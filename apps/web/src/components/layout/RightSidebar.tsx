import { useState, useCallback } from 'react';
import type { AgentType, ExtendedAgentEvent, TaskStatus } from '../../types';
import { SettingsPanel } from '../SettingsPanel';
import { OrchestratorChat } from '../OrchestratorChat';

interface RightSidebarProps {
  isExecuting: boolean;
  currentAgent?: AgentType;
  orchestratorEvents: ExtendedAgentEvent[];
  taskId?: string;
  onSendMessage: (message: string) => Promise<void>;
}

/** View mode for orchestrator panel */
type ViewMode = 'activity' | 'chat';

type Phase = 'analyzing' | 'routing' | 'executing' | 'completed' | 'failed' | 'waiting';

/** Phase colors and icons */
const PHASE_STYLES: Record<Phase, { color: string; icon: string }> = {
  analyzing: { color: 'text-blue-400', icon: '🔍' },
  routing: { color: 'text-purple-400', icon: '🔀' },
  executing: { color: 'text-yellow-400', icon: '⚡' },
  completed: { color: 'text-green-400', icon: '✓' },
  failed: { color: 'text-red-400', icon: '✗' },
  waiting: { color: 'text-orange-400', icon: '⏳' },
};

/** Map task status to display phase */
function getPhase(status: TaskStatus): Phase {
  switch (status) {
    case 'analyzing': return 'analyzing';
    case 'orchestrating': return 'routing';
    case 'agent_working': return 'executing';
    case 'completed': return 'completed';
    case 'failed': return 'failed';
    case 'awaiting_approval': return 'waiting';
    default: return 'executing';
  }
}

const AGENT_NAMES: Record<AgentType, string> = {
  system: 'System',
  orchestrator: 'Orchestrator',
  project_manager: 'Project Manager',
  architect: 'Architect',
  analyst: 'Analyst',
  analyzer: 'Analyzer',
  project_analyzer: 'Project Analyzer',
  compliance: 'Compliance',
  compliance_agent: 'Compliance Agent',
  ui_designer: 'UI Designer',
  frontend_developer: 'Frontend Dev',
  backend_developer: 'Backend Dev',
  tester: 'Tester',
  bug_fixer: 'Bug Fixer',
  reviewer: 'Reviewer',
  git_agent: 'Git Agent',
};

export function RightSidebar({ isExecuting, currentAgent, orchestratorEvents, taskId, onSendMessage }: RightSidebarProps) {
  // View mode state - default to chat for better UX
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  // Get latest thinking from orchestrator events (use reverse + find for ES2022 compatibility)
  const latestThinking = [...orchestratorEvents].reverse().find((e: ExtendedAgentEvent) => e.thinking);

  // Toggle view mode
  const handleViewToggle = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  return (
    <aside className="w-right-sidebar bg-bg-secondary border-l border-border-primary flex flex-col overflow-hidden shrink-0">
      {/* Orchestrator Panel Header */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-2">
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

        {/* View Mode Toggle */}
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-0.5">
          <button
            onClick={() => handleViewToggle('chat')}
            className={`flex-1 text-2xs py-1 px-2 rounded transition-colors ${
              viewMode === 'chat'
                ? 'bg-accent-primary text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            💬 Chat
          </button>
          <button
            onClick={() => handleViewToggle('activity')}
            className={`flex-1 text-2xs py-1 px-2 rounded transition-colors ${
              viewMode === 'activity'
                ? 'bg-accent-primary text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            📋 Activity
          </button>
        </div>

        {currentAgent && currentAgent !== 'orchestrator' && currentAgent !== 'system' && (
          <div className="text-xs text-text-secondary mt-2">
            Delegating to: <span className="text-text-accent">{AGENT_NAMES[currentAgent]}</span>
          </div>
        )}
      </div>

      {/* Settings Panel - collapsible */}
      <SettingsPanel />

      {/* Orchestrator Thinking Panel */}
      {latestThinking?.thinking && (
        <div className="p-3 border-b border-border-primary bg-accent-primary/5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-sm">🧠</span>
            <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Thinking
            </span>
          </div>
          <p className="text-xs text-text-secondary line-clamp-4 mb-2">
            {latestThinking.thinking.thinking}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-2xs px-1.5 py-0.5 bg-bg-tertiary rounded text-accent-primary">
              {latestThinking.thinking.action}
            </span>
            {latestThinking.thinking.targets?.map((target: string, i: number) => (
              <span key={i} className="text-2xs px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted">
                {target}
              </span>
            ))}
          </div>
        </div>
      )}

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

      {/* Main Content Area - Chat or Activity based on viewMode */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {viewMode === 'chat' ? (
          /* Chat View */
          <OrchestratorChat
            taskId={taskId}
            orchestratorEvents={orchestratorEvents}
            isExecuting={isExecuting}
            onSendMessage={onSendMessage}
          />
        ) : (
          /* Activity View */
          <>
            <div className="p-3 border-b border-border-primary shrink-0">
              <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                Orchestrator Activity
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 min-h-0">
              {orchestratorEvents.length === 0 ? (
                <div className="text-xs text-text-muted italic text-center py-4">
                  No orchestrator activity yet
                </div>
              ) : (
                <div className="space-y-1">
                  {orchestratorEvents.map((event, index) => {
                    const phase = getPhase(event.status);
                    const style = PHASE_STYLES[phase];
                    const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false });
                    const message = (event.message || event.status || 'Event').split('\n')[0].slice(0, 60);
                    const details = event.message?.includes('\n')
                      ? event.message.split('\n').slice(1).join(' ').slice(0, 80)
                      : undefined;

                    // Get reasoning from thinking data if available
                    const reasoning = event.thinking?.thinking;

                    return (
                      <div
                        key={index}
                        className="px-2 py-1.5 text-2xs rounded hover:bg-bg-tertiary"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted font-mono shrink-0">{time}</span>
                          <span className={`${style.color} shrink-0`}>{style.icon}</span>
                          <span className={`font-medium uppercase text-3xs ${style.color}`}>
                            {phase}
                          </span>
                          {event.thinking?.action && (
                            <span className="text-3xs px-1 py-0.5 bg-accent-primary/10 text-accent-primary rounded">
                              {event.thinking.action}
                            </span>
                          )}
                        </div>
                        <div className="text-text-secondary mt-0.5 pl-14 truncate">
                          {message}
                        </div>
                        {reasoning && (
                          <div className="mt-1 ml-14 p-1.5 bg-accent-primary/5 border-l-2 border-accent-primary/30 rounded-r">
                            <div className="text-3xs text-text-muted uppercase tracking-wider mb-0.5">
                              🧠 Reasoning
                            </div>
                            <div className="text-2xs text-text-secondary line-clamp-3">
                              {reasoning}
                            </div>
                            {event.thinking?.targets && event.thinking.targets.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {event.thinking.targets.map((target, i) => (
                                  <span key={i} className="text-3xs px-1 py-0.5 bg-bg-tertiary rounded text-text-muted">
                                    → {target}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {!reasoning && details && (
                          <div className="text-text-muted mt-0.5 pl-14 text-3xs truncate">
                            {details}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
