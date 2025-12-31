/**
 * Audit Logger
 *
 * Core audit logging with secret redaction, batching,
 * and hash chain integrity.
 */

import { randomUUID } from 'node:crypto';
import type {
  AuditEvent,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
  AuditActor,
  AuditTarget,
  AuditError as AuditErrorType,
  AuditChanges,
  AuditLoggerConfig,
} from './types.js';
import {
  AuditEventSchema,
  DEFAULT_LOGGER_CONFIG,
  SEVERITY_ORDER,
  SECRET_PATTERNS,
  SENSITIVE_KEYS,
  AUDIT_LIMITS,
} from './types.js';
import { AuditStore } from './audit-store.js';
import { IntegrityManager } from './integrity.js';
import { AuditValidationError } from './errors.js';

/**
 * Log event input options
 */
export interface LogEventOptions {
  category: AuditCategory;
  action: string;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  actor: AuditActor;
  target?: AuditTarget;
  description: string;
  details?: Record<string, unknown>;
  changes?: AuditChanges;
  error?: AuditErrorType;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit Logger implementation
 */
export class AuditLogger {
  private readonly config: AuditLoggerConfig;
  private readonly store: AuditStore;
  private readonly integrity: IntegrityManager;
  private sequence: number = 0;
  private sessionId: string;
  private projectId?: string;
  private workflowId?: string;
  private eventBuffer: AuditEvent[] = [];
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(
    store: AuditStore,
    integrity: IntegrityManager,
    config: Partial<AuditLoggerConfig> = {}
  ) {
    this.config = { ...DEFAULT_LOGGER_CONFIG, ...config };
    this.store = store;
    this.integrity = integrity;
    this.sessionId = randomUUID();
  }

  /**
   * Initialize audit logger
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Load last sequence number
    this.sequence = await this.store.getLastSequence();

    // Start flush timer for async writes
    if (this.config.asyncWrite && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(
        () => this.flush().catch(() => {}),
        this.config.flushInterval
      );
    }

    // Log system start
    await this.log({
      category: 'system_event',
      action: 'system_start',
      severity: 'info',
      outcome: 'success',
      actor: { type: 'system', id: 'orchestrator' },
      description: 'Audit logging system initialized',
    });
  }

  /**
   * Shutdown audit logger
   */
  async shutdown(): Promise<void> {
    // Log system stop
    if (this.config.enabled) {
      await this.log({
        category: 'system_event',
        action: 'system_stop',
        severity: 'info',
        outcome: 'success',
        actor: { type: 'system', id: 'orchestrator' },
        description: 'Audit logging system shutting down',
      });
    }

    // Clear timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Set context for subsequent logs
   */
  setContext(options: { projectId?: string; workflowId?: string }): void {
    if (options.projectId) this.projectId = options.projectId;
    if (options.workflowId) this.workflowId = options.workflowId;
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.projectId = undefined;
    this.workflowId = undefined;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Log an audit event
   */
  async log(options: LogEventOptions): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Check severity threshold
    if (
      SEVERITY_ORDER[options.severity] <
      SEVERITY_ORDER[this.config.minSeverity]
    ) {
      return;
    }

    // Get previous hash for chain
    const previousHash = await this.integrity.getLastHash();

    // Increment sequence
    this.sequence++;

    // Build event
    const event: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      sequence: this.sequence,
      category: options.category,
      action: options.action,
      severity: options.severity,
      outcome: options.outcome,
      sessionId: this.sessionId,
      projectId: this.projectId,
      workflowId: this.workflowId,
      correlationId: options.correlationId,
      actor: options.actor,
      target: options.target,
      description: this.sanitizeDescription(options.description),
      details: this.config.includeDetails
        ? (this.redactSecrets(options.details) as Record<string, unknown> | undefined)
        : undefined,
      changes: options.changes
        ? {
            before: this.redactSecrets(options.changes.before),
            after: this.redactSecrets(options.changes.after),
          }
        : undefined,
      error: options.error,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      previousHash,
      hash: '',
    };

    // Calculate hash
    event.hash = this.integrity.calculateEventHash(event);

    // Validate event
    try {
      AuditEventSchema.parse(event);
    } catch (error) {
      throw new AuditValidationError(
        'Event validation failed',
        'event',
        error
      );
    }

    // Store event
    if (this.config.asyncWrite) {
      this.eventBuffer.push(event);
      if (this.eventBuffer.length >= this.config.batchSize) {
        await this.flush();
      }
    } else {
      await this.store.append(event);
    }
  }

  /**
   * Flush buffered events to store
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = this.eventBuffer;
    this.eventBuffer = [];

    try {
      await this.store.appendBatch(events);
    } catch (error) {
      // Re-add to buffer for retry
      this.eventBuffer = [...events, ...this.eventBuffer];
      throw error;
    }
  }

  /**
   * Sanitize description (remove control characters)
   */
  private sanitizeDescription(description: string): string {
    // Remove newlines and control characters that could inject log entries
    return description.replace(/[\n\r\t\x00-\x1f]/g, ' ').trim();
  }

  /**
   * Redact secrets from data
   */
  private redactSecrets(data: unknown): unknown {
    if (!this.config.redactSecrets || data === undefined || data === null) {
      return data;
    }

    return this.deepRedactSecrets(data, 0);
  }

  /**
   * Deep redaction with depth limit
   */
  private deepRedactSecrets(obj: unknown, depth: number): unknown {
    if (depth > AUDIT_LIMITS.maxObjectDepth) {
      return '[MAX_DEPTH_EXCEEDED]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redactSecretString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepRedactSecrets(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Check if key is sensitive
        if (this.isSensitiveKey(key)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.deepRedactSecrets(value, depth + 1);
        }
      }
      return result;
    }

    return obj;
  }

  /**
   * Check if a key is sensitive
   */
  private isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEYS.some((pattern) => pattern.test(key));
  }

  /**
   * Redact secrets from string values
   */
  private redactSecretString(str: string): string {
    if (str.length < 8) {
      return str; // Don't redact very short strings
    }

    let result = str;
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }

    return result;
  }

  // ============================================
  // Convenience methods for common audit events
  // ============================================

  /**
   * Log agent execution event
   */
  async logAgentExecution(
    agentId: string,
    agentType: string,
    action: 'start' | 'complete' | 'fail',
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'agent_execution',
      action: `agent_${action}`,
      severity: action === 'fail' ? 'error' : 'info',
      outcome: action === 'fail' ? 'failure' : 'success',
      actor: { type: 'agent', id: agentId, name: agentType },
      description: `Agent ${agentType} ${action}`,
      details,
    });
  }

  /**
   * Log file operation event
   */
  async logFileOperation(
    operation: 'read' | 'write' | 'delete' | 'create',
    filePath: string,
    actorId: string,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'file_operation',
      action: `file_${operation}`,
      severity: 'info',
      outcome: success ? 'success' : 'failure',
      actor: { type: 'agent', id: actorId },
      target: { type: 'file', id: filePath, path: filePath },
      description: `File ${operation}: ${filePath}`,
      details,
    });
  }

  /**
   * Log git operation event
   */
  async logGitOperation(
    operation: string,
    actorId: string,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'git_operation',
      action: `git_${operation}`,
      severity: 'info',
      outcome: success ? 'success' : 'failure',
      actor: { type: 'agent', id: actorId },
      description: `Git ${operation}`,
      details,
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    action: string,
    severity: AuditSeverity,
    description: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'security_event',
      action,
      severity,
      outcome: 'success',
      actor: { type: 'system', id: 'security' },
      description,
      details,
    });
  }

  /**
   * Log compliance event
   */
  async logComplianceEvent(
    action: string,
    framework: string,
    passed: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'compliance_event',
      action,
      severity: passed ? 'info' : 'warning',
      outcome: passed ? 'success' : 'failure',
      actor: { type: 'system', id: 'compliance' },
      description: `Compliance check: ${framework} - ${action}`,
      details: { framework, ...details },
    });
  }

  /**
   * Log error event
   */
  async logError(
    error: Error,
    context: string,
    actorId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'error_event',
      action: 'error_occurred',
      severity: 'error',
      outcome: 'failure',
      actor: { type: 'system', id: actorId },
      description: `Error in ${context}: ${error.message}`,
      error: {
        code: error.name,
        message: error.message,
        stack: this.sanitizeStack(error.stack),
      },
      details,
    });
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    action: 'login' | 'logout' | 'token_refresh' | 'failed_login',
    userId: string,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'authentication',
      action: `auth_${action}`,
      severity: success ? 'info' : 'warning',
      outcome: success ? 'success' : 'failure',
      actor: { type: 'user', id: userId },
      description: `Authentication: ${action}`,
      details,
    });
  }

  /**
   * Log authorization event
   */
  async logAuthorization(
    resource: string,
    action: string,
    userId: string,
    granted: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'authorization',
      action: `authz_${action}`,
      severity: granted ? 'info' : 'warning',
      outcome: granted ? 'success' : 'blocked',
      actor: { type: 'user', id: userId },
      target: { type: 'resource', id: resource },
      description: `Authorization: ${action} on ${resource}`,
      details,
    });
  }

  /**
   * Sanitize stack trace (remove sensitive paths)
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;

    // In production, don't include stack traces
    if (process.env['NODE_ENV'] === 'production') {
      return undefined;
    }

    return stack;
  }
}
