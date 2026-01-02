/**
 * Orchestrator Output Schemas
 *
 * Zod schemas for all orchestrator-related data structures.
 * All LLM outputs must be validated against these schemas.
 *
 * SECURITY: Validates all inputs and outputs to prevent injection attacks.
 *
 * LENIENT: Uses lenient parsing utilities to handle Claude's output variations.
 */

import { z } from 'zod';
import { AgentTypeSchema, LenientAgentTypeArraySchema } from '../types.js';
import {
  lenientEnum,
  lenientArray,
  lenientConfidence,
  lenientBoolean,
  withDefault,
} from './lenient-utils.js';

/**
 * Task type values
 */
const TASK_TYPES = ['feature', 'bugfix', 'refactor', 'research', 'deployment', 'config'] as const;

/**
 * Complexity values
 */
const COMPLEXITY_LEVELS = ['trivial', 'simple', 'moderate', 'complex', 'epic'] as const;

/**
 * Task classification from user input analysis
 * Uses lenient parsing for enums and confidence
 */
export const TaskClassificationSchema = z.object({
  type: lenientEnum(TASK_TYPES, 'feature'),
  complexity: lenientEnum(COMPLEXITY_LEVELS, 'moderate'),
  requiresDesign: lenientBoolean,
  requiresArchitecture: lenientBoolean,
  requiresCompliance: lenientBoolean,
  estimatedAgents: z.number().int().min(1).max(20).catch(3),
  confidence: lenientConfidence,
});

export type TaskClassification = z.infer<typeof TaskClassificationSchema>;

/**
 * Routing decision made by decision engine
 * Uses lenient parsing for arrays and strings
 */
export const RoutingDecisionSchema = z.object({
  nextAgent: AgentTypeSchema.catch('orchestrator'),
  reason: z.string().max(500).default(''),
  priority: z.number().int().min(0).max(100).catch(50),
  contextRequirements: lenientArray(z.string().max(100)),
  estimatedDuration: z.string().max(50).optional(),
  alternativeAgents: lenientArray(AgentTypeSchema).default([]),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * AI reasoning result for complex decisions
 * Uses lenient parsing with defaults
 */
export const ReasoningResultSchema = z.object({
  decision: z.string().max(500).default(''),
  reasoning: z.string().max(2000).default(''),
  confidence: lenientConfidence,
  alternatives: lenientArray(
    z.object({
      option: z.string().max(200).default(''),
      pros: lenientArray(z.string().max(200)),
      cons: lenientArray(z.string().max(200)),
    })
  ),
  risks: lenientArray(z.string().max(200)),
});

export type ReasoningResult = z.infer<typeof ReasoningResultSchema>;

/**
 * Orchestrator phase values
 */
const ORCHESTRATOR_PHASES = [
  'analyzing',
  'planning',
  'designing',
  'building',
  'testing',
  'reviewing',
  'complete',
  'paused',
  'failed',
] as const;

/**
 * Orchestrator state tracking
 * Uses lenient enum for phase
 */
export const OrchestratorPhaseSchema = lenientEnum(ORCHESTRATOR_PHASES, 'analyzing');

export type OrchestratorPhase = z.infer<typeof OrchestratorPhaseSchema>;

export const OrchestratorStateSchema = z.object({
  phase: OrchestratorPhaseSchema,
  currentAgent: AgentTypeSchema.optional(),
  completedAgents: lenientArray(AgentTypeSchema),
  pendingAgents: lenientArray(AgentTypeSchema),
  blockedBy: z.string().max(500).optional(),
  approvalsPending: lenientArray(z.string().max(100)),
  failureCount: z.number().int().min(0).max(100).catch(0),
  lastDecision: z.string().max(500).default(''),
  totalTokensUsed: z.number().int().min(0).optional(),
  iterationCount: z.number().int().min(0).optional(),
});

export type OrchestratorState = z.infer<typeof OrchestratorStateSchema>;

/**
 * Conflict type values
 */
const CONFLICT_TYPES = ['file_conflict', 'routing_conflict', 'output_conflict', 'dependency_conflict'] as const;

/**
 * Severity values
 */
const SEVERITY_LEVELS = ['low', 'medium', 'high'] as const;

/**
 * Conflict detected during synthesis
 * Uses lenient parsing for enums
 */
export const ConflictSchema = z.object({
  type: lenientEnum(CONFLICT_TYPES, 'output_conflict'),
  description: z.string().max(500).default(''),
  resolution: z.string().max(500).optional(),
  severity: lenientEnum(SEVERITY_LEVELS, 'medium').optional(),
});

export type Conflict = z.infer<typeof ConflictSchema>;

/**
 * Key output from an agent
 */
export const KeyOutputSchema = z.object({
  agent: AgentTypeSchema,
  output: z.string().max(1000),
  artifacts: z.array(z.string().max(500)).max(50),
  success: z.boolean().optional(),
});

export type KeyOutput = z.infer<typeof KeyOutputSchema>;

/**
 * Synthesis result from combining multiple agent outputs
 * Uses lenient arrays and defaults
 */
export const SynthesisResultSchema = z.object({
  summary: z.string().max(2000).default(''),
  keyOutputs: lenientArray(KeyOutputSchema),
  conflicts: lenientArray(ConflictSchema),
  nextSteps: lenientArray(z.string().max(200)),
  completionStatus: z.number().min(0).max(100).catch(0),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

/**
 * Failure strategy values
 */
const FAILURE_STRATEGIES = ['retry', 'fix', 'escalate', 'skip', 'abort'] as const;

/**
 * Failure analysis result
 * Uses lenient enum and defaults
 */
export const FailureAnalysisSchema = z.object({
  strategy: lenientEnum(FAILURE_STRATEGIES, 'retry'),
  reason: z.string().max(500).default(''),
  suggestedAgent: AgentTypeSchema.optional(),
  requiresUserInput: lenientBoolean.optional(),
});

export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

/**
 * Decision context for routing engine
 * Uses lenient booleans and arrays
 */
export const DecisionContextSchema = z.object({
  taskClassification: TaskClassificationSchema,
  currentPhase: OrchestratorPhaseSchema,
  hasFailures: lenientBoolean,
  failureCount: z.number().int().min(0).catch(0),
  needsApproval: lenientBoolean,
  securityConcern: lenientBoolean,
  completedAgents: lenientArray(AgentTypeSchema),
  totalTokensUsed: z.number().int().min(0).optional(),
});

export type DecisionContext = z.infer<typeof DecisionContextSchema>;

/**
 * Complete orchestrator output
 * Uses lenient parsing throughout
 */
export const OrchestratorOutputSchema = z.object({
  taskClassification: TaskClassificationSchema,
  routingDecision: RoutingDecisionSchema.optional(),
  reasoning: ReasoningResultSchema.optional(),
  state: OrchestratorStateSchema,
  synthesis: SynthesisResultSchema.optional(),
  userMessage: z.string().max(2000).optional(),
  requiresUserInput: lenientBoolean,
  routingHints: z.object({
    suggestNext: LenientAgentTypeArraySchema,
    skipAgents: LenientAgentTypeArraySchema,
    needsApproval: lenientBoolean,
    hasFailures: lenientBoolean,
    isComplete: lenientBoolean,
    blockedBy: z.string().max(500).optional(),
  }).default({
    suggestNext: [],
    skipAgents: [],
    needsApproval: false,
    hasFailures: false,
    isComplete: false,
  }),
});

export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

/**
 * User input validation schema
 *
 * SECURITY: Validates user input before processing to prevent injection.
 */
export const UserInputSchema = z
  .string()
  .min(1, 'Input cannot be empty')
  .max(50000, 'Input exceeds maximum length')
  .refine(
    (input) => {
      // Check for obvious prompt injection patterns
      const dangerousPatterns = [
        /ignore\s+(all\s+)?(previous\s+)?instructions/i,
        /disregard\s+(all\s+)?(previous\s+)?instructions/i,
        /forget\s+(all\s+)?(previous\s+)?instructions/i,
        /override\s+(all\s+)?(system\s+)?instructions/i,
        /you\s+are\s+now\s+(a\s+)?different/i,
        /new\s+instructions?\s*:/i,
        /system\s+prompt\s*:/i,
        /<\s*system\s*>/i,
        /\[\s*SYSTEM\s*\]/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(input)) {
          return false;
        }
      }
      return true;
    },
    { message: 'Input contains potentially harmful patterns' }
  );

/**
 * Orchestration configuration
 */
export const OrchestrationConfigSchema = z.object({
  maxIterations: z.number().int().min(1).max(100).default(50),
  maxTokenBudget: z.number().int().min(1000).max(1000000).default(100000),
  aiReasoningThreshold: z.number().min(0).max(1).default(0.7),
  enableAuditLogging: z.boolean().default(true),
  enableSecurityChecks: z.boolean().default(true),
  timeoutMs: z.number().int().min(1000).max(3600000).default(300000),
});

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

/**
 * Default orchestration configuration
 */
export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  maxIterations: 50,
  maxTokenBudget: 100000,
  aiReasoningThreshold: 0.7,
  enableAuditLogging: true,
  enableSecurityChecks: true,
  timeoutMs: 300000, // 5 minutes
};
