/**
 * Migration Runner
 *
 * Executes database migrations using Drizzle Kit.
 * Includes RLS policy setup and validation.
 */

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { createDatabase, closeDatabase, type Database } from '../client.js';

// Get __dirname for migration folder resolution
// Since this is compiled to CJS, we use a simple approach that works in both modes
const __dirname = (() => {
  // In CJS mode, use process.cwd() as base (users typically override migrationsFolder anyway)
  // This avoids issues with import.meta.url being undefined in CJS
  return process.cwd();
})();

/**
 * Migration options
 */
export interface MigrationOptions {
  migrationsFolder?: string;
  applyRls?: boolean;
  validateAfter?: boolean;
  verbose?: boolean;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migrationsApplied: number;
  rlsApplied: boolean;
  validationPassed: boolean;
  errors: string[];
}

/**
 * Logger interface for migration output
 */
interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

const createLogger = (verbose: boolean): Logger => ({
  info: (message: string) => verbose && console.log(`[migrate] ${message}`),
  error: (message: string) => console.error(`[migrate] ERROR: ${message}`),
  warn: (message: string) => verbose && console.warn(`[migrate] WARN: ${message}`),
});

/**
 * Apply RLS policies to the database
 */
async function applyRlsPolicies(db: Database, logger: Logger): Promise<boolean> {
  try {
    logger.info('Applying RLS policies...');

    // Create helper functions
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION current_tenant_id()
      RETURNS uuid AS $$
        SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
      $$ LANGUAGE sql STABLE SECURITY DEFINER;
    `);

    await db.execute(sql`
      CREATE OR REPLACE FUNCTION current_user_id()
      RETURNS uuid AS $$
        SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
      $$ LANGUAGE sql STABLE SECURITY DEFINER;
    `);

    // Create service role if not exists
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END
      $$;
    `);

    // List of tenant-scoped tables
    const tenantTables = [
      'users',
      'projects',
      'tasks',
      'task_executions',
      'artifacts',
      'approvals',
      'agents',
      'lessons',
      'audit_logs',
    ];

    for (const tableName of tenantTables) {
      // Enable RLS
      await db.execute(
        sql.raw(`ALTER TABLE IF EXISTS ${tableName} ENABLE ROW LEVEL SECURITY`)
      );

      // Force RLS for table owners
      await db.execute(
        sql.raw(`ALTER TABLE IF EXISTS ${tableName} FORCE ROW LEVEL SECURITY`)
      );

      // Create tenant isolation policy
      await db.execute(
        sql.raw(`
          DROP POLICY IF EXISTS tenant_isolation ON ${tableName};
          CREATE POLICY tenant_isolation ON ${tableName}
            FOR ALL
            USING (tenant_id = current_tenant_id());
        `)
      );

      // Create service role bypass policy
      await db.execute(
        sql.raw(`
          DROP POLICY IF EXISTS service_role_bypass ON ${tableName};
          CREATE POLICY service_role_bypass ON ${tableName}
            FOR ALL
            TO service_role
            USING (true);
        `)
      );

      logger.info(`  RLS enabled on ${tableName}`);
    }

    // Tenants table has special policy (can only see own tenant)
    await db.execute(sql`
      ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS tenants FORCE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS tenant_self_isolation ON tenants;
      CREATE POLICY tenant_self_isolation ON tenants
        FOR ALL
        USING (id = current_tenant_id());

      DROP POLICY IF EXISTS service_role_bypass ON tenants;
      CREATE POLICY service_role_bypass ON tenants
        FOR ALL
        TO service_role
        USING (true);
    `);

    logger.info('RLS policies applied successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to apply RLS policies: ${error}`);
    return false;
  }
}

/**
 * Validate that RLS is properly configured
 */
async function validateRlsSetup(db: Database, logger: Logger): Promise<boolean> {
  try {
    logger.info('Validating RLS setup...');

    // Check that RLS is enabled on key tables
    const result = await db.execute(sql`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('tenants', 'projects', 'tasks', 'users', 'agents', 'lessons')
    `);

    const tables = result as unknown as { tablename: string; rowsecurity: boolean }[];

    for (const table of tables) {
      if (!table.rowsecurity) {
        logger.error(`RLS not enabled on table: ${table.tablename}`);
        return false;
      }
      logger.info(`  ✓ RLS enabled on ${table.tablename}`);
    }

    // Check that helper functions exist
    const functions = await db.execute(sql`
      SELECT proname
      FROM pg_proc
      WHERE proname IN ('current_tenant_id', 'current_user_id')
    `);

    if ((functions as unknown as { proname: string }[]).length < 2) {
      logger.error('Helper functions not found');
      return false;
    }

    logger.info('  ✓ Helper functions exist');
    logger.info('RLS validation passed');
    return true;
  } catch (error) {
    logger.error(`RLS validation failed: ${error}`);
    return false;
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(
  connectionString: string,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const {
    migrationsFolder = path.join(__dirname, '../../drizzle'),
    applyRls = true,
    validateAfter = true,
    verbose = false,
  } = options;

  const logger = createLogger(verbose);
  const errors: string[] = [];
  let migrationsApplied = 0;
  let rlsApplied = false;
  let validationPassed = false;

  let db: Database | null = null;

  try {
    logger.info('Starting database migration...');
    logger.info(`Connection: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
    logger.info(`Migrations folder: ${migrationsFolder}`);

    // Create database connection
    db = createDatabase({ connectionUrl: connectionString });

    // Run Drizzle migrations
    logger.info('Running schema migrations...');
    await migrate(db, { migrationsFolder });
    migrationsApplied = 1; // Drizzle handles counting internally
    logger.info('Schema migrations complete');

    // Apply RLS policies
    if (applyRls) {
      rlsApplied = await applyRlsPolicies(db, logger);
      if (!rlsApplied) {
        errors.push('Failed to apply RLS policies');
      }
    }

    // Validate setup
    if (validateAfter) {
      validationPassed = await validateRlsSetup(db, logger);
      if (!validationPassed) {
        errors.push('RLS validation failed');
      }
    } else {
      validationPassed = true;
    }

    logger.info('Migration complete');

    return {
      success: errors.length === 0,
      migrationsApplied,
      rlsApplied,
      validationPassed,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);
    logger.error(`Migration failed: ${errorMessage}`);

    return {
      success: false,
      migrationsApplied,
      rlsApplied,
      validationPassed,
      errors,
    };
  } finally {
    if (db) {
      await closeDatabase();
    }
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];

  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const result = await runMigrations(connectionString, {
    verbose: true,
    applyRls: true,
    validateAfter: true,
  });

  if (!result.success) {
    console.error('Migration failed with errors:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log('Migration completed successfully');
  console.log(`  Migrations applied: ${result.migrationsApplied}`);
  console.log(`  RLS applied: ${result.rlsApplied}`);
  console.log(`  Validation passed: ${result.validationPassed}`);
  process.exit(0);
}

// Run if called directly (ESM only - import.meta is undefined in CJS)
if (typeof import.meta !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
