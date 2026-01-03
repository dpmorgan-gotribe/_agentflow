import type { Task, AgentEvent, Artifact } from '../../types';
import type { ViewTab, DesignPhase } from '../../store';
import { AgentFeed } from '../AgentFeed';
import { DesignPreview } from '../DesignPreview';
import { DesignPage } from '../design';

interface MainContentProps {
  activeTab: ViewTab;
  currentTask: Task | null;
  events: AgentEvent[];
  onEvent: (event: AgentEvent) => void;
  // Design phase props
  artifacts: Artifact[];
  designPhase: DesignPhase;
  stylesheetApproved: boolean;
  screensApproved: boolean;
  onApproveStylesheet: () => void;
  onRejectStylesheet: (feedback: string) => void;
  onApproveScreens: () => void;
  onRejectScreens: (feedback: string) => void;
}

export function MainContent({
  activeTab,
  currentTask,
  events,
  onEvent,
  artifacts,
  designPhase,
  stylesheetApproved,
  screensApproved,
  onApproveStylesheet,
  onRejectStylesheet,
  onApproveScreens,
  onRejectScreens,
}: MainContentProps) {
  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Content Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-secondary border-b border-border-primary">
        <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
          {activeTab === 'activity' && 'Agent Activity'}
          {activeTab === 'kanban' && 'Task Board'}
          {activeTab === 'viewer' && 'Design Viewer'}
          {activeTab === 'design' && 'Design Assets'}
          {activeTab === 'planning' && 'Project Planning'}
        </h1>
        {currentTask && (
          <>
            <span className="text-2xs px-2 py-0.5 rounded bg-status-success/20 text-status-success">
              {currentTask.status}
            </span>
            <span className="text-2xs px-2 py-0.5 rounded bg-bg-tertiary text-text-muted">
              {currentTask.id.slice(0, 8)}
            </span>
          </>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'activity' && (
          <div className="h-full flex">
            {/* Agent Feed */}
            <div className="w-1/2 border-r border-border-primary overflow-y-auto p-4">
              <h2 className="text-xs font-semibold text-text-muted mb-4">Agent Messages</h2>
              <AgentFeed taskId={currentTask?.id} events={events} onEvent={onEvent} />
            </div>

            {/* Design Preview */}
            <div className="w-1/2 overflow-y-auto p-4">
              <h2 className="text-xs font-semibold text-text-muted mb-4">Design Preview</h2>
              <DesignPreview taskId={currentTask?.id} />
            </div>
          </div>
        )}

        {activeTab === 'kanban' && (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-sm">Kanban board view</p>
              <p className="text-xs mt-2">Coming in a future update</p>
            </div>
          </div>
        )}

        {activeTab === 'viewer' && (
          <div className="h-full p-4">
            <DesignPreview taskId={currentTask?.id} fullWidth />
          </div>
        )}

        {activeTab === 'design' && (
          <DesignPage
            taskId={currentTask?.id}
            artifacts={artifacts}
            designPhase={designPhase}
            stylesheetApproved={stylesheetApproved}
            screensApproved={screensApproved}
            onApproveStylesheet={onApproveStylesheet}
            onRejectStylesheet={onRejectStylesheet}
            onApproveScreens={onApproveScreens}
            onRejectScreens={onRejectScreens}
          />
        )}

        {activeTab === 'planning' && (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-sm">Project Planning</p>
              <p className="text-xs mt-2">Epics, Features, and Tasks</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
