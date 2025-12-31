/**
 * Prompt Architecture Types
 *
 * Defines the structure for the 18-layer prompt system.
 * Includes Zod schemas for runtime validation and security.
 */

import { z } from 'zod';

/**
 * Agent types supported by the system
 */
export const AgentType = {
  ORCHESTRATOR: 'orchestrator',
  ARCHITECT: 'architect',
  BACKEND: 'backend',
  FRONTEND: 'frontend',
  UI_DESIGNER: 'ui_designer',
  REVIEWER: 'reviewer',
  TESTER: 'tester',
  DEVOPS: 'devops',
  ANALYZER: 'analyzer',
} as const;

export type AgentType = (typeof AgentType)[keyof typeof AgentType];

export const agentTypeSchema = z.enum([
  'orchestrator',
  'architect',
  'backend',
  'frontend',
  'ui_designer',
  'reviewer',
  'tester',
  'devops',
  'analyzer',
]);

/**
 * Prompt layer categories
 */
export const LayerCategory = {
  IDENTITY: 'identity',
  OPERATIONAL: 'operational',
  CONTEXT: 'context',
  REASONING: 'reasoning',
  META: 'meta',
} as const;

export type LayerCategory = (typeof LayerCategory)[keyof typeof LayerCategory];

export const layerCategorySchema = z.enum([
  'identity',
  'operational',
  'context',
  'reasoning',
  'meta',
]);

/**
 * Individual layer definition schema
 */
export const promptLayerSchema = z.object({
  id: z.number().int().min(1).max(18),
  name: z.string().min(1).max(100),
  category: layerCategorySchema,
  description: z.string().max(500),
  required: z.boolean(),
  maxTokens: z.number().int().positive().max(10000),
  priority: z.number().int().min(1).max(100),
  template: z.string().min(1).max(50000),
  variables: z.array(z.string().regex(/^[a-z_][a-z0-9_]*$/i)),
});

export type PromptLayer = z.infer<typeof promptLayerSchema>;

/**
 * Token allocation by category schema
 */
export const tokenAllocationSchema = z.object({
  identity: z.number().int().nonnegative(),
  operational: z.number().int().nonnegative(),
  context: z.number().int().nonnegative(),
  reasoning: z.number().int().nonnegative(),
  meta: z.number().int().nonnegative(),
  total: z.number().int().positive(),
});

export type TokenAllocation = z.infer<typeof tokenAllocationSchema>;

/**
 * Default token allocation (for 100k context window)
 */
export const DEFAULT_TOKEN_ALLOCATION: TokenAllocation = {
  identity: 500,
  operational: 800,
  context: 4000,
  reasoning: 1200,
  meta: 1500,
  total: 8000,
};

/**
 * Token count result
 */
export const tokenCountSchema = z.object({
  system: z.number().int().nonnegative(),
  user: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type TokenCount = z.infer<typeof tokenCountSchema>;

/**
 * Composed prompt result schema
 */
export const composedPromptSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  tokenCount: tokenCountSchema,
  layersIncluded: z.array(z.number().int().min(1).max(18)),
  layersOmitted: z.array(z.number().int().min(1).max(18)),
  warnings: z.array(z.string()),
});

export type ComposedPrompt = z.infer<typeof composedPromptSchema>;

/**
 * Safe string pattern - prevents template injection
 * Allows alphanumeric, spaces, common punctuation, but not {{ }}
 */
const safeStringPattern = /^[^{}]*$/;

/**
 * Maximum variable value length to prevent DoS
 */
const MAX_VARIABLE_LENGTH = 50000;

/**
 * Prompt variables schema with security validation
 *
 * All string values are validated to prevent:
 * - Template injection ({{ }} patterns)
 * - Excessive length (DoS)
 */
export const promptVariablesSchema = z.object({
  // Identity variables
  agent_name: z
    .string()
    .max(100)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  agent_role: z
    .string()
    .max(1000)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  agent_goal: z
    .string()
    .max(1000)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),

  // Project variables
  project_name: z
    .string()
    .max(200)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  project_type: z
    .string()
    .max(100)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  tech_stack: z
    .string()
    .max(500)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  project_structure: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),

  // Task variables
  task_description: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  task_type: z
    .string()
    .max(100)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  task_requirements: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  acceptance_criteria: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),

  // Context variables
  previous_outputs: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  lessons_learned: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  compliance_requirements: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),

  // Operational variables
  available_tools: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  available_skills: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  constraints: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  output_schema: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),

  // Reasoning variables
  custom_decision_criteria: z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
  coding_style: z
    .string()
    .max(500)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
    .optional(),
});

export type PromptVariables = z.infer<typeof promptVariablesSchema>;

/**
 * Custom variables schema - allows additional variables with validation
 */
export const customVariablesSchema = z.record(
  z.string().regex(/^[a-z_][a-z0-9_]*$/i, 'Invalid variable name'),
  z
    .string()
    .max(MAX_VARIABLE_LENGTH)
    .regex(safeStringPattern, 'Variable cannot contain template syntax')
);

export type CustomVariables = z.infer<typeof customVariablesSchema>;

/**
 * Prompt composition options schema
 */
export const compositionOptionsSchema = z.object({
  maxTotalTokens: z.number().int().positive().max(1000000).optional(),
  prioritizeLayers: z.array(z.number().int().min(1).max(18)).optional(),
  excludeLayers: z.array(z.number().int().min(1).max(18)).optional(),
  customVariables: customVariablesSchema.optional(),
  includeDebugInfo: z.boolean().optional(),
});

export type CompositionOptions = z.infer<typeof compositionOptionsSchema>;

/**
 * Prompt template definition schema
 */
export const promptTemplateSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format'),
  agentType: z.union([agentTypeSchema, z.literal('universal')]),
  layers: z.record(z.string().regex(/^\d+$/), z.string().max(50000)),
  metadata: z.object({
    author: z.string().max(100),
    created: z.coerce.date(),
    updated: z.coerce.date(),
    description: z.string().max(1000),
    tags: z.array(z.string().max(50)),
  }),
});

export type PromptTemplate = z.infer<typeof promptTemplateSchema>;

/**
 * Variable validation result
 */
export interface VariableValidation {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Audit log entry for prompt composition
 */
export interface PromptAuditEntry {
  timestamp: string;
  executionId: string;
  agentType: string;
  variableKeys: string[];
  tokenCount?: TokenCount;
  layersIncluded?: number[];
  layersOmitted?: number[];
  warnings?: string[];
  error?: string;
}
