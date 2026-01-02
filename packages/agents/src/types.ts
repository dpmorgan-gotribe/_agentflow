/**
 * Agent Types
 *
 * Shared types and Zod schemas for the agent system.
 * Includes security-enhanced context with tenant isolation.
 */

import { z } from 'zod';

/**
 * Agent type enum - all available agent types
 */
export const AgentTypeEnum = {
  ORCHESTRATOR: 'orchestrator',
  PROJECT_MANAGER: 'project_manager',
  ANALYZER: 'analyzer',
  PROJECT_ANALYZER: 'project_analyzer',
  PLANNER: 'planner',
  ARCHITECT: 'architect',
  UI_DESIGNER: 'ui_designer',
  FRONTEND_DEV: 'frontend_dev',
  BACKEND_DEV: 'backend_dev',
  TESTER: 'tester',
  BUG_FIXER: 'bug_fixer',
  REVIEWER: 'reviewer',
  GIT_AGENT: 'git_agent',
  COMPLIANCE: 'compliance',
  COMPLIANCE_AGENT: 'compliance_agent',
  PATTERN_MINER: 'pattern_miner',
  AGENT_GENERATOR: 'agent_generator',
  TOURNAMENT_MANAGER: 'tournament_manager',
} as const;

export type AgentType = (typeof AgentTypeEnum)[keyof typeof AgentTypeEnum];

export const AgentTypeSchema = z.enum([
  'orchestrator',
  'project_manager',
  'analyzer',
  'project_analyzer',
  'planner',
  'architect',
  'ui_designer',
  'frontend_dev',
  'backend_dev',
  'tester',
  'bug_fixer',
  'reviewer',
  'git_agent',
  'compliance',
  'compliance_agent',
  'pattern_miner',
  'agent_generator',
  'tournament_manager',
]);

/**
 * Mapping of common agent names to valid enum values
 * Claude often returns human-friendly names that don't match our enum
 */
export const AGENT_TYPE_ALIASES: Record<string, AgentType> = {
  // Common variations Claude might return
  frontend_developer: 'frontend_dev',
  backend_developer: 'backend_dev',
  database_architect: 'architect',
  researcher: 'analyzer',
  research: 'analyzer',
  security: 'compliance',
  security_analyst: 'compliance',
  pm: 'project_manager',
  project_mgr: 'project_manager',
  designer: 'ui_designer',
  ux_designer: 'ui_designer',
  qa: 'tester',
  qa_tester: 'tester',
  code_reviewer: 'reviewer',
  devops: 'git_agent',
  // Valid enum values map to themselves
  orchestrator: 'orchestrator',
  project_manager: 'project_manager',
  analyzer: 'analyzer',
  project_analyzer: 'project_analyzer',
  planner: 'planner',
  architect: 'architect',
  ui_designer: 'ui_designer',
  frontend_dev: 'frontend_dev',
  backend_dev: 'backend_dev',
  tester: 'tester',
  bug_fixer: 'bug_fixer',
  reviewer: 'reviewer',
  git_agent: 'git_agent',
  compliance: 'compliance',
  compliance_agent: 'compliance_agent',
  pattern_miner: 'pattern_miner',
  agent_generator: 'agent_generator',
  tournament_manager: 'tournament_manager',
};

/**
 * Normalize an agent type string to a valid enum value
 * Returns null if unrecognized
 */
export function normalizeAgentType(value: string): AgentType | null {
  const normalized = value.toLowerCase().trim();
  return AGENT_TYPE_ALIASES[normalized] ?? null;
}

/**
 * Lenient agent type array schema that:
 * 1. Maps common names to valid enum values
 * 2. Filters out unrecognized values instead of failing validation
 *
 * Use this for routing hints where Claude may return varied agent names
 */
export const LenientAgentTypeArraySchema = z
  .array(z.string())
  .transform((arr) => {
    return arr
      .map((val) => normalizeAgentType(val))
      .filter((v): v is AgentType => v !== null);
  })
  .default([]);

/**
 * Context types that can be provided to agents
 */
export const ContextTypeEnum = {
  PROJECT_CONFIG: 'project_config',
  DESIGN_TOKENS: 'design_tokens',
  USER_FLOWS: 'user_flows',
  MOCKUPS: 'mockups',
  SOURCE_CODE: 'source_code',
  TEST_RESULTS: 'test_results',
  GIT_STATUS: 'git_status',
  LESSONS_LEARNED: 'lessons_learned',
  EXECUTION_HISTORY: 'execution_history',
  CURRENT_TASK: 'current_task',
  AGENT_OUTPUTS: 'agent_outputs',
  WORKFLOW_SETTINGS: 'workflow_settings',
} as const;

export type ContextType = (typeof ContextTypeEnum)[keyof typeof ContextTypeEnum];

export const ContextTypeSchema = z.enum([
  'project_config',
  'design_tokens',
  'user_flows',
  'mockups',
  'source_code',
  'test_results',
  'git_status',
  'lessons_learned',
  'execution_history',
  'current_task',
  'agent_outputs',
  'workflow_settings',
]);

/**
 * Artifact types that agents can produce
 */
export const ArtifactTypeEnum = {
  MOCKUP: 'mockup',
  STYLESHEET: 'stylesheet',
  FLOW_DIAGRAM: 'flow_diagram',
  SOURCE_FILE: 'source_file',
  TEST_FILE: 'test_file',
  CONFIG_FILE: 'config_file',
  DOCUMENTATION: 'documentation',
  REPORT: 'report',
} as const;

export type ArtifactType = (typeof ArtifactTypeEnum)[keyof typeof ArtifactTypeEnum];

export const ArtifactTypeSchema = z.enum([
  'mockup',
  'stylesheet',
  'flow_diagram',
  'source_file',
  'test_file',
  'config_file',
  'documentation',
  'report',
]);

/**
 * Task analysis schema (from LangGraph state)
 */
export const TaskAnalysisSchema = z.object({
  taskType: z.enum(['feature', 'bugfix', 'refactor', 'docs', 'config', 'test']),
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex']),
  requiresUI: z.boolean(),
  requiresBackend: z.boolean(),
  requiresArchitecture: z.boolean(),
  requiresApproval: z.boolean(),
  suggestedAgents: z.array(z.string()),
});

export type TaskAnalysis = z.infer<typeof TaskAnalysisSchema>;

/**
 * Authorization context for tenant isolation (SECURITY)
 */
export const AuthContextSchema = z.object({
  userId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sessionId: z.string().uuid(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  expiresAt: z.date().optional(),
});

export type AuthContext = z.infer<typeof AuthContextSchema>;

/**
 * Agent capability declaration
 */
export const AgentCapabilitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  inputTypes: z.array(z.string()),
  outputTypes: z.array(z.string()),
});

export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

/**
 * Context requirement declaration
 */
export const ContextRequirementSchema = z.object({
  type: ContextTypeSchema,
  required: z.boolean(),
  maxItems: z.number().int().positive().optional(),
  filter: z.record(z.unknown()).optional(),
});

export type ContextRequirement = z.infer<typeof ContextRequirementSchema>;

/**
 * Agent metadata for registry
 */
export const AgentMetadataSchema = z.object({
  id: AgentTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  capabilities: z.array(AgentCapabilitySchema),
  requiredContext: z.array(ContextRequirementSchema),
  outputSchema: z.string(),
});

export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

/**
 * Context item wrapper
 */
export const ContextItemSchema = z.object({
  type: ContextTypeSchema,
  content: z.unknown(),
  metadata: z.object({
    source: z.string(),
    timestamp: z.date(),
    relevance: z.number().min(0).max(1).optional(),
  }),
});

export type ContextItem = z.infer<typeof ContextItemSchema>;

/**
 * Agent constraints for execution limits
 */
export const AgentConstraintsSchema = z.object({
  maxTokens: z.number().int().positive().max(100000).default(4096),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeoutMs: z.number().int().positive().max(600000).default(60000),
  allowedTools: z.array(z.string()).default([]),
  forbiddenPatterns: z.array(z.string()).default([]),
});

export type AgentConstraints = z.infer<typeof AgentConstraintsSchema>;

/**
 * Default constraints
 */
export const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxTokens: 4096,
  maxRetries: 3,
  timeoutMs: 60000,
  allowedTools: [],
  forbiddenPatterns: [
    'process.exit',
    'rm -rf /',
    'DROP TABLE',
    'DELETE FROM',
    'eval(',
    'exec(',
    '__import__',
  ],
};

/**
 * Agent context with security (SECURITY ENHANCED)
 */
export const AgentContextSchema = z.object({
  projectId: z.string().uuid(),
  executionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  task: TaskAnalysisSchema,
  items: z.array(ContextItemSchema),
  previousOutputs: z.array(z.unknown()),
  constraints: AgentConstraintsSchema,
  auth: AuthContextSchema.optional(),
});

export type AgentContext = z.infer<typeof AgentContextSchema>;

/**
 * Routing hints for orchestrator
 * Uses LenientAgentTypeArraySchema to handle common Claude name variations
 */
export const RoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: z.boolean(),
  hasFailures: z.boolean(),
  isComplete: z.boolean(),
  blockedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type RoutingHints = z.infer<typeof RoutingHintsSchema>;

/**
 * Artifact produced by agent
 */
export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  type: ArtifactTypeSchema,
  path: z.string().min(1).max(1000),
  content: z.string().optional(),
  metadata: z.record(z.unknown()),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

/**
 * Execution metrics for tracing
 */
export const ExecutionMetricsSchema = z.object({
  startTime: z.date(),
  endTime: z.date(),
  durationMs: z.number().int().min(0),
  tokensUsed: z.number().int().min(0),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  llmCalls: z.number().int().min(0),
  retryCount: z.number().int().min(0),
  cacheHits: z.number().int().min(0),
});

export type ExecutionMetrics = z.infer<typeof ExecutionMetricsSchema>;

/**
 * Agent error structure
 */
export const AgentErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean(),
  context: z.record(z.unknown()).optional(),
  stack: z.string().optional(),
});

export type AgentError = z.infer<typeof AgentErrorSchema>;

/**
 * Agent output structure
 */
export const AgentOutputSchema = z.object({
  agentId: AgentTypeSchema,
  executionId: z.string().uuid(),
  timestamp: z.date(),
  success: z.boolean(),
  result: z.unknown(),
  artifacts: z.array(ArtifactSchema),
  routingHints: RoutingHintsSchema,
  metrics: ExecutionMetricsSchema,
  errors: z.array(AgentErrorSchema).optional(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

/**
 * Agent execution options
 */
export const AgentExecutionOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
  verbose: z.boolean().optional(),
  overrideConstraints: AgentConstraintsSchema.partial().optional(),
  skipInputValidation: z.boolean().optional(),
  skipOutputValidation: z.boolean().optional(),
});

export type AgentExecutionOptions = z.infer<typeof AgentExecutionOptionsSchema>;

/**
 * Agent request structure
 */
export const AgentRequestSchema = z.object({
  executionId: z.string().uuid(),
  task: TaskAnalysisSchema,
  context: AgentContextSchema,
  options: AgentExecutionOptionsSchema.optional(),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

/**
 * Agent status for monitoring
 */
export const AgentStatusSchema = z.object({
  agentId: AgentTypeSchema,
  state: z.enum(['idle', 'running', 'completed', 'failed']),
  currentTask: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  lastExecution: z.date().optional(),
  consecutiveFailures: z.number().int().min(0),
});

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

/**
 * Security violation error
 */
export class SecurityViolationError extends Error {
  constructor(
    message: string,
    public violations: string[],
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityViolationError';
  }
}

/**
 * Agent validation error
 */
export class AgentValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

/**
 * Agent execution error
 */
export class AgentExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentExecutionError';
  }
}
