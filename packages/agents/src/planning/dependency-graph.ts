/**
 * Dependency Graph
 *
 * Manages task dependencies and execution ordering.
 * Provides cycle detection, topological sorting, and
 * parallel execution group calculation.
 *
 * SECURITY:
 * - Validates all task IDs before adding
 * - Detects malicious dependency cycles
 */

import type { Task, Epic } from '../schemas/project-manager-output.js';
import { flattenTasks } from './work-breakdown.js';

/**
 * Cycle detection result
 */
export interface CycleInfo {
  cycle: string[];
  description: string;
}

/**
 * Dependency Graph class
 *
 * Builds and analyzes task dependency relationships.
 */
export class DependencyGraph {
  /** Forward adjacency list: task -> its dependencies */
  private adjacencyList: Map<string, string[]> = new Map();

  /** Reverse adjacency list: task -> tasks that depend on it */
  private reverseList: Map<string, string[]> = new Map();

  /** Task storage for lookup */
  private tasks: Map<string, Task> = new Map();

  /**
   * Build graph from epics
   *
   * @param epics - Array of epics containing tasks
   * @returns A new DependencyGraph instance
   */
  static fromEpics(epics: Epic[]): DependencyGraph {
    const graph = new DependencyGraph();
    const tasks = flattenTasks(epics);

    for (const task of tasks) {
      graph.addTask(task);
    }

    return graph;
  }

  /**
   * Add a task to the graph
   *
   * @param task - The task to add
   */
  addTask(task: Task): void {
    // Validate task ID
    if (!task.id || typeof task.id !== 'string') {
      throw new Error('Task must have a valid ID');
    }

    this.tasks.set(task.id, task);
    this.adjacencyList.set(task.id, [...task.dependencies]);

    // Initialize reverse list entry if not exists
    if (!this.reverseList.has(task.id)) {
      this.reverseList.set(task.id, []);
    }

    // Build reverse adjacency for dependents lookup
    for (const dep of task.dependencies) {
      const dependents = this.reverseList.get(dep) || [];
      dependents.push(task.id);
      this.reverseList.set(dep, dependents);
    }
  }

  /**
   * Get a task by ID
   *
   * @param taskId - The task ID
   * @returns The task if found
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all task IDs in the graph
   *
   * @returns Array of all task IDs
   */
  getAllTaskIds(): string[] {
    return Array.from(this.adjacencyList.keys());
  }

  /**
   * Get dependencies for a task
   *
   * @param taskId - The task ID
   * @returns Array of dependency task IDs
   */
  getDependencies(taskId: string): string[] {
    return this.adjacencyList.get(taskId) || [];
  }

  /**
   * Get tasks that depend on a given task
   *
   * @param taskId - The task ID
   * @returns Array of dependent task IDs
   */
  getDependents(taskId: string): string[] {
    return this.reverseList.get(taskId) || [];
  }

  /**
   * Check if task is ready (all dependencies complete)
   *
   * @param taskId - The task ID to check
   * @param completedTasks - Set of completed task IDs
   * @returns true if all dependencies are in completedTasks
   */
  isReady(taskId: string, completedTasks: Set<string>): boolean {
    const deps = this.getDependencies(taskId);
    return deps.every((dep) => completedTasks.has(dep));
  }

  /**
   * Get all tasks with no dependencies (can start immediately)
   *
   * @returns Array of root task IDs
   */
  getRootTasks(): string[] {
    const roots: string[] = [];
    for (const [taskId, deps] of this.adjacencyList) {
      if (deps.length === 0) {
        roots.push(taskId);
      }
    }
    return roots;
  }

  /**
   * Get all leaf tasks (no other task depends on them)
   *
   * @returns Array of leaf task IDs
   */
  getLeafTasks(): string[] {
    const leaves: string[] = [];
    for (const taskId of this.adjacencyList.keys()) {
      const dependents = this.reverseList.get(taskId) || [];
      if (dependents.length === 0) {
        leaves.push(taskId);
      }
    }
    return leaves;
  }

  /**
   * Get ready tasks given a set of completed tasks
   *
   * @param completedTasks - Set of completed task IDs
   * @returns Array of task IDs that are ready to execute
   */
  getReadyTasks(completedTasks: Set<string>): string[] {
    const ready: string[] = [];
    for (const taskId of this.adjacencyList.keys()) {
      if (!completedTasks.has(taskId) && this.isReady(taskId, completedTasks)) {
        ready.push(taskId);
      }
    }
    return ready;
  }

  /**
   * Get topologically sorted task order
   *
   * Uses Kahn's algorithm for deterministic ordering.
   *
   * @returns Array of task IDs in execution order
   * @throws Error if graph contains cycles
   */
  getTopologicalOrder(): string[] {
    // Check for cycles first
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      throw new Error(
        `Cannot compute topological order: cycles detected: ${cycles.map((c) => c.cycle.join(' -> ')).join('; ')}`
      );
    }

    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Calculate in-degrees
    for (const taskId of this.adjacencyList.keys()) {
      inDegree.set(taskId, 0);
    }

    for (const [_, deps] of this.adjacencyList) {
      for (const dep of deps) {
        inDegree.set(dep, (inDegree.get(dep) || 0));
      }
    }

    for (const [taskId, deps] of this.adjacencyList) {
      // In-degree is number of tasks that depend on this task
      // We want to process dependencies first, so count dependencies
      inDegree.set(taskId, deps.length);
    }

    // Find all tasks with no dependencies
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    // Process queue
    while (queue.length > 0) {
      // Sort for deterministic output
      queue.sort();
      const taskId = queue.shift()!;
      result.push(taskId);

      // Reduce in-degree for all dependents
      const dependents = this.getDependents(taskId);
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    return result;
  }

  /**
   * Detect circular dependencies
   *
   * Uses DFS with recursion stack tracking.
   *
   * @returns Array of cycle info objects
   */
  detectCycles(): CycleInfo[] {
    const cycles: CycleInfo[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const deps = this.getDependencies(taskId);
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (dfs(dep)) return true;
        } else if (recursionStack.has(dep)) {
          // Found cycle
          const cycleStart = path.indexOf(dep);
          const cycle = [...path.slice(cycleStart), dep];
          cycles.push({
            cycle,
            description: `Circular dependency: ${cycle.join(' -> ')}`,
          });
          return true;
        }
      }

      path.pop();
      recursionStack.delete(taskId);
      return false;
    };

    for (const taskId of this.adjacencyList.keys()) {
      if (!visited.has(taskId)) {
        dfs(taskId);
      }
    }

    return cycles;
  }

  /**
   * Find critical path (longest dependency chain)
   *
   * The critical path represents the minimum time needed
   * to complete all tasks, assuming unlimited parallelism.
   *
   * @returns Array of task IDs in the critical path
   */
  findCriticalPath(): string[] {
    // Can only compute if no cycles
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      return [];
    }

    const order = this.getTopologicalOrder();
    const distances: Map<string, number> = new Map();
    const predecessors: Map<string, string> = new Map();

    // Initialize distances
    for (const taskId of order) {
      distances.set(taskId, 0);
    }

    // Calculate longest path to each node
    for (const taskId of order) {
      const deps = this.getDependencies(taskId);
      for (const dep of deps) {
        const newDist = (distances.get(dep) || 0) + 1;
        if (newDist > (distances.get(taskId) || 0)) {
          distances.set(taskId, newDist);
          predecessors.set(taskId, dep);
        }
      }
    }

    // Find the end of critical path
    let maxDist = 0;
    let endTask = '';
    for (const [taskId, dist] of distances) {
      if (dist > maxDist) {
        maxDist = dist;
        endTask = taskId;
      }
    }

    if (!endTask) {
      // All tasks are independent
      return order.length > 0 ? [order[0]!] : [];
    }

    // Reconstruct critical path
    const criticalPath: string[] = [];
    let current: string | undefined = endTask;
    while (current) {
      criticalPath.unshift(current);
      current = predecessors.get(current);
    }

    return criticalPath;
  }

  /**
   * Get parallelizable task groups
   *
   * Groups tasks by their level in the dependency graph.
   * Tasks in the same group can be executed in parallel.
   *
   * @returns Array of task ID arrays (each array is a parallel group)
   */
  getParallelGroups(): string[][] {
    // Can only compute if no cycles
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      return [];
    }

    const order = this.getTopologicalOrder();
    const levels: Map<string, number> = new Map();

    // Assign levels based on dependencies
    for (const taskId of order) {
      const deps = this.getDependencies(taskId);
      if (deps.length === 0) {
        levels.set(taskId, 0);
      } else {
        const maxDepLevel = Math.max(...deps.map((d) => levels.get(d) || 0));
        levels.set(taskId, maxDepLevel + 1);
      }
    }

    // Group by level
    const groups: Map<number, string[]> = new Map();
    for (const [taskId, level] of levels) {
      const group = groups.get(level) || [];
      group.push(taskId);
      groups.set(level, group);
    }

    // Convert to array sorted by level
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, tasks]) => tasks.sort()); // Sort tasks within group for determinism
  }

  /**
   * Get all tasks that must complete before a given task
   *
   * @param taskId - The task ID
   * @returns Set of all transitive dependency IDs
   */
  getAllDependencies(taskId: string): Set<string> {
    const result = new Set<string>();
    const queue = [...this.getDependencies(taskId)];

    while (queue.length > 0) {
      const dep = queue.shift()!;
      if (!result.has(dep)) {
        result.add(dep);
        queue.push(...this.getDependencies(dep));
      }
    }

    return result;
  }

  /**
   * Get all tasks that cannot start until a given task completes
   *
   * @param taskId - The task ID
   * @returns Set of all transitive dependent IDs
   */
  getAllDependents(taskId: string): Set<string> {
    const result = new Set<string>();
    const queue = [...this.getDependents(taskId)];

    while (queue.length > 0) {
      const dep = queue.shift()!;
      if (!result.has(dep)) {
        result.add(dep);
        queue.push(...this.getDependents(dep));
      }
    }

    return result;
  }

  /**
   * Calculate estimated completion time in levels
   *
   * Each level represents one "wave" of parallel execution.
   *
   * @returns Number of levels (waves) needed
   */
  getEstimatedLevels(): number {
    const groups = this.getParallelGroups();
    return groups.length;
  }

  /**
   * Validate graph integrity
   *
   * @returns Validation result with any issues found
   */
  validate(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for missing dependencies
    for (const [taskId, deps] of this.adjacencyList) {
      for (const dep of deps) {
        if (!this.adjacencyList.has(dep)) {
          issues.push(`Task ${taskId} depends on non-existent task ${dep}`);
        }
      }
    }

    // Check for cycles
    const cycles = this.detectCycles();
    for (const cycle of cycles) {
      issues.push(cycle.description);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
