import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit Configuration
 *
 * Used for generating and running database migrations.
 * Requires DATABASE_URL environment variable.
 */
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/aigentflow',
  },
  verbose: true,
  strict: true,
});
