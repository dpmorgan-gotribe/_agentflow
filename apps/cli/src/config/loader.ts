/**
 * Configuration Loader
 *
 * Loads configuration from multiple sources with hierarchy:
 * environment variables > project config > global config > defaults
 */

import Conf from 'conf';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import type { Config, PartialConfig } from './types.js';
import { ConfigSchema, ConfSchema, EnvConfigSchema } from './schema.js';
import { CONFIG_DEFAULTS, ENV_VARS, PROJECT_FILES } from '../constants.js';
import { ConfigValidationError } from '../errors.js';

/**
 * Global configuration store
 */
const globalConfig = new Conf<PartialConfig>({
  projectName: 'aigentflow',
  schema: ConfSchema,
  // File permissions: owner read/write only (0600)
  configFileMode: 0o600,
});

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Config,
  source: PartialConfig
): Config {
  return {
    api: {
      ...target.api,
      ...(source.api || {}),
    },
    cli: {
      ...target.cli,
      ...(source.cli || {}),
    },
    project: {
      ...target.project,
      ...(source.project || {}),
    },
  };
}

/**
 * Load project configuration from .aigentflow.json
 */
function loadProjectConfig(cwd: string): PartialConfig {
  const configPath = join(cwd, PROJECT_FILES.CONFIG);

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return parsed as PartialConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigValidationError(
        `Invalid JSON in ${PROJECT_FILES.CONFIG}`,
        'projectConfig',
        { path: configPath, error: error.message }
      );
    }
    // File read errors are not fatal - just skip project config
    return {};
  }
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): PartialConfig {
  const env: Record<string, string | undefined> = {
    AIGENTFLOW_API_PORT: process.env[ENV_VARS.API_PORT],
    AIGENTFLOW_API_URL: process.env[ENV_VARS.API_URL],
    AIGENTFLOW_API_TOKEN: process.env[ENV_VARS.API_TOKEN],
    AIGENTFLOW_CLI_MODE: process.env[ENV_VARS.CLI_MODE],
    AIGENTFLOW_OUTPUT_FORMAT: process.env[ENV_VARS.OUTPUT_FORMAT],
    AIGENTFLOW_DEBUG: process.env[ENV_VARS.DEBUG],
  };

  // Filter out undefined values
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && value !== '') {
      filtered[key] = value;
    }
  }

  // If no env vars set, return empty config
  if (Object.keys(filtered).length === 0) {
    return {};
  }

  // Validate environment variables
  const result = EnvConfigSchema.safeParse(filtered);
  if (!result.success) {
    // Non-fatal: log warning and continue
    console.warn('Warning: Invalid environment variable configuration');
    return {};
  }

  const envConfig = result.data;
  const config: PartialConfig = {};

  // Map environment variables to config structure
  if (envConfig.AIGENTFLOW_API_PORT !== undefined) {
    config.api = { ...config.api, port: envConfig.AIGENTFLOW_API_PORT };
  }
  if (envConfig.AIGENTFLOW_API_URL !== undefined) {
    config.api = { ...config.api, remoteUrl: envConfig.AIGENTFLOW_API_URL };
  }
  if (envConfig.AIGENTFLOW_API_TOKEN !== undefined) {
    config.api = { ...config.api, token: envConfig.AIGENTFLOW_API_TOKEN };
  }
  if (envConfig.AIGENTFLOW_CLI_MODE !== undefined) {
    config.cli = { ...config.cli, defaultMode: envConfig.AIGENTFLOW_CLI_MODE };
  }
  if (envConfig.AIGENTFLOW_OUTPUT_FORMAT !== undefined) {
    config.cli = {
      ...config.cli,
      outputFormat: envConfig.AIGENTFLOW_OUTPUT_FORMAT,
    };
  }

  return config;
}

/**
 * Get default configuration
 */
function getDefaultConfig(): Config {
  return {
    api: {
      port: CONFIG_DEFAULTS.API_PORT,
      remoteUrl: CONFIG_DEFAULTS.API_REMOTE_URL,
      token: '',
      timeout: CONFIG_DEFAULTS.REQUEST_TIMEOUT_MS,
    },
    cli: {
      defaultMode: 'local',
      outputFormat: 'pretty',
      streamEnabled: true,
    },
    project: {
      path: process.cwd(),
    },
  };
}

/**
 * Load configuration with priority:
 * env vars > project config > global config > defaults
 */
export function loadConfig(): Config {
  // Start with defaults
  let config = getDefaultConfig();

  // Merge global config
  const global = globalConfig.store;
  config = deepMerge(config, global);

  // Merge project config
  const projectConfig = loadProjectConfig(process.cwd());
  config = deepMerge(config, projectConfig);

  // Merge environment variables (highest priority)
  const envConfig = loadEnvConfig();
  config = deepMerge(config, envConfig);

  // Validate final config
  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    throw new ConfigValidationError(
      'Invalid configuration',
      'config',
      result.error.format()
    );
  }

  return result.data;
}

/**
 * Save configuration to global store
 */
export function saveGlobalConfig(updates: PartialConfig): void {
  const current = globalConfig.store;
  const merged: PartialConfig = {
    api: {
      ...(current.api || {}),
      ...(updates.api || {}),
    },
    cli: {
      ...(current.cli || {}),
      ...(updates.cli || {}),
    },
    project: {
      ...(current.project || {}),
      ...(updates.project || {}),
    },
  };
  globalConfig.store = merged;
}

/**
 * Save project configuration to .aigentflow.json
 */
export function saveProjectConfig(
  config: Record<string, unknown>,
  cwd: string = process.cwd()
): void {
  const configPath = join(cwd, PROJECT_FILES.CONFIG);
  const content = JSON.stringify(config, null, 2);

  writeFileSync(configPath, content, 'utf-8');

  // Set secure permissions (owner read/write only)
  try {
    chmodSync(configPath, 0o600);
  } catch {
    // chmod may fail on Windows, non-fatal
  }
}

/**
 * Get the path to the global config file
 */
export function getGlobalConfigPath(): string {
  return globalConfig.path;
}

/**
 * Clear all global configuration
 */
export function clearGlobalConfig(): void {
  globalConfig.clear();
}
