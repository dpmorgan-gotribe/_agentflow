/**
 * Audit Logging Types
 *
 * Type definitions and Zod schemas for the audit system.
 */

import { z } from 'zod';

/**
 * Audit event categories
 */
export const AuditCategorySchema = z.enum([
  'authentication',
  'authorization',
  'orchestration',
  'agent_execution',
  'file_operation',
  'git_operation',
  'external_call',
  'user_action',
  'system_event',
  'security_event',
  'compliance_event',
  'error_event',
]);

export type AuditCategory = z.infer<typeof AuditCategorySchema>;

/**
 * Audit severity levels
 */
export const AuditSeveritySchema = z.enum([
  'debug',
  'info',
  'warning',
  'error',
  'critical',
]);

export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

/**
 * Severity order for filtering
 */
export const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

/**
 * Audit event outcome
 */
export const AuditOutcomeSchema = z.enum([
  'success',
  'failure',
  'partial',
  'blocked',
  'pending',
]);

export type AuditOutcome = z.infer<typeof AuditOutcomeSchema>;

/**
 * Actor types
 */
export const ActorTypeSchema = z.enum(['user', 'agent', 'system', 'external']);

export type ActorType = z.infer<typeof ActorTypeSchema>;

/**
 * Actor information (who performed the action)
 */
export const AuditActorSchema = z.object({
  type: ActorTypeSchema,
  id: z.string().min(1).max(255),
  name: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditActor = z.infer<typeof AuditActorSchema>;

/**
 * Target types
 */
export const TargetTypeSchema = z.enum([
  'file',
  'workflow',
  'project',
  'user',
  'agent',
  'resource',
  'checkpoint',
  'config',
]);

export type TargetType = z.infer<typeof TargetTypeSchema>;

/**
 * Target information (what was affected)
 */
export const AuditTargetSchema = z.object({
  type: TargetTypeSchema,
  id: z.string().min(1).max(255),
  path: z.string().max(1024).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AuditTarget = z.infer<typeof AuditTargetSchema>;

/**
 * Error details
 */
export const AuditErrorSchema = z.object({
  code: z.string().min(1).max(100),
  message: z.string().max(10000),
  stack: z.string().max(50000).optional(),
});

export type AuditError = z.infer<typeof AuditErrorSchema>;

/**
 * Change tracking
 */
export const AuditChangesSchema = z.object({
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});

export type AuditChanges = z.infer<typeof AuditChangesSchema>;

/**
 * Complete audit event
 */
export const AuditEventSchema = z.object({
  // Identity
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sequence: z.number().int().positive(),

  // Classification
  category: AuditCategorySchema,
  action: z.string().min(1).max(100),
  severity: AuditSeveritySchema,
  outcome: AuditOutcomeSchema,

  // Context
  sessionId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  correlationId: z.string().uuid().optional(),

  // Actors
  actor: AuditActorSchema,
  target: AuditTargetSchema.optional(),

  // Details
  description: z.string().min(1).max(10000),
  details: z.record(z.unknown()).optional(),
  changes: AuditChangesSchema.optional(),

  // Error info
  error: AuditErrorSchema.optional(),

  // Security
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(500).optional(),

  // Integrity
  previousHash: z.string(),
  hash: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  startDate?: Date;
  endDate?: Date;
  categories?: AuditCategory[];
  severity?: AuditSeverity[];
  outcome?: AuditOutcome[];
  actorId?: string;
  targetId?: string;
  sessionId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Partial<Record<AuditCategory, number>>;
  eventsBySeverity: Partial<Record<AuditSeverity, number>>;
  eventsByOutcome: Partial<Record<AuditOutcome, number>>;
  eventsPerDay: Array<{ date: string; count: number }>;
  topActors: Array<{ actorId: string; count: number }>;
  errorRate: number;
}

/**
 * Audit logger configuration
 */
export interface AuditLoggerConfig {
  enabled: boolean;
  minSeverity: AuditSeverity;
  includeDetails: boolean;
  redactSecrets: boolean;
  asyncWrite: boolean;
  batchSize: number;
  flushInterval: number;
}

/**
 * Audit store configuration
 */
export interface AuditStoreConfig {
  basePath: string;
  rotateSize: number;
  retentionDays: number;
  compress: boolean;
}

/**
 * Integrity check result
 */
export interface IntegrityCheckResult {
  valid: boolean;
  checkedEvents: number;
  invalidEvents: Array<{
    id: string;
    sequence: number;
    issue: string;
  }>;
  chainBroken: boolean;
  chainBreakPoint?: number;
}

/**
 * Integrity report
 */
export interface IntegrityReport {
  timestamp: string;
  result: IntegrityCheckResult;
  statistics: {
    totalEvents: number;
    dateRange: { start: string; end: string };
    hashAlgorithm: string;
  };
  signature: string;
}

/**
 * Compliance report types
 */
export type ComplianceReportType = 'gdpr' | 'soc2' | 'hipaa' | 'pci' | 'full';

/**
 * Secret patterns for redaction
 */
export const SECRET_PATTERNS: RegExp[] = [
  // Password patterns
  /password["'\s:=]+["']?[^"'\s,}]+/gi,
  // API key patterns
  /api[_-]?key["'\s:=]+["']?[^"'\s,}]+/gi,
  // Token patterns
  /token["'\s:=]+["']?[^"'\s,}]+/gi,
  // Secret patterns
  /secret["'\s:=]+["']?[^"'\s,}]+/gi,
  // Auth patterns
  /auth["'\s:=]+["']?[^"'\s,}]+/gi,
  // Bearer tokens
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  // AWS access keys
  /AKIA[0-9A-Z]{16}/g,
  // GitHub personal access tokens
  /ghp_[a-zA-Z0-9]{36}/g,
  // OpenAI API keys
  /sk-[a-zA-Z0-9]{20,}/g,
  // Anthropic API keys
  /sk-ant-[a-zA-Z0-9-]+/g,
  // Database connection strings
  /postgres(ql)?:\/\/[^"'\s]+/gi,
  /mongodb(\+srv)?:\/\/[^"'\s]+/gi,
  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
];

/**
 * Sensitive field names for redaction
 */
export const SENSITIVE_KEYS: RegExp[] = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /token/i,
  /credential/i,
  /aws[_-]?secret/i,
  /private[_-]?key/i,
  /jwt/i,
  /bearer/i,
  /apikey/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
];

/**
 * Audit system limits
 */
export const AUDIT_LIMITS = {
  maxEventSize: 1024 * 1024, // 1MB per event
  maxDetailsSize: 512 * 1024, // 512KB for details field
  maxBatchSize: 1000,
  maxQueryLimit: 10000,
  maxDescriptionLength: 10000,
  maxObjectDepth: 10,
};

/**
 * Default audit logger configuration
 */
export const DEFAULT_LOGGER_CONFIG: AuditLoggerConfig = {
  enabled: true,
  minSeverity: 'info',
  includeDetails: true,
  redactSecrets: true,
  asyncWrite: true,
  batchSize: 100,
  flushInterval: 5000,
};

/**
 * Default audit store configuration
 */
export const DEFAULT_STORE_CONFIG: AuditStoreConfig = {
  basePath: '.audit',
  rotateSize: 10 * 1024 * 1024, // 10MB
  retentionDays: 30,
  compress: false,
};
