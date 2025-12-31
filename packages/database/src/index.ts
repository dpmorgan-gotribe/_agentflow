/**
 * @aigentflow/database
 *
 * PostgreSQL database client with Row-Level Security (RLS)
 * for multi-tenant isolation using Drizzle ORM.
 */

export const DATABASE_VERSION = '0.0.0';

// Database client and connection management
export {
  createDatabase,
  getDatabase,
  closeDatabase,
  isDatabaseHealthy,
  getConnectionStats,
  withTenant,
  type Database,
  type DatabaseConfig,
  type TenantContext,
} from './client.js';

// Re-export all schemas for convenience
export * from './schema/index.js';

// Re-export all repositories
export * from './repositories/index.js';

// Re-export migration runner
export { runMigrations, type MigrationOptions, type MigrationResult } from './migrations/runner.js';
