import { useEffect, useRef, useCallback } from 'react';
import type { AgentEvent, AgentType, TaskStatus, SelfReviewSummary, ArtifactType, ArtifactRef, ApprovalRequest } from '../types';
import { getTaskStreamUrl } from '../api';

interface StreamData {
  status: TaskStatus;
  currentAgent?: AgentType;
  analysis?: {
    taskType: string;
    complexity: string;
  };
  agentOutputs?: Array<{
    success: boolean;
    error?: string;
    artifacts?: Array<{ id: string; type: string; path: string }>;
    selfReviewResult?: {
      iteration: number;
      qualityScore: number;
      completenessScore: number;
      decision: 'approved' | 'needs_work' | 'escalate';
      gaps?: unknown[];
      criticalGapCount?: number;
    };
  }>;
  approvalRequest?: {
    type: 'design' | 'architecture' | 'implementation' | 'final';
    description: string;
    artifacts: Array<{ id: string; type: string; name: string }>;
  };
  error?: string;
}

/**
 * Format SSE event data into user-friendly message
 */
function formatEventMessage(data: StreamData): string {
  const { status, currentAgent, analysis, agentOutputs, error } = data;

  if (status === 'analyzing' && analysis) {
    return `Analyzing task...\nType: ${analysis.taskType}\nComplexity: ${analysis.complexity}`;
  }

  if (status === 'orchestrating') {
    return 'Determining next agent...';
  }

  if (status === 'agent_working' && currentAgent) {
    return 'Working on task...';
  }

  if (status === 'awaiting_approval') {
    return 'Awaiting your approval to continue.';
  }

  if (status === 'completed') {
    return 'Task completed successfully!';
  }

  if (status === 'failed') {
    return `Task failed: ${error || 'Unknown error'}`;
  }

  // Get last agent output
  const lastOutput = agentOutputs?.[agentOutputs.length - 1];
  if (lastOutput) {
    if (lastOutput.success) {
      const artifactCount = lastOutput.artifacts?.length || 0;
      return `Completed successfully.${artifactCount > 0 ? `\nCreated ${artifactCount} artifact(s).` : ''}`;
    } else {
      return `Failed: ${lastOutput.error}`;
    }
  }

  return status;
}

/**
 * Extract self-review summary from stream data
 */
function extractSelfReview(data: StreamData): SelfReviewSummary | undefined {
  const lastOutput = data.agentOutputs?.[data.agentOutputs.length - 1];
  if (!lastOutput?.selfReviewResult) return undefined;

  const { selfReviewResult } = lastOutput;
  return {
    iteration: selfReviewResult.iteration,
    maxIterations: 3, // Default from config
    qualityScore: selfReviewResult.qualityScore,
    completenessScore: selfReviewResult.completenessScore,
    decision: selfReviewResult.decision,
    gapsCount: selfReviewResult.gaps?.length || 0,
    criticalGapsCount: selfReviewResult.criticalGapCount || 0,
  };
}

/**
 * Hook for connecting to task SSE stream
 */
export function useTaskStream(
  taskId: string | undefined,
  onEvent: (event: AgentEvent) => void
): void {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep callback ref updated
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: StreamData = JSON.parse(event.data);
      const lastOutput = data.agentOutputs?.[data.agentOutputs.length - 1];

      // Map artifacts with proper type casting
      const artifacts: ArtifactRef[] | undefined = lastOutput?.artifacts?.map((a) => ({
        id: a.id,
        type: a.type as ArtifactType,
        name: a.path.split('/').pop() || a.id,
      }));

      // Map approval request with proper type casting
      const approvalRequest: ApprovalRequest | undefined = data.approvalRequest
        ? {
            type: data.approvalRequest.type,
            description: data.approvalRequest.description,
            artifacts: data.approvalRequest.artifacts.map((a) => ({
              id: a.id,
              type: a.type as ArtifactType,
              name: a.name,
            })),
          }
        : undefined;

      const agentEvent: AgentEvent = {
        agent: data.currentAgent || 'orchestrator',
        status: data.status,
        message: formatEventMessage(data),
        timestamp: new Date().toISOString(),
        artifacts,
        approvalRequest,
        selfReview: extractSelfReview(data),
      };

      onEventRef.current(agentEvent);
    } catch (error) {
      console.error('Failed to parse SSE event:', error);
    }
  }, []);

  useEffect(() => {
    if (!taskId) return;

    // Close existing connection
    eventSourceRef.current?.close();

    // Open new SSE connection
    const eventSource = new EventSource(getTaskStreamUrl(taskId));
    eventSourceRef.current = eventSource;

    eventSource.onmessage = handleMessage;

    eventSource.onerror = () => {
      console.error('SSE connection error, will retry...');
    };

    return () => {
      eventSource.close();
    };
  }, [taskId, handleMessage]);
}
