/**
 * Active Agents Panel
 *
 * Shows all active and recently completed sub-agents with detailed activity.
 * Supports multiple parallel instances of the same agent type.
 */

import { useState, useCallback } from 'react';
import type { ActiveAgent } from '../../types';
import { AgentCard } from '../AgentCard';

interface ActiveAgentsPanelProps {
  activeAgents: ActiveAgent[];
}

/** Generate unique key for an agent instance */
function getAgentKey(agent: ActiveAgent): string {
  // Use executionId for parallel instances, otherwise use type + timestamp
  if (agent.executionId) {
    return `${agent.type}-${agent.executionId}`;
  }
  // Fallback: use type with startedAt for uniqueness
  return `${agent.type}-${agent.startedAt || 'default'}`;
}

export function ActiveAgentsPanel({ activeAgents }: ActiveAgentsPanelProps) {
  // Track which agents are expanded
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((key: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const workingCount = activeAgents.filter((a) => a.status === 'working').length;
  const completedCount = activeAgents.filter((a) => a.status === 'completed').length;
  const failedCount = activeAgents.filter((a) => a.status === 'failed').length;

  // Group agents by status for better organization
  const workingAgents = activeAgents.filter((a) => a.status === 'working');
  const finishedAgents = activeAgents.filter((a) => a.status !== 'working');

  return (
    <aside className="w-64 bg-bg-secondary border-r border-border-primary flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Sub-Agents
          </span>
          <span
            className={`text-2xs px-1.5 py-0.5 rounded ${
              workingCount > 0
                ? 'bg-status-warning/20 text-status-warning'
                : activeAgents.length > 0
                  ? 'bg-status-success/20 text-status-success'
                  : 'bg-bg-tertiary text-text-muted'
            }`}
          >
            {workingCount > 0 ? `${workingCount} working` : `${activeAgents.length} total`}
          </span>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeAgents.length > 0 ? (
          <div className="space-y-3">
            {/* Working Agents Section */}
            {workingAgents.length > 0 && (
              <div>
                <div className="text-2xs font-medium text-status-warning mb-1.5 px-1 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-warning opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-status-warning"></span>
                  </span>
                  Working ({workingAgents.length})
                </div>
                <div className="flex flex-col gap-2">
                  {workingAgents.map((agent) => {
                    const key = getAgentKey(agent);
                    return (
                      <AgentCard
                        key={key}
                        agent={agent}
                        isExpanded={expandedAgents.has(key)}
                        onToggleExpand={() => toggleExpand(key)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Finished Agents Section */}
            {finishedAgents.length > 0 && (
              <div>
                {workingAgents.length > 0 && (
                  <div className="text-2xs font-medium text-text-muted mb-1.5 px-1">
                    Completed ({finishedAgents.length})
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {finishedAgents.map((agent) => {
                    const key = getAgentKey(agent);
                    return (
                      <AgentCard
                        key={key}
                        agent={agent}
                        isExpanded={expandedAgents.has(key)}
                        onToggleExpand={() => toggleExpand(key)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-3xl mb-2 opacity-50">🤖</div>
            <div className="text-xs text-text-muted">No agents active</div>
            <div className="text-2xs text-text-muted mt-1">
              Submit a prompt to start
            </div>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {activeAgents.length > 0 && (
        <div className="p-3 border-t border-border-primary bg-bg-tertiary/50">
          <div className="flex items-center justify-between text-2xs">
            <span className="text-status-success flex items-center gap-1">
              <span>✓</span> {completedCount}
            </span>
            <span className="text-status-error flex items-center gap-1">
              <span>✗</span> {failedCount}
            </span>
            <span className="text-text-muted">
              {activeAgents.length} total
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
