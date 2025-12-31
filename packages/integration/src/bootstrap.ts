/**
 * Application Bootstrap
 *
 * Manages application initialization and shutdown sequences.
 * Coordinates component startup in the correct order per spec.
 */

import type {
  Component,
  BootstrapState,
  BootstrapConfig,
} from './types.js';
import {
  BootstrapPhases,
  SystemEvents,
  DEFAULT_BOOTSTRAP_CONFIG,
} from './types.js';
import { ComponentRegistry } from './component-registry.js';
import { EventBus } from './event-bus.js';
import { BootstrapError, ShutdownTimeoutError } from './errors.js';

/**
 * ApplicationBootstrap implementation
 *
 * Manages the 11-phase initialization sequence and reverse shutdown.
 */
export class ApplicationBootstrap {
  private readonly config: BootstrapConfig;
  private readonly registry: ComponentRegistry;
  private readonly eventBus: EventBus;
  private state: BootstrapState;
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor(
    registry: ComponentRegistry,
    eventBus: EventBus,
    config: Partial<BootstrapConfig> = {}
  ) {
    this.config = { ...DEFAULT_BOOTSTRAP_CONFIG, ...config };
    this.registry = registry;
    this.eventBus = eventBus;
    this.state = this.initializeState();
  }

  /**
   * Get current bootstrap state
   */
  getState(): BootstrapState {
    return { ...this.state };
  }

  /**
   * Check if system is ready
   */
  isReady(): boolean {
    return this.state.ready;
  }

  /**
   * Initialize all components
   *
   * Executes 11-phase initialization sequence.
   */
  async initialize(componentConfig?: Record<string, unknown>): Promise<void> {
    if (this.state.ready) {
      return; // Already initialized
    }

    this.state.startedAt = new Date();
    const startTime = Date.now();

    console.log('[BOOT] Starting Aigentflow...');

    // Emit system starting event
    this.eventBus.emitEvent({
      type: SystemEvents.SYSTEM_STARTED,
      source: 'bootstrap',
      timestamp: new Date(),
      data: { phase: 'starting' },
    });

    try {
      // Initialize all registered components
      await this.registry.initializeAll(componentConfig);

      // Mark all phases as completed (registry handles actual init)
      for (const phase of BootstrapPhases) {
        const phaseStatus = this.state.phases.find((p) => p.phase === phase);
        if (phaseStatus) {
          phaseStatus.status = 'completed';
          phaseStatus.completedAt = new Date();
        }
      }

      // Mark as ready
      this.state.ready = true;
      this.state.sealed = true;
      this.state.completedAt = new Date();
      this.state.totalDuration = Date.now() - startTime;

      console.log(`[BOOT] Aigentflow ready! (${this.state.totalDuration}ms)`);

      // Start health check interval if enabled
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      // Emit system started event
      this.eventBus.emitEvent({
        type: SystemEvents.SYSTEM_STARTED,
        source: 'bootstrap',
        timestamp: new Date(),
        data: {
          phase: 'completed',
          duration: this.state.totalDuration,
          components: this.registry.getNames(),
        },
      });
    } catch (error) {
      const failedPhase = this.findFailedPhase();

      // Emit failure event
      this.eventBus.emitEvent({
        type: SystemEvents.SYSTEM_STOPPED,
        source: 'bootstrap',
        timestamp: new Date(),
        data: {
          phase: 'failed',
          error: (error as Error).message,
          failedPhase,
        },
      });

      throw new BootstrapError(
        failedPhase ?? 'unknown',
        undefined,
        `Bootstrap failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Shutdown all components
   *
   * Executes shutdown in reverse initialization order.
   */
  async shutdown(): Promise<void> {
    if (!this.state.ready) {
      return; // Not initialized
    }

    console.log('[SHUTDOWN] Stopping Aigentflow...');

    // Emit stopping event
    this.eventBus.emitEvent({
      type: SystemEvents.SYSTEM_STOPPING,
      source: 'bootstrap',
      timestamp: new Date(),
      data: { phase: 'stopping' },
    });

    // Stop health checks
    this.stopHealthChecks();

    const startTime = Date.now();

    try {
      // Create shutdown promise with timeout
      const shutdownPromise = this.registry.shutdownAll();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new ShutdownTimeoutError(
              this.config.shutdownTimeout,
              this.getPendingComponents()
            )
          );
        }, this.config.shutdownTimeout);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      this.state.ready = false;
      console.log(`[SHUTDOWN] Aigentflow stopped (${duration}ms)`);

      // Emit stopped event
      this.eventBus.emitEvent({
        type: SystemEvents.SYSTEM_STOPPED,
        source: 'bootstrap',
        timestamp: new Date(),
        data: { phase: 'completed', duration },
      });
    } catch (error) {
      console.error('[SHUTDOWN] Error during shutdown:', error);

      // Emit failure event
      this.eventBus.emitEvent({
        type: SystemEvents.SYSTEM_STOPPED,
        source: 'bootstrap',
        timestamp: new Date(),
        data: {
          phase: 'failed',
          error: (error as Error).message,
        },
      });

      throw error;
    }
  }

  /**
   * Run health check on all components
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Map<string, { healthy: boolean; details?: unknown }>;
  }> {
    const results = await this.registry.healthCheckAll();
    let healthy = true;

    for (const result of results.values()) {
      if (!result.healthy) {
        healthy = false;
        break;
      }
    }

    return { healthy, components: results };
  }

  /**
   * Get component from registry
   */
  getComponent<T extends Component>(name: string): T | undefined {
    return this.registry.get<T>(name);
  }

  /**
   * Get event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get registry
   */
  getRegistry(): ComponentRegistry {
    return this.registry;
  }

  /**
   * Initialize bootstrap state
   */
  private initializeState(): BootstrapState {
    return {
      phases: BootstrapPhases.map((phase) => ({
        phase,
        status: 'pending' as const,
      })),
      ready: false,
      sealed: false,
    };
  }

  /**
   * Find the phase that failed
   */
  private findFailedPhase(): string | undefined {
    for (const status of this.state.phases) {
      if (status.status === 'failed') {
        return status.phase;
      }
    }
    return undefined;
  }

  /**
   * Get components that haven't shutdown
   */
  private getPendingComponents(): string[] {
    return this.registry
      .getAllStatuses()
      .filter((s) => s.state === 'initialized' || s.state === 'shutting_down')
      .map((s) => s.name);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      try {
        const { healthy, components } = await this.healthCheck();

        if (!healthy) {
          console.warn('[HEALTH] Unhealthy components detected');
          for (const [name, result] of components) {
            if (!result.healthy) {
              console.warn(`[HEALTH] ${name}: unhealthy`, result.details);
            }
          }
        }
      } catch (error) {
        console.error('[HEALTH] Health check failed:', error);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}

/**
 * Create a bootstrap instance with new registry and event bus
 */
export function createBootstrap(
  config?: Partial<BootstrapConfig>
): {
  bootstrap: ApplicationBootstrap;
  registry: ComponentRegistry;
  eventBus: EventBus;
} {
  const registry = new ComponentRegistry();
  const eventBus = new EventBus();
  const bootstrap = new ApplicationBootstrap(registry, eventBus, config);

  return { bootstrap, registry, eventBus };
}
