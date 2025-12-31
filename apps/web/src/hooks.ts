import { useState, useEffect, useRef, useCallback } from 'react';
import { getTaskStreamUrl, getArtifacts } from './api';
import type { AgentEvent, Artifact } from './types';

/**
 * Hook to subscribe to task SSE stream
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

  useEffect(() => {
    if (!taskId) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = getTaskStreamUrl(taskId);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Transform API event to AgentEvent format
        const agentEvent: AgentEvent = {
          agent: data.agent || data.currentAgent || 'orchestrator',
          status: mapEventTypeToStatus(data.type),
          message: data.message || formatEventMessage(data),
          timestamp: data.timestamp || new Date().toISOString(),
          artifacts: data.artifacts,
          approvalRequest: data.request,
        };

        onEventRef.current(agentEvent);
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);

      // If the connection failed immediately (readyState 0 = CONNECTING or 2 = CLOSED),
      // the task may not exist on the server (e.g., after server restart)
      if (eventSource.readyState === EventSource.CLOSED) {
        // Emit a synthetic error event to inform the UI
        onEventRef.current({
          agent: 'system',
          status: 'failed',
          message: 'Connection lost. Task may no longer exist on server. Try creating a new task.',
          timestamp: new Date().toISOString(),
        });
        eventSource.close();
      }
      // Otherwise EventSource will automatically reconnect
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [taskId]);
}

/**
 * Map API event type to task status
 */
function mapEventTypeToStatus(eventType: string): AgentEvent['status'] {
  switch (eventType) {
    case 'workflow_started':
      return 'analyzing';
    case 'agent_started':
      return 'agent_working';
    case 'agent_completed':
      return 'orchestrating';
    case 'approval_required':
      return 'awaiting_approval';
    case 'workflow_completed':
      return 'completed';
    case 'workflow_failed':
      return 'failed';
    default:
      return 'orchestrating';
  }
}

/**
 * Format event message from API data
 */
function formatEventMessage(data: Record<string, unknown>): string {
  const type = data.type as string;

  switch (type) {
    case 'workflow_started':
      return 'Workflow started, analyzing task...';
    case 'agent_started':
      return `Agent ${data.agent || 'unknown'} started working`;
    case 'agent_completed':
      return `Agent ${data.agent || 'unknown'} completed`;
    case 'approval_required':
      return 'Waiting for approval...';
    case 'workflow_completed':
      return 'Workflow completed successfully';
    case 'workflow_failed':
      return `Workflow failed: ${data.error || 'Unknown error'}`;
    default:
      return JSON.stringify(data);
  }
}

/**
 * Hook to fetch and manage artifacts for a task
 */
export function useArtifacts(taskId: string | undefined): {
  artifacts: Artifact[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchArtifacts = useCallback(async () => {
    if (!taskId) {
      setArtifacts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getArtifacts(taskId);
      setArtifacts(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch artifacts'));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Fetch on mount and when taskId changes
  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  // Poll for new artifacts while task is active
  useEffect(() => {
    if (!taskId) return;

    const interval = setInterval(fetchArtifacts, 5000);
    return () => clearInterval(interval);
  }, [taskId, fetchArtifacts]);

  return { artifacts, loading, error, refresh: fetchArtifacts };
}
