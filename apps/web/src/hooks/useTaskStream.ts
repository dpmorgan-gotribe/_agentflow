import { useEffect, useRef, useCallback } from 'react';
import type { AgentEvent, AgentType, TaskStatus, SelfReviewSummary, ArtifactType, ArtifactRef, ApprovalRequest, SubAgentActivity, ToolUsage, HookExecution } from '../types';
import { getTaskStreamUrl } from '../api';

interface StreamData {
  // API sends 'type' field like 'workflow.analyzing', 'workflow.routing', etc.
  type?: string;
  // Fallback for direct status updates
  status?: TaskStatus;
  // Message with detailed reasoning from the workflow
  message?: string;
  // Current agent being routed to
  currentAgent?: AgentType;
  // Agent that completed (for agent_completed events)
  agent?: string;
  agentId?: string;
  // Task analysis results
  analysis?: {
    taskType: string;
    complexity: string;
    requiresUI?: boolean;
    requiresBackend?: boolean;
    requiresArchitecture?: boolean;
    suggestedAgents?: string[];
  };
  // Queue of agents to execute
  agentQueue?: string[];
  // Completed agents list
  completedAgents?: string[];
  // Agent outputs from workflow
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
  taskId?: string;
  timestamp?: string;
  // Artifact info for artifact_created events
  artifact?: {
    id: string;
    type: string;
    name: string;
  };
  // Success flag for agent completion
  success?: boolean;
  artifactCount?: number;
  // Sub-agent activity details
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

/**
 * Map API event type to frontend TaskStatus
 */
function mapTypeToStatus(type: string | undefined, status: TaskStatus | undefined): TaskStatus {
  // If direct status is provided, use it
  if (status) return status;

  // Map workflow event types to frontend status
  switch (type) {
    case 'workflow_started':
    case 'workflow.started':
      return 'pending';
    case 'workflow.analyzing':
      return 'analyzing';
    case 'workflow.routing':
      return 'orchestrating';
    case 'workflow.agent_started':
    case 'workflow.agent_completed':
      return 'agent_working';
    case 'workflow.approval_needed':
    case 'approval_required':
      return 'awaiting_approval';
    case 'workflow_completed':
    case 'workflow.completed':
      return 'completed';
    case 'workflow_failed':
    case 'workflow.failed':
    case 'workflow.error':
      return 'failed';
    case 'artifact_created':
      return 'agent_working';
    default:
      return 'pending';
  }
}

/**
 * Extract agent name from event data
 */
function extractAgentName(data: StreamData): AgentType {
  // Try various fields that might contain the agent name
  const agent = data.currentAgent || data.agent || data.agentId;
  if (agent) {
    // Validate it's a known agent type
    const knownAgents: AgentType[] = [
      'orchestrator', 'project_manager', 'architect', 'analyst',
      'project_analyzer', 'compliance', 'ui_designer', 'frontend_developer',
      'backend_developer', 'tester', 'bug_fixer', 'reviewer', 'git_agent'
    ];
    if (knownAgents.includes(agent as AgentType)) {
      return agent as AgentType;
    }
  }
  return 'orchestrator';
}

/**
 * Format SSE event data into user-friendly message
 */
function formatEventMessage(data: StreamData): string {
  // FIRST: If the API sends a message field with reasoning, use it
  if (data.message) {
    return data.message;
  }

  // Otherwise, construct a message based on the event type/status
  const eventType = data.type;
  const { analysis, agentOutputs, error, agentQueue, completedAgents } = data;

  switch (eventType) {
    case 'workflow_started':
    case 'workflow.started':
      return 'Starting workflow execution...';

    case 'workflow.analyzing':
      if (analysis) {
        return `Task Analysis Complete:\n• Type: ${analysis.taskType}\n• Complexity: ${analysis.complexity}`;
      }
      return 'Analyzing task requirements...';

    case 'workflow.routing':
      if (agentQueue && agentQueue.length > 0) {
        return `Routing to agents: ${agentQueue.join(' → ')}`;
      }
      return 'Determining next agent...';

    case 'workflow.agent_started':
      return `Starting agent: ${data.agentId || data.agent || 'unknown'}`;

    case 'workflow.agent_completed':
      const success = data.success !== false;
      const artifactCount = data.artifactCount || 0;
      const agentName = data.agentId || data.agent || 'Agent';
      return `${agentName} ${success ? 'completed successfully' : 'failed'}${artifactCount > 0 ? `\nCreated ${artifactCount} artifact(s)` : ''}`;

    case 'workflow.approval_needed':
    case 'approval_required':
      return 'Awaiting your approval to continue.';

    case 'workflow_completed':
    case 'workflow.completed':
      if (completedAgents && completedAgents.length > 0) {
        return `Workflow completed!\nAgents: ${completedAgents.join(', ')}`;
      }
      return 'Workflow completed successfully!';

    case 'workflow_failed':
    case 'workflow.failed':
    case 'workflow.error':
      return `Workflow failed: ${error || 'Unknown error'}`;

    case 'artifact_created':
      if (data.artifact) {
        return `Artifact created: ${data.artifact.name} (${data.artifact.type})`;
      }
      return 'Artifact created';

    default:
      // Fallback to checking agentOutputs
      const lastOutput = agentOutputs?.[agentOutputs.length - 1];
      if (lastOutput) {
        if (lastOutput.success) {
          const artCount = lastOutput.artifacts?.length || 0;
          return `Completed successfully.${artCount > 0 ? `\nCreated ${artCount} artifact(s).` : ''}`;
        } else {
          return `Failed: ${lastOutput.error}`;
        }
      }
      return eventType || data.status || 'Processing...';
  }
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

      // Also include artifact from artifact_created events
      if (data.artifact && !artifacts?.some(a => a.id === data.artifact?.id)) {
        const artifactRefs = artifacts || [];
        artifactRefs.push({
          id: data.artifact.id,
          type: data.artifact.type as ArtifactType,
          name: data.artifact.name,
        });
      }

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

      // Use API timestamp if provided, otherwise use current time
      const timestamp = data.timestamp || new Date().toISOString();

      // Extract activity data
      const activity: SubAgentActivity | undefined = data.activity
        ? {
            thinking: data.activity.thinking,
            tools: data.activity.tools as ToolUsage[] | undefined,
            hooks: data.activity.hooks as HookExecution[] | undefined,
            response: data.activity.response,
            tokenUsage: data.activity.tokenUsage,
          }
        : undefined;

      const agentEvent: AgentEvent = {
        agent: extractAgentName(data),
        status: mapTypeToStatus(data.type, data.status),
        message: formatEventMessage(data),
        timestamp,
        artifacts,
        approvalRequest,
        selfReview: extractSelfReview(data),
        activity,
      };

      console.log('SSE Event received:', { type: data.type, message: agentEvent.message, agent: agentEvent.agent });
      onEventRef.current(agentEvent);
    } catch (error) {
      console.error('Failed to parse SSE event:', error, event.data);
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
