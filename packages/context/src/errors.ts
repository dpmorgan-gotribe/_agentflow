/**
 * Context Package Errors
 *
 * Typed error hierarchy for project analysis and CLAUDE.md generation.
 */

/**
 * Base error for all context-related errors
 */
export class ContextError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ContextError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error when file system operations fail
 */
export class FileSystemError extends ContextError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: 'read' | 'write' | 'stat' | 'readdir' | 'access',
    cause?: Error
  ) {
    super(message, 'FILE_SYSTEM_ERROR', { path, operation });
    this.name = 'FileSystemError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when path validation fails (security)
 */
export class PathValidationError extends ContextError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly reason: 'outside_root' | 'symlink' | 'absolute_required' | 'not_directory'
  ) {
    super(message, 'PATH_VALIDATION_ERROR', { path, reason });
    this.name = 'PathValidationError';
  }
}

/**
 * Error when analysis limits are exceeded
 */
export class LimitExceededError extends ContextError {
  constructor(
    message: string,
    public readonly limitType: 'depth' | 'files' | 'file_size' | 'total_size',
    public readonly limit: number,
    public readonly actual: number
  ) {
    super(message, 'LIMIT_EXCEEDED_ERROR', { limitType, limit, actual });
    this.name = 'LimitExceededError';
  }
}

/**
 * Error when parsing configuration files fails
 */
export class ConfigParseError extends ContextError {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly fileType: 'json' | 'yaml' | 'toml' | 'unknown',
    cause?: Error
  ) {
    super(message, 'CONFIG_PARSE_ERROR', { filePath, fileType });
    this.name = 'ConfigParseError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when project analysis fails
 */
export class AnalysisError extends ContextError {
  constructor(
    message: string,
    public readonly phase: 'tech_stack' | 'structure' | 'conventions' | 'commands',
    cause?: Error
  ) {
    super(message, 'ANALYSIS_ERROR', { phase });
    this.name = 'AnalysisError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when CLAUDE.md generation fails
 */
export class GenerationError extends ContextError {
  constructor(
    message: string,
    public readonly section: string,
    cause?: Error
  ) {
    super(message, 'GENERATION_ERROR', { section });
    this.name = 'GenerationError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Type guard to check if an error is a ContextError
 */
export function isContextError(error: unknown): error is ContextError {
  return error instanceof ContextError;
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode(
  error: unknown,
  code: string
): error is ContextError {
  return isContextError(error) && error.code === code;
}
