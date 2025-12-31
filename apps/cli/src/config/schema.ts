/**
 * Configuration Schema
 *
 * Zod schemas for configuration validation.
 */

import { z } from 'zod';
import { CONFIG_DEFAULTS } from '../constants.js';

/**
 * API configuration schema
 */
export const ApiConfigSchema = z.object({
  port: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(CONFIG_DEFAULTS.API_PORT),
  remoteUrl: z.string().url().default(CONFIG_DEFAULTS.API_REMOTE_URL),
  token: z.string().default(''),
  timeout: z.coerce
    .number()
    .int()
    .positive()
    .default(CONFIG_DEFAULTS.REQUEST_TIMEOUT_MS),
});

/**
 * CLI behavior configuration schema
 */
export const CliConfigSchema = z.object({
  defaultMode: z.enum(['local', 'remote']).default('local'),
  outputFormat: z.enum(['pretty', 'json']).default('pretty'),
  streamEnabled: z.coerce.boolean().default(true),
});

/**
 * Project configuration schema
 */
export const ProjectConfigSchema = z.object({
  path: z.string().default(process.cwd()),
});

/**
 * Complete configuration schema
 */
export const ConfigSchema = z.object({
  api: ApiConfigSchema.default({}),
  cli: CliConfigSchema.default({}),
  project: ProjectConfigSchema.default({}),
});

export type ValidatedConfig = z.infer<typeof ConfigSchema>;

/**
 * Environment configuration schema
 */
export const EnvConfigSchema = z.object({
  AIGENTFLOW_API_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  AIGENTFLOW_API_URL: z.string().url().optional(),
  AIGENTFLOW_API_TOKEN: z.string().optional(),
  AIGENTFLOW_CLI_MODE: z.enum(['local', 'remote']).optional(),
  AIGENTFLOW_OUTPUT_FORMAT: z.enum(['pretty', 'json']).optional(),
  AIGENTFLOW_DEBUG: z.coerce.boolean().optional(),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

/**
 * Schema for the Conf library (global config store)
 */
export const ConfSchema = {
  api: {
    type: 'object' as const,
    properties: {
      port: { type: 'number' as const, default: CONFIG_DEFAULTS.API_PORT },
      remoteUrl: {
        type: 'string' as const,
        default: CONFIG_DEFAULTS.API_REMOTE_URL,
      },
      token: { type: 'string' as const, default: '' },
      timeout: {
        type: 'number' as const,
        default: CONFIG_DEFAULTS.REQUEST_TIMEOUT_MS,
      },
    },
  },
  cli: {
    type: 'object' as const,
    properties: {
      defaultMode: {
        type: 'string' as const,
        enum: ['local', 'remote'],
        default: 'local',
      },
      outputFormat: {
        type: 'string' as const,
        enum: ['pretty', 'json'],
        default: 'pretty',
      },
      streamEnabled: { type: 'boolean' as const, default: true },
    },
  },
  project: {
    type: 'object' as const,
    properties: {
      path: { type: 'string' as const },
    },
  },
};
