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
  | 'workflow.error';

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
  | WorkflowErrorData;

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
