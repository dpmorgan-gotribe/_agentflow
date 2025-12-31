/**
 * @aigentflow/integration
 *
 * Component integration and lifecycle management for Aigentflow.
 *
 * Provides:
 * - EventBus for inter-component communication
 * - ComponentRegistry for lifecycle management
 * - ApplicationBootstrap for initialization/shutdown
 * - GlobalErrorHandler for cross-component error handling
 *
 * @example
 * ```typescript
 * import {
 *   createBootstrap,
 *   ComponentRegistry,
 *   EventBus,
 *   GlobalErrorHandler,
 *   SystemEvents,
 * } from '@aigentflow/integration';
 *
 * // Create bootstrap with registry and event bus
 * const { bootstrap, registry, eventBus } = createBootstrap();
 *
 * // Register components
 * registry.register(databaseComponent);
 * registry.register(auditComponent);
 * registry.register(hooksComponent);
 *
 * // Initialize all components
 * await bootstrap.initialize();
 *
 * // Listen for events
 * eventBus.subscribe(SystemEvents.STATE_TRANSITION, (event) => {
 *   console.log('State changed:', event.data);
 * });
 *
 * // Handle errors
 * const errorHandler = new GlobalErrorHandler(eventBus);
 * await errorHandler.handle(error, {
 *   component: 'my-component',
 *   operation: 'my-operation',
 * });
 *
 * // Shutdown
 * await bootstrap.shutdown();
 * ```
 */

// Types and schemas
export {
  // System events
  type SystemEvent,
  type SystemEventType,
  SystemEvents,
  SystemEventSchema,
  AllowedEventSources,
  type AllowedEventSource,
  // Event bus config
  type EventBusConfig,
  type EventHistoryFilter,
  EventBusConfigSchema,
  EventHistoryFilterSchema,
  DEFAULT_EVENT_BUS_CONFIG,
  // Component types
  type Component,
  type ComponentMetadata,
  type ComponentState,
  type ComponentStatus,
  type HealthCheckResult,
  ComponentMetadataSchema,
  HealthCheckResultSchema,
  // Bootstrap types
  type BootstrapPhase,
  type BootstrapPhaseStatus,
  type BootstrapState,
  type BootstrapConfig,
  BootstrapPhases,
  BootstrapPhaseStatusSchema,
  BootstrapConfigSchema,
  DEFAULT_BOOTSTRAP_CONFIG,
  // Configuration types
  type ConfigurationSource,
  type ConfigurationOverride,
  type ConfigurationLoadResult,
  ConfigurationSources,
  // Error handler types
  type ErrorContext,
  type ErrorRecoveryResult,
  type RetryPolicy,
  ErrorContextSchema,
  RetryPolicySchema,
  DEFAULT_RETRY_POLICY,
  // Limits
  INTEGRATION_LIMITS,
  CRITICAL_EVENTS,
} from './types.js';

// Errors
export {
  // Base error
  IntegrationError,
  // Component errors
  ComponentRegistrationError,
  ComponentInitializationError,
  ComponentShutdownError,
  ComponentDependencyError,
  ComponentNotFoundError,
  // Health check errors
  HealthCheckError,
  // Event bus errors
  EventEmissionError,
  EventValidationError,
  EventListenerError,
  EventRateLimitError,
  // Configuration errors
  ConfigurationLoadError,
  ConfigurationValidationError,
  // Bootstrap errors
  BootstrapError,
  ShutdownError,
  ShutdownTimeoutError,
  RegistrySealedError,
  // Dependency errors
  CircularDependencyError,
  UnresolvedDependencyError,
  // Type guards
  isIntegrationError,
  hasErrorCode,
  isRecoverableError,
  isSecurityError,
} from './errors.js';

// Event Bus
export {
  EventBus,
  type EventListener,
  getGlobalEventBus,
  resetGlobalEventBus,
} from './event-bus.js';

// Component Registry
export { ComponentRegistry } from './component-registry.js';

// Bootstrap
export {
  ApplicationBootstrap,
  createBootstrap,
} from './bootstrap.js';

// Error Handler
export {
  GlobalErrorHandler,
  type ErrorHandlerConfig,
} from './error-handler.js';
