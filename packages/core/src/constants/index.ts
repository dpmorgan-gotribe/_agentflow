/**
 * Core constants for Aigentflow.
 */

/**
 * Application metadata.
 */
export const APP_NAME = 'Aigentflow';
export const APP_VERSION = '0.0.0';

/**
 * Default configuration values.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY_MS = 1_000;

/**
 * Agent configuration defaults.
 */
export const MAX_CONCURRENT_AGENTS = 15;
export const AGENT_HEARTBEAT_INTERVAL_MS = 5_000;
export const AGENT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Database configuration.
 */
export const DB_MAX_CONNECTIONS = 20;
export const DB_IDLE_TIMEOUT_MS = 10_000;

/**
 * Queue configuration.
 */
export const QUEUE_MAX_RETRIES = 3;
export const QUEUE_BACKOFF_MS = 1_000;
