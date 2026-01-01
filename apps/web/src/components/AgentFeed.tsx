import { useEffect, useRef, useMemo } from 'react';
import { AgentMessage } from './AgentMessage';
import { useTaskStream } from '../hooks';
import type { ExtendedAgentEvent, ParallelAgent } from '../types';

interface AgentFeedProps {
  taskId: string | undefined;
  events: ExtendedAgentEvent[];
  onEvent: (event: ExtendedAgentEvent) => void;
}

/**
 * Parallel execution progress indicator
 */
function ParallelProgress({
  agents,
  isStyleCompetition,
}: {
  agents: ParallelAgent[];
  isStyleCompetition: boolean;
}) {
  const total = agents.length;
  const completed = agents.filter(a => a.status === 'completed').length;

  if (total === 0) return null;

  return (
    <div className="bg-bg-tertiary rounded-lg p-3 border border-border-primary">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{isStyleCompetition ? '🎨' : '⚡'}</span>
        <span className="text-xs font-medium text-text-primary">
          {isStyleCompetition ? 'Style Competition' : 'Parallel Execution'}
        </span>
        <span className="text-xs text-text-muted ml-auto">
          {completed}/{total} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-bg-card rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-accent-primary transition-all duration-300"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      {/* Agent list */}
      <div className="flex flex-wrap gap-1">
        {agents.map((agent, i) => (
          <span
            key={i}
            className={`text-2xs px-2 py-0.5 rounded-full ${
              agent.status === 'completed'
                ? 'bg-status-success/20 text-status-success'
                : agent.status === 'running'
                ? 'bg-accent-primary/20 text-accent-primary animate-pulse'
                : agent.status === 'failed'
                ? 'bg-status-error/20 text-status-error'
                : 'bg-text-muted/20 text-text-muted'
            }`}
          >
            {agent.stylePackageId ? `Style ${i + 1}` : agent.agentId}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgentFeed({ taskId, events, onEvent }: AgentFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Connect to SSE stream
  useTaskStream(taskId, onEvent);

  // Filter to only sub-agent events (exclude orchestrator and system)
  const subAgentEvents = useMemo(() =>
    events.filter(e => e.agent !== 'orchestrator' && e.agent !== 'system'),
    [events]
  );

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [subAgentEvents]);

  // Extract current parallel execution state from events
  const parallelState = useMemo(() => {
    const agents: ParallelAgent[] = [];
    let isStyleCompetition = false;
    let isActive = false;

    for (const event of events) {
      if (event.parallelExecution?.type === 'started') {
        isActive = true;
        isStyleCompetition = event.parallelExecution.isStyleCompetition ?? false;
        // Initialize agents from the started event
        event.parallelExecution.agents?.forEach(agentId => {
          agents.push({
            agentId,
            status: 'running',
          });
        });
      } else if (event.parallelExecution?.type === 'agent_completed') {
        // Update agent status
        const idx = agents.findIndex(a => a.agentId === event.parallelExecution?.agentId);
        if (idx >= 0) {
          agents[idx].status = event.parallelExecution.success ? 'completed' : 'failed';
          agents[idx].error = event.parallelExecution.success ? undefined : 'Failed';
        }
      } else if (event.parallelExecution?.type === 'completed') {
        isActive = false;
      }
    }

    return { agents, isStyleCompetition, isActive };
  }, [events]);

  if (!taskId) {
    return (
      <div className="text-text-muted text-center py-8">
        <div className="text-3xl mb-3">🤖</div>
        <p className="text-sm">Enter a prompt below to start</p>
        <p className="text-xs mt-2">The orchestrator will coordinate agents to build your app</p>
      </div>
    );
  }

  if (subAgentEvents.length === 0) {
    return (
      <div className="text-text-muted text-center py-8">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Waiting for agent activity...</p>
          <p className="text-xs mt-2">Orchestrator is processing your request</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Show parallel progress if active */}
      {parallelState.isActive && parallelState.agents.length > 0 && (
        <ParallelProgress
          agents={parallelState.agents}
          isStyleCompetition={parallelState.isStyleCompetition}
        />
      )}

      {/* Sub-agent event messages only (orchestrator activity is in right sidebar) */}
      {subAgentEvents.map((event, index) => (
        <AgentMessage key={index} event={event} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
