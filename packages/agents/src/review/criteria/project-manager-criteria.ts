/**
 * Project Manager Review Criteria
 *
 * Agent-specific review criteria for the Project Manager agent.
 * Validates work breakdown, task dependencies, and acceptance criteria.
 *
 * Security:
 * - Cycle detection prevents infinite loops
 * - Array bounds checking
 */

import type { AgentOutput, AgentRequest } from '../../types.js';
import type { RequirementCoverage } from '../schemas.js';
import {
  BaseAgentReviewCriteria,
  ReviewCriterion,
  ReviewContext,
  CriterionResult,
  criterionPassed,
  criterionFailed,
  criterionPartial,
} from './base-criteria.js';

// ============================================================================
// Type Definitions for PM Output
// ============================================================================

interface PMTask {
  id: string;
  title: string;
  description?: string;
  complexity?: string;
  dependencies?: string[];
  acceptanceCriteria?: string[];
  assignedAgents?: string[];
}

interface PMFeature {
  id: string;
  title: string;
  userStory?: string;
  tasks?: PMTask[];
}

interface PMEpic {
  id: string;
  title: string;
  features?: PMFeature[];
}

interface PMResult {
  epics?: PMEpic[];
}

// ============================================================================
// Project Manager Review Criteria
// ============================================================================

/**
 * Review criteria for Project Manager agent
 */
export class ProjectManagerReviewCriteria extends BaseAgentReviewCriteria {
  agentId = 'project_manager';

  criteria: ReviewCriterion[] = [
    // ========================================================================
    // Criterion: Acceptance Criteria Present
    // ========================================================================
    {
      id: 'tasks_have_acceptance_criteria',
      name: 'Acceptance Criteria Present',
      description: 'Every task has defined acceptance criteria',
      severity: 'critical',
      category: 'incomplete',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const result = output.result as PMResult | undefined;
        const tasks = flattenTasks(result?.epics || []);

        if (tasks.length === 0) {
          return criterionFailed(
            'No tasks found in work breakdown',
            'Generate tasks with acceptance criteria for each',
            0,
            'large'
          );
        }

        const withCriteria = tasks.filter(
          (t) => t.acceptanceCriteria && t.acceptanceCriteria.length > 0
        ).length;

        const score = withCriteria / tasks.length;

        if (score >= 0.9) {
          return criterionPassed(
            `${withCriteria}/${tasks.length} tasks have acceptance criteria`
          );
        }

        const missing = tasks.length - withCriteria;
        return criterionFailed(
          `${missing} tasks missing acceptance criteria`,
          'Add specific, testable acceptance criteria to each task',
          score,
          missing > 5 ? 'large' : 'medium'
        );
      },
    },

    // ========================================================================
    // Criterion: Valid Dependencies
    // ========================================================================
    {
      id: 'dependencies_valid',
      name: 'Valid Dependencies',
      description: 'All task dependencies exist and form no cycles',
      severity: 'critical',
      category: 'incorrect',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const result = output.result as PMResult | undefined;
        const tasks = flattenTasks(result?.epics || []);

        if (tasks.length === 0) {
          return criterionPassed('No tasks to validate');
        }

        const taskIds = new Set(tasks.map((t) => t.id));

        // Check all dependencies exist
        const invalidDeps: string[] = [];
        for (const task of tasks) {
          for (const dep of task.dependencies || []) {
            if (!taskIds.has(dep)) {
              invalidDeps.push(`${task.id} -> ${dep}`);
            }
          }
        }

        // Check for cycles
        const cycleInfo = detectCycle(tasks);

        if (invalidDeps.length > 0) {
          return criterionFailed(
            `Invalid dependencies: ${invalidDeps.slice(0, 5).join(', ')}${invalidDeps.length > 5 ? '...' : ''}`,
            'Fix dependency references to point to valid task IDs',
            0,
            'medium'
          );
        }

        if (cycleInfo.hasCycle) {
          return criterionFailed(
            `Circular dependency detected: ${cycleInfo.cycle?.join(' -> ')}`,
            'Remove circular dependencies to enable topological ordering',
            0,
            'medium'
          );
        }

        return criterionPassed('All dependencies valid, no cycles detected');
      },
    },

    // ========================================================================
    // Criterion: Balanced Complexity
    // ========================================================================
    {
      id: 'balanced_complexity',
      name: 'Balanced Complexity',
      description: 'No tasks with "epic" complexity (should be broken down)',
      severity: 'major',
      category: 'incomplete',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const result = output.result as PMResult | undefined;
        const tasks = flattenTasks(result?.epics || []);

        if (tasks.length === 0) {
          return criterionPassed('No tasks to validate');
        }

        const epicComplexity = tasks.filter((t) => t.complexity === 'epic');

        if (epicComplexity.length === 0) {
          return criterionPassed('All tasks appropriately sized');
        }

        const epicTitles = epicComplexity
          .slice(0, 3)
          .map((t) => t.title)
          .join(', ');

        return criterionFailed(
          `${epicComplexity.length} tasks have "epic" complexity and should be broken down`,
          `Break down these tasks into smaller units: ${epicTitles}`,
          1 - epicComplexity.length / Math.max(tasks.length, 1),
          'large'
        );
      },
    },

    // ========================================================================
    // Criterion: Agents Assigned
    // ========================================================================
    {
      id: 'agents_assigned',
      name: 'Agents Assigned',
      description: 'All tasks have appropriate agents assigned',
      severity: 'major',
      category: 'incomplete',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const result = output.result as PMResult | undefined;
        const tasks = flattenTasks(result?.epics || []);

        if (tasks.length === 0) {
          return criterionPassed('No tasks to validate');
        }

        const withAgents = tasks.filter(
          (t) => t.assignedAgents && t.assignedAgents.length > 0
        ).length;

        const score = withAgents / tasks.length;

        if (score >= 0.95) {
          return criterionPassed(
            `${withAgents}/${tasks.length} tasks have agents assigned`
          );
        }

        const missing = tasks.length - withAgents;
        return criterionPartial(
          `${missing} tasks missing agent assignment`,
          score,
          'Assign appropriate agents based on task type',
          'small'
        );
      },
    },

    // ========================================================================
    // Criterion: Task Descriptions
    // ========================================================================
    {
      id: 'task_descriptions',
      name: 'Task Descriptions',
      description: 'All tasks have meaningful descriptions',
      severity: 'major',
      category: 'incomplete',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const result = output.result as PMResult | undefined;
        const tasks = flattenTasks(result?.epics || []);

        if (tasks.length === 0) {
          return criterionPassed('No tasks to validate');
        }

        const withDescriptions = tasks.filter(
          (t) => t.description && t.description.length >= 20
        ).length;

        const score = withDescriptions / tasks.length;

        if (score >= 0.9) {
          return criterionPassed(
            `${withDescriptions}/${tasks.length} tasks have descriptions`
          );
        }

        const missing = tasks.length - withDescriptions;
        return criterionPartial(
          `${missing} tasks missing or have short descriptions`,
          score,
          'Add detailed descriptions explaining what each task accomplishes',
          'medium'
        );
      },
    },

    // ========================================================================
    // Criterion: Epic/Feature Structure
    // ========================================================================
    {
      id: 'structure_valid',
      name: 'Epic/Feature Structure',
      description: 'Work is organized into epics, features, and tasks',
      severity: 'minor',
      category: 'quality',

      async validate(
        output: AgentOutput,
        _request: AgentRequest,
        _context: ReviewContext
      ): Promise<CriterionResult> {
        const result = output.result as PMResult | undefined;
        const epics = result?.epics || [];

        if (epics.length === 0) {
          return criterionFailed(
            'No epics found in work breakdown',
            'Organize work into epics containing features and tasks',
            0,
            'large'
          );
        }

        // Count features and tasks
        let featureCount = 0;
        let taskCount = 0;

        for (const epic of epics) {
          const features = epic.features || [];
          featureCount += features.length;
          for (const feature of features) {
            taskCount += (feature.tasks || []).length;
          }
        }

        if (featureCount === 0) {
          return criterionPartial(
            'Epics exist but no features defined',
            0.3,
            'Add features to epics to better organize work',
            'medium'
          );
        }

        if (taskCount === 0) {
          return criterionPartial(
            'Epics and features exist but no tasks defined',
            0.5,
            'Add specific tasks to features',
            'medium'
          );
        }

        return criterionPassed(
          `Well-structured: ${epics.length} epics, ${featureCount} features, ${taskCount} tasks`
        );
      },
    },
  ];

  /**
   * Check if a requirement is covered by tasks/features
   */
  async checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    _context: ReviewContext
  ): Promise<RequirementCoverage> {
    const result = output.result as PMResult | undefined;
    const tasks = flattenTasks(result?.epics || []);
    const features = flattenFeatures(result?.epics || []);

    const reqLower = requirement.toLowerCase();

    // Check if requirement maps to any task
    const matchingTask = tasks.find(
      (t) =>
        t.title.toLowerCase().includes(reqLower) ||
        t.description?.toLowerCase().includes(reqLower)
    );

    // Check if requirement maps to any feature
    const matchingFeature = features.find(
      (f) =>
        f.title.toLowerCase().includes(reqLower) ||
        f.userStory?.toLowerCase().includes(reqLower)
    );

    const covered = Boolean(matchingTask || matchingFeature);

    return {
      requirement,
      source: 'explicit',
      covered,
      coverageDetails: covered
        ? `Covered by: ${matchingTask?.title || matchingFeature?.title}`
        : 'No task or feature addresses this requirement',
      evidenceLocation: matchingTask?.id || matchingFeature?.id,
      confidence: covered ? 0.8 : 0.2,
    };
  }

  /**
   * Infer implicit requirements for project planning
   */
  protected override inferImplicitRequirements(request: AgentRequest): string[] {
    const implicit: string[] = [];
    const description = this.getTaskDescription(request).toLowerCase();

    // Development-related implicit requirements
    if (description.includes('develop') || description.includes('implement')) {
      implicit.push('Testing tasks for implemented features');
      implicit.push('Documentation tasks');
    }

    // API-related requirements
    if (description.includes('api') || description.includes('endpoint')) {
      implicit.push('API documentation');
      implicit.push('Error handling');
      implicit.push('Input validation');
    }

    // Database-related requirements
    if (description.includes('database') || description.includes('storage')) {
      implicit.push('Database migration tasks');
      implicit.push('Data validation');
    }

    // Security-related requirements
    if (description.includes('auth') || description.includes('security')) {
      implicit.push('Security review task');
      implicit.push('Authentication testing');
    }

    return implicit;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Flatten tasks from epic/feature hierarchy
 */
function flattenTasks(epics: PMEpic[]): PMTask[] {
  return epics.flatMap(
    (e) => (e.features || []).flatMap((f) => f.tasks || [])
  );
}

/**
 * Flatten features from epics
 */
function flattenFeatures(epics: PMEpic[]): PMFeature[] {
  return epics.flatMap((e) => e.features || []);
}

/**
 * Detect cycles in task dependencies using DFS
 */
function detectCycle(tasks: PMTask[]): { hasCycle: boolean; cycle?: string[] } {
  const graph = new Map<string, string[]>();
  for (const task of tasks) {
    graph.set(task.id, task.dependencies || []);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(taskId: string): string[] | null {
    visited.add(taskId);
    recursionStack.add(taskId);
    path.push(taskId);

    const deps = graph.get(taskId) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      } else if (recursionStack.has(dep)) {
        // Found cycle - extract it from path
        const cycleStart = path.indexOf(dep);
        return [...path.slice(cycleStart), dep];
      }
    }

    path.pop();
    recursionStack.delete(taskId);
    return null;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      const cycle = dfs(task.id);
      if (cycle) {
        return { hasCycle: true, cycle };
      }
    }
  }

  return { hasCycle: false };
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create Project Manager review criteria instance
 */
export function createProjectManagerCriteria(): ProjectManagerReviewCriteria {
  return new ProjectManagerReviewCriteria();
}
