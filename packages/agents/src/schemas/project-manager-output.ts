/**
 * Project Manager Output Schema
 *
 * Defines the work breakdown structure for project planning.
 * Includes Epic/Feature/Task hierarchy with dependencies.
 *
 * SECURITY:
 * - All IDs are validated for format
 * - User input validation on descriptions
 *
 * LENIENT: Uses lenient parsing utilities to handle Claude's output variations.
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema, RoutingHintsSchema } from '../types.js';
import {
  lenientEnum,
  lenientArray,
  lenientBoolean,
  lenientId,
} from './lenient-utils.js';

/**
 * Task type values
 */
const TASK_TYPES = ['design', 'frontend', 'backend', 'database', 'testing', 'integration', 'documentation', 'devops', 'review'] as const;

/**
 * Task types that categorize work items (lenient)
 */
export const TaskTypeSchema = lenientEnum(TASK_TYPES, 'backend');

export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Complexity level values
 */
const COMPLEXITY_LEVELS = ['trivial', 'simple', 'moderate', 'complex', 'epic'] as const;

/**
 * Complexity levels for effort estimation (lenient)
 */
export const ComplexitySchema = lenientEnum(COMPLEXITY_LEVELS, 'moderate');

export type Complexity = z.infer<typeof ComplexitySchema>;

/**
 * Priority level values
 */
const PRIORITY_LEVELS = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Priority levels for features (lenient)
 */
export const PrioritySchema = lenientEnum(PRIORITY_LEVELS, 'medium');

export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Risk severity values
 */
const RISK_SEVERITIES = ['low', 'medium', 'high'] as const;

/**
 * Risk severity levels (lenient)
 */
export const RiskSeveritySchema = lenientEnum(RISK_SEVERITIES, 'medium');

export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;

/**
 * Risk definition for project planning (lenient)
 */
export const RiskSchema = z.object({
  description: z.string().max(1000).default(''),
  mitigation: z.string().max(1000).default(''),
  severity: RiskSeveritySchema,
});

export type Risk = z.infer<typeof RiskSchema>;

/**
 * Design reference for a task (Sprint 5)
 * Links tasks to approved design mockups for implementation guidance
 */
export const TaskDesignReferenceSchema = z.object({
  /** Screen ID from the approved design */
  screenId: z.string().min(1).max(100).optional(),
  /** Path to the mockup file */
  mockupPath: z.string().max(200).optional(),
  /** Specific component IDs to implement */
  componentIds: z.array(z.string().max(100)).optional(),
  /** Component names for quick reference */
  componentNames: z.array(z.string().max(100)).optional(),
  /** Path to the design spec JSON */
  designSpecPath: z.string().max(200).optional(),
  /** Specific CSS classes to use */
  cssClasses: z.array(z.string().max(100)).optional(),
  /** Implementation notes from the designer */
  implementationNotes: z.string().max(1000).optional(),
  /** Responsive breakpoints to implement */
  responsiveBreakpoints: z.array(z.enum(['mobile', 'tablet', 'desktop', 'wide'])).optional(),
  /** States to implement (loading, empty, error, etc.) */
  statesToImplement: z.array(z.string().max(50)).optional(),
});

export type TaskDesignReference = z.infer<typeof TaskDesignReferenceSchema>;

/**
 * Task definition - atomic work unit (lenient)
 *
 * Each task represents a single deliverable that can be
 * assigned to one agent and completed independently.
 */
export const TaskSchema = z.object({
  id: lenientId(100),
  title: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  type: TaskTypeSchema,
  complexity: ComplexitySchema,
  dependencies: lenientArray(z.string().max(100)), // Task IDs
  acceptanceCriteria: lenientArray(z.string().max(500)),
  assignedAgents: LenientAgentTypeArraySchema,
  complianceRelevant: lenientBoolean,
  complianceNotes: z.string().max(1000).optional(),
  estimatedTokens: z.number().int().min(0).max(1000000).optional(),
  tags: lenientArray(z.string().max(50)),
  /** Design reference - links to approved mockups (Sprint 5) */
  designReference: TaskDesignReferenceSchema.optional(),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Feature definition - group of related tasks (lenient)
 *
 * A feature represents a deliverable unit of functionality
 * that provides user value.
 */
export const FeatureSchema = z.object({
  id: lenientId(100),
  title: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  userStory: z.string().max(500).default(''), // "As a [user], I want [goal], so that [benefit]"
  tasks: lenientArray(TaskSchema),
  acceptanceCriteria: lenientArray(z.string().max(500)),
  priority: PrioritySchema,
  dependencies: lenientArray(z.string().max(100)), // Feature IDs
  complianceRelevant: lenientBoolean,
});

export type Feature = z.infer<typeof FeatureSchema>;

/**
 * Epic definition - large initiative (lenient)
 *
 * An epic represents a major initiative that spans
 * multiple features and significant development effort.
 */
export const EpicSchema = z.object({
  id: lenientId(100),
  title: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  objective: z.string().max(1000).default(''),
  features: lenientArray(FeatureSchema),
  successMetrics: lenientArray(z.string().max(500)),
  risks: lenientArray(RiskSchema),
});

export type Epic = z.infer<typeof EpicSchema>;

/**
 * Blocker definition (lenient)
 */
export const BlockerSchema = z.object({
  taskId: z.string().max(100).default(''),
  reason: z.string().max(1000).default(''),
  resolution: z.string().max(1000).default(''),
});

export type Blocker = z.infer<typeof BlockerSchema>;

/**
 * Work breakdown summary statistics
 */
export const WorkBreakdownSummarySchema = z.object({
  totalEpics: z.number().int().min(0).default(0),
  totalFeatures: z.number().int().min(0).default(0),
  totalTasks: z.number().int().min(0).default(0),
  complexityDistribution: z.record(ComplexitySchema, z.number().int().min(0)).default({}),
  taskTypeDistribution: z.record(TaskTypeSchema, z.number().int().min(0)).default({}),
  estimatedTotalEffort: z.string().max(100).default('Unknown'),
  criticalPath: z.array(z.string().min(1).max(100)).default([]), // Task IDs in critical path
  complianceTaskCount: z.number().int().min(0).default(0),
});

export type WorkBreakdownSummary = z.infer<typeof WorkBreakdownSummarySchema>;

/**
 * Project Manager routing hints (lenient)
 * Uses LenientAgentTypeArraySchema and lenientBoolean
 */
export const PMRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: lenientBoolean,
  hasFailures: lenientBoolean,
  isComplete: lenientBoolean,
  notes: z.string().max(1000).optional(),
}).default({
  suggestNext: [],
  skipAgents: [],
  needsApproval: false,
  hasFailures: false,
  isComplete: true,
});

export type PMRoutingHints = z.infer<typeof PMRoutingHintsSchema>;

/**
 * Complete Project Manager output (lenient)
 *
 * The full work breakdown structure produced by the PM agent.
 */
export const ProjectManagerOutputSchema = z.object({
  epics: lenientArray(EpicSchema),
  summary: WorkBreakdownSummarySchema.default({}),
  suggestedOrder: lenientArray(z.string().max(100)), // Task IDs in suggested execution order
  parallelizable: lenientArray(z.array(z.string().max(100))), // Groups of task IDs that can run in parallel
  blockers: lenientArray(BlockerSchema),
  routingHints: PMRoutingHintsSchema,
});

export type ProjectManagerOutput = z.infer<typeof ProjectManagerOutputSchema>;

/**
 * Validation result for work breakdown (lenient)
 */
export const WorkBreakdownValidationSchema = z.object({
  valid: lenientBoolean,
  errors: lenientArray(z.string()),
  warnings: lenientArray(z.string()),
});

export type WorkBreakdownValidation = z.infer<typeof WorkBreakdownValidationSchema>;

/**
 * Default complexity distribution (all zeros)
 */
export const DEFAULT_COMPLEXITY_DISTRIBUTION: Record<Complexity, number> = {
  trivial: 0,
  simple: 0,
  moderate: 0,
  complex: 0,
  epic: 0,
};

/**
 * Default task type distribution (all zeros)
 */
export const DEFAULT_TASK_TYPE_DISTRIBUTION: Record<TaskType, number> = {
  design: 0,
  frontend: 0,
  backend: 0,
  database: 0,
  testing: 0,
  integration: 0,
  documentation: 0,
  devops: 0,
  review: 0,
};

/**
 * Effort hours mapping for complexity levels
 */
export const COMPLEXITY_EFFORT_HOURS: Record<Complexity, number> = {
  trivial: 0.5,
  simple: 2,
  moderate: 6,
  complex: 16,
  epic: 40,
};
