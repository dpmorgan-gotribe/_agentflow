/**
 * LangGraph State Channels
 *
 * Defines the state shape for the orchestrator workflow.
 * Extended to support the thinking orchestrator pattern with:
 * - Orchestrator reasoning between steps
 * - Parallel agent execution
 * - Style competition workflow
 * - Component inventory tracking
 */

import type { BaseMessage } from '@langchain/core/messages';
import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import { z } from 'zod';

import type {
  OrchestratorThinking,
  OrchestratorDecision,
  ThinkingStep,
  AgentDispatch,
  ParallelResult,
} from './schemas/orchestrator-thinking.js';
import type {
  StylePackage,
  RejectedStyle,
  StyleSelection,
  UserStyleHints,
  StyleCompetitionState,
} from './schemas/style-package.js';
import type { ComponentInventory } from './schemas/component-inventory.js';

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

  // ============================================================
  // THINKING ORCHESTRATOR STATE CHANNELS
  // ============================================================

  // Orchestrator reasoning state - tracks the AI's decision-making
  orchestratorThinking: Annotation<OrchestratorThinking | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // History of all thinking steps (accumulated)
  thinkingHistory: Annotation<ThinkingStep[]>({
    reducer: appendReducer,
    default: () => [],
  }),

  // Current decision from orchestrator
  orchestratorDecision: Annotation<OrchestratorDecision | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // ============================================================
  // PARALLEL EXECUTION STATE CHANNELS
  // ============================================================

  // Agents pending parallel execution
  pendingAgents: Annotation<AgentDispatch[]>({
    reducer: replaceReducer,
    default: () => [],
  }),

  // Results from parallel agent execution (accumulated)
  parallelResults: Annotation<ParallelResult[]>({
    reducer: appendReducer,
    default: () => [],
  }),

  // Whether we're currently in parallel execution mode
  isParallelExecution: Annotation<boolean>({
    reducer: lastValue,
    default: () => false,
  }),

  // ============================================================
  // STYLE COMPETITION STATE CHANNELS
  // ============================================================

  // All style packages generated by Analyst
  stylePackages: Annotation<StylePackage[]>({
    reducer: replaceReducer,
    default: () => [],
  }),

  // ID of the selected style (after user approval)
  selectedStyleId: Annotation<string | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // Full style selection record
  styleSelection: Annotation<StyleSelection | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // History of rejected styles (accumulated across iterations)
  rejectedStyles: Annotation<RejectedStyle[]>({
    reducer: appendReducer,
    default: () => [],
  }),

  // Current style competition iteration (1-5)
  styleIteration: Annotation<number>({
    reducer: lastValue,
    default: () => 1,
  }),

  // User hints extracted from prompt
  userStyleHints: Annotation<UserStyleHints | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // Full style competition state
  styleCompetition: Annotation<StyleCompetitionState | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // ============================================================
  // COMPONENT INVENTORY STATE CHANNELS
  // ============================================================

  // Component inventory from Analyst
  componentInventory: Annotation<ComponentInventory | null>({
    reducer: lastValue,
    default: () => null,
  }),

  // ============================================================
  // MEGA PAGE STATE CHANNELS
  // ============================================================

  // Mega page previews from parallel UI designer execution
  megaPagePreviews: Annotation<Array<{
    styleId: string;
    designerId: string;
    previewPath: string;
    thumbnailPath?: string;
    htmlContent?: string;
    cssContent?: string;
    generatedAt: string;
  }>>({
    reducer: appendReducer,
    default: () => [],
  }),

  // ============================================================
  // WORKFLOW SETTINGS STATE CHANNELS
  // ============================================================

  // Workflow settings passed from API
  workflowSettings: Annotation<WorkflowSettings>({
    reducer: lastValue,
    default: () => DEFAULT_WORKFLOW_SETTINGS,
  }),
});

/**
 * Workflow settings for configurable parameters
 */
export interface WorkflowSettings {
  /** Number of style packages to generate */
  stylePackageCount: number;
  /** Number of parallel UI designers */
  parallelDesignerCount: number;
  /** Whether to enable style competition */
  enableStyleCompetition: boolean;
  /** Maximum style rejection iterations */
  maxStyleRejections: number;
  /** Claude CLI timeout in ms */
  claudeCliTimeoutMs: number;
}

export const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
  stylePackageCount: 1,
  parallelDesignerCount: 1,
  enableStyleCompetition: false,
  maxStyleRejections: 5,
  claudeCliTimeoutMs: 900000,
};

export type OrchestratorStateType = typeof OrchestratorState.State;

/**
 * Initial state factory with validation
 */
export function createInitialState(input: {
  tenantId: string;
  projectId: string;
  taskId: string;
  prompt: string;
  workflowSettings?: Partial<WorkflowSettings>;
}): Partial<OrchestratorStateType> {
  // Validate required fields
  const schema = z.object({
    tenantId: z.string().uuid(),
    projectId: z.string().uuid(),
    taskId: z.string().uuid(),
    prompt: z.string().min(1),
  });

  const validated = schema.parse(input);

  // Merge settings with defaults
  const settings: WorkflowSettings = {
    ...DEFAULT_WORKFLOW_SETTINGS,
    ...input.workflowSettings,
  };

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
    // Thinking orchestrator channels
    orchestratorThinking: null,
    thinkingHistory: [],
    orchestratorDecision: null,
    // Parallel execution channels
    pendingAgents: [],
    parallelResults: [],
    isParallelExecution: false,
    // Style competition channels
    stylePackages: [],
    selectedStyleId: null,
    styleSelection: null,
    rejectedStyles: [],
    styleIteration: 1,
    userStyleHints: null,
    styleCompetition: null,
    // Component inventory
    componentInventory: null,
    // Mega page previews
    megaPagePreviews: [],
    // Workflow settings
    workflowSettings: settings,
  };
}
