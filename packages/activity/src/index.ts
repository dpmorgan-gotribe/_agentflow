/**
 * @aigentflow/activity
 *
 * Real-time activity streaming system for Aigentflow.
 *
 * Features:
 * - Event streaming with subscription-based filtering
 * - Multiple event types (workflow, agent, file, git, user, system)
 * - CLI formatting with colors and icons
 * - JSONL persistence with retention management
 * - Progress tracking with percentage calculations
 *
 * Security:
 * - Zod validation for all schemas
 * - Secret redaction in event details
 * - Path traversal prevention in persistence
 * - Handler timeout enforcement
 * - Content sanitization for terminal output
 *
 * @packageDocumentation
 */

// Version
export const ACTIVITY_VERSION = '1.0.0';

// ============================================================================
// Type Exports
// ============================================================================

export {
  // Constants
  MAX_ID_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_SESSION_ID_LENGTH,
  MAX_WORKFLOW_ID_LENGTH,
  MAX_EVENTS_IN_MEMORY,
  MAX_DETAILS_DEPTH,
  SAFE_ID_REGEX,
  // Activity Type
  ActivityTypeSchema,
  type ActivityType,
  // Activity Category
  ActivityCategorySchema,
  type ActivityCategory,
  // Activity Severity
  ActivitySeveritySchema,
  type ActivitySeverity,
  // Progress Info
  ProgressInfoSchema,
  type ProgressInfo,
  // Activity Event
  ActivityEventSchema,
  type ActivityEvent,
  // Subscription Filter
  SubscriptionFilterSchema,
  type SubscriptionFilter,
  // Event Handler
  type EventHandler,
  // Subscription
  type Subscription,
  // Display Format
  DisplayFormatSchema,
  type DisplayFormat,
  // Stream Config
  ActivityStreamConfigSchema,
  type ActivityStreamConfig,
  // Persistence Config
  ActivityPersistenceConfigSchema,
  type ActivityPersistenceConfig,
  // Type-to-Category mapping
  TYPE_CATEGORIES,
  // Validation helpers
  validateActivityEvent,
  validateSubscriptionFilter,
  createActivityEvent,
} from './types.js';

// ============================================================================
// Subscription Manager Exports
// ============================================================================

export {
  SubscriptionManager,
  MAX_SUBSCRIPTIONS,
  HANDLER_TIMEOUT_MS,
  createSubscriptionManager,
  createSubscription,
} from './subscriptions.js';

// ============================================================================
// Activity Stream Exports
// ============================================================================

export {
  ActivityStream,
  type ActivityPersistence,
  type EmitOptions,
  createActivityStream,
} from './activity-stream.js';

// ============================================================================
// Persistence Exports
// ============================================================================

export {
  FileActivityPersistence,
  InMemoryActivityPersistence,
  MAX_FILE_SIZE_BYTES,
  MAX_LINE_LENGTH,
  FILE_PREFIX,
  FILE_EXTENSION,
  createFileActivityPersistence,
  createInMemoryActivityPersistence,
} from './persistence.js';

// ============================================================================
// Formatter Exports
// ============================================================================

export {
  CLIFormatter,
  type CLIFormatterOptions,
  SPINNER_FRAMES,
  createSpinner,
  createActivityDisplay,
  createCLIFormatter,
  formatActivityEvent,
} from './formatters/index.js';
