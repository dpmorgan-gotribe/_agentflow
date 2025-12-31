import type { AgentType, AgentLogEntry } from '../../types';

interface RightSidebarProps {
  isExecuting: boolean;
  currentAgent?: AgentType;
  agentLogs: AgentLogEntry[];
}

const AGENT_NAMES: Record<AgentType, string> = {
  orchestrator: 'Orchestrator',
  project_manager: 'Project Manager',
  architect: 'Architect',
  analyst: 'Analyst',
  project_analyzer: 'Project Analyzer',
  compliance: 'Compliance',
  ui_designer: 'UI Designer',
  frontend_developer: 'Frontend Dev',
  backend_developer: 'Backend Dev',
  tester: 'Tester',
  bug_fixer: 'Bug Fixer',
  reviewer: 'Reviewer',
  git_agent: 'Git Agent',
};

export function RightSidebar({ isExecuting, currentAgent, agentLogs }: RightSidebarProps) {
  return (
    <aside className="w-right-sidebar bg-bg-secondary border-l border-border-primary flex flex-col overflow-hidden shrink-0">
      {/* Orchestrator Panel */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-text-primary">Orchestrator</span>
          <span
            className={`text-2xs px-2 py-0.5 rounded font-medium ${
              isExecuting
                ? 'bg-status-success/20 text-status-success'
                : 'bg-bg-tertiary text-text-muted'
            }`}
          >
            {isExecuting ? 'executing' : 'idle'}
          </span>
        </div>
        {currentAgent && (
          <div className="text-xs text-text-secondary">
            Current: <span className="text-text-accent">{AGENT_NAMES[currentAgent]}</span>
          </div>
        )}
      </div>

      {/* Git Status Panel */}
      <div className="p-3 border-b border-border-primary">
        <div className="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Git Status
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Branch</span>
            <span className="text-text-accent font-mono text-2xs">main</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Ahead/Behind</span>
            <span className="text-text-primary font-mono text-2xs">+0 / -0</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Modified</span>
            <span className="text-text-primary font-mono text-2xs">0 files</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Staged</span>
            <span className="text-text-primary font-mono text-2xs">0 files</span>
          </div>
        </div>
      </div>

      {/* Agent Logs Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border-primary">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Agent Logs
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {agentLogs.length === 0 ? (
            <div className="text-xs text-text-muted italic text-center py-8">
              No activity yet
            </div>
          ) : (
            <div className="space-y-0.5">
              {agentLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex gap-2 px-2 py-1 text-2xs font-mono rounded hover:bg-bg-tertiary"
                >
                  <span className="text-text-muted shrink-0">{log.time}</span>
                  <span
                    className={`font-medium shrink-0 ${
                      log.action === 'reading'
                        ? 'log-action-reading'
                        : log.action === 'writing'
                          ? 'log-action-writing'
                          : log.action === 'commit'
                            ? 'log-action-commit'
                            : log.action === 'error'
                              ? 'log-action-error'
                              : 'log-action-spawned'
                    }`}
                  >
                    {log.agent ? AGENT_NAMES[log.agent] : log.action}
                  </span>
                  <span className="text-text-secondary truncate">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
