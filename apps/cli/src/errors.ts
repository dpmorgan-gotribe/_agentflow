/**
 * CLI Errors
 *
 * Typed error hierarchy for the CLI.
 * Follows the pattern from @aigentflow/ai-provider.
 */

/**
 * Base CLI error
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CLIError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends CLIError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly details?: unknown
  ) {
    super(message, 'CONFIG_VALIDATION_ERROR', { field, details });
    this.name = 'ConfigValidationError';
  }
}

/**
 * API connection error
 */
export class APIConnectionError extends CLIError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message, 'API_CONNECTION_ERROR', { statusCode });
    this.name = 'APIConnectionError';
  }
}

/**
 * API authentication error
 */
export class APIAuthenticationError extends CLIError {
  constructor() {
    super(
      'API authentication failed - check your API token',
      'API_AUTHENTICATION_ERROR'
    );
    this.name = 'APIAuthenticationError';
  }
}

/**
 * Task not found error
 */
export class TaskNotFoundError extends CLIError {
  constructor(public readonly taskId: string) {
    super(`Task not found: ${taskId}`, 'TASK_NOT_FOUND_ERROR', { taskId });
    this.name = 'TaskNotFoundError';
  }
}

/**
 * Task timeout error
 */
export class TaskTimeoutError extends CLIError {
  constructor(
    public readonly taskId: string,
    public readonly timeoutMs: number
  ) {
    super(`Task timeout after ${timeoutMs}ms`, 'TASK_TIMEOUT_ERROR', {
      taskId,
      timeoutMs,
    });
    this.name = 'TaskTimeoutError';
  }
}

/**
 * Invalid task state error
 */
export class InvalidTaskStateError extends CLIError {
  constructor(
    public readonly taskId: string,
    public readonly currentState: string,
    public readonly expectedState: string
  ) {
    super(
      `Task ${taskId} is in state '${currentState}', expected '${expectedState}'`,
      'INVALID_TASK_STATE_ERROR',
      { taskId, currentState, expectedState }
    );
    this.name = 'InvalidTaskStateError';
  }
}

/**
 * Streaming error
 */
export class StreamingError extends CLIError {
  constructor(message: string) {
    super(message, 'STREAMING_ERROR');
    this.name = 'StreamingError';
  }
}

/**
 * Input validation error
 */
export class InputValidationError extends CLIError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly details?: unknown
  ) {
    super(message, 'INPUT_VALIDATION_ERROR', { field, details });
    this.name = 'InputValidationError';
  }
}

/**
 * Path traversal error
 */
export class PathTraversalError extends CLIError {
  constructor(
    public readonly path: string,
    public readonly reason: string
  ) {
    super(`Invalid path: ${reason}`, 'PATH_TRAVERSAL_ERROR', { path, reason });
    this.name = 'PathTraversalError';
  }
}

/**
 * File operation error
 */
export class FileOperationError extends CLIError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly operation: 'read' | 'write' | 'delete'
  ) {
    super(message, 'FILE_OPERATION_ERROR', { filePath, operation });
    this.name = 'FileOperationError';
  }
}

/**
 * Type guard for CLIError
 */
export function isCLIError(error: unknown): error is CLIError {
  return error instanceof CLIError;
}

/**
 * Type guard for specific error codes
 */
export function hasErrorCode(error: unknown, code: string): error is CLIError {
  return isCLIError(error) && error.code === code;
}

/**
 * Check if error is recoverable (can be retried)
 */
export function isRecoverableError(error: unknown): boolean {
  if (!isCLIError(error)) return false;

  const recoverableCodes = [
    'API_CONNECTION_ERROR',
    'STREAMING_ERROR',
    'TASK_TIMEOUT_ERROR',
  ];

  return recoverableCodes.includes(error.code);
}
