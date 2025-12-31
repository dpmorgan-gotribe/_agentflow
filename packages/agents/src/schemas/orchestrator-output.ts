/**
 * Orchestrator Output Schemas
 *
 * Zod schemas for all orchestrator-related data structures.
 * All LLM outputs must be validated against these schemas.
 *
 * SECURITY: Validates all inputs and outputs to prevent injection attacks.
 */

import { z } from 'zod';
import { AgentTypeSchema } from '../types.js';

/**
 * Task classification from user input analysis
 */
export const TaskClassificationSchema = z.object({
  type: z.enum(['feature', 'bugfix', 'refactor', 'research', 'deployment', 'config']),
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex', 'epic']),
  requiresDesign: z.boolean(),
  requiresArchitecture: z.boolean(),
  requiresCompliance: z.boolean(),
  estimatedAgents: z.number().int().min(1).max(20),
  confidence: z.number().min(0).max(1),
});

export type TaskClassification = z.infer<typeof TaskClassificationSchema>;

/**
 * Routing decision made by decision engine
 */
export const RoutingDecisionSchema = z.object({
  nextAgent: AgentTypeSchema,
  reason: z.string().min(1).max(500),
  priority: z.number().int().min(0).max(100),
  contextRequirements: z.array(z.string().max(100)).max(20),
  estimatedDuration: z.string().max(50).optional(),
  alternativeAgents: z.array(AgentTypeSchema).max(5).optional(),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * AI reasoning result for complex decisions
 */
export const ReasoningResultSchema = z.object({
  decision: z.string().min(1).max(500),
  reasoning: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1),
  alternatives: z
    .array(
      z.object({
        option: z.string().max(200),
        pros: z.array(z.string().max(200)).max(5),
        cons: z.array(z.string().max(200)).max(5),
      })
    )
    .max(5),
  risks: z.array(z.string().max(200)).max(10),
});

export type ReasoningResult = z.infer<typeof ReasoningResultSchema>;

/**
 * Orchestrator state tracking
 */
export const OrchestratorPhaseSchema = z.enum([
  'analyzing',
  'planning',
  'designing',
  'building',
  'testing',
  'reviewing',
  'complete',
  'paused',
  'failed',
]);

export type OrchestratorPhase = z.infer<typeof OrchestratorPhaseSchema>;

export const OrchestratorStateSchema = z.object({
  phase: OrchestratorPhaseSchema,
  currentAgent: AgentTypeSchema.optional(),
  completedAgents: z.array(AgentTypeSchema),
  pendingAgents: z.array(AgentTypeSchema),
  blockedBy: z.string().max(500).optional(),
  approvalsPending: z.array(z.string().max(100)),
  failureCount: z.number().int().min(0).max(100),
  lastDecision: z.string().max(500),
  totalTokensUsed: z.number().int().min(0).optional(),
  iterationCount: z.number().int().min(0).optional(),
});

export type OrchestratorState = z.infer<typeof OrchestratorStateSchema>;

/**
 * Conflict detected during synthesis
 */
export const ConflictSchema = z.object({
  type: z.enum(['file_conflict', 'routing_conflict', 'output_conflict', 'dependency_conflict']),
  description: z.string().min(1).max(500),
  resolution: z.string().max(500).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
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
 */
export const SynthesisResultSchema = z.object({
  summary: z.string().min(1).max(2000),
  keyOutputs: z.array(KeyOutputSchema).max(50),
  conflicts: z.array(ConflictSchema).max(20),
  nextSteps: z.array(z.string().max(200)).max(20),
  completionStatus: z.number().min(0).max(100),
});

export type SynthesisResult = z.infer<typeof SynthesisResultSchema>;

/**
 * Failure analysis result
 */
export const FailureAnalysisSchema = z.object({
  strategy: z.enum(['retry', 'fix', 'escalate', 'skip', 'abort']),
  reason: z.string().min(1).max(500),
  suggestedAgent: AgentTypeSchema.optional(),
  requiresUserInput: z.boolean().optional(),
});

export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

/**
 * Decision context for routing engine
 */
export const DecisionContextSchema = z.object({
  taskClassification: TaskClassificationSchema,
  currentPhase: OrchestratorPhaseSchema,
  hasFailures: z.boolean(),
  failureCount: z.number().int().min(0),
  needsApproval: z.boolean(),
  securityConcern: z.boolean(),
  completedAgents: z.array(AgentTypeSchema),
  totalTokensUsed: z.number().int().min(0).optional(),
});

export type DecisionContext = z.infer<typeof DecisionContextSchema>;

/**
 * Complete orchestrator output
 */
export const OrchestratorOutputSchema = z.object({
  taskClassification: TaskClassificationSchema,
  routingDecision: RoutingDecisionSchema.optional(),
  reasoning: ReasoningResultSchema.optional(),
  state: OrchestratorStateSchema,
  synthesis: SynthesisResultSchema.optional(),
  userMessage: z.string().max(2000).optional(),
  requiresUserInput: z.boolean(),
  routingHints: z.object({
    suggestNext: z.array(AgentTypeSchema),
    skipAgents: z.array(AgentTypeSchema),
    needsApproval: z.boolean(),
    hasFailures: z.boolean(),
    isComplete: z.boolean(),
    blockedBy: z.string().max(500).optional(),
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
