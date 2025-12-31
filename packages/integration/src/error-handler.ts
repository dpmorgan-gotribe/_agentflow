/**
 * Global Error Handler
 *
 * Centralized error handling for cross-component error management.
 * Logs to audit, fires hooks, emits events, and handles recovery.
 */

import type {
  ErrorContext,
  ErrorRecoveryResult,
  RetryPolicy,
  AllowedEventSource,
} from './types.js';
import {
  ErrorContextSchema,
  SystemEvents,
  DEFAULT_RETRY_POLICY,
} from './types.js';
import { EventBus } from './event-bus.js';
import { isIntegrationError, isRecoverableError } from './errors.js';

/**
 * Audit logger interface (from @aigentflow/audit)
 */
interface AuditLogger {
  log(options: {
    category: string;
    action: string;
    severity: string;
    outcome: string;
    actor: { type: string; id: string };
    description: string;
    error?: { code: string; message: string; stack?: string };
    details?: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * Hook engine interface (from @aigentflow/hooks)
 */
interface HookEngine {
  execute(
    hookPoint: string,
    payload: unknown
  ): Promise<{ action: string; reason?: string }>;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  logStackTraces: boolean;
  sanitizeStackTraces: boolean;
  retryPolicy: RetryPolicy;
  notifyOnCritical: boolean;
}

const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  logStackTraces: true,
  sanitizeStackTraces: true,
  retryPolicy: DEFAULT_RETRY_POLICY,
  notifyOnCritical: true,
};

/**
 * Sensitive patterns to redact from error messages
 */
const SENSITIVE_PATTERNS = [
  /password[=:]\s*['"]?[^'"\s]+/gi,
  /api[_-]?key[=:]\s*['"]?[^'"\s]+/gi,
  /secret[=:]\s*['"]?[^'"\s]+/gi,
  /token[=:]\s*['"]?[^'"\s]+/gi,
  /auth[=:]\s*['"]?[^'"\s]+/gi,
  /bearer\s+[a-zA-Z0-9._-]+/gi,
];

/**
 * GlobalErrorHandler implementation
 *
 * Provides centralized error handling with:
 * - Audit logging
 * - Hook execution
 * - Event emission
 * - Recovery handling
 */
export class GlobalErrorHandler {
  private readonly config: ErrorHandlerConfig;
  private readonly eventBus: EventBus;
  private auditLogger?: AuditLogger;
  private hookEngine?: HookEngine;

  constructor(
    eventBus: EventBus,
    config: Partial<ErrorHandlerConfig> = {}
  ) {
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
    this.eventBus = eventBus;
  }

  /**
   * Set audit logger (optional dependency)
   */
  setAuditLogger(logger: AuditLogger): void {
    this.auditLogger = logger;
  }

  /**
   * Set hook engine (optional dependency)
   */
  setHookEngine(engine: HookEngine): void {
    this.hookEngine = engine;
  }

  /**
   * Handle an error
   *
   * 1. Logs to audit trail
   * 2. Fires error hook
   * 3. Emits error event
   * 4. Determines recovery action
   */
  async handle(error: Error, context: ErrorContext): Promise<ErrorRecoveryResult> {
    // Validate context
    const contextValidation = ErrorContextSchema.safeParse(context);
    if (!contextValidation.success) {
      console.error('[ErrorHandler] Invalid error context:', contextValidation.error);
    }

    // Determine if recoverable
    const recoverable = isRecoverableError(error);

    // Get error details
    const errorCode = isIntegrationError(error) ? error.code : 'UNKNOWN_ERROR';
    const sanitizedMessage = this.sanitizeMessage(error.message);
    const sanitizedStack = this.sanitizeStack(error.stack);

    // 1. Log to audit trail
    await this.logToAudit(error, context, errorCode, sanitizedMessage, sanitizedStack);

    // 2. Fire error hook
    await this.fireErrorHook(error, context, recoverable);

    // 3. Emit error event
    this.emitErrorEvent(error, context, recoverable);

    // 4. Determine recovery action
    return this.determineRecovery(error, context, recoverable);
  }

  /**
   * Handle error with retry logic
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    policy: Partial<RetryPolicy> = {}
  ): Promise<T> {
    const retryPolicy = { ...this.config.retryPolicy, ...policy };
    let lastError: Error | undefined;
    let delay = retryPolicy.baseDelay;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (attempt >= retryPolicy.maxRetries) {
          break;
        }

        const recoveryResult = await this.handle(error as Error, {
          ...context,
          retryCount: attempt,
          canRetry: true,
        });

        if (recoveryResult.action !== 'retry') {
          break;
        }

        // Wait before retry with exponential backoff
        await this.delay(delay);
        delay = Math.min(delay * retryPolicy.backoffMultiplier, retryPolicy.maxDelay);
      }
    }

    // Final failure
    await this.handle(lastError!, {
      ...context,
      retryCount: retryPolicy.maxRetries,
      canRetry: false,
    });

    throw lastError;
  }

  /**
   * Log error to audit trail
   */
  private async logToAudit(
    _error: Error,
    context: ErrorContext,
    code: string,
    message: string,
    stack?: string
  ): Promise<void> {
    if (!this.auditLogger) {
      console.error(`[${context.component}] Error in ${context.operation}:`, message);
      return;
    }

    try {
      await this.auditLogger.log({
        category: 'error_event',
        action: 'error_occurred',
        severity: 'error',
        outcome: 'failure',
        actor: { type: 'system', id: context.component },
        description: `Error in ${context.operation}: ${message}`,
        error: {
          code,
          message,
          stack: this.config.logStackTraces ? stack : undefined,
        },
        details: {
          component: context.component,
          operation: context.operation,
          level: context.level,
          correlationId: context.correlationId,
          retryCount: context.retryCount,
        },
      });
    } catch (auditError) {
      // Don't throw on audit failure - log to console instead
      console.error('[ErrorHandler] Failed to log to audit:', auditError);
    }
  }

  /**
   * Fire on_error hook
   */
  private async fireErrorHook(
    error: Error,
    context: ErrorContext,
    recoverable: boolean
  ): Promise<void> {
    if (!this.hookEngine) {
      return;
    }

    try {
      await this.hookEngine.execute('on_error', {
        error: {
          name: error.name,
          message: this.sanitizeMessage(error.message),
          code: isIntegrationError(error) ? error.code : 'UNKNOWN_ERROR',
        },
        context,
        recoverable,
      });
    } catch (hookError) {
      // Don't throw on hook failure
      console.error('[ErrorHandler] Error hook failed:', hookError);
    }
  }

  /**
   * Emit error event to event bus
   */
  private emitErrorEvent(
    error: Error,
    context: ErrorContext,
    recoverable: boolean
  ): void {
    try {
      this.eventBus.emitEvent({
        type: SystemEvents.STATE_ERROR,
        source: (context.component as AllowedEventSource) ?? 'error_handler',
        timestamp: new Date(),
        data: {
          error: {
            name: error.name,
            message: this.sanitizeMessage(error.message),
            code: isIntegrationError(error) ? error.code : 'UNKNOWN_ERROR',
          },
          context: {
            component: context.component,
            operation: context.operation,
            level: context.level,
          },
          recoverable,
        },
        correlationId: context.correlationId,
      });
    } catch (eventError) {
      console.error('[ErrorHandler] Failed to emit error event:', eventError);
    }
  }

  /**
   * Determine recovery action based on error type
   */
  private determineRecovery(
    error: Error,
    context: ErrorContext,
    recoverable: boolean
  ): ErrorRecoveryResult {
    // If not recoverable, escalate
    if (!recoverable) {
      return {
        recovered: false,
        action: 'escalate',
        message: `Non-recoverable error: ${error.name}`,
      };
    }

    // Check retry count
    if (context.canRetry && (context.retryCount ?? 0) < this.config.retryPolicy.maxRetries) {
      return {
        recovered: false,
        action: 'retry',
        message: `Retrying operation (attempt ${(context.retryCount ?? 0) + 1}/${this.config.retryPolicy.maxRetries})`,
      };
    }

    // Retry exhausted, escalate
    if ((context.retryCount ?? 0) >= this.config.retryPolicy.maxRetries) {
      return {
        recovered: false,
        action: 'escalate',
        message: `Max retries (${this.config.retryPolicy.maxRetries}) exceeded`,
      };
    }

    // Default: abort
    return {
      recovered: false,
      action: 'abort',
      message: 'Operation aborted due to error',
    };
  }

  /**
   * Sanitize error message to remove sensitive data
   */
  private sanitizeMessage(message: string): string {
    let result = message;

    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }

    return result;
  }

  /**
   * Sanitize stack trace
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;
    if (!this.config.sanitizeStackTraces) return stack;

    // In production, don't include stack traces
    if (process.env['NODE_ENV'] === 'production') {
      return undefined;
    }

    // Remove absolute paths
    let result = stack;

    // Remove home directory paths
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    if (homeDir) {
      result = result.replace(new RegExp(homeDir.replace(/[/\\]/g, '[/\\\\]'), 'g'), '~');
    }

    // Remove node_modules full paths
    result = result.replace(/at .+node_modules\//g, 'at node_modules/');

    // Limit to first 10 frames
    const lines = result.split('\n');
    if (lines.length > 11) {
      result = lines.slice(0, 11).join('\n') + '\n    ... (truncated)';
    }

    return result;
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
