/**
 * Meta-Prompt Types
 *
 * Defines types for the meta-prompt generation system.
 * Includes Zod schemas for runtime validation and security.
 */

import { z } from 'zod';

import type { AgentType } from '../types.js';
import { agentTypeSchema } from '../types.js';

/**
 * Safe string pattern - prevents template injection
 * Blocks {{ }} patterns that could be used for template injection
 */
const safeStringPattern = /^[^{}]*$/;

/**
 * Maximum lengths for security
 */
const MAX_LESSON_LENGTH = 10000;
const MAX_DECISION_LENGTH = 5000;
const MAX_SUMMARY_LENGTH = 50000;
const MAX_ITEMS_PER_ARRAY = 100;

/**
 * Workflow states for agent execution
 */
export const WorkflowState = {
  IDLE: 'idle',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  REVIEWING: 'reviewing',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type WorkflowState = (typeof WorkflowState)[keyof typeof WorkflowState];

export const workflowStateSchema = z.enum([
  'idle',
  'planning',
  'executing',
  'reviewing',
  'blocked',
  'completed',
  'failed',
]);

/**
 * Activation condition types
 */
export const ActivationConditionType = {
  ALWAYS: 'always',
  AGENT: 'agent',
  STATE: 'state',
  CONTEXT: 'context',
  CUSTOM: 'custom',
} as const;

export type ActivationConditionType =
  (typeof ActivationConditionType)[keyof typeof ActivationConditionType];

export const activationConditionTypeSchema = z.enum([
  'always',
  'agent',
  'state',
  'context',
  'custom',
]);

/**
 * Lesson schema with security validation
 */
export const lessonSchema = z.object({
  id: z
    .string()
    .max(100)
    .regex(safeStringPattern, 'Lesson ID cannot contain template syntax'),
  content: z
    .string()
    .max(MAX_LESSON_LENGTH)
    .regex(safeStringPattern, 'Lesson content cannot contain template syntax'),
  category: z
    .string()
    .max(50)
    .regex(safeStringPattern, 'Category cannot contain template syntax')
    .optional(),
  appliesTo: z.array(agentTypeSchema).optional(),
});

export type Lesson = z.infer<typeof lessonSchema>;

/**
 * Decision schema with security validation
 */
export const decisionSchema = z.object({
  id: z
    .string()
    .max(100)
    .regex(safeStringPattern, 'Decision ID cannot contain template syntax'),
  description: z
    .string()
    .max(MAX_DECISION_LENGTH)
    .regex(
      safeStringPattern,
      'Decision description cannot contain template syntax'
    ),
  rationale: z
    .string()
    .max(MAX_DECISION_LENGTH)
    .regex(
      safeStringPattern,
      'Decision rationale cannot contain template syntax'
    )
    .optional(),
  timestamp: z.string().datetime().optional(),
});

export type Decision = z.infer<typeof decisionSchema>;

/**
 * Previous output summary schema with security validation
 */
export const previousOutputSchema = z.object({
  agentType: agentTypeSchema,
  summary: z
    .string()
    .max(MAX_SUMMARY_LENGTH)
    .regex(
      safeStringPattern,
      'Previous output summary cannot contain template syntax'
    ),
  success: z.boolean(),
  timestamp: z.string().datetime().optional(),
});

export type PreviousOutput = z.infer<typeof previousOutputSchema>;

/**
 * Project context schema with safe string validation
 */
export const projectContextSchema = z.record(
  z.string().regex(/^[a-z_][a-z0-9_]*$/i, 'Invalid context key'),
  z.union([
    z
      .string()
      .max(MAX_SUMMARY_LENGTH)
      .regex(safeStringPattern, 'Context value cannot contain template syntax'),
    z.number(),
    z.boolean(),
  ])
);

export type ProjectContext = z.infer<typeof projectContextSchema>;

/**
 * Meta-prompt context schema with full security validation
 */
export const metaPromptContextSchema = z.object({
  agentType: agentTypeSchema,
  workflowState: workflowStateSchema,
  lessons: z.array(lessonSchema).max(MAX_ITEMS_PER_ARRAY).optional(),
  decisions: z.array(decisionSchema).max(MAX_ITEMS_PER_ARRAY).optional(),
  previousOutputs: z
    .array(previousOutputSchema)
    .max(MAX_ITEMS_PER_ARRAY)
    .optional(),
  projectContext: projectContextSchema.optional(),
  taskType: z
    .string()
    .max(100)
    .regex(safeStringPattern, 'Task type cannot contain template syntax')
    .optional(),
  expertise: z
    .array(
      z
        .string()
        .max(500)
        .regex(safeStringPattern, 'Expertise cannot contain template syntax')
    )
    .max(20)
    .optional(),
  constraints: z
    .array(
      z
        .string()
        .max(1000)
        .regex(safeStringPattern, 'Constraint cannot contain template syntax')
    )
    .max(50)
    .optional(),
});

export type MetaPromptContext = z.infer<typeof metaPromptContextSchema>;

/**
 * Activation condition schema
 */
export const activationConditionSchema = z.object({
  type: activationConditionTypeSchema,
  agents: z.array(agentTypeSchema).optional(),
  states: z.array(workflowStateSchema).optional(),
  contextKeys: z.array(z.string().max(100)).optional(),
  customPredicate: z.string().max(1000).optional(),
});

export type ActivationCondition = z.infer<typeof activationConditionSchema>;

/**
 * Meta-prompt definition schema
 */
export const metaPromptDefinitionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Meta-prompt ID must be UPPER_SNAKE_CASE'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  targetLayer: z.number().int().min(14).max(18),
  priority: z.number().int().min(1).max(100),
  activation: activationConditionSchema,
  template: z.string().min(1).max(50000),
  maxTokens: z.number().int().positive().max(2000),
});

export type MetaPromptDefinition = z.infer<typeof metaPromptDefinitionSchema>;

/**
 * Rendered meta-prompt result
 */
export interface RenderedMetaPrompt {
  id: string;
  targetLayer: number;
  content: string;
  tokenEstimate: number;
}

/**
 * Injection result
 */
export interface MetaPromptInjectionResult {
  injected: RenderedMetaPrompt[];
  skipped: Array<{ id: string; reason: string }>;
  totalTokens: number;
  warnings: string[];
}

/**
 * Meta-prompt audit entry
 */
export interface MetaPromptAuditEntry {
  timestamp: string;
  executionId: string;
  agentType: AgentType;
  metaPromptsInjected: string[];
  metaPromptsSkipped: string[];
  totalTokens: number;
  warnings?: string[];
  error?: string;
}
