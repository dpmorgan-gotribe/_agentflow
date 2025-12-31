/**
 * CLI Constants
 *
 * Centralized constants for the Aigentflow CLI.
 */

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  TASKS: '/api/v1/tasks',
  TASK_BY_ID: (id: string) => `/api/v1/tasks/${encodeURIComponent(id)}`,
  TASK_APPROVE: (id: string) =>
    `/api/v1/tasks/${encodeURIComponent(id)}/approve`,
  TASK_STREAM: (id: string) => `/api/v1/tasks/${encodeURIComponent(id)}/stream`,
} as const;

/**
 * Default configuration values
 */
export const CONFIG_DEFAULTS = {
  API_PORT: 3000,
  API_REMOTE_URL: 'https://api.aigentflow.io',
  REQUEST_TIMEOUT_MS: 30000,
  STREAM_RECONNECT_MS: 5000,
  POLL_INTERVAL_MS: 2000,
  MAX_POLL_RETRIES: 150,
} as const;

/**
 * CLI limits for security and performance
 */
export const CLI_LIMITS = {
  MAX_PROMPT_LENGTH: 100000,
  MAX_PROJECT_PATH_LENGTH: 4096,
  MAX_MESSAGE_SIZE: 1048576, // 1MB
  MAX_ARTIFACT_DISPLAY_SIZE: 50000,
  MIN_POLL_INTERVAL_MS: 1000,
  MAX_POLL_INTERVAL_MS: 30000,
} as const;

/**
 * User-facing messages
 */
export const MESSAGES = {
  WELCOME: 'Aigentflow - AI-powered development orchestrator',
  INIT_SUCCESS: 'Project initialized!',
  INIT_CANCELLED: 'Initialization cancelled',
  INIT_EXISTS: 'Project already initialized',
  TASK_CREATED: (id: string) => `Task created: ${id}`,
  TASK_RUNNING: 'Processing...',
  TASK_COMPLETED: 'Task completed successfully',
  TASK_FAILED: (error: string) => `Task failed: ${error}`,
  TASK_AWAITING_APPROVAL: 'Task awaiting approval',
  APPROVAL_HINT: (taskId: string) => `Run: aigentflow approve ${taskId}`,
  APPROVAL_SUCCESS: 'Task approved, continuing execution...',
  APPROVAL_REJECTED: 'Task rejected',
  CONFIG_SAVED: 'Configuration saved',
  CONNECTION_ERROR: 'Failed to connect to API',
  STREAMING_CONNECTED: 'Connected to task stream',
  STREAMING_DISCONNECTED: 'Disconnected from task stream',
} as const;

/**
 * Environment variable names
 */
export const ENV_VARS = {
  API_PORT: 'AIGENTFLOW_API_PORT',
  API_URL: 'AIGENTFLOW_API_URL',
  API_TOKEN: 'AIGENTFLOW_API_TOKEN',
  CLI_MODE: 'AIGENTFLOW_CLI_MODE',
  OUTPUT_FORMAT: 'AIGENTFLOW_OUTPUT_FORMAT',
  DEBUG: 'AIGENTFLOW_DEBUG',
} as const;

/**
 * Project file names
 */
export const PROJECT_FILES = {
  CONFIG: '.aigentflow.json',
  STATE_DIR: '.aigentflow',
  GITIGNORE: '.gitignore',
} as const;

/**
 * Agent colors for terminal output
 */
export const AGENT_COLORS: Record<string, string> = {
  orchestrator: 'magenta',
  project_manager: 'blue',
  architect: 'cyan',
  ui_designer: 'yellow',
  frontend_dev: 'green',
  backend_dev: 'red',
  tester: 'gray',
  reviewer: 'white',
} as const;

/**
 * Available agents for project initialization
 */
export const AVAILABLE_AGENTS = [
  { name: 'UI Designer', value: 'ui_designer' },
  { name: 'Frontend Developer', value: 'frontend_dev' },
  { name: 'Backend Developer', value: 'backend_dev' },
  { name: 'Tester', value: 'tester' },
  { name: 'Reviewer', value: 'reviewer' },
] as const;

/**
 * Sensitive patterns for error sanitization
 */
export const SENSITIVE_PATTERNS = [
  /Bearer [A-Za-z0-9\-_.]+/g,
  /api[_-]?key['":]?\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi,
  /password['":]?\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi,
  /token['":]?\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi,
  /secret['":]?\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi,
  /authorization['":]?\s*[:=]\s*['"]?([^'"\s]+)['"]?/gi,
] as const;
