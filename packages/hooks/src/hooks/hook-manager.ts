/**
 * Hook Manager
 *
 * Central management for all hooks in the system.
 * Provides registration, execution, and lifecycle management.
 */

import {
  type HookPoint,
  type HookResult,
  type HookRegistration,
  type HookConfig,
  type BaseHookPayload,
  HOOK_POINTS,
  hookRegistrationSchema,
} from './hook-types.js';
import { HookTimeoutError, HookRegistrationError } from './hook-errors.js';

/**
 * Hook execution statistics
 */
interface HookStats {
  calls: number;
  failures: number;
  totalDuration: number;
  avgDuration: number;
}

/**
 * Default hook configuration - secure by default
 */
const DEFAULT_CONFIG: HookConfig = {
  enabled: true,
  timeout: 2000, // 2 seconds - reduced from 5s for security
  failureMode: 'block', // Fail-safe: block on failure
  maxRetries: 0, // No retries by default for security hooks
};

/**
 * Hook Manager class
 *
 * Singleton pattern with EventEmitter-like capabilities
 */
export class HookManager {
  private hooks: Map<HookPoint, HookRegistration[]> = new Map();
  private config: HookConfig;
  private executionStats: Map<string, HookStats> = new Map();
  private listeners: Map<string, Array<(data: unknown) => void>> = new Map();

  constructor(config: Partial<HookConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeHookPoints();
  }

  /**
   * Initialize all hook points with empty arrays
   */
  private initializeHookPoints(): void {
    for (const point of HOOK_POINTS) {
      this.hooks.set(point, []);
    }
  }

  /**
   * Register a hook
   */
  register(
    registration: Omit<HookRegistration, 'enabled'> & { enabled?: boolean }
  ): void {
    const hookId = registration.id;
    const hookPoint = registration.point;

    // Validate registration input (excluding handler)
    const validationResult = hookRegistrationSchema.safeParse({
      id: hookId,
      point: hookPoint,
      priority: registration.priority,
      description: registration.description,
      source: registration.source,
      enabled: registration.enabled,
    });

    if (!validationResult.success) {
      throw new HookRegistrationError(
        hookId,
        hookPoint,
        `Invalid hook registration: ${validationResult.error.message}`
      );
    }

    const hooks = this.hooks.get(hookPoint);

    if (!hooks) {
      throw new HookRegistrationError(
        hookId,
        hookPoint,
        `Invalid hook point: ${hookPoint}`
      );
    }

    // Check for duplicate ID
    const existingIndex = hooks.findIndex((h) => h.id === hookId);
    if (existingIndex !== -1) {
      // Replace existing hook with same ID
      hooks.splice(existingIndex, 1);
    }

    const fullRegistration: HookRegistration = {
      ...registration,
      enabled: registration.enabled ?? true,
    };

    // Insert in priority order (lower priority = runs first)
    const insertIndex = hooks.findIndex(
      (h) => h.priority > fullRegistration.priority
    );
    if (insertIndex === -1) {
      hooks.push(fullRegistration);
    } else {
      hooks.splice(insertIndex, 0, fullRegistration);
    }

    this.emit('hook:registered', fullRegistration);
  }

  /**
   * Unregister a hook by ID
   */
  unregister(hookId: string): boolean {
    for (const hooks of this.hooks.values()) {
      const index = hooks.findIndex((h) => h.id === hookId);
      if (index !== -1) {
        hooks.splice(index, 1);
        this.emit('hook:unregistered', { hookId });
        return true;
      }
    }
    return false;
  }

  /**
   * Execute all hooks for a point
   */
  async execute<P extends BaseHookPayload>(
    point: HookPoint,
    payload: P
  ): Promise<HookResult<P>> {
    if (!this.config.enabled) {
      return { action: 'continue', data: payload };
    }

    const hooks = this.hooks.get(point);
    if (!hooks || hooks.length === 0) {
      return { action: 'continue', data: payload };
    }

    let currentPayload = payload;
    const warnings: string[] = [];

    for (const hook of hooks) {
      if (!hook.enabled) continue;

      const startTime = Date.now();

      try {
        const result = await this.executeHook(hook, currentPayload);
        this.recordExecution(hook.id, Date.now() - startTime, false);

        switch (result.action) {
          case 'block':
            this.emit('hook:blocked', { hook, result });
            return {
              action: 'block',
              reason: result.reason ?? `Blocked by hook ${hook.id}`,
              warnings: [...warnings, ...(result.warnings ?? [])],
            };

          case 'skip':
            // Skip remaining hooks
            return {
              action: 'continue',
              data: currentPayload,
              warnings: [...warnings, ...(result.warnings ?? [])],
            };

          case 'modify':
            if (result.data) {
              currentPayload = result.data as P;
            }
            if (result.warnings) {
              warnings.push(...result.warnings);
            }
            break;

          case 'continue':
          default:
            if (result.warnings) {
              warnings.push(...result.warnings);
            }
            break;
        }
      } catch (error) {
        this.recordExecution(hook.id, Date.now() - startTime, true);
        const errorMsg = error instanceof Error ? error.message : String(error);

        switch (this.config.failureMode) {
          case 'block':
            return {
              action: 'block',
              reason: `Hook ${hook.id} failed: ${errorMsg}`,
              warnings,
            };

          case 'warn':
            warnings.push(`Hook ${hook.id} failed: ${errorMsg}`);
            break;

          case 'ignore':
            // Silently continue
            break;
        }
      }
    }

    return {
      action: 'continue',
      data: currentPayload,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Execute a single hook with timeout
   */
  private async executeHook<P extends BaseHookPayload>(
    hook: HookRegistration,
    payload: P
  ): Promise<HookResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new HookTimeoutError(hook.id, this.config.timeout));
      }, this.config.timeout);

      hook
        .handler(payload)
        .then((result: HookResult) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Record execution statistics
   */
  private recordExecution(
    hookId: string,
    duration: number,
    failed: boolean
  ): void {
    const stats = this.executionStats.get(hookId) ?? {
      calls: 0,
      failures: 0,
      totalDuration: 0,
      avgDuration: 0,
    };

    stats.calls++;
    if (failed) stats.failures++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.calls;

    this.executionStats.set(hookId, stats);
  }

  /**
   * Enable/disable a hook
   *
   * Note: Critical built-in hooks cannot be disabled by non-builtin sources
   */
  setEnabled(hookId: string, enabled: boolean): boolean {
    for (const hooks of this.hooks.values()) {
      const hook = hooks.find((h) => h.id === hookId);
      if (hook) {
        // Prevent disabling critical security hooks
        const criticalHooks = [
          'builtin:secret-detection',
          'builtin:dangerous-file-protection',
        ];
        if (criticalHooks.includes(hookId) && !enabled) {
          // Log attempt but don't disable
          this.emit('hook:disable-blocked', {
            hookId,
            reason: 'Cannot disable critical security hook',
          });
          return false;
        }

        hook.enabled = enabled;
        this.emit('hook:status-changed', { hookId, enabled });
        return true;
      }
    }
    return false;
  }

  /**
   * Get all registered hooks
   */
  getHooks(point?: HookPoint): HookRegistration[] {
    if (point) {
      return [...(this.hooks.get(point) ?? [])];
    }
    return Array.from(this.hooks.values()).flat();
  }

  /**
   * Get hook by ID
   */
  getHook(hookId: string): HookRegistration | undefined {
    for (const hooks of this.hooks.values()) {
      const hook = hooks.find((h) => h.id === hookId);
      if (hook) return hook;
    }
    return undefined;
  }

  /**
   * Get execution statistics
   */
  getStats(): Map<string, HookStats> {
    return new Map(this.executionStats);
  }

  /**
   * Get stats for a specific hook
   */
  getHookStats(hookId: string): HookStats | undefined {
    return this.executionStats.get(hookId);
  }

  /**
   * Clear all hooks (except builtin if specified)
   */
  clear(includeBuiltin = false): void {
    for (const [, hooks] of this.hooks) {
      if (includeBuiltin) {
        hooks.length = 0;
      } else {
        // Keep builtin hooks
        const builtinHooks = hooks.filter((h) => h.source === 'builtin');
        hooks.length = 0;
        hooks.push(...builtinHooks);
      }
    }
    this.executionStats.clear();
    this.emit('hooks:cleared', { includeBuiltin });
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<HookConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): HookConfig {
    return { ...this.config };
  }

  /**
   * Simple event emitter - on
   */
  on(event: string, listener: (data: unknown) => void): void {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  /**
   * Simple event emitter - off
   */
  off(event: string, listener: (data: unknown) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Simple event emitter - emit
   */
  private emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }
}

/**
 * Singleton hook manager instance
 */
let hookManagerInstance: HookManager | null = null;

/**
 * Get the singleton hook manager instance
 */
export function getHookManager(config?: Partial<HookConfig>): HookManager {
  if (!hookManagerInstance) {
    hookManagerInstance = new HookManager(config);
  }
  return hookManagerInstance;
}

/**
 * Reset the hook manager (for testing)
 */
export function resetHookManager(): void {
  hookManagerInstance = null;
}

/**
 * Create a new hook manager instance (for testing or isolation)
 */
export function createHookManager(config?: Partial<HookConfig>): HookManager {
  return new HookManager(config);
}
