import type { ActiveAgent, AgentType } from '../../types';

interface ActiveAgentsPanelProps {
  activeAgents: ActiveAgent[];
}

/** Agent display names and icons */
const AGENT_INFO: Record<AgentType, { name: string; icon: string }> = {
  system: { name: 'System', icon: '⚙️' },
  orchestrator: { name: 'Orchestrator', icon: '🎯' },
  project_manager: { name: 'Project Manager', icon: '📋' },
  architect: { name: 'Architect', icon: '🏗️' },
  analyst: { name: 'Analyst', icon: '🔍' },
  project_analyzer: { name: 'Project Analyzer', icon: '📊' },
  compliance: { name: 'Compliance', icon: '🔒' },
  ui_designer: { name: 'UI Designer', icon: '🎨' },
  frontend_developer: { name: 'Frontend Dev', icon: '⚛️' },
  backend_developer: { name: 'Backend Dev', icon: '🔧' },
  tester: { name: 'Tester', icon: '🧪' },
  bug_fixer: { name: 'Bug Fixer', icon: '🐛' },
  reviewer: { name: 'Reviewer', icon: '👀' },
  git_agent: { name: 'Git Agent', icon: '📚' },
};

export function ActiveAgentsPanel({ activeAgents }: ActiveAgentsPanelProps) {
  const workingCount = activeAgents.filter((a) => a.status === 'working').length;

  return (
    <aside className="w-56 bg-bg-secondary border-r border-border-primary flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Active Agents
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
            {workingCount} working
          </span>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeAgents.length > 0 ? (
          <div className="flex flex-col gap-2">
            {activeAgents.map((agent) => {
              const info = AGENT_INFO[agent.type] || { name: agent.type, icon: '🤖' };
              return (
                <div
                  key={agent.type}
                  className={`p-2.5 rounded-lg border transition-all ${
                    agent.status === 'working'
                      ? 'bg-status-warning/10 border-status-warning/30 shadow-sm'
                      : agent.status === 'completed'
                        ? 'bg-status-success/10 border-status-success/30'
                        : agent.status === 'failed'
                          ? 'bg-status-error/10 border-status-error/30'
                          : 'bg-bg-card border-border-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{info.icon}</span>
                    <span className="text-xs font-medium text-text-primary flex-1 truncate">
                      {info.name}
                    </span>
                    {agent.status === 'working' && (
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
                  </div>
                  {agent.message && (
                    <div className="text-2xs text-text-muted mt-1.5 pl-6 line-clamp-2">
                      {agent.message}
                    </div>
                  )}
                  {agent.artifactCount !== undefined && agent.artifactCount > 0 && (
                    <div className="text-2xs text-text-secondary mt-1 pl-6 flex items-center gap-1">
                      <span>📦</span>
                      {agent.artifactCount} artifact{agent.artifactCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
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
          <div className="flex items-center justify-between text-2xs text-text-muted">
            <span>
              {activeAgents.filter((a) => a.status === 'completed').length} completed
            </span>
            <span>
              {activeAgents.filter((a) => a.status === 'failed').length} failed
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
