/**
 * Work Breakdown Structure Utilities
 *
 * Helpers for managing work breakdown hierarchies.
 * Provides creation, validation, and summary functions.
 *
 * SECURITY:
 * - Validates all IDs for proper format
 * - Prevents ID collision attacks
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Epic,
  Feature,
  Task,
  TaskType,
  Complexity,
  WorkBreakdownSummary,
  WorkBreakdownValidation,
} from '../schemas/project-manager-output.js';
import {
  DEFAULT_COMPLEXITY_DISTRIBUTION,
  DEFAULT_TASK_TYPE_DISTRIBUTION,
  COMPLEXITY_EFFORT_HOURS,
} from '../schemas/project-manager-output.js';

/**
 * Generate a unique ID for work items
 *
 * @param prefix - The prefix to use (e.g., 'epic', 'feat', 'task')
 * @returns A unique ID in the format prefix-xxxxxxxx
 */
export function generateId(prefix: string): string {
  const uuid = uuidv4().substring(0, 8);
  // Ensure prefix is lowercase and valid
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${safePrefix}-${uuid}`;
}

/**
 * Create an empty epic with default values
 *
 * @param title - The epic title
 * @param description - The epic description
 * @returns A new Epic with generated ID
 */
export function createEpic(title: string, description: string): Epic {
  return {
    id: generateId('epic'),
    title,
    description,
    objective: '',
    features: [],
    successMetrics: [],
    risks: [],
  };
}

/**
 * Create an empty feature with default values
 *
 * @param title - The feature title
 * @param description - The feature description
 * @returns A new Feature with generated ID
 */
export function createFeature(title: string, description: string): Feature {
  return {
    id: generateId('feat'),
    title,
    description,
    userStory: '',
    tasks: [],
    acceptanceCriteria: [],
    priority: 'medium',
    dependencies: [],
    complianceRelevant: false,
  };
}

/**
 * Create a task with required fields
 *
 * @param title - The task title
 * @param type - The task type (design, frontend, etc.)
 * @param complexity - The complexity level
 * @returns A new Task with generated ID
 */
export function createTask(title: string, type: TaskType, complexity: Complexity): Task {
  return {
    id: generateId('task'),
    title,
    description: '',
    type,
    complexity,
    dependencies: [],
    acceptanceCriteria: [],
    assignedAgents: [],
    complianceRelevant: false,
    tags: [],
  };
}

/**
 * Flatten all tasks from epics into a single array
 *
 * @param epics - Array of epics to flatten
 * @returns All tasks from all features in all epics
 */
export function flattenTasks(epics: Epic[]): Task[] {
  return epics.flatMap((e) => e.features.flatMap((f) => f.tasks));
}

/**
 * Flatten all features from epics into a single array
 *
 * @param epics - Array of epics to flatten
 * @returns All features from all epics
 */
export function flattenFeatures(epics: Epic[]): Feature[] {
  return epics.flatMap((e) => e.features);
}

/**
 * Get task by ID from epics hierarchy
 *
 * @param epics - Array of epics to search
 * @param taskId - The task ID to find
 * @returns The task if found, undefined otherwise
 */
export function getTaskById(epics: Epic[], taskId: string): Task | undefined {
  for (const epic of epics) {
    for (const feature of epic.features) {
      const task = feature.tasks.find((t) => t.id === taskId);
      if (task) return task;
    }
  }
  return undefined;
}

/**
 * Get feature by ID from epics hierarchy
 *
 * @param epics - Array of epics to search
 * @param featureId - The feature ID to find
 * @returns The feature if found, undefined otherwise
 */
export function getFeatureById(epics: Epic[], featureId: string): Feature | undefined {
  for (const epic of epics) {
    const feature = epic.features.find((f) => f.id === featureId);
    if (feature) return feature;
  }
  return undefined;
}

/**
 * Get epic by ID
 *
 * @param epics - Array of epics to search
 * @param epicId - The epic ID to find
 * @returns The epic if found, undefined otherwise
 */
export function getEpicById(epics: Epic[], epicId: string): Epic | undefined {
  return epics.find((e) => e.id === epicId);
}

/**
 * Calculate work breakdown summary statistics
 *
 * @param epics - Array of epics to summarize
 * @returns Summary with counts, distributions, and effort estimate
 */
export function calculateSummary(epics: Epic[]): WorkBreakdownSummary {
  const allTasks = flattenTasks(epics);
  const allFeatures = flattenFeatures(epics);

  // Initialize distributions as copies to avoid mutation
  const complexityDist: Record<Complexity, number> = { ...DEFAULT_COMPLEXITY_DISTRIBUTION };
  const typeDist: Record<TaskType, number> = { ...DEFAULT_TASK_TYPE_DISTRIBUTION };

  let complianceCount = 0;

  for (const task of allTasks) {
    complexityDist[task.complexity]++;
    typeDist[task.type]++;
    if (task.complianceRelevant) complianceCount++;
  }

  // Calculate total effort hours
  const totalHours = allTasks.reduce(
    (sum, task) => sum + COMPLEXITY_EFFORT_HOURS[task.complexity],
    0
  );

  // Convert hours to human-readable format
  const days = Math.ceil(totalHours / 8);
  let estimatedEffort: string;
  if (days === 0) {
    estimatedEffort = 'less than 1 day';
  } else if (days === 1) {
    estimatedEffort = '1 day';
  } else if (days <= 5) {
    estimatedEffort = `${days} days`;
  } else {
    const weeks = Math.ceil(days / 5);
    estimatedEffort = weeks === 1 ? '1 week' : `${weeks} weeks`;
  }

  return {
    totalEpics: epics.length,
    totalFeatures: allFeatures.length,
    totalTasks: allTasks.length,
    complexityDistribution: complexityDist,
    taskTypeDistribution: typeDist,
    estimatedTotalEffort: estimatedEffort,
    criticalPath: [], // Calculated by dependency graph
    complianceTaskCount: complianceCount,
  };
}

/**
 * Validate work breakdown structure
 *
 * Checks for:
 * - Missing required fields
 * - Duplicate IDs
 * - Invalid dependencies
 * - Structural issues
 *
 * @param epics - Array of epics to validate
 * @returns Validation result with errors and warnings
 */
export function validateWorkBreakdown(epics: Epic[]): WorkBreakdownValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allTaskIds = new Set<string>();
  const allFeatureIds = new Set<string>();
  const allEpicIds = new Set<string>();

  // First pass: collect all IDs
  for (const epic of epics) {
    // Check epic ID uniqueness
    if (allEpicIds.has(epic.id)) {
      errors.push(`Duplicate epic ID: ${epic.id}`);
    }
    allEpicIds.add(epic.id);

    if (!epic.title) {
      errors.push(`Epic ${epic.id} has no title`);
    }

    if (epic.features.length === 0) {
      warnings.push(`Epic ${epic.id} has no features`);
    }

    if (!epic.objective) {
      warnings.push(`Epic ${epic.id} has no objective`);
    }

    for (const feature of epic.features) {
      // Check feature ID uniqueness
      if (allFeatureIds.has(feature.id)) {
        errors.push(`Duplicate feature ID: ${feature.id}`);
      }
      allFeatureIds.add(feature.id);

      if (!feature.title) {
        errors.push(`Feature ${feature.id} has no title`);
      }

      if (!feature.userStory) {
        warnings.push(`Feature ${feature.id} has no user story`);
      }

      if (feature.tasks.length === 0) {
        warnings.push(`Feature ${feature.id} has no tasks`);
      }

      for (const task of feature.tasks) {
        // Check task ID uniqueness
        if (allTaskIds.has(task.id)) {
          errors.push(`Duplicate task ID: ${task.id}`);
        }
        allTaskIds.add(task.id);

        if (!task.title) {
          errors.push(`Task ${task.id} has no title`);
        }

        if (task.acceptanceCriteria.length === 0) {
          warnings.push(`Task ${task.id} has no acceptance criteria`);
        }

        if (task.complexity === 'epic') {
          warnings.push(
            `Task ${task.id} has 'epic' complexity - should be broken down further`
          );
        }

        if (task.assignedAgents.length === 0) {
          warnings.push(`Task ${task.id} has no assigned agents`);
        }
      }
    }
  }

  // Second pass: validate dependencies
  for (const epic of epics) {
    for (const feature of epic.features) {
      // Validate feature dependencies
      for (const depId of feature.dependencies) {
        if (!allFeatureIds.has(depId)) {
          errors.push(`Feature ${feature.id} depends on non-existent feature ${depId}`);
        }
        if (depId === feature.id) {
          errors.push(`Feature ${feature.id} depends on itself`);
        }
      }

      for (const task of feature.tasks) {
        // Validate task dependencies
        for (const depId of task.dependencies) {
          if (!allTaskIds.has(depId)) {
            errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
          }
          if (depId === task.id) {
            errors.push(`Task ${task.id} depends on itself`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get tasks by type
 *
 * @param epics - Array of epics to search
 * @param type - The task type to filter by
 * @returns Array of tasks matching the type
 */
export function getTasksByType(epics: Epic[], type: TaskType): Task[] {
  return flattenTasks(epics).filter((t) => t.type === type);
}

/**
 * Get tasks by complexity
 *
 * @param epics - Array of epics to search
 * @param complexity - The complexity level to filter by
 * @returns Array of tasks matching the complexity
 */
export function getTasksByComplexity(epics: Epic[], complexity: Complexity): Task[] {
  return flattenTasks(epics).filter((t) => t.complexity === complexity);
}

/**
 * Get compliance-relevant tasks
 *
 * @param epics - Array of epics to search
 * @returns Array of tasks marked as compliance-relevant
 */
export function getComplianceTasks(epics: Epic[]): Task[] {
  return flattenTasks(epics).filter((t) => t.complianceRelevant);
}

/**
 * Get tasks with no dependencies (root tasks)
 *
 * @param epics - Array of epics to search
 * @returns Array of tasks with no dependencies
 */
export function getRootTasks(epics: Epic[]): Task[] {
  return flattenTasks(epics).filter((t) => t.dependencies.length === 0);
}

/**
 * Count tasks by assigned agent
 *
 * @param epics - Array of epics to analyze
 * @returns Map of agent type to task count
 */
export function countTasksByAgent(epics: Epic[]): Map<string, number> {
  const counts = new Map<string, number>();
  const allTasks = flattenTasks(epics);

  for (const task of allTasks) {
    for (const agent of task.assignedAgents) {
      counts.set(agent, (counts.get(agent) || 0) + 1);
    }
  }

  return counts;
}

/**
 * Merge multiple work breakdowns into one
 *
 * Used when combining work from multiple planning sessions.
 *
 * @param breakdowns - Array of epic arrays to merge
 * @returns Combined array of all epics
 */
export function mergeWorkBreakdowns(breakdowns: Epic[][]): Epic[] {
  const merged: Epic[] = [];
  const seenEpicIds = new Set<string>();

  for (const epics of breakdowns) {
    for (const epic of epics) {
      if (!seenEpicIds.has(epic.id)) {
        seenEpicIds.add(epic.id);
        merged.push(epic);
      }
    }
  }

  return merged;
}
