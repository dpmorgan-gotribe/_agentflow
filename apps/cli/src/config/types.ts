/**
 * Configuration Types
 *
 * Type definitions for CLI configuration.
 */

import type { ExecutionMode, OutputFormat } from '../types.js';

/**
 * API configuration section
 */
export interface ApiConfig {
  port: number;
  remoteUrl: string;
  token: string;
  timeout: number;
}

/**
 * CLI behavior configuration section
 */
export interface CliConfig {
  defaultMode: ExecutionMode;
  outputFormat: OutputFormat;
  streamEnabled: boolean;
}

/**
 * Project configuration section
 */
export interface ProjectLocalConfig {
  path: string;
}

/**
 * Complete CLI configuration
 */
export interface Config {
  api: ApiConfig;
  cli: CliConfig;
  project: ProjectLocalConfig;
}

/**
 * Partial configuration for merging
 */
export type PartialConfig = {
  api?: Partial<ApiConfig>;
  cli?: Partial<CliConfig>;
  project?: Partial<ProjectLocalConfig>;
};
