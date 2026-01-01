import { useState } from 'react';
import { triggerShutdown } from '../../api';

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
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [isKilling, setIsKilling] = useState(false);

  const handleKillAll = async () => {
    setIsKilling(true);
    try {
      await triggerShutdown('User clicked Kill All button in Header');
      // The server will shut down, so this might not execute
    } catch {
      // Server is shutting down or already dead
    }
    setIsKilling(false);
    setShowKillConfirm(false);
  };

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

        {/* Kill All Button */}
        <button
          onClick={() => setShowKillConfirm(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-status-error hover:bg-red-700 rounded text-xs font-medium text-white transition-colors"
          title="Stop all processes and shut down the server"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
          Kill All
        </button>

        {/* New Project Button */}
        <button className="flex items-center gap-1 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary-hover rounded text-xs font-medium text-white transition-colors">
          + New Project
        </button>
      </div>

      {/* Kill Confirmation Dialog */}
      {showKillConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-status-error/20 rounded-full flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-status-error"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Kill All Processes?</h3>
                <p className="text-sm text-text-secondary">This will shut down the API server and stop all running workflows.</p>
              </div>
            </div>

            <div className="bg-bg-tertiary rounded p-3 mb-4 text-xs text-text-secondary">
              <p className="mb-2">This action will:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Stop all running agent workflows</li>
                <li>Close all SSE connections</li>
                <li>Shut down the API server</li>
                <li>You will need to restart with <code className="bg-bg-card px-1 rounded">pnpm dev</code></li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowKillConfirm(false)}
                disabled={isKilling}
                className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary hover:bg-bg-card-hover transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleKillAll}
                disabled={isKilling}
                className="px-4 py-2 bg-status-error hover:bg-red-700 rounded text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isKilling ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Shutting down...
                  </>
                ) : (
                  'Kill All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
