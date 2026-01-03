/**
 * Streaming Utilities
 *
 * Helpers for streaming workflow updates to clients.
 */

import type { OrchestratorStateType } from '../state.js';

/**
 * Streaming event types
 */
export type StreamEventType =
  | 'workflow.started'
  | 'workflow.analyzing'
  | 'workflow.routing'
  | 'workflow.agent_started'
  | 'workflow.agent_completed'
  | 'workflow.approval_needed'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.error'
  // Thinking orchestrator events
  | 'workflow.orchestrator_thinking'
  // Parallel execution events
  | 'workflow.parallel_started'
  | 'workflow.parallel_agent_completed'
  | 'workflow.parallel_completed'
  // Style competition events
  | 'workflow.style_competition'
  | 'workflow.style_selected'
  | 'workflow.style_rejected'
  // Incremental agent activity events (live streaming)
  | 'workflow.agent_context_loaded'
  | 'workflow.agent_thinking'
  | 'workflow.agent_tool_started'
  | 'workflow.agent_tool_completed'
  | 'workflow.agent_response';

/**
 * Stream event structure
 */
export interface StreamEvent {
  type: StreamEventType;
  timestamp: string;
  data: StreamEventData;
}

/**
 * Stream event data variants
 */
export type StreamEventData =
  | WorkflowStartedData
  | WorkflowAnalyzingData
  | WorkflowRoutingData
  | AgentStartedData
  | AgentCompletedData
  | ApprovalNeededData
  | WorkflowCompletedData
  | WorkflowFailedData
  | WorkflowErrorData
  | OrchestratorThinkingData
  | ParallelStartedData
  | ParallelAgentCompletedData
  | ParallelCompletedData
  | StyleCompetitionData
  | StyleSelectedData
  | StyleRejectedData
  // Incremental agent activity
  | AgentContextLoadedData
  | AgentThinkingData
  | AgentToolStartedData
  | AgentToolCompletedData
  | AgentResponseData;

/**
 * Base event data with optional reasoning/message field
 */
interface BaseEventData {
  taskId: string;
  /** Human-readable message describing the event */
  message?: string;
  /** AI reasoning for the event (more detailed than message) */
  reasoning?: string;
}

export interface WorkflowStartedData extends BaseEventData {
  tenantId?: string;
  projectId?: string;
  prompt: string;
}

export interface WorkflowAnalyzingData extends BaseEventData {
  analysis?: {
    taskType: string;
    complexity: string;
    requiresUI?: boolean;
    requiresBackend?: boolean;
    requiresArchitecture?: boolean;
  };
  agentQueue?: string[];
}

export interface WorkflowRoutingData extends BaseEventData {
  agentQueue: string[];
  currentAgent?: string;
}

export interface AgentStartedData extends BaseEventData {
  agentId: string;
}

export interface AgentCompletedData extends BaseEventData {
  agentId: string;
  success: boolean;
  artifactCount: number;
  completedAgents?: string[];
  /** Sub-agent activity details (thinking, tools, hooks, response) */
  activity?: {
    thinking?: string;
    tools?: Array<{
      name: string;
      input?: string;
      output?: string;
      duration?: number;
    }>;
    hooks?: Array<{
      name: string;
      type: 'pre' | 'post';
      status: 'success' | 'failed' | 'skipped';
      message?: string;
    }>;
    response?: string;
    tokenUsage?: {
      input: number;
      output: number;
      /** Tokens used to create cache entries */
      cacheCreation?: number;
      /** Tokens read from cache (90% discount) */
      cacheRead?: number;
    };
  };
}

export interface ApprovalNeededData extends BaseEventData {
  approvalType: string;
  description: string;
  artifactCount: number;
  approvalRequest?: unknown;
}

export interface WorkflowCompletedData extends BaseEventData {
  completedAgents: string[];
  totalArtifacts: number;
  agentOutputs?: unknown[];
}

export interface WorkflowFailedData extends BaseEventData {
  error: string;
  lastAgent?: string;
  agentOutputs?: unknown[];
}

export interface WorkflowErrorData extends BaseEventData {
  error: string;
}

// ============================================================================
// Thinking Orchestrator Events
// ============================================================================

export interface OrchestratorThinkingData extends BaseEventData {
  /** What the orchestrator is reasoning about */
  thinking: string;
  /** The decision made */
  action: 'dispatch' | 'parallel_dispatch' | 'approval' | 'complete' | 'fail';
  /** Target agents for dispatch */
  targets?: string[];
  /** Step number in thinking history */
  step: number;
}

// ============================================================================
// Parallel Execution Events
// ============================================================================

export interface ParallelStartedData extends BaseEventData {
  /** Agents being executed in parallel */
  agents: string[];
  /** Number of agents in parallel execution */
  agentCount: number;
  /** Whether this is a style competition */
  isStyleCompetition?: boolean;
}

export interface ParallelAgentCompletedData extends BaseEventData {
  /** Agent that completed */
  agentId: string;
  /** Execution ID for this parallel run */
  executionId: string;
  /** Whether this agent succeeded */
  success: boolean;
  /** Artifact count for this agent */
  artifactCount: number;
  /** Style package ID if style competition */
  stylePackageId?: string;
  /** Error message if failed */
  error?: string;
  /** How many agents are still pending */
  remainingAgents: number;
}

export interface ParallelCompletedData extends BaseEventData {
  /** Total agents executed */
  totalAgents: number;
  /** Successful agents count */
  successfulAgents: number;
  /** Failed agents count */
  failedAgents: number;
  /** Whether this was a style competition */
  isStyleCompetition?: boolean;
}

// ============================================================================
// Style Competition Events
// ============================================================================

export interface StyleCompetitionData extends BaseEventData {
  /** Number of style packages being competed */
  styleCount: number;
  /** Style package names */
  styleNames: string[];
  /** Preview paths for each style */
  previewPaths?: string[];
}

export interface StyleSelectedData extends BaseEventData {
  /** Selected style package ID */
  selectedStyleId: string;
  /** Selected style package name */
  selectedStyleName: string;
  /** User feedback if any */
  feedback?: string;
}

export interface StyleRejectedData extends BaseEventData {
  /** How many times styles have been rejected */
  rejectionCount: number;
  /** Max rejections allowed before asking for specific guidance */
  maxRejections: number;
  /** User feedback for rejection */
  feedback?: string;
  /** Rejected style IDs */
  rejectedStyleIds: string[];
}

// ============================================================================
// Incremental Agent Activity Events (Live Streaming)
// ============================================================================

export interface AgentContextLoadedData extends BaseEventData {
  /** Agent that loaded context */
  agentId: string;
  /** Number of context items loaded */
  contextItemCount: number;
  /** Types of context loaded */
  contextTypes: string[];
  /** Total tokens in context */
  contextTokens?: number;
}

export interface AgentThinkingData extends BaseEventData {
  /** Agent that is thinking */
  agentId: string;
  /** Current thinking/reasoning content */
  thinking: string;
  /** Whether this is a partial update (more coming) */
  isPartial?: boolean;
  /** Thinking step number (for multi-step reasoning) */
  step?: number;
}

export interface AgentToolStartedData extends BaseEventData {
  /** Agent using the tool */
  agentId: string;
  /** Tool being invoked */
  toolName: string;
  /** Tool invocation ID (for matching start/complete) */
  toolId: string;
  /** Tool input (truncated for display) */
  toolInput?: string;
}

export interface AgentToolCompletedData extends BaseEventData {
  /** Agent that used the tool */
  agentId: string;
  /** Tool that was invoked */
  toolName: string;
  /** Tool invocation ID (matches start event) */
  toolId: string;
  /** Whether tool succeeded */
  success: boolean;
  /** Tool output (truncated for display) */
  toolOutput?: string;
  /** Error if tool failed */
  error?: string;
  /** Duration in milliseconds */
  duration?: number;
}

export interface AgentResponseData extends BaseEventData {
  /** Agent providing the response */
  agentId: string;
  /** Response content (may be partial) */
  response: string;
  /** Whether this is a partial response (streaming) */
  isPartial?: boolean;
  /** Response chunk number for streaming */
  chunk?: number;
}

/**
 * Extra event data that can be passed to createStreamEvent
 */
export interface ExtraEventData {
  taskId?: string;
  tenantId?: string;
  projectId?: string;
  prompt?: string;
  message?: string;
  reasoning?: string;
  analysis?: unknown;
  agentQueue?: string[];
  currentAgent?: string;
  agentId?: string;
  success?: boolean;
  artifactCount?: number;
  completedAgents?: string[];
  approvalType?: string;
  description?: string;
  approvalRequest?: unknown;
  totalArtifacts?: number;
  agentOutputs?: unknown[];
  error?: string;
  lastAgent?: string;
  /** Sub-agent activity details */
  activity?: AgentCompletedData['activity'];

  // Thinking orchestrator fields
  thinking?: string;
  action?: 'dispatch' | 'parallel_dispatch' | 'approval' | 'complete' | 'fail';
  targets?: string[];
  step?: number;

  // Parallel execution fields
  agents?: string[];
  agentCount?: number;
  executionId?: string;
  stylePackageId?: string;
  remainingAgents?: number;
  totalAgents?: number;
  successfulAgents?: number;
  failedAgents?: number;
  isStyleCompetition?: boolean;

  // Style competition fields
  styleCount?: number;
  styleNames?: string[];
  previewPaths?: string[];
  selectedStyleId?: string;
  selectedStyleName?: string;
  feedback?: string;
  rejectionCount?: number;
  maxRejections?: number;
  rejectedStyleIds?: string[];

  // Incremental agent activity fields
  contextItemCount?: number;
  contextTypes?: string[];
  contextTokens?: number;
  isPartial?: boolean;
  toolName?: string;
  toolId?: string;
  toolInput?: string;
  toolOutput?: string;
  duration?: number;
  response?: string;
  chunk?: number;
}

/**
 * Create a stream event from workflow state with optional extra data
 */
export function createStreamEvent(
  type: StreamEventType,
  stateOrData: Partial<OrchestratorStateType> | ExtraEventData,
  extraData?: ExtraEventData
): StreamEvent {
  const timestamp = new Date().toISOString();

  // Determine if first arg is state or data object
  const state = ('prompt' in stateOrData && typeof stateOrData.prompt === 'string' && stateOrData.prompt.length > 0)
    ? stateOrData as Partial<OrchestratorStateType>
    : {} as Partial<OrchestratorStateType>;
  const extra: ExtraEventData = extraData || stateOrData as ExtraEventData;

  // Helper to merge extra data
  const withExtra = <T extends object>(data: T): T => ({
    ...data,
    message: extra.message,
    reasoning: extra.reasoning,
  });

  switch (type) {
    case 'workflow.started':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          tenantId: state.tenantId ?? extra.tenantId,
          projectId: state.projectId ?? extra.projectId,
          prompt: state.prompt ?? extra.prompt ?? '',
        }) as WorkflowStartedData,
      };

    case 'workflow.analyzing':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          analysis: state.analysis ?? extra.analysis,
          agentQueue: state.agentQueue ?? extra.agentQueue,
        }) as WorkflowAnalyzingData,
      };

    case 'workflow.routing':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentQueue: state.agentQueue ?? extra.agentQueue ?? [],
          currentAgent: state.currentAgent ?? extra.currentAgent,
        }) as WorkflowRoutingData,
      };

    case 'workflow.agent_started':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: state.currentAgent ?? extra.agentId ?? '',
        }) as AgentStartedData,
      };

    case 'workflow.agent_completed': {
      const lastOutput = state.agentOutputs?.[state.agentOutputs.length - 1];
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: lastOutput?.agentId ?? extra.agentId ?? '',
          success: lastOutput?.success ?? extra.success ?? false,
          artifactCount: lastOutput?.artifacts?.length ?? extra.artifactCount ?? 0,
          completedAgents: state.completedAgents ?? extra.completedAgents,
          // Include sub-agent activity (thinking, tools, hooks, response)
          activity: lastOutput?.activity ?? extra.activity,
        }) as AgentCompletedData,
      };
    }

    case 'workflow.approval_needed':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          approvalType: state.approvalRequest?.type ?? extra.approvalType ?? 'final',
          description: state.approvalRequest?.description ?? extra.description ?? '',
          artifactCount: state.approvalRequest?.artifacts?.length ?? extra.artifactCount ?? 0,
          approvalRequest: state.approvalRequest ?? extra.approvalRequest,
        }) as ApprovalNeededData,
      };

    case 'workflow.completed': {
      const totalArtifacts =
        state.agentOutputs?.reduce(
          (sum, output) => sum + (output.artifacts?.length ?? 0),
          0
        ) ?? extra.totalArtifacts ?? 0;
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          completedAgents: state.completedAgents ?? extra.completedAgents ?? [],
          totalArtifacts,
          agentOutputs: state.agentOutputs ?? extra.agentOutputs,
        }) as WorkflowCompletedData,
      };
    }

    case 'workflow.failed': {
      const lastAgent =
        state.agentOutputs?.[state.agentOutputs.length - 1]?.agentId ?? extra.lastAgent;
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          error: state.error ?? extra.error ?? 'Unknown error',
          lastAgent,
          agentOutputs: state.agentOutputs ?? extra.agentOutputs,
        }) as WorkflowFailedData,
      };
    }

    case 'workflow.error':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          error: state.error ?? extra.error ?? 'Unknown error',
        }) as WorkflowErrorData,
      };

    // Thinking orchestrator events
    case 'workflow.orchestrator_thinking':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          thinking: state.orchestratorDecision?.reasoning ?? extra.thinking ?? '',
          action: state.orchestratorDecision?.action ?? extra.action ?? 'dispatch',
          targets: state.orchestratorDecision?.targets?.map(t => t.agentId) ?? extra.targets,
          step: state.thinkingHistory?.length ?? extra.step ?? 1,
        }) as OrchestratorThinkingData,
      };

    // Parallel execution events
    case 'workflow.parallel_started':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agents: state.pendingAgents?.map(a => a.agentId) ?? extra.agents ?? [],
          agentCount: state.pendingAgents?.length ?? extra.agentCount ?? 0,
          isStyleCompetition: state.pendingAgents?.some(a => a.stylePackageId) ?? extra.isStyleCompetition,
        }) as ParallelStartedData,
      };

    case 'workflow.parallel_agent_completed':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: extra.agentId ?? '',
          executionId: extra.executionId ?? '',
          success: extra.success ?? false,
          artifactCount: extra.artifactCount ?? 0,
          stylePackageId: extra.stylePackageId,
          error: extra.error,
          remainingAgents: extra.remainingAgents ?? 0,
        }) as ParallelAgentCompletedData,
      };

    case 'workflow.parallel_completed':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          totalAgents: state.parallelResults?.length ?? extra.totalAgents ?? 0,
          successfulAgents: state.parallelResults?.filter(r => r.success).length ?? extra.successfulAgents ?? 0,
          failedAgents: state.parallelResults?.filter(r => !r.success).length ?? extra.failedAgents ?? 0,
          isStyleCompetition: state.parallelResults?.some(r => r.stylePackageId) ?? extra.isStyleCompetition,
        }) as ParallelCompletedData,
      };

    // Style competition events
    case 'workflow.style_competition':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          styleCount: state.stylePackages?.length ?? extra.styleCount ?? 0,
          styleNames: state.stylePackages?.map(s => (s as { name: string }).name) ?? extra.styleNames ?? [],
          previewPaths: state.megaPagePreviews?.map(p => p.previewPath) ?? extra.previewPaths,
        }) as StyleCompetitionData,
      };

    case 'workflow.style_selected':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          selectedStyleId: state.selectedStyleId ?? extra.selectedStyleId ?? '',
          selectedStyleName: state.stylePackages?.find(
            s => (s as { id: string }).id === (state.selectedStyleId ?? extra.selectedStyleId)
          )?.name as string ?? extra.selectedStyleName ?? '',
          feedback: extra.feedback,
        }) as StyleSelectedData,
      };

    case 'workflow.style_rejected':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          rejectionCount: state.rejectedStyles?.length ?? extra.rejectionCount ?? 0,
          maxRejections: 5, // Default max rejections
          feedback: extra.feedback,
          rejectedStyleIds: state.rejectedStyles?.map(r => r.styleId) ?? extra.rejectedStyleIds ?? [],
        }) as StyleRejectedData,
      };

    // Incremental agent activity events
    case 'workflow.agent_context_loaded':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: state.currentAgent ?? extra.agentId ?? '',
          contextItemCount: extra.contextItemCount ?? 0,
          contextTypes: extra.contextTypes ?? [],
          contextTokens: extra.contextTokens,
        }) as AgentContextLoadedData,
      };

    case 'workflow.agent_thinking':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: state.currentAgent ?? extra.agentId ?? '',
          thinking: extra.thinking ?? '',
          isPartial: extra.isPartial,
          step: extra.step,
        }) as AgentThinkingData,
      };

    case 'workflow.agent_tool_started':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: state.currentAgent ?? extra.agentId ?? '',
          toolName: extra.toolName ?? '',
          toolId: extra.toolId ?? '',
          toolInput: extra.toolInput,
        }) as AgentToolStartedData,
      };

    case 'workflow.agent_tool_completed':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: state.currentAgent ?? extra.agentId ?? '',
          toolName: extra.toolName ?? '',
          toolId: extra.toolId ?? '',
          success: extra.success ?? true,
          toolOutput: extra.toolOutput,
          error: extra.error,
          duration: extra.duration,
        }) as AgentToolCompletedData,
      };

    case 'workflow.agent_response':
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          agentId: state.currentAgent ?? extra.agentId ?? '',
          response: extra.response ?? '',
          isPartial: extra.isPartial,
          chunk: extra.chunk,
        }) as AgentResponseData,
      };

    default:
      return {
        type,
        timestamp,
        data: withExtra({
          taskId: state.taskId ?? extra.taskId ?? '',
          error: 'Unknown event type',
        }) as WorkflowErrorData,
      };
  }
}

/**
 * Event handler type for stream events
 */
export type StreamEventHandler = (event: StreamEvent) => void | Promise<void>;

/**
 * Create a streaming callback for workflow execution
 *
 * @param handler - Event handler function
 * @returns Callback configuration for LangGraph
 */
export function createStreamingCallback(handler: StreamEventHandler) {
  return {
    onNodeStart: async (state: OrchestratorStateType) => {
      if (state.status === 'analyzing') {
        await handler(createStreamEvent('workflow.analyzing', state));
      } else if (state.status === 'agent_working' && state.currentAgent) {
        await handler(createStreamEvent('workflow.agent_started', state));
      }
    },
    onNodeEnd: async (state: OrchestratorStateType) => {
      if (state.status === 'orchestrating') {
        await handler(createStreamEvent('workflow.routing', state));
      } else if (state.agentOutputs?.length) {
        await handler(createStreamEvent('workflow.agent_completed', state));
      }
    },
  };
}
