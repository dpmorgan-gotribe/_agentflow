/**
 * Database Client
 *
 * PostgreSQL client with RLS tenant context management.
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { z } from 'zod';

import * as schema from './schema/index.js';

/**
 * Database URL validation schema
 */
const databaseUrlSchema = z
  .string()
  .min(1, 'DATABASE_URL is required')
  .refine(
    (url: string) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:'
        );
      } catch {
        return false;
      }
    },
    { message: 'DATABASE_URL must be a valid PostgreSQL connection string' }
  );

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /**
   * PostgreSQL connection URL
   */
  connectionUrl: string;

  /**
   * Maximum number of connections in the pool
   * @default 10
   */
  maxConnections?: number;

  /**
   * Idle connection timeout in seconds
   * @default 20
   */
  idleTimeout?: number;

  /**
   * Connection timeout in seconds
   * @default 10
   */
  connectTimeout?: number;

  /**
   * Enable SSL/TLS connection
   * @default false for localhost, true otherwise
   */
  ssl?: boolean | 'require' | 'prefer';
}

/**
 * Database instance type with schema
 */
export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Tenant context for RLS
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
}

/**
 * Connection pool instance (module-level singleton)
 */
let connectionPool: ReturnType<typeof postgres> | null = null;
let databaseInstance: Database | null = null;

/**
 * Create and configure the database connection
 *
 * @param config - Database configuration
 * @returns Configured database instance
 * @throws Error if connection URL is invalid
 */
export function createDatabase(config: DatabaseConfig): Database {
  // Validate connection URL
  const validatedUrl = databaseUrlSchema.parse(config.connectionUrl);

  // Determine SSL settings
  const parsedUrl = new URL(validatedUrl);
  const isLocalhost =
    parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
  const ssl = config.ssl ?? (isLocalhost ? false : 'require');

  // Create connection pool
  connectionPool = postgres(validatedUrl, {
    max: config.maxConnections ?? 10,
    idle_timeout: config.idleTimeout ?? 20,
    connect_timeout: config.connectTimeout ?? 10,
    ssl: ssl === false ? false : ssl,
    prepare: false, // Required for transaction-level RLS
  });

  // Create drizzle instance with schema
  databaseInstance = drizzle(connectionPool, { schema });

  return databaseInstance;
}

/**
 * Get the current database instance
 *
 * @returns Database instance
 * @throws Error if database not initialized
 */
export function getDatabase(): Database {
  if (!databaseInstance) {
    throw new Error('Database not initialized. Call createDatabase() first.');
  }
  return databaseInstance;
}

/**
 * Execute a callback within a tenant context (RLS)
 *
 * Sets the tenant context for Row-Level Security policies
 * and executes the callback within a transaction.
 *
 * @param context - Tenant context with tenantId and optional userId
 * @param callback - Function to execute within the tenant context
 * @returns Result of the callback
 */
export async function withTenant<T>(
  context: TenantContext,
  callback: (db: Database) => Promise<T>
): Promise<T> {
  // Ensure database is initialized (validates instance exists)
  getDatabase();

  if (!connectionPool) {
    throw new Error('Connection pool not initialized');
  }

  // Validate tenant ID format (UUID)
  const uuidSchema = z.string().uuid();
  const validatedTenantId = uuidSchema.parse(context.tenantId);

  // Execute within a transaction with RLS context
  const result = await connectionPool.begin(async (tx): Promise<T> => {
    // Set the tenant context for RLS policies
    // Using parameterized query to prevent SQL injection
    await tx.unsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, [
      validatedTenantId,
    ]);

    if (context.userId) {
      const validatedUserId = uuidSchema.parse(context.userId);
      await tx.unsafe(`SELECT set_config('app.current_user_id', $1, true)`, [
        validatedUserId,
      ]);
    }

    // Create a transaction-scoped drizzle instance
    const txDb = drizzle(tx, { schema });

    // Execute the callback
    return callback(txDb as Database);
  });

  return result as T;
}

/**
 * Close the database connection pool
 *
 * Should be called during application shutdown.
 */
export async function closeDatabase(): Promise<void> {
  if (connectionPool) {
    await connectionPool.end();
    connectionPool = null;
    databaseInstance = null;
  }
}

/**
 * Health check for database connection
 *
 * @returns true if database is reachable
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    if (!connectionPool) {
      return false;
    }
    await connectionPool`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get connection pool statistics
 *
 * @returns Connection pool stats or null if not initialized
 */
export function getConnectionStats(): {
  total: number;
  idle: number;
  pending: number;
} | null {
  if (!connectionPool) {
    return null;
  }

  return {
    total: connectionPool.options.max ?? 10,
    idle: 0, // postgres.js doesn't expose this directly
    pending: 0,
  };
}
