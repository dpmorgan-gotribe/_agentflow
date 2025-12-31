import { useEffect, useRef } from 'react';
import { AgentMessage } from './AgentMessage';
import { useTaskStream } from '../hooks';
import type { AgentEvent } from '../types';

interface AgentFeedProps {
  taskId: string | undefined;
  events: AgentEvent[];
  onEvent: (event: AgentEvent) => void;
}

export function AgentFeed({ taskId, events, onEvent }: AgentFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Connect to SSE stream
  useTaskStream(taskId, onEvent);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  if (events.length === 0) {
    return (
      <div className="text-text-muted text-center py-8">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm">Connecting to orchestrator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <AgentMessage key={index} event={event} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
