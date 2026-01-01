/**
 * LangGraph State Channels
 *
 * Defines the state shape for the orchestrator workflow.
 */

import type { BaseMessage } from '@langchain/core/messages';
import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import { z } from 'zod';

/**
 * Task analysis result schema
 */
export const taskAnalysisSchema = z.object({
  taskType: z.enum(['feature', 'bugfix', 'refactor', 'docs', 'config', 'test']),
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex']),
  requiresUI: z.boolean(),
  requiresBackend: z.boolean(),
  requiresArchitecture: z.boolean(),
  requiresApproval: z.boolean(),
  suggestedAgents: z.array(z.string()),
});

export type TaskAnalysis = z.infer<typeof taskAnalysisSchema>;

/**
 * Artifact produced by agents
 */
export interface Artifact {
  id: string;
  type:
    | 'mockup'
    | 'source_file'
    | 'test_file'
    | 'config_file'
    | 'documentation';
  path: string;
  content?: string;
}

export const artifactSchema = z.object({
  id: z.string(),
  type: z.enum([
    'mockup',
    'source_file',
    'test_file',
    'config_file',
    'documentation',
  ]),
  path: z.string(),
  content: z.string().optional(),
});

/**
 * Routing hints from agents
 */
export interface RoutingHints {
  suggestNext?: string[];
  skipAgents?: string[];
  needsApproval?: boolean;
  hasFailures?: boolean;
  isComplete?: boolean;
}

export const routingHintsSchema = z.object({
  suggestNext: z.array(z.string()).optional(),
  skipAgents: z.array(z.string()).optional(),
  needsApproval: z.boolean().optional(),
  hasFailures: z.boolean().optional(),
  isComplete: z.boolean().optional(),
});

/**
 * Tool usage during agent execution
 */
export interface ToolUsage {
  name: string;
  input?: string;
  output?: string;
  duration?: number;
}

/**
 * Hook execution during agent execution
 */
export interface HookExecution {
  name: string;
  type: 'pre' | 'post';
  status: 'success' | 'failed' | 'skipped';
  message?: string;
}

/**
 * Sub-agent activity details
 */
export interface AgentActivity {
  thinking?: string;
  tools?: ToolUsage[];
  hooks?: HookExecution[];
  response?: string;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Agent output from execution
 */
export interface AgentOutput {
  agentId: string;
  success: boolean;
  result: unknown;
  artifacts: Artifact[];
  routingHints: RoutingHints;
  error?: string;
  timestamp: string;
  activity?: AgentActivity;
}

export const agentOutputSchema = z.object({
  agentId: z.string(),
  success: z.boolean(),
  result: z.unknown(),
  artifacts: z.array(artifactSchema),
  routingHints: routingHintsSchema,
  error: z.string().optional(),
  timestamp: z.string(),
});

/**
 * Approval request structure
 */
export interface ApprovalRequest {
  type: 'design' | 'architecture' | 'implementation' | 'final';
  description: string;
  artifacts: Artifact[];
  options?: string[];
}

export const approvalRequestSchema = z.object({
  type: z.enum(['design', 'architecture', 'implementation', 'final']),
  description: z.string(),
  artifacts: z.array(artifactSchema),
  options: z.array(z.string()).optional(),
});

/**
 * Approval response structure
 */
export interface ApprovalResponse {
  approved: boolean;
  selectedOption?: string;
  feedback?: string;
  timestamp: string;
}

export const approvalResponseSchema = z.object({
  approved: z.boolean(),
  selectedOption: z.string().optional(),
  feedback: z.string().optional(),
  timestamp: z.string(),
});

/**
 * Workflow status enum
 */
export type WorkflowStatus =
  | 'pending'
  | 'analyzing'
  | 'orchestrating'
  | 'agent_working'
  | 'awaiting_approval'
  | 'completing'
  | 'completed'
  | 'failed'
  | 'aborted';

export const workflowStatusSchema = z.enum([
  'pending',
  'analyzing',
  'orchestrating',
  'agent_working',
  'awaiting_approval',
  'completing',
  'completed',
  'failed',
  'aborted',
]);

/**
 * Last value reducer - keeps only the most recent value
 */
const lastValue = <T>(current: T, update: T): T => update;

/**
 * Append reducer - accumulates values in an array
 */
const appendReducer = <T>(current: T[], update: T[]): T[] => [
  ...current,
  ...(update ?? []),
];

/**
 * Replace reducer - replaces if update is provided, otherwise keeps current
 */
const replaceReducer = <T>(current: T[], update: T[]): T[] => update ?? current;

/**
 * Main orchestrator state annotation
 *
 * Defines the complete state shape for workflow execution.
 */
export const OrchestratorState = Annotation.Root({
  // Message history for LLM context
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Project context - required fields
  tenantId: Annotation<string>({
    reducer: lastValue,
    default: () => '',
  }),
  projectId: Annotation<string>({
    reducer: lastValue,
    default: () => '',
  }),
  taskId: Annotation<string>({
    reducer: lastValue,
    default: () => '',
  }),

  // Original prompt
  prompt: Annotation<string>({
    reducer: lastValue,
    default: () => '',
  }),

  // Task analysis result
  analysis: Annotation<TaskAnalysis | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // Agent routing
  currentAgent: Annotation<string | null>({
    reducer: lastValue,
    default: () => null,
  }),
  agentQueue: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  completedAgents: Annotation<string[]>({
    reducer: appendReducer,
    default: () => [],
  }),

  // Agent outputs (accumulated)
  agentOutputs: Annotation<AgentOutput[]>({
    reducer: appendReducer,
    default: () => [],
  }),

  // Retry tracking
  retryCount: Annotation<number>({
    reducer: lastValue,
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    reducer: lastValue,
    default: () => 3,
  }),

  // Workflow status
  status: Annotation<WorkflowStatus>({
    reducer: lastValue,
    default: () => 'pending' as WorkflowStatus,
  }),

  // Error tracking
  error: Annotation<string | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // Approval state
  approvalRequest: Annotation<ApprovalRequest | null>({
    reducer: lastValue,
    default: () => null,
  }),
  approvalResponse: Annotation<ApprovalResponse | null>({
    reducer: lastValue,
    default: () => null,
  }),
});

export type OrchestratorStateType = typeof OrchestratorState.State;

/**
 * Initial state factory with validation
 */
export function createInitialState(input: {
  tenantId: string;
  projectId: string;
  taskId: string;
  prompt: string;
}): Partial<OrchestratorStateType> {
  // Validate required fields
  const schema = z.object({
    tenantId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    prompt: z.string().min(1),
  });

  const validated = schema.parse(input);

  return {
    tenantId: validated.tenantId,
    projectId: validated.projectId,
    taskId: validated.taskId,
    prompt: validated.prompt,
    status: 'pending',
    messages: [],
    analysis: null,
    currentAgent: null,
    agentQueue: [],
    completedAgents: [],
    agentOutputs: [],
    retryCount: 0,
    maxRetries: 3,
    error: null,
    approvalRequest: null,
    approvalResponse: null,
  };
}
