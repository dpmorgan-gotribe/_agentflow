/**
 * Component Registry
 *
 * Manages component lifecycle, dependency resolution, and initialization order.
 * Uses Kahn's algorithm for topological sort to determine initialization order.
 */

import type {
  Component,
  ComponentMetadata,
  ComponentState,
  ComponentStatus,
  HealthCheckResult,
} from './types.js';
import { ComponentMetadataSchema, INTEGRATION_LIMITS } from './types.js';
import {
  ComponentRegistrationError,
  ComponentInitializationError,
  ComponentShutdownError,
  ComponentDependencyError,
  ComponentNotFoundError,
  CircularDependencyError,
  UnresolvedDependencyError,
  RegistrySealedError,
  HealthCheckError,
} from './errors.js';

/**
 * Component entry with state tracking
 */
interface ComponentEntry {
  component: Component;
  state: ComponentState;
  initializedAt?: Date;
  shutdownAt?: Date;
  error?: string;
}

/**
 * ComponentRegistry implementation
 *
 * Manages component registration, dependency resolution,
 * and lifecycle (initialization/shutdown).
 */
export class ComponentRegistry {
  private components: Map<string, ComponentEntry> = new Map();
  private initializationOrder: string[] = [];
  private sealed: boolean = false;

  /**
   * Register a component
   *
   * @throws {RegistrySealedError} If registry is sealed
   * @throws {ComponentRegistrationError} If component is invalid
   */
  register(component: Component): void {
    if (this.sealed) {
      throw new RegistrySealedError('register component');
    }

    // Validate component metadata
    const validation = ComponentMetadataSchema.safeParse({
      name: component.name,
      version: component.version,
      dependencies: component.dependencies,
    });

    if (!validation.success) {
      throw new ComponentRegistrationError(
        component.name ?? 'unknown',
        `Invalid component metadata: ${validation.error.message}`
      );
    }

    // Check component limit
    if (this.components.size >= INTEGRATION_LIMITS.maxComponents) {
      throw new ComponentRegistrationError(
        component.name,
        `Maximum component limit reached: ${INTEGRATION_LIMITS.maxComponents}`
      );
    }

    // Check for duplicate
    if (this.components.has(component.name)) {
      throw new ComponentRegistrationError(
        component.name,
        `Component already registered: ${component.name}`
      );
    }

    // Validate required methods
    if (typeof component.initialize !== 'function') {
      throw new ComponentRegistrationError(
        component.name,
        'Component must have initialize() method'
      );
    }
    if (typeof component.shutdown !== 'function') {
      throw new ComponentRegistrationError(
        component.name,
        'Component must have shutdown() method'
      );
    }
    if (typeof component.healthCheck !== 'function') {
      throw new ComponentRegistrationError(
        component.name,
        'Component must have healthCheck() method'
      );
    }

    this.components.set(component.name, {
      component,
      state: 'registered',
    });
  }

  /**
   * Unregister a component
   *
   * @throws {RegistrySealedError} If registry is sealed
   */
  unregister(name: string): void {
    if (this.sealed) {
      throw new RegistrySealedError('unregister component');
    }

    const entry = this.components.get(name);
    if (entry && entry.state !== 'registered') {
      throw new ComponentRegistrationError(
        name,
        `Cannot unregister component in state: ${entry.state}`
      );
    }

    this.components.delete(name);
  }

  /**
   * Get a component by name
   */
  get<T extends Component>(name: string): T | undefined {
    const entry = this.components.get(name);
    return entry?.component as T | undefined;
  }

  /**
   * Check if component exists
   */
  has(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Get all component names
   */
  getNames(): string[] {
    return [...this.components.keys()];
  }

  /**
   * Get component status
   */
  getStatus(name: string): ComponentStatus | undefined {
    const entry = this.components.get(name);
    if (!entry) return undefined;

    return {
      name,
      state: entry.state,
      initializedAt: entry.initializedAt,
      shutdownAt: entry.shutdownAt,
      error: entry.error,
    };
  }

  /**
   * Get all component statuses
   */
  getAllStatuses(): ComponentStatus[] {
    return [...this.components.entries()].map(([name, entry]) => ({
      name,
      state: entry.state,
      initializedAt: entry.initializedAt,
      shutdownAt: entry.shutdownAt,
      error: entry.error,
    }));
  }

  /**
   * Seal the registry to prevent further modifications
   */
  seal(): void {
    this.sealed = true;
  }

  /**
   * Check if registry is sealed
   */
  isSealed(): boolean {
    return this.sealed;
  }

  /**
   * Initialize all components in dependency order
   *
   * @throws {CircularDependencyError} If circular dependencies detected
   * @throws {UnresolvedDependencyError} If dependencies are missing
   * @throws {ComponentInitializationError} If component fails to initialize
   */
  async initializeAll(config?: Record<string, unknown>): Promise<void> {
    // Validate all dependencies exist
    this.validateDependencies();

    // Calculate initialization order using topological sort
    this.initializationOrder = this.topologicalSort();

    // Seal registry after calculating order
    this.seal();

    // Initialize in order
    for (const name of this.initializationOrder) {
      const entry = this.components.get(name)!;

      try {
        entry.state = 'initializing';
        await entry.component.initialize(config?.[name] ?? {});
        entry.state = 'initialized';
        entry.initializedAt = new Date();
      } catch (error) {
        entry.state = 'failed';
        entry.error = (error as Error).message;

        throw new ComponentInitializationError(
          name,
          'initialization',
          `Failed to initialize component ${name}: ${(error as Error).message}`,
          error as Error
        );
      }
    }
  }

  /**
   * Shutdown all components in reverse initialization order
   *
   * Continues even if individual components fail, collecting errors.
   */
  async shutdownAll(): Promise<void> {
    const errors: Error[] = [];

    // Shutdown in reverse order
    const shutdownOrder = [...this.initializationOrder].reverse();

    for (const name of shutdownOrder) {
      const entry = this.components.get(name);
      if (!entry || entry.state !== 'initialized') {
        continue;
      }

      try {
        entry.state = 'shutting_down';
        await entry.component.shutdown();
        entry.state = 'shutdown';
        entry.shutdownAt = new Date();
      } catch (error) {
        entry.state = 'failed';
        entry.error = (error as Error).message;
        errors.push(
          new ComponentShutdownError(
            name,
            `Failed to shutdown ${name}: ${(error as Error).message}`,
            error as Error
          )
        );
      }
    }

    // If any errors occurred, throw the first one
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Run health checks on all initialized components
   */
  async healthCheckAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    for (const [name, entry] of this.components) {
      if (entry.state !== 'initialized') {
        results.set(name, {
          healthy: false,
          details: { state: entry.state, error: entry.error },
        });
        continue;
      }

      try {
        const result = await entry.component.healthCheck();
        results.set(name, result);
      } catch (error) {
        results.set(name, {
          healthy: false,
          details: { error: (error as Error).message },
        });
      }
    }

    return results;
  }

  /**
   * Check if all components are healthy
   */
  async isHealthy(): Promise<boolean> {
    const results = await this.healthCheckAll();
    for (const result of results.values()) {
      if (!result.healthy) return false;
    }
    return true;
  }

  /**
   * Validate all component dependencies exist
   */
  private validateDependencies(): void {
    for (const [name, entry] of this.components) {
      const missing: string[] = [];

      for (const dep of entry.component.dependencies) {
        if (!this.components.has(dep)) {
          missing.push(dep);
        }
      }

      if (missing.length > 0) {
        throw new ComponentDependencyError(name, missing);
      }
    }
  }

  /**
   * Topological sort using Kahn's algorithm
   *
   * Returns components in dependency order (dependencies first).
   */
  private topologicalSort(): string[] {
    // Build adjacency list and in-degree map
    const inDegree: Map<string, number> = new Map();
    const adjList: Map<string, string[]> = new Map();

    // Initialize
    for (const [name, entry] of this.components) {
      inDegree.set(name, entry.component.dependencies.length);

      for (const dep of entry.component.dependencies) {
        if (!adjList.has(dep)) {
          adjList.set(dep, []);
        }
        adjList.get(dep)!.push(name);
      }
    }

    // Find all nodes with no dependencies
    const queue: string[] = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    // Sort queue for deterministic order
    queue.sort();

    const result: string[] = [];
    let processed = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      processed++;

      // Process dependents
      const dependents = adjList.get(current) ?? [];
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) ?? 0) - 1;
        inDegree.set(dependent, newDegree);

        if (newDegree === 0) {
          // Insert in sorted order for determinism
          const insertIndex = queue.findIndex((n) => n > dependent);
          if (insertIndex === -1) {
            queue.push(dependent);
          } else {
            queue.splice(insertIndex, 0, dependent);
          }
        }
      }
    }

    // Check for cycles
    if (processed !== this.components.size) {
      // Find the cycle
      const cycle = this.findCycle();
      throw new CircularDependencyError(cycle);
    }

    return result;
  }

  /**
   * Find a cycle in the dependency graph
   *
   * Uses DFS with coloring (white/gray/black).
   */
  private findCycle(): string[] {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;

    const color: Map<string, number> = new Map();
    const parent: Map<string, string> = new Map();

    // Initialize all as white
    for (const name of this.components.keys()) {
      color.set(name, WHITE);
    }

    // DFS from each unvisited node
    for (const start of this.components.keys()) {
      if (color.get(start) !== WHITE) continue;

      const stack: string[] = [start];

      while (stack.length > 0) {
        const current = stack[stack.length - 1]!;

        if (color.get(current) === WHITE) {
          color.set(current, GRAY);
        }

        const entry = this.components.get(current)!;
        let hasUnvisited = false;

        for (const dep of entry.component.dependencies) {
          if (color.get(dep) === WHITE) {
            parent.set(dep, current);
            stack.push(dep);
            hasUnvisited = true;
            break;
          } else if (color.get(dep) === GRAY) {
            // Found cycle - reconstruct it
            const cycle: string[] = [dep];
            let node = current;
            while (node !== dep) {
              cycle.push(node);
              node = parent.get(node) ?? dep;
            }
            cycle.push(dep);
            return cycle.reverse();
          }
        }

        if (!hasUnvisited) {
          color.set(current, BLACK);
          stack.pop();
        }
      }
    }

    // Fallback - shouldn't reach here
    return ['unknown'];
  }
}
