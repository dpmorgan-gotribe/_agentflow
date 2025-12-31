import type { Task, GitBranch } from '../../types';

interface LeftSidebarProps {
  currentTask: Task | null;
}

// Mock data for demonstration
const MOCK_BRANCHES: GitBranch[] = [
  { name: 'main', isCurrent: true, ahead: 0, behind: 0 },
  { name: 'feature/gallery-ui', isCurrent: false, ahead: 2, behind: 0 },
  { name: 'feature/auth-system', isCurrent: false, ahead: 5, behind: 0 },
];

export function LeftSidebar({ currentTask }: LeftSidebarProps) {
  return (
    <aside className="w-left-sidebar bg-bg-secondary border-r border-border-primary flex flex-col overflow-hidden shrink-0">
      {/* Git Branches Section */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Git Branches
          </span>
          <button className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:bg-bg-tertiary hover:text-text-primary transition-colors">
            +
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {MOCK_BRANCHES.map((branch) => (
            <div
              key={branch.name}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                branch.isCurrent ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  branch.isCurrent ? 'bg-status-success' : 'bg-accent-primary'
                }`}
              />
              <span className="flex-1 text-xs text-text-primary truncate">{branch.name}</span>
              {branch.isCurrent ? (
                <span className="text-2xs px-1.5 py-0.5 rounded bg-status-success/20 text-status-success">
                  current
                </span>
              ) : (
                <span className="text-2xs text-text-muted">
                  {branch.ahead > 0 && `${branch.ahead} ahead`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Worktrees Section */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Worktrees
          </span>
          <span className="text-2xs px-1.5 py-0.5 rounded bg-status-success/20 text-status-success">
            0 active
          </span>
        </div>
        {currentTask ? (
          <div className="p-2 bg-bg-card border border-border-primary rounded">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-text-primary">
                task-{currentTask.id.slice(0, 8)}
              </span>
              <span className="text-2xs px-1.5 py-0.5 rounded bg-status-success/20 text-status-success">
                active
              </span>
            </div>
            <div className="text-2xs text-text-muted font-mono mb-1">
              /worktrees/task-{currentTask.id.slice(0, 8)}
            </div>
            <div className="text-2xs text-text-secondary">
              Agent: <span className="text-text-accent">{currentTask.currentAgent || 'None'}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-text-muted italic text-center py-4">
            No active worktrees
          </div>
        )}
      </div>

      {/* Files Section */}
      <div className="flex-1 p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Files
          </span>
        </div>
        {currentTask ? (
          <div className="text-xs">
            <div className="flex items-center gap-2 px-2 py-1 text-text-secondary">
              <span>src</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 ml-4 text-text-secondary">
              <span>components</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-text-muted italic text-center py-4">
            No files to display
          </div>
        )}
      </div>

      {/* Other Projects */}
      <div className="p-3 border-t border-border-primary">
        <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
          Other Projects
        </span>
      </div>
    </aside>
  );
}
