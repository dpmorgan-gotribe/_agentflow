/**
 * @aigentflow/audit
 *
 * Immutable audit logging with tamper detection for Aigentflow.
 *
 * Provides:
 * - Append-only audit event storage
 * - SHA256 hash chain for tamper detection
 * - Secret redaction in logged data
 * - SOC2 compliance reporting
 *
 * @example
 * ```typescript
 * import {
 *   AuditLogger,
 *   AuditStore,
 *   IntegrityManager,
 *   SOC2Reporter,
 * } from '@aigentflow/audit';
 *
 * // Initialize store
 * const store = new AuditStore({ basePath: '.audit' });
 * await store.initialize();
 *
 * // Initialize integrity manager
 * const integrity = new IntegrityManager(store);
 * await integrity.initialize();
 *
 * // Initialize logger
 * const logger = new AuditLogger(store, integrity);
 * await logger.initialize();
 *
 * // Log events
 * await logger.log({
 *   category: 'agent_execution',
 *   action: 'agent_start',
 *   severity: 'info',
 *   outcome: 'success',
 *   actor: { type: 'agent', id: 'my-agent' },
 *   description: 'Agent started execution',
 * });
 *
 * // Generate compliance report
 * const reporter = new SOC2Reporter(store);
 * const report = await reporter.generateReport(startDate, endDate);
 * ```
 */

// Types and schemas
export {
  // Category, severity, outcome enums
  type AuditCategory,
  type AuditSeverity,
  type AuditOutcome,
  type ActorType,
  type TargetType,
  AuditCategorySchema,
  AuditSeveritySchema,
  AuditOutcomeSchema,
  ActorTypeSchema,
  TargetTypeSchema,
  // Actor and target types
  type AuditActor,
  type AuditTarget,
  type AuditError,
  type AuditChanges,
  AuditActorSchema,
  AuditTargetSchema,
  AuditErrorSchema,
  AuditChangesSchema,
  // Event type and schema
  type AuditEvent,
  AuditEventSchema,
  // Query and statistics types
  type AuditQueryOptions,
  type AuditStatistics,
  // Config types
  type AuditLoggerConfig,
  type AuditStoreConfig,
  // Integrity types
  type IntegrityCheckResult,
  type IntegrityReport,
  // Compliance types
  type ComplianceReportType,
  // Constants
  SEVERITY_ORDER,
  SECRET_PATTERNS,
  SENSITIVE_KEYS,
  AUDIT_LIMITS,
  DEFAULT_LOGGER_CONFIG,
  DEFAULT_STORE_CONFIG,
} from './types.js';

// Errors
export {
  AuditError as AuditErrorClass,
  AuditStoreError,
  AuditPathError,
  AuditSizeError,
  AuditIntegrityError,
  AuditValidationError,
  AuditQueryError,
  ComplianceCheckError,
  AuditDisabledError,
  isAuditError,
  hasErrorCode,
} from './errors.js';

// Store
export { AuditStore } from './audit-store.js';

// Integrity
export { IntegrityManager } from './integrity.js';

// Logger
export { AuditLogger, type LogEventOptions } from './audit-logger.js';

// Reporters
export {
  SOC2Reporter,
  type SOC2Category,
  type ComplianceStatus,
  type ControlAssessment,
  type SOC2Summary,
  type SOC2Report,
} from './reporters/index.js';
