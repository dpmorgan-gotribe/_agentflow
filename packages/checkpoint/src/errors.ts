/**
 * Checkpoint Package Errors
 *
 * Typed error hierarchy for checkpoint and recovery operations.
 */

/**
 * Base error for all checkpoint-related errors
 */
export class CheckpointError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CheckpointError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error when checkpoint integrity validation fails
 */
export class CheckpointIntegrityError extends CheckpointError {
  constructor(
    public readonly checkpointId: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CHECKPOINT_INTEGRITY_ERROR', {
      checkpointId,
      ...context,
    });
    this.name = 'CheckpointIntegrityError';
  }
}

/**
 * Error when checkpoint is not found
 */
export class CheckpointNotFoundError extends CheckpointError {
  constructor(
    public readonly checkpointId: string
  ) {
    super(
      `Checkpoint not found: ${checkpointId}`,
      'CHECKPOINT_NOT_FOUND',
      { checkpointId }
    );
    this.name = 'CheckpointNotFoundError';
  }
}

/**
 * Error when checkpoint is corrupted
 */
export class CheckpointCorruptionError extends CheckpointError {
  constructor(
    public readonly checkpointId: string,
    message: string,
    cause?: Error
  ) {
    super(message, 'CHECKPOINT_CORRUPTION_ERROR', { checkpointId });
    this.name = 'CheckpointCorruptionError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when recovery fails
 */
export class RecoveryError extends CheckpointError {
  constructor(
    message: string,
    public readonly checkpointId: string,
    public readonly phase: 'validation' | 'workflow' | 'agents' | 'context' | 'filesystem',
    cause?: Error
  ) {
    super(message, 'RECOVERY_ERROR', { checkpointId, phase });
    this.name = 'RecoveryError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when recovery is not possible
 */
export class RecoveryBlockedError extends CheckpointError {
  constructor(
    public readonly checkpointId: string,
    public readonly blockers: string[]
  ) {
    super(
      `Recovery blocked: ${blockers.join(', ')}`,
      'RECOVERY_BLOCKED',
      { checkpointId, blockers }
    );
    this.name = 'RecoveryBlockedError';
  }
}

/**
 * Error when checkpoint store operations fail
 */
export class CheckpointStoreError extends CheckpointError {
  constructor(
    message: string,
    public readonly operation: 'save' | 'load' | 'delete' | 'list' | 'initialize',
    cause?: Error
  ) {
    super(message, 'CHECKPOINT_STORE_ERROR', { operation });
    this.name = 'CheckpointStoreError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when path validation fails
 */
export class CheckpointPathError extends CheckpointError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly reason: 'outside_root' | 'symlink' | 'invalid_id'
  ) {
    super(message, 'CHECKPOINT_PATH_ERROR', { path, reason });
    this.name = 'CheckpointPathError';
  }
}

/**
 * Error when size limits are exceeded
 */
export class CheckpointSizeError extends CheckpointError {
  constructor(
    message: string,
    public readonly limitType: 'checkpoint_size' | 'decompressed_size' | 'compression_ratio',
    public readonly limit: number,
    public readonly actual: number
  ) {
    super(message, 'CHECKPOINT_SIZE_ERROR', { limitType, limit, actual });
    this.name = 'CheckpointSizeError';
  }
}

/**
 * Error when compression/decompression fails
 */
export class CompressionError extends CheckpointError {
  constructor(
    message: string,
    public readonly operation: 'compress' | 'decompress',
    cause?: Error
  ) {
    super(message, 'COMPRESSION_ERROR', { operation });
    this.name = 'CompressionError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when checkpoint system is disabled
 */
export class CheckpointDisabledError extends CheckpointError {
  constructor() {
    super('Checkpoint system is disabled', 'CHECKPOINT_DISABLED', {});
    this.name = 'CheckpointDisabledError';
  }
}

/**
 * Type guard to check if an error is a CheckpointError
 */
export function isCheckpointError(error: unknown): error is CheckpointError {
  return error instanceof CheckpointError;
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode(
  error: unknown,
  code: string
): error is CheckpointError {
  return isCheckpointError(error) && error.code === code;
}
