import { useEffect, useCallback, useState } from 'react';
import { Header } from './components/layout/Header';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { ActiveAgentsPanel } from './components/layout/ActiveAgentsPanel';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomBar } from './components/layout/BottomBar';
import { MainContent } from './components/layout/MainContent';
import { ApprovalDialog } from './components/ApprovalDialog';
import { NewProjectModal } from './components/NewProjectModal';
import { useAppStore, useActiveAgents, useOrchestratorEvents } from './store';
import { fetchTaskEvents } from './api';
import type { Task, AgentEvent } from './types';

export default function App() {
  // Zustand store state
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentTask = useAppStore((state) => state.currentTask);
  const events = useAppStore((state) => state.events);
  const approvalRequest = useAppStore((state) => state.approvalRequest);
  const activeTab = useAppStore((state) => state.activeTab);
  const isExecuting = useAppStore((state) => state.isExecuting);

  // Zustand store actions
  const handleTaskCreated = useAppStore((state) => state.handleTaskCreated);
  const handleProjectChange = useAppStore((state) => state.handleProjectChange);
  const handleEvent = useAppStore((state) => state.handleEvent);
  const handleApprovalComplete = useAppStore((state) => state.handleApprovalComplete);
  const handlePause = useAppStore((state) => state.handlePause);
  const handleStop = useAppStore((state) => state.handleStop);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const setEvents = useAppStore((state) => state.setEvents);
  const setIsExecuting = useAppStore((state) => state.setIsExecuting);

  // Derived state from store
  const activeAgents = useActiveAgents();
  const orchestratorEvents = useOrchestratorEvents();

  // Local UI state for modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // Restore session on mount - fetch events if we have an active task
  useEffect(() => {
    async function restoreSession() {
      if (currentTask && events.length === 0) {
        try {
          // Fetch events from backend
          const storedEvents = await fetchTaskEvents(currentTask.id);
          if (storedEvents.length > 0) {
            setEvents(storedEvents);
            // Check if task is still executing
            const lastEvent = storedEvents[storedEvents.length - 1];
            if (lastEvent.status !== 'completed' && lastEvent.status !== 'failed') {
              setIsExecuting(true);
            }
          }
        } catch (error) {
          console.error('Failed to restore session events:', error);
        }
      }
    }
    restoreSession();
  }, [currentTask?.id]); // Only run when task ID changes, not on every render

  // Memoize callbacks to prevent unnecessary re-renders
  const onTaskCreated = useCallback((task: Task) => {
    handleTaskCreated(task);
  }, [handleTaskCreated]);

  const onProjectChange = useCallback((projectId: string) => {
    handleProjectChange(projectId);
  }, [handleProjectChange]);

  const onEvent = useCallback((event: AgentEvent) => {
    handleEvent(event);
  }, [handleEvent]);

  const onApprovalComplete = useCallback(() => {
    handleApprovalComplete();
  }, [handleApprovalComplete]);

  const onPause = useCallback(() => {
    handlePause();
  }, [handlePause]);

  const onStop = useCallback(() => {
    handleStop();
  }, [handleStop]);

  const onTabChange = useCallback((tab: typeof activeTab) => {
    setActiveTab(tab);
  }, [setActiveTab]);

  const onNewProject = useCallback(() => {
    setIsNewProjectModalOpen(true);
  }, []);

  const onNewProjectClose = useCallback(() => {
    setIsNewProjectModalOpen(false);
  }, []);

  const onNewProjectCreated = useCallback((projectId: string) => {
    setIsNewProjectModalOpen(false);
    handleProjectChange(projectId);
  }, [handleProjectChange]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={onTabChange}
        isExecuting={isExecuting}
        currentBranch={currentTask ? `task/${currentTask.id.slice(0, 8)}` : 'main'}
        onNewProject={onNewProject}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Project, Git, Files */}
        <LeftSidebar
          currentProjectId={currentProjectId}
          onProjectChange={onProjectChange}
          activeWorktreeCount={currentTask ? 1 : 0}
          currentTaskId={currentTask?.id}
        />

        {/* Active Agents Panel */}
        <ActiveAgentsPanel activeAgents={activeAgents} />

        {/* Main Content - Agent Activity */}
        <MainContent
          activeTab={activeTab}
          currentTask={currentTask}
          events={events}
          onEvent={onEvent}
        />

        {/* Right Sidebar */}
        <RightSidebar
          isExecuting={isExecuting}
          currentAgent={events[events.length - 1]?.agent}
          orchestratorEvents={orchestratorEvents}
        />
      </div>

      {/* Bottom Bar */}
      <BottomBar
        onTaskCreated={onTaskCreated}
        disabled={isExecuting || !currentProjectId}
        isExecuting={isExecuting}
        onPause={onPause}
        onStop={onStop}
        currentProjectId={currentProjectId}
      />

      {/* Approval Dialog */}
      {approvalRequest && currentTask && (
        <ApprovalDialog
          taskId={currentTask.id}
          request={approvalRequest}
          onComplete={onApprovalComplete}
        />
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={onNewProjectClose}
        onProjectCreated={onNewProjectCreated}
      />
    </div>
  );
}
