/**
 * Hook Errors
 *
 * Error types specific to the hooks system.
 */

/**
 * Base hook error
 */
export class HookError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'HookError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Error when hook registration fails
 */
export class HookRegistrationError extends HookError {
  readonly hookId: string;
  readonly point: string;

  constructor(hookId: string, point: string, message: string) {
    super(message, 'HOOK_REGISTRATION_ERROR', { hookId, point });
    this.name = 'HookRegistrationError';
    this.hookId = hookId;
    this.point = point;
  }
}

/**
 * Error when hook times out
 */
export class HookTimeoutError extends HookError {
  readonly hookId: string;
  readonly timeoutMs: number;

  constructor(hookId: string, timeoutMs: number) {
    super(
      `Hook ${hookId} timed out after ${timeoutMs}ms`,
      'HOOK_TIMEOUT_ERROR',
      { hookId, timeoutMs }
    );
    this.name = 'HookTimeoutError';
    this.hookId = hookId;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error when hook execution fails
 */
export class HookExecutionError extends HookError {
  readonly hookId: string;
  readonly originalError?: Error;

  constructor(hookId: string, message: string, originalError?: Error) {
    super(message, 'HOOK_EXECUTION_ERROR', {
      hookId,
      originalError: originalError?.message,
    });
    this.name = 'HookExecutionError';
    this.hookId = hookId;
    this.originalError = originalError;
  }
}

/**
 * Error when hook blocks execution
 */
export class HookBlockedError extends HookError {
  readonly hookId: string;
  readonly reason: string;

  constructor(hookId: string, reason: string) {
    super(`Hook ${hookId} blocked execution: ${reason}`, 'HOOK_BLOCKED_ERROR', {
      hookId,
      reason,
    });
    this.name = 'HookBlockedError';
    this.hookId = hookId;
    this.reason = reason;
  }
}
