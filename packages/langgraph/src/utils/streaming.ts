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

export interface WorkflowStartedData {
  taskId: string;
  prompt: string;
}

export interface WorkflowAnalyzingData {
  taskId: string;
}

export interface WorkflowRoutingData {
  taskId: string;
  agentQueue: string[];
}

export interface AgentStartedData {
  taskId: string;
  agentId: string;
}

export interface AgentCompletedData {
  taskId: string;
  agentId: string;
  success: boolean;
  artifactCount: number;
}

export interface ApprovalNeededData {
  taskId: string;
  approvalType: string;
  description: string;
  artifactCount: number;
}

export interface WorkflowCompletedData {
  taskId: string;
  completedAgents: string[];
  totalArtifacts: number;
}

export interface WorkflowFailedData {
  taskId: string;
  error: string;
  lastAgent?: string;
}

export interface WorkflowErrorData {
  taskId: string;
  error: string;
}

/**
 * Create a stream event from workflow state
 */
export function createStreamEvent(
  type: StreamEventType,
  state: Partial<OrchestratorStateType>
): StreamEvent {
  const timestamp = new Date().toISOString();

  switch (type) {
    case 'workflow.started':
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          prompt: state.prompt ?? '',
        } as WorkflowStartedData,
      };

    case 'workflow.analyzing':
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
        } as WorkflowAnalyzingData,
      };

    case 'workflow.routing':
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          agentQueue: state.agentQueue ?? [],
        } as WorkflowRoutingData,
      };

    case 'workflow.agent_started':
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          agentId: state.currentAgent ?? '',
        } as AgentStartedData,
      };

    case 'workflow.agent_completed': {
      const lastOutput = state.agentOutputs?.[state.agentOutputs.length - 1];
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          agentId: lastOutput?.agentId ?? '',
          success: lastOutput?.success ?? false,
          artifactCount: lastOutput?.artifacts?.length ?? 0,
        } as AgentCompletedData,
      };
    }

    case 'workflow.approval_needed':
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          approvalType: state.approvalRequest?.type ?? 'final',
          description: state.approvalRequest?.description ?? '',
          artifactCount: state.approvalRequest?.artifacts?.length ?? 0,
        } as ApprovalNeededData,
      };

    case 'workflow.completed': {
      const totalArtifacts =
        state.agentOutputs?.reduce(
          (sum, output) => sum + (output.artifacts?.length ?? 0),
          0
        ) ?? 0;
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          completedAgents: state.completedAgents ?? [],
          totalArtifacts,
        } as WorkflowCompletedData,
      };
    }

    case 'workflow.failed': {
      const lastAgent =
        state.agentOutputs?.[state.agentOutputs.length - 1]?.agentId;
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          error: state.error ?? 'Unknown error',
          lastAgent,
        } as WorkflowFailedData,
      };
    }

    case 'workflow.error':
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          error: state.error ?? 'Unknown error',
        } as WorkflowErrorData,
      };

    default:
      return {
        type,
        timestamp,
        data: {
          taskId: state.taskId ?? '',
          error: 'Unknown event type',
        } as WorkflowErrorData,
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
