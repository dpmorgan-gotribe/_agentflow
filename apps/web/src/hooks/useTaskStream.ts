import { useEffect, useRef, useCallback } from 'react';
import type {
  AgentType,
  TaskStatus,
  SelfReviewSummary,
  ArtifactType,
  ArtifactRef,
  ApprovalRequest,
  SubAgentActivity,
  ToolUsage,
  HookExecution,
  ExtendedAgentEvent,
  ThinkingStep,
} from '../types';
import { getTaskStreamUrl } from '../api';

interface StreamData {
  // API sends 'type' field like 'workflow.analyzing', 'workflow.routing', etc.
  type?: string;
  // Fallback for direct status updates
  status?: TaskStatus;
  // Message with detailed reasoning from the workflow
  message?: string;
  reasoning?: string;
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

  // ============================================================================
  // Thinking Orchestrator Fields (Sprint 6)
  // ============================================================================

  // Orchestrator thinking
  thinking?: string;
  action?: 'dispatch' | 'parallel_dispatch' | 'approval' | 'complete' | 'fail';
  targets?: string[];
  step?: number;

  // Parallel execution
  agents?: string[];
  agentCount?: number;
  executionId?: string;
  stylePackageId?: string;
  remainingAgents?: number;
  totalAgents?: number;
  successfulAgents?: number;
  failedAgents?: number;
  isStyleCompetition?: boolean;

  // Style competition
  styleCount?: number;
  styleNames?: string[];
  previewPaths?: string[];
  selectedStyleId?: string;
  selectedStyleName?: string;
  feedback?: string;
  rejectionCount?: number;
  maxRejections?: number;
  rejectedStyleIds?: string[];
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
    case 'workflow.orchestrator_thinking':
      return 'orchestrating';
    case 'workflow.agent_started':
    case 'workflow.agent_completed':
    case 'workflow.parallel_started':
    case 'workflow.parallel_agent_completed':
    case 'workflow.parallel_completed':
      return 'agent_working';
    case 'workflow.approval_needed':
    case 'workflow.style_competition':
    case 'approval_required':
      return 'awaiting_approval';
    case 'workflow.style_selected':
      return 'orchestrating';
    case 'workflow.style_rejected':
      return 'orchestrating';
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
    // Normalize agent names (backend uses 'analyzer', frontend uses 'analyst')
    const normalizedAgent = agent === 'analyzer' ? 'analyst' : agent;

    // Validate it's a known agent type
    const knownAgents: AgentType[] = [
      'orchestrator', 'project_manager', 'architect', 'analyst', 'analyzer',
      'project_analyzer', 'compliance', 'compliance_agent', 'ui_designer',
      'frontend_developer', 'backend_developer', 'tester', 'bug_fixer',
      'reviewer', 'git_agent'
    ];
    if (knownAgents.includes(normalizedAgent as AgentType)) {
      return normalizedAgent as AgentType;
    }
    // Return raw agent name if not in known list (better than defaulting to orchestrator)
    return agent as AgentType;
  }
  return 'orchestrator';
}

/**
 * Format SSE event data into user-friendly message
 */
function formatEventMessage(data: StreamData): string {
  // FIRST: If the API sends a message or reasoning field, use it
  if (data.message) {
    return data.message;
  }
  if (data.reasoning) {
    return data.reasoning;
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

    case 'workflow.orchestrator_thinking':
      if (data.thinking) {
        const action = data.action || 'dispatch';
        const targets = data.targets?.join(', ') || '';
        return `🧠 Orchestrator thinking...\n${data.thinking}\n→ Action: ${action}${targets ? ` (${targets})` : ''}`;
      }
      return '🧠 Orchestrator is reasoning about next steps...';

    case 'workflow.agent_started':
      return `Starting agent: ${data.agentId || data.agent || 'unknown'}`;

    case 'workflow.agent_completed': {
      const success = data.success !== false;
      const artifactCount = data.artifactCount || 0;
      const agentName = data.agentId || data.agent || 'Agent';
      return `${agentName} ${success ? 'completed successfully' : 'failed'}${artifactCount > 0 ? `\nCreated ${artifactCount} artifact(s)` : ''}`;
    }

    // Parallel execution events
    case 'workflow.parallel_started': {
      const agents = data.agents || [];
      const isStyle = data.isStyleCompetition;
      return isStyle
        ? `🎨 Starting style competition with ${agents.length} designers...`
        : `⚡ Starting parallel execution: ${agents.join(', ')}`;
    }

    case 'workflow.parallel_agent_completed': {
      const remaining = data.remainingAgents ?? 0;
      const agentId = data.agentId || 'Agent';
      const success = data.success !== false;
      return `${success ? '✓' : '✗'} ${agentId} completed${remaining > 0 ? ` (${remaining} remaining)` : ''}`;
    }

    case 'workflow.parallel_completed': {
      const total = data.totalAgents ?? 0;
      const successful = data.successfulAgents ?? 0;
      const failed = data.failedAgents ?? 0;
      return `⚡ Parallel execution complete: ${successful}/${total} succeeded${failed > 0 ? `, ${failed} failed` : ''}`;
    }

    // Style competition events
    case 'workflow.style_competition': {
      const count = data.styleCount ?? 0;
      const names = data.styleNames?.join(', ') || '';
      return `🎨 Style competition ready!\n${count} styles to choose from${names ? `:\n${names}` : ''}`;
    }

    case 'workflow.style_selected':
      return `✓ Style selected: ${data.selectedStyleName || data.selectedStyleId || 'Unknown'}`;

    case 'workflow.style_rejected': {
      const rejectCount = data.rejectionCount ?? 0;
      const maxReject = data.maxRejections ?? 5;
      return `✗ Styles rejected (${rejectCount}/${maxReject})\nGenerating new style options...`;
    }

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

    default: {
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
 * Parse SSE data into ExtendedAgentEvent
 */
function parseStreamData(data: StreamData): ExtendedAgentEvent {
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

  // Extract thinking orchestrator data
  const thinking: ThinkingStep | undefined = data.type === 'workflow.orchestrator_thinking'
    ? {
        step: data.step ?? 1,
        thinking: data.thinking ?? '',
        action: data.action ?? 'dispatch',
        targets: data.targets,
        timestamp,
      }
    : undefined;

  // Extract parallel execution data (with executionId for unique instance tracking)
  const parallelExecution = data.type?.startsWith('workflow.parallel') || data.executionId
    ? {
        type: data.type === 'workflow.parallel_started' ? 'started' as const
          : data.type === 'workflow.parallel_agent_completed' ? 'agent_completed' as const
          : 'completed' as const,
        agents: data.agents,
        agentId: data.agentId,
        executionId: data.executionId,
        success: data.success,
        remainingAgents: data.remainingAgents,
        totalAgents: data.totalAgents,
        successfulAgents: data.successfulAgents,
        failedAgents: data.failedAgents,
        isStyleCompetition: data.isStyleCompetition,
      }
    : undefined;

  // Extract style competition data
  const styleCompetition = data.type?.startsWith('workflow.style')
    ? {
        type: data.type === 'workflow.style_competition' ? 'competition' as const
          : data.type === 'workflow.style_selected' ? 'selected' as const
          : 'rejected' as const,
        styleCount: data.styleCount,
        styleNames: data.styleNames,
        previewPaths: data.previewPaths,
        selectedStyleId: data.selectedStyleId,
        selectedStyleName: data.selectedStyleName,
        rejectionCount: data.rejectionCount,
        maxRejections: data.maxRejections,
        feedback: data.feedback,
      }
    : undefined;

  return {
    agent: extractAgentName(data),
    status: mapTypeToStatus(data.type, data.status),
    message: formatEventMessage(data),
    timestamp,
    artifacts,
    approvalRequest,
    selfReview: extractSelfReview(data),
    activity,
    thinking,
    parallelExecution,
    styleCompetition,
  };
}

/** Reconnection config */
const RECONNECT_INITIAL_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_MULTIPLIER = 2;

/**
 * Hook for connecting to task SSE stream
 * Supports:
 * - Extended events for thinking orchestrator, parallel execution, and style competition
 * - Automatic reconnection with exponential backoff
 * - Event replay on reconnection (from server's event history)
 */
export function useTaskStream(
  taskId: string | undefined,
  onEvent: (event: ExtendedAgentEvent) => void
): void {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_INITIAL_DELAY_MS);
  const lastEventTimestampRef = useRef<string | null>(null);
  const isManualCloseRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: StreamData = JSON.parse(event.data);
      const agentEvent = parseStreamData(data);

      // Track last event timestamp for deduplication on reconnect
      lastEventTimestampRef.current = agentEvent.timestamp;

      // Reset reconnect delay on successful message
      reconnectDelayRef.current = RECONNECT_INITIAL_DELAY_MS;

      console.log('SSE Event received:', { type: data.type, message: agentEvent.message, agent: agentEvent.agent });
      onEventRef.current(agentEvent);
    } catch (error) {
      console.error('Failed to parse SSE event:', error, event.data);
    }
  }, []);

  const connect = useCallback((taskIdToConnect: string) => {
    // Close existing connection
    eventSourceRef.current?.close();

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log(`SSE connecting to task: ${taskIdToConnect}`);
    const eventSource = new EventSource(getTaskStreamUrl(taskIdToConnect));
    eventSourceRef.current = eventSource;
    isManualCloseRef.current = false;

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      reconnectDelayRef.current = RECONNECT_INITIAL_DELAY_MS;
    };

    eventSource.onmessage = handleMessage;

    eventSource.onerror = () => {
      // Don't reconnect if this was a manual close
      if (isManualCloseRef.current) {
        console.log('SSE closed manually, not reconnecting');
        return;
      }

      const readyState = eventSource.readyState;

      // CLOSED (2): Connection was terminated
      if (readyState === EventSource.CLOSED) {
        console.log('SSE connection closed, attempting reconnect...');

        // Check if this was an immediate close (server doesn't recognize task)
        // In this case, emit an error event to inform the user
        onEventRef.current({
          agent: 'system',
          status: 'failed',
          message: 'Connection lost. The task may no longer exist on the server (e.g., after server restart). Please create a new task.',
          timestamp: new Date().toISOString(),
        });

        // Schedule reconnect with exponential backoff
        const delay = reconnectDelayRef.current;
        console.log(`Reconnecting in ${delay}ms...`);

        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect(taskIdToConnect);
        }, delay);

        // Increase delay for next attempt (capped at max)
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * RECONNECT_MULTIPLIER,
          RECONNECT_MAX_DELAY_MS
        );
      } else if (readyState === EventSource.CONNECTING) {
        // CONNECTING (0): Connection attempt in progress, browser will auto-retry
        // This is normal behavior during network instability - don't spam console
        console.log('SSE connection interrupted, browser will auto-reconnect...');
      } else {
        // OPEN (1): Unusual to get error while open, log for debugging
        console.warn('SSE error while connection open - unexpected state');
      }
    };

    return eventSource;
  }, [handleMessage]);

  useEffect(() => {
    if (!taskId) {
      // Close connection and clear reconnect timer
      isManualCloseRef.current = true;
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    // Reset state for new task
    lastEventTimestampRef.current = null;
    reconnectDelayRef.current = RECONNECT_INITIAL_DELAY_MS;

    connect(taskId);

    return () => {
      isManualCloseRef.current = true;
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [taskId, connect]);
}
