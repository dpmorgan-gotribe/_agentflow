interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: 'activity' | 'kanban' | 'viewer') => void;
  isExecuting: boolean;
  currentBranch: string;
}

const NAV_TABS = [
  { id: 'activity', label: 'Activity' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'viewer', label: 'Viewer' },
] as const;

export function Header({ activeTab, onTabChange, isExecuting, currentBranch }: HeaderProps) {
  return (
    <header className="h-header bg-bg-secondary border-b border-border-primary flex items-center px-3 shrink-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-6 h-6 bg-accent-primary rounded flex items-center justify-center font-bold text-xs text-white">
          A
        </div>
        <span className="font-bold text-sm text-text-primary">AGENTFLOW</span>
      </div>

      {/* Live Stream Button */}
      <button className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-text-secondary text-xs hover:bg-bg-card-hover hover:text-text-primary transition-colors">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        LIVE LOG STREAM
      </button>

      {/* Status Indicator */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary ml-3">
        <span
          className={`w-2 h-2 rounded-full ${
            isExecuting ? 'bg-status-success status-dot-pulse' : 'bg-status-idle'
          }`}
        />
        {isExecuting ? 'executing' : 'idle'}
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 ml-4">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              activeTab === tab.id
                ? 'bg-bg-tertiary text-text-primary'
                : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right Section */}
      <div className="ml-auto flex items-center gap-3">
        {/* Branch Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-xs text-text-secondary">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 3v12" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 6V3" />
            <circle cx="18" cy="9" r="3" />
          </svg>
          <span className="text-text-accent">{currentBranch}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>
            Active: <span className="text-text-primary font-medium">{isExecuting ? 1 : 0}</span>
          </span>
          <span>
            Parallel: <span className="text-text-primary font-medium">0/15</span>
          </span>
          <span>
            Cost: <span className="text-text-primary font-medium">$0.00</span>
          </span>
        </div>

        {/* New Project Button */}
        <button className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary-hover rounded text-xs font-medium text-white transition-colors">
          + New Project
        </button>
      </div>
    </header>
  );
}
