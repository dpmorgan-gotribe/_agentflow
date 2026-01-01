/**
 * Orchestrator Thinking Schemas
 *
 * Defines the structures for orchestrator reasoning and decision-making.
 * The thinking orchestrator uses AI to reason about what should happen next
 * after each step, rather than following a predetermined queue.
 */

import { z } from 'zod';

/**
 * Actions the orchestrator can decide to take
 */
export const OrchestratorActionSchema = z.enum([
  'dispatch',           // Send to a single agent
  'parallel_dispatch',  // Send to multiple agents concurrently
  'approval',           // Request user approval
  'complete',           // Workflow is done
  'fail',               // Workflow has failed
  'wait',               // Wait for something (e.g., external input)
]);

export type OrchestratorAction = z.infer<typeof OrchestratorActionSchema>;

/**
 * Target for agent dispatch
 */
export const AgentDispatchSchema = z.object({
  /** Agent type to dispatch to */
  agentId: z.string(),
  /** Unique execution ID for this dispatch */
  executionId: z.string().optional(),
  /** Style hint for parallel UI designers */
  styleHint: z.string().optional(),
  /** Style package ID (for UI designers in competition) */
  stylePackageId: z.string().optional(),
  /** Specific context to pass to this agent */
  contextRefs: z.array(z.string()).optional(),
  /** Priority for this dispatch */
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type AgentDispatch = z.infer<typeof AgentDispatchSchema>;

/**
 * Approval configuration when requesting user input
 */
export const ApprovalConfigSchema = z.object({
  /** Type of approval */
  type: z.enum([
    'style_selection',    // Select 1 of N style options
    'design_review',      // Review all screen designs
    'confirmation',       // Simple yes/no confirmation
    'feedback',           // Request feedback/guidance
  ]),
  /** Description of what's being approved */
  description: z.string(),
  /** Options for selection (style_selection type) */
  options: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    previewPath: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })).optional(),
  /** Allow rejecting all options */
  allowRejectAll: z.boolean().default(false),
  /** Message to show if user rejects all */
  rejectAllMessage: z.string().optional(),
  /** Current iteration count (for rejection loops) */
  iterationCount: z.number().default(0),
  /** Maximum iterations before escalation */
  maxIterations: z.number().default(5),
});

export type ApprovalConfig = z.infer<typeof ApprovalConfigSchema>;

/**
 * Context mapping for selective context passing
 * Maps agent IDs to the context references they should receive
 */
export const ContextMappingSchema = z.record(
  z.string(), // Agent ID
  z.array(z.string()) // Context references like "analyst.stylePackages[0]" or "architect.structure"
);

export type ContextMapping = z.infer<typeof ContextMappingSchema>;

/**
 * The orchestrator's decision after thinking
 */
export const OrchestratorDecisionSchema = z.object({
  /** The reasoning process that led to this decision */
  reasoning: z.string(),
  /** The action to take */
  action: OrchestratorActionSchema,
  /** Target agents for dispatch/parallel_dispatch */
  targets: z.array(AgentDispatchSchema).optional(),
  /** Context mapping for selective context passing */
  contextMapping: ContextMappingSchema.optional(),
  /** Approval configuration if action is 'approval' */
  approvalConfig: ApprovalConfigSchema.optional(),
  /** Error message if action is 'fail' */
  error: z.string().optional(),
  /** Completion summary if action is 'complete' */
  summary: z.string().optional(),
  /** Confidence level in this decision (0-1) */
  confidence: z.number().min(0).max(1).optional(),
});

export type OrchestratorDecision = z.infer<typeof OrchestratorDecisionSchema>;

/**
 * A single step in the orchestrator's thinking history
 */
export const ThinkingStepSchema = z.object({
  /** Step number in the thinking sequence */
  step: z.number(),
  /** Timestamp of this thinking step */
  timestamp: z.string(),
  /** What triggered this thinking step */
  trigger: z.enum([
    'initial',            // Initial prompt received
    'agent_completed',    // An agent finished execution
    'parallel_completed', // All parallel agents finished
    'approval_received',  // User provided approval response
    'error_occurred',     // An error occurred
    'timeout',            // A timeout occurred
  ]),
  /** The agent that triggered this (if applicable) */
  triggerAgentId: z.string().optional(),
  /** State summary at time of thinking */
  stateSummary: z.object({
    completedAgents: z.array(z.string()),
    pendingAgents: z.array(z.string()),
    hasErrors: z.boolean(),
    artifactCount: z.number(),
    currentPhase: z.string().optional(),
  }),
  /** The reasoning produced */
  reasoning: z.string(),
  /** The decision made */
  decision: OrchestratorDecisionSchema,
});

export type ThinkingStep = z.infer<typeof ThinkingStepSchema>;

/**
 * Result from parallel agent execution
 */
export const ParallelResultSchema = z.object({
  /** Agent ID that produced this result */
  agentId: z.string(),
  /** Execution ID for this parallel run */
  executionId: z.string(),
  /** Whether execution succeeded */
  success: z.boolean(),
  /** The agent's output */
  output: z.unknown(),
  /** Artifacts produced */
  artifacts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    path: z.string(),
    content: z.string().optional(),
  })),
  /** Error if failed */
  error: z.string().optional(),
  /** Execution duration in ms */
  durationMs: z.number().optional(),
  /** Style package ID if this was a style competition */
  stylePackageId: z.string().optional(),
});

export type ParallelResult = z.infer<typeof ParallelResultSchema>;

/**
 * Current thinking state of the orchestrator
 */
export const OrchestratorThinkingSchema = z.object({
  /** Current phase of the workflow */
  currentPhase: z.enum([
    'analyzing',          // Analyzing initial prompt
    'researching',        // Analyst doing research
    'architecting',       // Architect creating structure
    'style_competition',  // Multiple UI designers competing
    'awaiting_style_selection', // Waiting for user to pick a style
    'full_design',        // Creating all screen mockups
    'awaiting_design_approval', // Waiting for design approval
    'project_planning',   // PM creating tasks
    'development',        // Developers building
    'review',             // Reviewing output
    'complete',           // Done
    'failed',             // Failed
  ]),
  /** Current iteration for rejection loops */
  styleIterationCount: z.number().default(0),
  /** IDs of rejected styles (to avoid in next iteration) */
  rejectedStyleIds: z.array(z.string()).default([]),
  /** User feedback from rejections */
  userFeedback: z.array(z.string()).default([]),
  /** Last decision made */
  lastDecision: OrchestratorDecisionSchema.optional(),
  /** Is orchestrator currently waiting for something */
  isWaiting: z.boolean().default(false),
  /** What is it waiting for */
  waitingFor: z.string().optional(),
});

export type OrchestratorThinking = z.infer<typeof OrchestratorThinkingSchema>;

/**
 * Helper to create initial orchestrator thinking state
 */
export function createInitialThinkingState(): OrchestratorThinking {
  return {
    currentPhase: 'analyzing',
    styleIterationCount: 0,
    rejectedStyleIds: [],
    userFeedback: [],
    isWaiting: false,
  };
}

/**
 * Helper to create a thinking step
 */
export function createThinkingStep(
  step: number,
  trigger: ThinkingStep['trigger'],
  stateSummary: ThinkingStep['stateSummary'],
  reasoning: string,
  decision: OrchestratorDecision,
  triggerAgentId?: string
): ThinkingStep {
  return {
    step,
    timestamp: new Date().toISOString(),
    trigger,
    triggerAgentId,
    stateSummary,
    reasoning,
    decision,
  };
}
