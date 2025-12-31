/**
 * Planning Module
 *
 * Utilities for work breakdown and dependency management.
 *
 * @packageDocumentation
 */

// Work breakdown utilities
export {
  generateId,
  createEpic,
  createFeature,
  createTask,
  flattenTasks,
  flattenFeatures,
  getTaskById,
  getFeatureById,
  getEpicById,
  calculateSummary,
  validateWorkBreakdown,
  getTasksByType,
  getTasksByComplexity,
  getComplianceTasks,
  getRootTasks,
  countTasksByAgent,
  mergeWorkBreakdowns,
} from './work-breakdown.js';

// Dependency graph
export { DependencyGraph, type CycleInfo } from './dependency-graph.js';
