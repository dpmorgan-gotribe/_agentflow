/**
 * AgentCard Component
 *
 * Detailed card showing a sub-agent's activity including:
 * - Agent type and instance ID
 * - Status with visual indicator
 * - Expandable sections for thinking, tools, hooks, response
 * - Token usage metrics
 */

import { useState, useEffect, useRef } from 'react';
import type { ActiveAgent, AgentType, ToolUsage, HookExecution, SubAgentActivity } from '../types';

/** Agent display names and icons */
const AGENT_INFO: Record<AgentType, { name: string; icon: string }> = {
  system: { name: 'System', icon: '⚙️' },
  orchestrator: { name: 'Orchestrator', icon: '🎯' },
  project_manager: { name: 'Project Manager', icon: '📋' },
  architect: { name: 'Architect', icon: '🏗️' },
  analyst: { name: 'Analyst', icon: '🔍' },
  analyzer: { name: 'Analyzer', icon: '🔍' },
  project_analyzer: { name: 'Project Analyzer', icon: '📊' },
  compliance: { name: 'Compliance', icon: '🔒' },
  compliance_agent: { name: 'Compliance', icon: '🔒' },
  ui_designer: { name: 'UI Designer', icon: '🎨' },
  frontend_developer: { name: 'Frontend Dev', icon: '⚛️' },
  backend_developer: { name: 'Backend Dev', icon: '🔧' },
  tester: { name: 'Tester', icon: '🧪' },
  bug_fixer: { name: 'Bug Fixer', icon: '🐛' },
  reviewer: { name: 'Reviewer', icon: '👀' },
  git_agent: { name: 'Git Agent', icon: '📚' },
};

interface AgentCardProps {
  agent: ActiveAgent;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/** Format duration in ms to human-readable string */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/** Tool usage display */
function ToolItem({ tool }: { tool: ToolUsage }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-l-2 border-accent-primary/50 pl-2 py-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full text-left hover:bg-bg-tertiary/50 rounded px-1"
      >
        <span className="text-2xs font-mono text-accent-primary">{tool.name}</span>
        {tool.duration !== undefined && (
          <span className="text-2xs text-text-muted">{formatDuration(tool.duration)}</span>
        )}
        <span className="text-2xs text-text-muted ml-auto">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-1 space-y-1">
          {tool.input && (
            <div className="bg-bg-tertiary rounded p-1.5">
              <div className="text-2xs text-text-muted mb-0.5">Input:</div>
              <pre className="text-2xs text-text-secondary whitespace-pre-wrap break-words max-h-20 overflow-auto">
                {tool.input.slice(0, 500)}{tool.input.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
          {tool.output && (
            <div className="bg-bg-tertiary rounded p-1.5">
              <div className="text-2xs text-text-muted mb-0.5">Output:</div>
              <pre className="text-2xs text-text-secondary whitespace-pre-wrap break-words max-h-20 overflow-auto">
                {tool.output.slice(0, 500)}{tool.output.length > 500 ? '...' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Hook execution display */
function HookItem({ hook }: { hook: HookExecution }) {
  const statusColors = {
    success: 'bg-status-success/20 text-status-success',
    failed: 'bg-status-error/20 text-status-error',
    skipped: 'bg-bg-tertiary text-text-muted',
  };

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`text-2xs px-1.5 py-0.5 rounded ${statusColors[hook.status]}`}>
        {hook.type}
      </span>
      <span className="text-2xs font-mono text-text-secondary">{hook.name}</span>
      {hook.message && (
        <span className="text-2xs text-text-muted truncate flex-1">
          {hook.message}
        </span>
      )}
    </div>
  );
}

/** Context display */
function ContextSection({ activity }: { activity: SubAgentActivity }) {
  const contextTypes = activity.contextTypes || [];
  const itemCount = activity.contextItemCount || 0;
  const tokens = activity.contextTokens;

  if (itemCount === 0 && contextTypes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-text-muted">Items loaded:</span>
        <span className="text-2xs font-mono text-text-secondary">{itemCount}</span>
      </div>
      {contextTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contextTypes.map((type) => (
            <span
              key={type}
              className="text-2xs px-1.5 py-0.5 rounded bg-accent-primary/20 text-accent-primary"
            >
              {type}
            </span>
          ))}
        </div>
      )}
      {tokens !== undefined && tokens > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-2xs text-text-muted">Total tokens:</span>
          <span className="text-2xs font-mono text-text-secondary">{tokens.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

/** Streaming indicator */
function StreamingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-accent-primary">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-primary"></span>
      </span>
      streaming
    </span>
  );
}

/** Collapsible section */
function Section({
  title,
  icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border-primary/50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-bg-tertiary/50 transition-colors"
      >
        <span className="text-xs">{icon}</span>
        <span className="text-2xs font-medium text-text-secondary flex-1 text-left">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-2xs bg-bg-tertiary px-1.5 py-0.5 rounded text-text-muted">
            {count}
          </span>
        )}
        <span className="text-2xs text-text-muted">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && (
        <div className="px-2 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function AgentCard({ agent, isExpanded, onToggleExpand }: AgentCardProps) {
  const info = AGENT_INFO[agent.type] || { name: agent.type, icon: '🤖' };
  const activity = agent.activity;

  // Check if there's any activity content to show
  const hasActivity = activity && (
    activity.thinking ||
    (activity.tools && activity.tools.length > 0) ||
    (activity.hooks && activity.hooks.length > 0) ||
    activity.response ||
    (activity.contextItemCount && activity.contextItemCount > 0)
  );

  // Check if activity is still streaming
  const isStreaming = activity?.isStreaming ?? false;

  // Instance identifier for parallel agents
  const instanceId = agent.executionId ? agent.executionId.slice(0, 6) : null;

  // Auto-scroll ref for streaming content
  const thinkingRef = useRef<HTMLDivElement>(null);

  // Auto-scroll thinking section when streaming
  useEffect(() => {
    if (isStreaming && thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [activity?.thinking, isStreaming]);

  return (
    <div
      className={`rounded-lg border transition-all ${
        agent.status === 'working'
          ? 'bg-status-warning/10 border-status-warning/30 shadow-sm'
          : agent.status === 'completed'
            ? 'bg-status-success/10 border-status-success/30'
            : agent.status === 'failed'
              ? 'bg-status-error/10 border-status-error/30'
              : 'bg-bg-card border-border-primary'
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 p-2.5 ${hasActivity ? 'cursor-pointer hover:bg-white/5' : ''}`}
        onClick={hasActivity ? onToggleExpand : undefined}
      >
        <span className="text-base">{info.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-text-primary truncate">
              {info.name}
            </span>
            {instanceId && (
              <span className="text-2xs font-mono bg-bg-tertiary px-1 py-0.5 rounded text-text-muted">
                #{instanceId}
              </span>
            )}
          </div>
          {agent.message && (
            <div className="text-2xs text-text-muted mt-0.5 line-clamp-1">
              {agent.message}
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {agent.artifactCount !== undefined && agent.artifactCount > 0 && (
            <span className="text-2xs text-text-secondary flex items-center gap-0.5">
              📦 {agent.artifactCount}
            </span>
          )}
          {/* Streaming indicator */}
          {isStreaming && <StreamingIndicator />}
          {agent.status === 'working' && !isStreaming && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-warning"></span>
            </span>
          )}
          {agent.status === 'completed' && (
            <span className="text-status-success text-sm font-bold">✓</span>
          )}
          {agent.status === 'failed' && (
            <span className="text-status-error text-sm font-bold">✗</span>
          )}
          {hasActivity && (
            <span className="text-2xs text-text-muted">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Activity Details */}
      {isExpanded && hasActivity && activity && (
        <div className="border-t border-border-primary/50">
          {/* Context */}
          {(activity.contextItemCount && activity.contextItemCount > 0) && (
            <Section title="Context" icon="📋" count={activity.contextItemCount}>
              <ContextSection activity={activity} />
            </Section>
          )}

          {/* Thinking */}
          {activity.thinking && (
            <Section title="Thinking" icon="🧠" defaultOpen>
              <div
                ref={thinkingRef}
                className={`bg-bg-tertiary rounded p-2 text-2xs text-text-secondary whitespace-pre-wrap max-h-32 overflow-auto ${
                  isStreaming ? 'border-l-2 border-accent-primary' : ''
                }`}
              >
                {activity.thinking}
                {isStreaming && activity.thinking && (
                  <span className="inline-block w-1 h-3 ml-0.5 bg-accent-primary animate-pulse" />
                )}
              </div>
            </Section>
          )}

          {/* Tools */}
          {activity.tools && activity.tools.length > 0 && (
            <Section title="Tools" icon="🔧" count={activity.tools.length}>
              <div className="space-y-1">
                {activity.tools.map((tool, i) => (
                  <ToolItem key={`${tool.name}-${i}`} tool={tool} />
                ))}
              </div>
            </Section>
          )}

          {/* Hooks */}
          {activity.hooks && activity.hooks.length > 0 && (
            <Section title="Hooks" icon="🪝" count={activity.hooks.length}>
              <div className="space-y-0.5">
                {activity.hooks.map((hook, i) => (
                  <HookItem key={`${hook.name}-${i}`} hook={hook} />
                ))}
              </div>
            </Section>
          )}

          {/* Response */}
          {activity.response && (
            <Section title="Response" icon="💬">
              <div
                className={`bg-bg-tertiary rounded p-2 text-2xs text-text-secondary whitespace-pre-wrap max-h-40 overflow-auto ${
                  isStreaming ? 'border-l-2 border-accent-primary' : ''
                }`}
              >
                {activity.response.slice(0, 1000)}
                {activity.response.length > 1000 && '...'}
                {isStreaming && activity.response && (
                  <span className="inline-block w-1 h-3 ml-0.5 bg-accent-primary animate-pulse" />
                )}
              </div>
            </Section>
          )}

          {/* Token Usage */}
          {activity.tokenUsage && (
            <div className="flex items-center justify-between px-2 py-1.5 border-t border-border-primary/50 bg-bg-tertiary/30">
              <span className="text-2xs text-text-muted">Token Usage</span>
              <div className="flex items-center gap-3 text-2xs">
                <span className="text-text-secondary">
                  ↓ {activity.tokenUsage.input.toLocaleString()}
                </span>
                <span className="text-text-secondary">
                  ↑ {activity.tokenUsage.output.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
