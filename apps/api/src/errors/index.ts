/**
 * API Error Types
 *
 * Domain-specific errors for the API layer.
 * Maps to HTTP status codes via exception filter.
 */

/**
 * Base error class for all API domain errors
 */
export class DomainError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;
  readonly statusCode: number;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
  }
}

/**
 * 400 Bad Request - Validation errors
 */
export class ValidationError extends DomainError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends DomainError {
  constructor(
    message: string = 'Authentication required',
    context: Record<string, unknown> = {}
  ) {
    super(message, 'UNAUTHORIZED', 401, context);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden - Access denied
 */
export class ForbiddenError extends DomainError {
  constructor(
    message: string = 'Access denied',
    context: Record<string, unknown> = {}
  ) {
    super(message, 'FORBIDDEN', 403, context);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends DomainError {
  constructor(
    message: string = 'Resource not found',
    context: Record<string, unknown> = {}
  ) {
    super(message, 'NOT_FOUND', 404, context);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 Conflict - Resource conflict
 */
export class ConflictError extends DomainError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'CONFLICT', 409, context);
    this.name = 'ConflictError';
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends DomainError {
  constructor(
    message: string = 'Rate limit exceeded',
    context: Record<string, unknown> = {}
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, context);
    this.name = 'RateLimitError';
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends DomainError {
  constructor(
    message: string = 'Internal server error',
    context: Record<string, unknown> = {}
  ) {
    super(message, 'INTERNAL_ERROR', 500, context);
    this.name = 'InternalServerError';
  }
}

/**
 * Task-specific errors
 */
export class TaskExecutionError extends DomainError {
  readonly taskId: string;

  constructor(
    message: string,
    taskId: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'TASK_EXECUTION_ERROR', 500, { ...context, taskId });
    this.name = 'TaskExecutionError';
    this.taskId = taskId;
  }
}

/**
 * Task not in expected state for operation
 */
export class TaskStateError extends DomainError {
  readonly taskId: string;
  readonly currentState: string;
  readonly expectedState: string;

  constructor(
    taskId: string,
    currentState: string,
    expectedState: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Task ${taskId} is in state '${currentState}', expected '${expectedState}'`,
      'TASK_STATE_ERROR',
      400,
      { ...context, taskId, currentState, expectedState }
    );
    this.name = 'TaskStateError';
    this.taskId = taskId;
    this.currentState = currentState;
    this.expectedState = expectedState;
  }
}

/**
 * Database operation error
 */
export class DatabaseError extends DomainError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'DATABASE_ERROR', 500, context);
    this.name = 'DatabaseError';
  }
}
