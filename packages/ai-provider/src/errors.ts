/**
 * AI Provider Errors
 *
 * Typed error hierarchy for the AI provider system.
 */

/**
 * Base AI provider error
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIProviderError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Configuration error
 */
export class AIProviderConfigError extends AIProviderError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly details?: unknown
  ) {
    super(message, 'AI_PROVIDER_CONFIG_ERROR', { field, details });
    this.name = 'AIProviderConfigError';
  }
}

/**
 * CLI execution error
 */
export class CLIExecutionError extends AIProviderError {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr?: string
  ) {
    super(message, 'CLI_EXECUTION_ERROR', { exitCode, stderr });
    this.name = 'CLIExecutionError';
  }
}

/**
 * CLI timeout error
 */
export class CLITimeoutError extends AIProviderError {
  constructor(
    public readonly timeoutMs: number
  ) {
    super(
      `Claude CLI timeout after ${timeoutMs}ms`,
      'CLI_TIMEOUT_ERROR',
      { timeoutMs }
    );
    this.name = 'CLITimeoutError';
  }
}

/**
 * API error
 */
export class APIError extends AIProviderError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    apiError?: unknown,
    code: string = 'API_ERROR'
  ) {
    super(message, code, { statusCode, apiError });
    this.name = 'APIError';
  }
}

/**
 * API rate limit error
 */
export class APIRateLimitError extends APIError {
  constructor(
    public readonly retryAfter?: number
  ) {
    super('API rate limit exceeded', 429, { retryAfter }, 'API_RATE_LIMIT_ERROR');
    this.name = 'APIRateLimitError';
  }
}

/**
 * API authentication error
 */
export class APIAuthenticationError extends APIError {
  constructor() {
    super('API authentication failed - check ANTHROPIC_API_KEY', 401, undefined, 'API_AUTHENTICATION_ERROR');
    this.name = 'APIAuthenticationError';
  }
}

/**
 * Validation error for request/response
 */
export class AIProviderValidationError extends AIProviderError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly details?: unknown
  ) {
    super(message, 'AI_PROVIDER_VALIDATION_ERROR', { field, details });
    this.name = 'AIProviderValidationError';
  }
}

/**
 * Invalid role error
 */
export class InvalidRoleError extends AIProviderError {
  constructor(
    public readonly role: string,
    public readonly validRoles: string[]
  ) {
    super(
      `Invalid agent role: ${role}. Valid roles: ${validRoles.join(', ')}`,
      'INVALID_ROLE_ERROR',
      { role, validRoles }
    );
    this.name = 'InvalidRoleError';
  }
}

/**
 * Path traversal error
 */
export class PathTraversalError extends AIProviderError {
  constructor(
    public readonly path: string,
    public readonly reason: string
  ) {
    super(
      `Path traversal detected: ${reason}`,
      'PATH_TRAVERSAL_ERROR',
      { path, reason }
    );
    this.name = 'PathTraversalError';
  }
}

/**
 * Provider not available error
 */
export class ProviderNotAvailableError extends AIProviderError {
  constructor(
    public readonly providerName: string,
    public readonly reason: string
  ) {
    super(
      `Provider '${providerName}' not available: ${reason}`,
      'PROVIDER_NOT_AVAILABLE_ERROR',
      { providerName, reason }
    );
    this.name = 'ProviderNotAvailableError';
  }
}

/**
 * Streaming not supported error
 */
export class StreamingNotSupportedError extends AIProviderError {
  constructor(
    public readonly providerName: string
  ) {
    super(
      `Streaming not supported by provider: ${providerName}`,
      'STREAMING_NOT_SUPPORTED_ERROR',
      { providerName }
    );
    this.name = 'StreamingNotSupportedError';
  }
}

/**
 * Type guard for AIProviderError
 */
export function isAIProviderError(error: unknown): error is AIProviderError {
  return error instanceof AIProviderError;
}

/**
 * Type guard for specific error codes
 */
export function hasErrorCode(
  error: unknown,
  code: string
): error is AIProviderError {
  return isAIProviderError(error) && error.code === code;
}

/**
 * Check if error is recoverable (can be retried)
 */
export function isRecoverableError(error: unknown): boolean {
  if (!isAIProviderError(error)) return false;

  const recoverableCodes = [
    'CLI_TIMEOUT_ERROR',
    'API_RATE_LIMIT_ERROR',
    'API_ERROR', // Some API errors are transient
  ];

  return recoverableCodes.includes(error.code);
}
