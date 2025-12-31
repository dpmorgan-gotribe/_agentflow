/**
 * Activity System Types
 *
 * Defines types for real-time activity streaming.
 *
 * Security features:
 * - Zod validation for all schemas
 * - UUID validation for IDs
 * - Max length constraints on strings
 * - Bounded arrays to prevent payload abuse
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * Max lengths for security
 */
export const MAX_ID_LENGTH = 100;
export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_SESSION_ID_LENGTH = 100;
export const MAX_WORKFLOW_ID_LENGTH = 100;
export const MAX_EVENTS_IN_MEMORY = 10000;
export const MAX_DETAILS_DEPTH = 5;

/**
 * Safe ID pattern (UUID or simple ID)
 */
export const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;

// ============================================================================
// Activity Types Enum
// ============================================================================

/**
 * Activity event types
 */
export const ActivityTypeSchema = z.enum([
  // Workflow events
  'workflow_start',
  'workflow_complete',
  'workflow_error',
  'workflow_pause',
  'workflow_resume',

  // State events
  'state_enter',
  'state_exit',
  'state_transition',

  // Agent events
  'agent_start',
  'agent_thinking',
  'agent_progress',
  'agent_output',
  'agent_complete',
  'agent_error',

  // File events
  'file_read',
  'file_write',
  'file_delete',

  // Git events
  'git_operation',
  'git_commit',
  'git_push',
  'git_conflict',

  // User events
  'user_input',
  'user_approval',
  'user_rejection',

  // System events
  'system_message',
  'system_warning',
  'system_error',

  // Progress events
  'progress_update',
  'task_start',
  'task_complete',

  // Design events
  'design_generated',
  'design_approved',
  'design_rejected',
  'mockup_created',
  'tokens_extracted',
]);

export type ActivityType = z.infer<typeof ActivityTypeSchema>;

// ============================================================================
// Activity Category
// ============================================================================

/**
 * Activity categories for filtering
 */
export const ActivityCategorySchema = z.enum([
  'workflow',
  'agent',
  'file',
  'git',
  'user',
  'system',
  'progress',
  'design',
]);

export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;

// ============================================================================
// Activity Severity
// ============================================================================

/**
 * Activity severity levels
 */
export const ActivitySeveritySchema = z.enum([
  'debug',
  'info',
  'success',
  'warning',
  'error',
]);

export type ActivitySeverity = z.infer<typeof ActivitySeveritySchema>;

// ============================================================================
// Progress Schema
// ============================================================================

/**
 * Progress information
 */
export const ProgressInfoSchema = z.object({
  current: z.number().int().min(0),
  total: z.number().int().min(1),
  percentage: z.number().min(0).max(100),
});

export type ProgressInfo = z.infer<typeof ProgressInfoSchema>;

// ============================================================================
// Activity Event Schema
// ============================================================================

/**
 * Activity event schema with validation
 */
export const ActivityEventSchema = z.object({
  // Identity
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sequence: z.number().int().positive(),

  // Classification
  type: ActivityTypeSchema,
  category: ActivityCategorySchema,
  severity: ActivitySeveritySchema,

  // Context
  sessionId: z.string().max(MAX_SESSION_ID_LENGTH),
  workflowId: z.string().max(MAX_WORKFLOW_ID_LENGTH).optional(),
  agentId: z.string().max(MAX_ID_LENGTH).optional(),

  // Content
  title: z.string().max(MAX_TITLE_LENGTH),
  message: z.string().max(MAX_MESSAGE_LENGTH),
  details: z.record(z.unknown()).optional(),

  // Progress
  progress: ProgressInfoSchema.optional(),

  // Duration in milliseconds
  duration: z.number().int().min(0).optional(),

  // Correlation for tracking related events
  parentId: z.string().uuid().optional(),
  correlationId: z.string().uuid().optional(),
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

// ============================================================================
// Subscription Filter
// ============================================================================

/**
 * Filter for event subscriptions
 */
export interface SubscriptionFilter {
  types?: ActivityType[];
  categories?: ActivityCategory[];
  severities?: ActivitySeverity[];
  agentIds?: string[];
  workflowId?: string;
}

/**
 * Subscription filter schema for validation
 */
export const SubscriptionFilterSchema = z.object({
  types: z.array(ActivityTypeSchema).max(50).optional(),
  categories: z.array(ActivityCategorySchema).max(10).optional(),
  severities: z.array(ActivitySeveritySchema).max(5).optional(),
  agentIds: z.array(z.string().max(MAX_ID_LENGTH)).max(50).optional(),
  workflowId: z.string().max(MAX_WORKFLOW_ID_LENGTH).optional(),
});

// ============================================================================
// Event Handler
// ============================================================================

/**
 * Event handler function type
 */
export type EventHandler = (event: ActivityEvent) => void | Promise<void>;

// ============================================================================
// Subscription
// ============================================================================

/**
 * Event subscription
 */
export interface Subscription {
  id: string;
  filter: SubscriptionFilter;
  handler: EventHandler;
  createdAt: Date;
}

// ============================================================================
// Display Format
// ============================================================================

/**
 * Display format for CLI output
 */
export type DisplayFormat = 'simple' | 'detailed' | 'json' | 'compact';

export const DisplayFormatSchema = z.enum(['simple', 'detailed', 'json', 'compact']);

// ============================================================================
// Stream Configuration
// ============================================================================

/**
 * Activity stream configuration
 */
export interface ActivityStreamConfig {
  persistEvents: boolean;
  maxEventsInMemory: number;
  enableDebugEvents: boolean;
}

export const ActivityStreamConfigSchema = z.object({
  persistEvents: z.boolean().default(true),
  maxEventsInMemory: z.number().int().min(100).max(MAX_EVENTS_IN_MEMORY).default(1000),
  enableDebugEvents: z.boolean().default(false),
});

// ============================================================================
// Persistence Configuration
// ============================================================================

/**
 * Persistence configuration
 */
export interface ActivityPersistenceConfig {
  basePath: string;
  retentionHours: number;
  maxEventsPerFile: number;
}

export const ActivityPersistenceConfigSchema = z.object({
  basePath: z.string().min(1).max(500),
  retentionHours: z.number().int().min(1).max(8760), // Max 1 year
  maxEventsPerFile: z.number().int().min(100).max(100000),
});

// ============================================================================
// Type-to-Category Mapping
// ============================================================================

/**
 * Mapping from activity type to category
 */
export const TYPE_CATEGORIES: Record<ActivityType, ActivityCategory> = {
  // Workflow
  workflow_start: 'workflow',
  workflow_complete: 'workflow',
  workflow_error: 'workflow',
  workflow_pause: 'workflow',
  workflow_resume: 'workflow',
  state_enter: 'workflow',
  state_exit: 'workflow',
  state_transition: 'workflow',

  // Agent
  agent_start: 'agent',
  agent_thinking: 'agent',
  agent_progress: 'agent',
  agent_output: 'agent',
  agent_complete: 'agent',
  agent_error: 'agent',

  // File
  file_read: 'file',
  file_write: 'file',
  file_delete: 'file',

  // Git
  git_operation: 'git',
  git_commit: 'git',
  git_push: 'git',
  git_conflict: 'git',

  // User
  user_input: 'user',
  user_approval: 'user',
  user_rejection: 'user',

  // System
  system_message: 'system',
  system_warning: 'system',
  system_error: 'system',

  // Progress
  progress_update: 'progress',
  task_start: 'progress',
  task_complete: 'progress',

  // Design
  design_generated: 'design',
  design_approved: 'design',
  design_rejected: 'design',
  mockup_created: 'design',
  tokens_extracted: 'design',
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate an activity event
 */
export function validateActivityEvent(
  event: unknown
): { success: true; data: ActivityEvent } | { success: false; error: z.ZodError } {
  const result = ActivityEventSchema.safeParse(event);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate a subscription filter
 */
export function validateSubscriptionFilter(
  filter: unknown
): { success: true; data: SubscriptionFilter } | { success: false; error: z.ZodError } {
  const result = SubscriptionFilterSchema.safeParse(filter);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create a safe activity event (partial, for convenience methods)
 */
export function createActivityEvent(partial: Partial<ActivityEvent>): ActivityEvent {
  const now = new Date().toISOString();
  const event: ActivityEvent = {
    id: partial.id ?? crypto.randomUUID(),
    timestamp: partial.timestamp ?? now,
    sequence: partial.sequence ?? 0,
    type: partial.type ?? 'system_message',
    category: partial.category ?? TYPE_CATEGORIES[partial.type ?? 'system_message'],
    severity: partial.severity ?? 'info',
    sessionId: partial.sessionId ?? 'unknown',
    workflowId: partial.workflowId,
    agentId: partial.agentId,
    title: partial.title ?? 'Event',
    message: partial.message ?? partial.title ?? 'Event',
    details: partial.details,
    progress: partial.progress,
    duration: partial.duration,
    parentId: partial.parentId,
    correlationId: partial.correlationId,
  };
  return event;
}
