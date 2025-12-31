/**
 * Integration Types
 *
 * Types and Zod schemas for component integration, event bus,
 * and lifecycle management.
 */

import { z } from 'zod';

// ============================================
// System Event Types
// ============================================

/**
 * All system event types as constants
 */
export const SystemEvents = {
  // Lifecycle events
  SYSTEM_STARTED: 'system:started',
  SYSTEM_STOPPING: 'system:stopping',
  SYSTEM_STOPPED: 'system:stopped',

  // State machine events
  STATE_TRANSITION: 'state:transition',
  STATE_ERROR: 'state:error',

  // Agent events
  AGENT_SPAWNING: 'agent:spawning',
  AGENT_SPAWNED: 'agent:spawned',
  AGENT_COMPLETED: 'agent:completed',
  AGENT_FAILED: 'agent:failed',

  // Hook events
  HOOK_EXECUTING: 'hook:executing',
  HOOK_COMPLETED: 'hook:completed',
  HOOK_BLOCKED: 'hook:blocked',

  // Checkpoint events
  CHECKPOINT_CREATED: 'checkpoint:created',
  CHECKPOINT_RESTORED: 'checkpoint:restored',

  // Audit events
  AUDIT_EVENT: 'audit:event',

  // Security events
  SECRET_DETECTED: 'security:secret_detected',
  GUARDRAIL_TRIGGERED: 'security:guardrail_triggered',

  // User events
  APPROVAL_REQUESTED: 'user:approval_requested',
  APPROVAL_RECEIVED: 'user:approval_received',
} as const;

export type SystemEventType = (typeof SystemEvents)[keyof typeof SystemEvents];

/**
 * Allowed event sources (whitelist for security)
 */
export const AllowedEventSources = [
  'system',
  'state_machine',
  'checkpoint_manager',
  'audit_logger',
  'hook_engine',
  'guardrails',
  'prompt_manager',
  'cli',
  'api',
  'agent',
  'orchestrator',
  'bootstrap',
  'error_handler',
] as const;

export type AllowedEventSource = (typeof AllowedEventSources)[number];

/**
 * System event schema with validation
 */
export const SystemEventSchema = z.object({
  type: z.string().min(1).max(100),
  source: z.enum(AllowedEventSources),
  timestamp: z.date(),
  data: z.unknown(),
  correlationId: z.string().uuid().optional(),
});

export type SystemEvent = z.infer<typeof SystemEventSchema>;

/**
 * Event history filter options
 */
export const EventHistoryFilterSchema = z.object({
  type: z.string().optional(),
  source: z.string().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  correlationId: z.string().uuid().optional(),
  limit: z.number().int().positive().max(10000).default(1000),
  offset: z.number().int().nonnegative().default(0),
});

export type EventHistoryFilter = z.infer<typeof EventHistoryFilterSchema>;

/**
 * Event bus configuration
 */
export const EventBusConfigSchema = z.object({
  maxHistory: z.number().int().positive().default(1000),
  maxEventsPerSecond: z.number().int().positive().default(100),
  validateEvents: z.boolean().default(true),
});

export type EventBusConfig = z.infer<typeof EventBusConfigSchema>;

export const DEFAULT_EVENT_BUS_CONFIG: EventBusConfig = {
  maxHistory: 1000,
  maxEventsPerSecond: 100,
  validateEvents: true,
};

// ============================================
// Component Types
// ============================================

/**
 * Health check result
 */
export const HealthCheckResultSchema = z.object({
  healthy: z.boolean(),
  details: z.unknown().optional(),
  timestamp: z.date().optional(),
});

export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

/**
 * Component interface (runtime validated)
 */
export interface Component {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];

  initialize(config: unknown): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
}

/**
 * Component metadata schema for registration validation
 */
export const ComponentMetadataSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(50),
  dependencies: z.array(z.string().min(1).max(100)),
});

export type ComponentMetadata = z.infer<typeof ComponentMetadataSchema>;

/**
 * Component state for lifecycle tracking
 */
export type ComponentState =
  | 'unregistered'
  | 'registered'
  | 'initializing'
  | 'initialized'
  | 'shutting_down'
  | 'shutdown'
  | 'failed';

/**
 * Component status with state
 */
export interface ComponentStatus {
  name: string;
  state: ComponentState;
  initializedAt?: Date;
  shutdownAt?: Date;
  error?: string;
}

// ============================================
// Bootstrap Types
// ============================================

/**
 * Bootstrap phases in initialization order
 */
export const BootstrapPhases = [
  'configuration',
  'database',
  'persistence',
  'audit',
  'hooks',
  'guardrails',
  'prompts',
  'state_machine',
  'checkpoints',
  'generators',
  'cli',
] as const;

export type BootstrapPhase = (typeof BootstrapPhases)[number];

/**
 * Bootstrap phase status
 */
export const BootstrapPhaseStatusSchema = z.object({
  phase: z.enum(BootstrapPhases),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  error: z.string().optional(),
  duration: z.number().int().nonnegative().optional(),
});

export type BootstrapPhaseStatus = z.infer<typeof BootstrapPhaseStatusSchema>;

/**
 * Complete bootstrap state
 */
export interface BootstrapState {
  phases: BootstrapPhaseStatus[];
  totalDuration?: number;
  ready: boolean;
  sealed: boolean;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Bootstrap configuration
 */
export const BootstrapConfigSchema = z.object({
  initializationTimeout: z.number().int().positive().default(30000),
  shutdownTimeout: z.number().int().positive().default(10000),
  healthCheckInterval: z.number().int().positive().default(30000),
  enableHealthChecks: z.boolean().default(true),
});

export type BootstrapConfig = z.infer<typeof BootstrapConfigSchema>;

export const DEFAULT_BOOTSTRAP_CONFIG: BootstrapConfig = {
  initializationTimeout: 30000,
  shutdownTimeout: 10000,
  healthCheckInterval: 30000,
  enableHealthChecks: true,
};

// ============================================
// Configuration Types
// ============================================

/**
 * Configuration source priority levels
 */
export const ConfigurationSources = [
  'defaults',
  'system',
  'environment',
  'user',
  'project',
  'cli',
] as const;

export type ConfigurationSource = (typeof ConfigurationSources)[number];

/**
 * Configuration override tracking
 */
export interface ConfigurationOverride {
  key: string;
  from: ConfigurationSource;
  to: ConfigurationSource;
}

/**
 * Configuration load result
 */
export interface ConfigurationLoadResult {
  source: ConfigurationSource;
  timestamp: Date;
  overrides: ConfigurationOverride[];
  config: Record<string, unknown>;
}

// ============================================
// Error Handler Types
// ============================================

/**
 * Error context for handling
 */
export const ErrorContextSchema = z.object({
  component: z.string().min(1).max(100),
  operation: z.string().min(1).max(200),
  correlationId: z.string().uuid().optional(),
  level: z.enum(['user', 'agent', 'system']).optional(),
  canRetry: z.boolean().optional(),
  retryCount: z.number().int().nonnegative().optional(),
});

export type ErrorContext = z.infer<typeof ErrorContextSchema>;

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult {
  recovered: boolean;
  action: 'retry' | 'escalate' | 'ignore' | 'abort';
  message?: string;
}

/**
 * Retry policy configuration
 */
export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().nonnegative().default(3),
  baseDelay: z.number().int().positive().default(1000),
  maxDelay: z.number().int().positive().default(30000),
  backoffMultiplier: z.number().positive().default(2),
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

// ============================================
// Constants & Limits
// ============================================

/**
 * Integration system limits
 */
export const INTEGRATION_LIMITS = {
  maxEventHistory: 10000,
  maxComponents: 100,
  maxDependencyDepth: 20,
  maxEventSize: 1024 * 1024, // 1MB
  maxShutdownWait: 60000, // 60s
  maxInitializationWait: 120000, // 2 min
} as const;

/**
 * Critical events that require additional validation
 */
export const CRITICAL_EVENTS: SystemEventType[] = [
  SystemEvents.CHECKPOINT_RESTORED,
  SystemEvents.STATE_TRANSITION,
  SystemEvents.SECRET_DETECTED,
  SystemEvents.GUARDRAIL_TRIGGERED,
];
