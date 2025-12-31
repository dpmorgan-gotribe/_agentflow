/**
 * Audit Logging Errors
 *
 * Typed error hierarchy for the audit system.
 */

/**
 * Base audit error
 */
export class AuditError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuditError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Audit store operation error
 */
export class AuditStoreError extends AuditError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalCause?: Error
  ) {
    super(message, 'AUDIT_STORE_ERROR', { operation });
    this.name = 'AuditStoreError';
  }
}

/**
 * Audit path validation error
 */
export class AuditPathError extends AuditError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly reason: 'outside_root' | 'symlink' | 'invalid_id'
  ) {
    super(message, 'AUDIT_PATH_ERROR', { path, reason });
    this.name = 'AuditPathError';
  }
}

/**
 * Audit size limit error
 */
export class AuditSizeError extends AuditError {
  constructor(
    message: string,
    public readonly sizeType: 'event_size' | 'details_size' | 'batch_size',
    public readonly limit: number,
    public readonly actual: number
  ) {
    super(message, 'AUDIT_SIZE_ERROR', { sizeType, limit, actual });
    this.name = 'AuditSizeError';
  }
}

/**
 * Audit integrity error (tamper detection)
 */
export class AuditIntegrityError extends AuditError {
  constructor(
    message: string,
    public readonly eventId?: string,
    public readonly sequence?: number
  ) {
    super(message, 'AUDIT_INTEGRITY_ERROR', { eventId, sequence });
    this.name = 'AuditIntegrityError';
  }
}

/**
 * Audit validation error (schema validation)
 */
export class AuditValidationError extends AuditError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly details?: unknown
  ) {
    super(message, 'AUDIT_VALIDATION_ERROR', { field, details });
    this.name = 'AuditValidationError';
  }
}

/**
 * Audit query error
 */
export class AuditQueryError extends AuditError {
  constructor(
    message: string,
    public readonly queryDetails?: Record<string, unknown>,
    public readonly originalCause?: Error
  ) {
    super(message, 'AUDIT_QUERY_ERROR', { queryDetails });
    this.name = 'AuditQueryError';
  }
}

/**
 * Compliance check error
 */
export class ComplianceCheckError extends AuditError {
  constructor(
    message: string,
    public readonly framework: string,
    public readonly controlId?: string
  ) {
    super(message, 'COMPLIANCE_CHECK_ERROR', { framework, controlId });
    this.name = 'ComplianceCheckError';
  }
}

/**
 * Audit disabled error
 */
export class AuditDisabledError extends AuditError {
  constructor() {
    super('Audit logging is disabled', 'AUDIT_DISABLED');
    this.name = 'AuditDisabledError';
  }
}

/**
 * Type guard for AuditError
 */
export function isAuditError(error: unknown): error is AuditError {
  return error instanceof AuditError;
}

/**
 * Type guard for specific error codes
 */
export function hasErrorCode(
  error: unknown,
  code: string
): error is AuditError {
  return isAuditError(error) && error.code === code;
}
