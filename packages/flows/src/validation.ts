/**
 * Flow Validation Utilities
 *
 * Provides comprehensive validation for user flows including:
 * - Structural validation (start/end steps, transitions)
 * - Cycle detection using DFS
 * - Reachability analysis
 * - Type-specific constraints (wait/timeout, decision/branches)
 *
 * Security features:
 * - Prevents infinite loops in validation
 * - Bounded recursion depth
 * - Validates all step references
 */

import type {
  UserFlow,
  FlowStep,
  FlowTransition,
  FlowStepType,
} from './schema.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Validation error with context
 */
export interface ValidationError {
  code: string;
  message: string;
  stepId?: string;
  transitionId?: string;
  severity: 'error' | 'warning';
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Cycle information
 */
export interface CycleInfo {
  cycle: string[];
  isInfinite: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum recursion depth for DFS */
const MAX_RECURSION_DEPTH = 1000;

/** Step types that require outgoing transitions */
const REQUIRES_OUTGOING: FlowStepType[] = [
  'start',
  'action',
  'decision',
  'process',
  'input',
  'wait',
];

/** Step types that should not have outgoing transitions */
const NO_OUTGOING: FlowStepType[] = ['end'];

/** Minimum branches for decision nodes */
const MIN_DECISION_BRANCHES = 2;

// ============================================================================
// Flow Validator Class
// ============================================================================

/**
 * Flow validator class
 */
export class FlowValidator {
  private flow: UserFlow;
  private stepMap: Map<string, FlowStep>;
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  constructor(flow: UserFlow) {
    this.flow = flow;
    this.stepMap = new Map(flow.steps.map((s) => [s.id, s]));
  }

  /**
   * Validate the flow and return results
   */
  validate(): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // Structural validations
    this.validateStartStep();
    this.validateEndSteps();
    this.validateTransitionReferences();
    this.validateStepTypes();

    // Graph validations
    this.validateReachability();
    this.validateCycles();

    // Type-specific validations
    this.validateDecisionNodes();
    this.validateWaitSteps();
    this.validateErrorSteps();

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Validate start step exists and is of type 'start'
   */
  private validateStartStep(): void {
    const startStep = this.stepMap.get(this.flow.startStep);

    if (!startStep) {
      this.addError(
        'INVALID_START_STEP',
        `Start step "${this.flow.startStep}" not found in steps`
      );
      return;
    }

    if (startStep.type !== 'start') {
      this.addWarning(
        'START_STEP_TYPE',
        `Start step "${this.flow.startStep}" has type "${startStep.type}" instead of "start"`,
        startStep.id
      );
    }

    // Check that start step has no incoming transitions
    const incomingToStart = this.flow.transitions.filter(
      (t) => t.to === this.flow.startStep
    );
    if (incomingToStart.length > 0) {
      this.addWarning(
        'START_HAS_INCOMING',
        `Start step has ${incomingToStart.length} incoming transitions`,
        this.flow.startStep
      );
    }
  }

  /**
   * Validate end steps exist and are of type 'end'
   */
  private validateEndSteps(): void {
    for (const endId of this.flow.endSteps) {
      const endStep = this.stepMap.get(endId);

      if (!endStep) {
        this.addError(
          'INVALID_END_STEP',
          `End step "${endId}" not found in steps`
        );
        continue;
      }

      if (endStep.type !== 'end') {
        this.addWarning(
          'END_STEP_TYPE',
          `End step "${endId}" has type "${endStep.type}" instead of "end"`,
          endId
        );
      }

      // Check that end steps have no outgoing transitions
      const outgoingFromEnd = this.flow.transitions.filter(
        (t) => t.from === endId
      );
      if (outgoingFromEnd.length > 0) {
        this.addError(
          'END_HAS_OUTGOING',
          `End step "${endId}" has ${outgoingFromEnd.length} outgoing transitions`,
          endId
        );
      }
    }
  }

  /**
   * Validate all transitions reference valid steps
   */
  private validateTransitionReferences(): void {
    for (const transition of this.flow.transitions) {
      if (!this.stepMap.has(transition.from)) {
        this.addError(
          'INVALID_TRANSITION_FROM',
          `Transition "${transition.id}" has unknown source step: ${transition.from}`,
          undefined,
          transition.id
        );
      }

      if (!this.stepMap.has(transition.to)) {
        this.addError(
          'INVALID_TRANSITION_TO',
          `Transition "${transition.id}" has unknown target step: ${transition.to}`,
          undefined,
          transition.id
        );
      }

      // Check for self-referencing transitions
      if (transition.from === transition.to) {
        this.addWarning(
          'SELF_TRANSITION',
          `Transition "${transition.id}" is a self-loop on step "${transition.from}"`,
          transition.from,
          transition.id
        );
      }
    }
  }

  /**
   * Validate step types have appropriate transitions
   */
  private validateStepTypes(): void {
    for (const step of this.flow.steps) {
      const outgoing = this.flow.transitions.filter((t) => t.from === step.id);
      const incoming = this.flow.transitions.filter((t) => t.to === step.id);

      // Check steps that require outgoing
      if (REQUIRES_OUTGOING.includes(step.type) && outgoing.length === 0) {
        // Skip if it's an end step
        if (!this.flow.endSteps.includes(step.id)) {
          this.addError(
            'MISSING_OUTGOING',
            `Step "${step.id}" of type "${step.type}" has no outgoing transitions`,
            step.id
          );
        }
      }

      // Check steps that should not have outgoing
      if (NO_OUTGOING.includes(step.type) && outgoing.length > 0) {
        this.addError(
          'UNEXPECTED_OUTGOING',
          `Step "${step.id}" of type "${step.type}" should not have outgoing transitions`,
          step.id
        );
      }

      // Non-start steps should have incoming transitions
      if (
        step.id !== this.flow.startStep &&
        step.type !== 'start' &&
        incoming.length === 0
      ) {
        this.addWarning(
          'NO_INCOMING',
          `Step "${step.id}" has no incoming transitions`,
          step.id
        );
      }
    }
  }

  /**
   * Validate all steps are reachable from start
   */
  private validateReachability(): void {
    const reachable = this.computeReachableSteps();

    for (const step of this.flow.steps) {
      if (!reachable.has(step.id)) {
        this.addError(
          'UNREACHABLE_STEP',
          `Step "${step.id}" is not reachable from the start step`,
          step.id
        );
      }
    }
  }

  /**
   * Compute set of reachable steps from start
   */
  private computeReachableSteps(): Set<string> {
    const reachable = new Set<string>();
    const queue: string[] = [this.flow.startStep];
    let iterations = 0;

    while (queue.length > 0 && iterations < MAX_RECURSION_DEPTH) {
      iterations++;
      const current = queue.shift()!;

      if (reachable.has(current)) continue;
      reachable.add(current);

      const outgoing = this.flow.transitions.filter((t) => t.from === current);
      for (const t of outgoing) {
        if (!reachable.has(t.to)) {
          queue.push(t.to);
        }
      }
    }

    return reachable;
  }

  /**
   * Detect cycles in the flow graph
   */
  private validateCycles(): void {
    const cycles = this.detectCycles();

    for (const cycle of cycles) {
      // Only report as error if cycle doesn't include an exit path
      const hasExitPath = this.cycleHasExitPath(cycle);

      if (!hasExitPath) {
        this.addError(
          'INFINITE_CYCLE',
          `Potential infinite loop detected: ${cycle.join(' → ')} → ${cycle[0]}`,
          cycle[0]
        );
      } else {
        this.addWarning(
          'CYCLE_DETECTED',
          `Cycle detected (with exit path): ${cycle.join(' → ')} → ${cycle[0]}`,
          cycle[0]
        );
      }
    }
  }

  /**
   * Detect all cycles using DFS
   */
  private detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (stepId: string, depth: number): void => {
      if (depth > MAX_RECURSION_DEPTH) return;

      if (recursionStack.has(stepId)) {
        // Found a cycle
        const cycleStart = path.indexOf(stepId);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(stepId)) return;

      visited.add(stepId);
      recursionStack.add(stepId);
      path.push(stepId);

      const outgoing = this.flow.transitions.filter((t) => t.from === stepId);
      for (const t of outgoing) {
        dfs(t.to, depth + 1);
      }

      path.pop();
      recursionStack.delete(stepId);
    };

    dfs(this.flow.startStep, 0);

    return cycles;
  }

  /**
   * Check if a cycle has an exit path
   */
  private cycleHasExitPath(cycle: string[]): boolean {
    const cycleSet = new Set(cycle);

    for (const stepId of cycle) {
      const outgoing = this.flow.transitions.filter((t) => t.from === stepId);

      for (const t of outgoing) {
        if (!cycleSet.has(t.to)) {
          // There's a transition out of the cycle
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Validate decision nodes have multiple branches
   */
  private validateDecisionNodes(): void {
    for (const step of this.flow.steps) {
      if (step.type !== 'decision') continue;

      const outgoing = this.flow.transitions.filter((t) => t.from === step.id);

      if (outgoing.length < MIN_DECISION_BRANCHES) {
        this.addError(
          'DECISION_NEEDS_BRANCHES',
          `Decision step "${step.id}" needs at least ${MIN_DECISION_BRANCHES} outgoing transitions, has ${outgoing.length}`,
          step.id
        );
      }

      // Check that decision branches have conditions or labels
      const unlabeled = outgoing.filter((t) => !t.condition && !t.label);
      if (unlabeled.length > 1) {
        this.addWarning(
          'DECISION_UNLABELED_BRANCHES',
          `Decision step "${step.id}" has ${unlabeled.length} unlabeled branches`,
          step.id
        );
      }
    }
  }

  /**
   * Validate wait steps have timeout configuration
   */
  private validateWaitSteps(): void {
    for (const step of this.flow.steps) {
      if (step.type !== 'wait') continue;

      if (!step.timeout) {
        this.addWarning(
          'WAIT_NO_TIMEOUT',
          `Wait step "${step.id}" has no timeout configured`,
          step.id
        );
      }
    }
  }

  /**
   * Validate error steps have fallback configured
   */
  private validateErrorSteps(): void {
    for (const step of this.flow.steps) {
      if (step.type !== 'error') continue;

      if (!step.errorHandling?.fallback) {
        this.addWarning(
          'ERROR_NO_FALLBACK',
          `Error step "${step.id}" has no fallback configured`,
          step.id
        );
      }
    }
  }

  /**
   * Add an error
   */
  private addError(
    code: string,
    message: string,
    stepId?: string,
    transitionId?: string
  ): void {
    this.errors.push({
      code,
      message,
      stepId,
      transitionId,
      severity: 'error',
    });
  }

  /**
   * Add a warning
   */
  private addWarning(
    code: string,
    message: string,
    stepId?: string,
    transitionId?: string
  ): void {
    this.warnings.push({
      code,
      message,
      stepId,
      transitionId,
      severity: 'warning',
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate a user flow
 */
export function validateFlow(flow: UserFlow): ValidationResult {
  const validator = new FlowValidator(flow);
  return validator.validate();
}

/**
 * Check if a flow is valid
 */
export function isValidFlow(flow: UserFlow): boolean {
  return validateFlow(flow).valid;
}

/**
 * Get all steps reachable from a given step
 */
export function getReachableSteps(
  flow: UserFlow,
  fromStepId: string
): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [fromStepId];
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_RECURSION_DEPTH) {
    iterations++;
    const current = queue.shift()!;

    if (reachable.has(current)) continue;
    reachable.add(current);

    const outgoing = flow.transitions.filter((t) => t.from === current);
    for (const t of outgoing) {
      if (!reachable.has(t.to)) {
        queue.push(t.to);
      }
    }
  }

  return reachable;
}

/**
 * Get all steps that can reach a given step
 */
export function getStepsReaching(
  flow: UserFlow,
  toStepId: string
): Set<string> {
  const reaching = new Set<string>();
  const queue: string[] = [toStepId];
  let iterations = 0;

  while (queue.length > 0 && iterations < MAX_RECURSION_DEPTH) {
    iterations++;
    const current = queue.shift()!;

    if (reaching.has(current)) continue;
    reaching.add(current);

    const incoming = flow.transitions.filter((t) => t.to === current);
    for (const t of incoming) {
      if (!reaching.has(t.from)) {
        queue.push(t.from);
      }
    }
  }

  return reaching;
}

/**
 * Get the critical path (longest path) from start to any end
 */
export function getCriticalPath(flow: UserFlow): string[] {
  const distances = new Map<string, number>();
  const predecessors = new Map<string, string>();

  // Initialize distances
  for (const step of flow.steps) {
    distances.set(step.id, step.id === flow.startStep ? 0 : -Infinity);
  }

  // Topological sort-based relaxation
  const visited = new Set<string>();
  const order: string[] = [];

  const topoSort = (stepId: string, depth: number): void => {
    if (depth > MAX_RECURSION_DEPTH || visited.has(stepId)) return;
    visited.add(stepId);

    const outgoing = flow.transitions.filter((t) => t.from === stepId);
    for (const t of outgoing) {
      topoSort(t.to, depth + 1);
    }

    order.unshift(stepId);
  };

  topoSort(flow.startStep, 0);

  // Relax edges in topological order
  for (const stepId of order) {
    const dist = distances.get(stepId)!;
    if (dist === -Infinity) continue;

    const outgoing = flow.transitions.filter((t) => t.from === stepId);
    for (const t of outgoing) {
      const newDist = dist + 1;
      if (newDist > (distances.get(t.to) ?? -Infinity)) {
        distances.set(t.to, newDist);
        predecessors.set(t.to, stepId);
      }
    }
  }

  // Find the end step with maximum distance
  let maxDist = -Infinity;
  let maxEndStep = flow.endSteps[0];

  for (const endId of flow.endSteps) {
    const dist = distances.get(endId) ?? -Infinity;
    if (dist > maxDist) {
      maxDist = dist;
      maxEndStep = endId;
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let current: string | undefined = maxEndStep;

  while (current) {
    path.unshift(current);
    current = predecessors.get(current);
  }

  return path;
}

/**
 * Count steps by type
 */
export function countStepsByType(
  flow: UserFlow
): Record<FlowStepType, number> {
  const counts: Record<FlowStepType, number> = {
    start: 0,
    end: 0,
    action: 0,
    decision: 0,
    process: 0,
    input: 0,
    display: 0,
    wait: 0,
    error: 0,
    external: 0,
  };

  for (const step of flow.steps) {
    counts[step.type]++;
  }

  return counts;
}

/**
 * Get flow statistics
 */
export function getFlowStats(flow: UserFlow): {
  stepCount: number;
  transitionCount: number;
  actorCount: number;
  decisionCount: number;
  errorCount: number;
  avgOutgoingPerStep: number;
  criticalPathLength: number;
} {
  const counts = countStepsByType(flow);
  const criticalPath = getCriticalPath(flow);

  return {
    stepCount: flow.steps.length,
    transitionCount: flow.transitions.length,
    actorCount: flow.actors.length,
    decisionCount: counts.decision,
    errorCount: counts.error,
    avgOutgoingPerStep:
      flow.steps.length > 0
        ? flow.transitions.length / flow.steps.length
        : 0,
    criticalPathLength: criticalPath.length,
  };
}
