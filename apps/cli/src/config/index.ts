/**
 * Configuration Module
 *
 * Exports configuration utilities for the CLI.
 */

export type { Config, ApiConfig, CliConfig, ProjectLocalConfig, PartialConfig } from './types.js';

export {
  ConfigSchema,
  ApiConfigSchema,
  CliConfigSchema,
  ProjectConfigSchema,
  EnvConfigSchema,
  ConfSchema,
  type ValidatedConfig,
  type EnvConfig,
} from './schema.js';

export {
  loadConfig,
  saveGlobalConfig,
  saveProjectConfig,
  getGlobalConfigPath,
  clearGlobalConfig,
} from './loader.js';
