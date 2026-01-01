/**
 * Environment Variable Validation Schema
 *
 * Validates all required environment variables at startup.
 * Prevents the application from running with invalid configuration.
 */

import { z } from 'zod';

/**
 * Database URL validation
 * PostgreSQL is required in production, optional in development (uses in-memory storage)
 */
const databaseUrlSchema = z
  .string()
  .optional()
  .refine(
    (url) => {
      // Optional in development
      if (!url && process.env.NODE_ENV === 'development') {
        return true;
      }
      // Required in production
      if (!url) {
        return false;
      }
      // Must be valid PostgreSQL URL if provided
      try {
        const parsed = new URL(url);
        return (
          parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:'
        );
      } catch {
        return false;
      }
    },
    { message: 'DATABASE_URL must be a valid PostgreSQL connection string (optional in development)' }
  );

/**
 * JWT Secret validation - minimum 32 characters for security
 */
const jwtSecretSchema = z
  .string()
  .min(32, 'JWT_SECRET must be at least 32 characters for security');

/**
 * CORS origins validation - no wildcards in production
 */
const corsOriginsSchema = z
  .string()
  .min(1, 'CORS_ORIGINS is required')
  .refine(
    (origins) => {
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'production' && origins.includes('*')) {
        return false;
      }
      return true;
    },
    { message: 'CORS_ORIGINS cannot contain wildcard (*) in production' }
  );

/**
 * Complete environment schema
 */
export const envSchema = z.object({
  // Server configuration
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: databaseUrlSchema,

  // Authentication
  JWT_SECRET: jwtSecretSchema,
  JWT_EXPIRES_IN: z.string().default('1h'),

  // Security
  CORS_ORIGINS: corsOriginsSchema,
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // Optional: External services
  QDRANT_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * @throws ZodError if validation fails
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}
