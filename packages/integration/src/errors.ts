/**
 * Integration Errors
 *
 * Typed error hierarchy for the integration system.
 */

/**
 * Base integration error
 */
export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IntegrationError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ============================================
// Component Lifecycle Errors
// ============================================

/**
 * Component registration error
 */
export class ComponentRegistrationError extends IntegrationError {
  constructor(
    public readonly componentName: string,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'COMPONENT_REGISTRATION_ERROR', {
      componentName,
      ...context,
    });
    this.name = 'ComponentRegistrationError';
  }
}

/**
 * Component initialization error
 */
export class ComponentInitializationError extends IntegrationError {
  public readonly originalCause?: Error;

  constructor(
    public readonly componentName: string,
    public readonly phase: string,
    message: string,
    cause?: Error
  ) {
    super(message, 'COMPONENT_INIT_ERROR', {
      componentName,
      phase,
      cause: cause?.message,
    });
    this.name = 'ComponentInitializationError';
    this.originalCause = cause;
  }
}

/**
 * Component shutdown error
 */
export class ComponentShutdownError extends IntegrationError {
  public readonly originalCause?: Error;

  constructor(
    public readonly componentName: string,
    message: string,
    cause?: Error
  ) {
    super(message, 'COMPONENT_SHUTDOWN_ERROR', {
      componentName,
      cause: cause?.message,
    });
    this.name = 'ComponentShutdownError';
    this.originalCause = cause;
  }
}

/**
 * Component dependency error
 */
export class ComponentDependencyError extends IntegrationError {
  constructor(
    public readonly componentName: string,
    public readonly missingDependencies: string[]
  ) {
    super(
      `Component ${componentName} missing dependencies: ${missingDependencies.join(', ')}`,
      'COMPONENT_DEPENDENCY_ERROR',
      { componentName, missingDependencies }
    );
    this.name = 'ComponentDependencyError';
  }
}

/**
 * Component not found error
 */
export class ComponentNotFoundError extends IntegrationError {
  constructor(public readonly componentName: string) {
    super(
      `Component not found: ${componentName}`,
      'COMPONENT_NOT_FOUND_ERROR',
      { componentName }
    );
    this.name = 'ComponentNotFoundError';
  }
}

// ============================================
// Health Check Errors
// ============================================

/**
 * Component health check error
 */
export class HealthCheckError extends IntegrationError {
  constructor(
    public readonly componentName: string,
    public readonly failedChecks: string[]
  ) {
    super(
      `Health check failed for ${componentName}: ${failedChecks.join(', ')}`,
      'HEALTH_CHECK_ERROR',
      { componentName, failedChecks }
    );
    this.name = 'HealthCheckError';
  }
}

// ============================================
// Event Bus Errors
// ============================================

/**
 * Event emission error
 */
export class EventEmissionError extends IntegrationError {
  public readonly originalCause?: Error;

  constructor(
    public readonly eventType: string,
    message: string,
    cause?: Error
  ) {
    super(message, 'EVENT_EMISSION_ERROR', {
      eventType,
      cause: cause?.message,
    });
    this.name = 'EventEmissionError';
    this.originalCause = cause;
  }
}

/**
 * Event validation error
 */
export class EventValidationError extends IntegrationError {
  constructor(
    public readonly eventType: string,
    public readonly field: string,
    message: string
  ) {
    super(message, 'EVENT_VALIDATION_ERROR', {
      eventType,
      field,
    });
    this.name = 'EventValidationError';
  }
}

/**
 * Event listener error
 */
export class EventListenerError extends IntegrationError {
  public readonly originalCause?: Error;

  constructor(
    public readonly eventType: string,
    public readonly listenerId: string,
    message: string,
    cause?: Error
  ) {
    super(message, 'EVENT_LISTENER_ERROR', {
      eventType,
      listenerId,
      cause: cause?.message,
    });
    this.name = 'EventListenerError';
    this.originalCause = cause;
  }
}

/**
 * Event rate limit error
 */
export class EventRateLimitError extends IntegrationError {
  constructor(
    public readonly source: string,
    public readonly limit: number,
    public readonly current: number
  ) {
    super(
      `Event rate limit exceeded for source ${source}: ${current}/${limit} per second`,
      'EVENT_RATE_LIMIT_ERROR',
      { source, limit, current }
    );
    this.name = 'EventRateLimitError';
  }
}

// ============================================
// Configuration Errors
// ============================================

/**
 * Configuration loading error
 */
export class ConfigurationLoadError extends IntegrationError {
  public readonly originalCause?: Error;

  constructor(
    public readonly source: string,
    message: string,
    cause?: Error
  ) {
    super(message, 'CONFIG_LOAD_ERROR', {
      source,
      cause: cause?.message,
    });
    this.name = 'ConfigurationLoadError';
    this.originalCause = cause;
  }
}

/**
 * Configuration validation error
 */
export class ConfigurationValidationError extends IntegrationError {
  constructor(
    public readonly field: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message, 'CONFIG_VALIDATION_ERROR', {
      field,
      details,
    });
    this.name = 'ConfigurationValidationError';
  }
}

// ============================================
// Bootstrap/Shutdown Errors
// ============================================

/**
 * Bootstrap error
 */
export class BootstrapError extends IntegrationError {
  public readonly originalCause?: Error;

  constructor(
    public readonly phase: string,
    public readonly failedComponent?: string,
    message?: string,
    cause?: Error
  ) {
    const msg = message || `Bootstrap failed at phase: ${phase}`;
    super(msg, 'BOOTSTRAP_ERROR', {
      phase,
      failedComponent,
      cause: cause?.message,
    });
    this.name = 'BootstrapError';
    this.originalCause = cause;
  }
}

/**
 * Shutdown error
 */
export class ShutdownError extends IntegrationError {
  public readonly originalCause?: Error;

  constructor(
    public readonly failedComponent: string,
    message: string,
    cause?: Error
  ) {
    super(message, 'SHUTDOWN_ERROR', {
      failedComponent,
      cause: cause?.message,
    });
    this.name = 'ShutdownError';
    this.originalCause = cause;
  }
}

/**
 * Shutdown timeout error
 */
export class ShutdownTimeoutError extends IntegrationError {
  constructor(
    public readonly timeout: number,
    public readonly pendingComponents: string[]
  ) {
    super(
      `Shutdown timeout after ${timeout}ms. Pending: ${pendingComponents.join(', ')}`,
      'SHUTDOWN_TIMEOUT_ERROR',
      { timeout, pendingComponents }
    );
    this.name = 'ShutdownTimeoutError';
  }
}

/**
 * Registry sealed error - thrown when trying to modify sealed registry
 */
export class RegistrySealedError extends IntegrationError {
  constructor(public readonly operation: string) {
    super(
      `Cannot ${operation}: registry is sealed after initialization`,
      'REGISTRY_SEALED_ERROR',
      { operation }
    );
    this.name = 'RegistrySealedError';
  }
}

// ============================================
// Topological Sort Errors
// ============================================

/**
 * Circular dependency error
 */
export class CircularDependencyError extends IntegrationError {
  constructor(public readonly cycle: string[]) {
    super(
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      'CIRCULAR_DEPENDENCY_ERROR',
      { cycle }
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Unresolved dependency error
 */
export class UnresolvedDependencyError extends IntegrationError {
  constructor(
    public readonly component: string,
    public readonly missingDependency: string
  ) {
    super(
      `Component ${component} depends on unregistered component: ${missingDependency}`,
      'UNRESOLVED_DEPENDENCY_ERROR',
      { component, missingDependency }
    );
    this.name = 'UnresolvedDependencyError';
  }
}

// ============================================
// Type Guards
// ============================================

/**
 * Type guard for IntegrationError
 */
export function isIntegrationError(error: unknown): error is IntegrationError {
  return error instanceof IntegrationError;
}

/**
 * Type guard for specific error codes
 */
export function hasErrorCode(
  error: unknown,
  code: string
): error is IntegrationError {
  return isIntegrationError(error) && error.code === code;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  const recoverableCodes = [
    'COMPONENT_INIT_ERROR',
    'EVENT_EMISSION_ERROR',
    'HEALTH_CHECK_ERROR',
    'CONFIG_LOAD_ERROR',
    'EVENT_RATE_LIMIT_ERROR',
  ];
  return isIntegrationError(error) && recoverableCodes.includes(error.code);
}

/**
 * Check if error is a security-related error
 */
export function isSecurityError(error: unknown): boolean {
  const securityCodes = [
    'REGISTRY_SEALED_ERROR',
    'EVENT_VALIDATION_ERROR',
  ];
  return isIntegrationError(error) && securityCodes.includes(error.code);
}
