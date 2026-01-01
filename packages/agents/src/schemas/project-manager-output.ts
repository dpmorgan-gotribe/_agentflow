/**
 * Project Manager Output Schema
 *
 * Defines the work breakdown structure for project planning.
 * Includes Epic/Feature/Task hierarchy with dependencies.
 *
 * SECURITY:
 * - All IDs are validated for format
 * - User input validation on descriptions
 */

import { z } from 'zod';
import { AgentTypeSchema, RoutingHintsSchema } from '../types.js';

/**
 * Task types that categorize work items
 */
export const TaskTypeSchema = z.enum([
  'design',
  'frontend',
  'backend',
  'database',
  'testing',
  'integration',
  'documentation',
  'devops',
  'review',
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

/**
 * Complexity levels for effort estimation
 */
export const ComplexitySchema = z.enum([
  'trivial', // < 1 hour
  'simple', // 1-4 hours
  'moderate', // 4-8 hours
  'complex', // 1-3 days
  'epic', // > 3 days (should be broken down)
]);

export type Complexity = z.infer<typeof ComplexitySchema>;

/**
 * Priority levels for features
 */
export const PrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Risk severity levels
 */
export const RiskSeveritySchema = z.enum(['low', 'medium', 'high']);

export type RiskSeverity = z.infer<typeof RiskSeveritySchema>;

/**
 * Risk definition for project planning
 */
export const RiskSchema = z.object({
  description: z.string().min(1).max(1000),
  mitigation: z.string().min(1).max(1000),
  severity: RiskSeveritySchema,
});

export type Risk = z.infer<typeof RiskSchema>;

/**
 * Task definition - atomic work unit
 *
 * Each task represents a single deliverable that can be
 * assigned to one agent and completed independently.
 */
export const TaskSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Task ID must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  type: TaskTypeSchema,
  complexity: ComplexitySchema,
  dependencies: z.array(z.string().min(1).max(100)), // Task IDs
  acceptanceCriteria: z.array(z.string().min(1).max(500)),
  assignedAgents: z.array(AgentTypeSchema),
  complianceRelevant: z.boolean(),
  complianceNotes: z.string().max(1000).optional(),
  estimatedTokens: z.number().int().min(0).max(1000000).optional(),
  tags: z.array(z.string().min(1).max(50)),
});

export type Task = z.infer<typeof TaskSchema>;

/**
 * Feature definition - group of related tasks
 *
 * A feature represents a deliverable unit of functionality
 * that provides user value.
 */
export const FeatureSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Feature ID must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  userStory: z.string().min(1).max(500), // "As a [user], I want [goal], so that [benefit]"
  tasks: z.array(TaskSchema),
  acceptanceCriteria: z.array(z.string().min(1).max(500)),
  priority: PrioritySchema,
  dependencies: z.array(z.string().min(1).max(100)), // Feature IDs
  complianceRelevant: z.boolean(),
});

export type Feature = z.infer<typeof FeatureSchema>;

/**
 * Epic definition - large initiative
 *
 * An epic represents a major initiative that spans
 * multiple features and significant development effort.
 */
export const EpicSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Epic ID must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  objective: z.string().min(1).max(1000),
  features: z.array(FeatureSchema),
  successMetrics: z.array(z.string().min(1).max(500)),
  risks: z.array(RiskSchema),
});

export type Epic = z.infer<typeof EpicSchema>;

/**
 * Blocker definition
 */
export const BlockerSchema = z.object({
  taskId: z.string().min(1).max(100),
  reason: z.string().min(1).max(1000),
  resolution: z.string().min(1).max(1000),
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
 * Project Manager routing hints
 */
export const PMRoutingHintsSchema = z.object({
  suggestNext: z.array(AgentTypeSchema).default([]),
  skipAgents: z.array(AgentTypeSchema).default([]),
  needsApproval: z.boolean().default(false),
  hasFailures: z.boolean().default(false),
  isComplete: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
});

export type PMRoutingHints = z.infer<typeof PMRoutingHintsSchema>;

/**
 * Complete Project Manager output
 *
 * The full work breakdown structure produced by the PM agent.
 */
export const ProjectManagerOutputSchema = z.object({
  epics: z.array(EpicSchema).default([]),
  summary: WorkBreakdownSummarySchema.default({}),
  suggestedOrder: z.array(z.string().min(1).max(100)).default([]), // Task IDs in suggested execution order
  parallelizable: z.array(z.array(z.string().min(1).max(100))).default([]), // Groups of task IDs that can run in parallel
  blockers: z.array(BlockerSchema).default([]),
  routingHints: PMRoutingHintsSchema.default({}),
});

export type ProjectManagerOutput = z.infer<typeof ProjectManagerOutputSchema>;

/**
 * Validation result for work breakdown
 */
export const WorkBreakdownValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
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
