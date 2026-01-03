import { useEffect, useCallback, useState, useMemo } from 'react';
import { Header, type TokenUsageStats } from './components/layout/Header';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { ActiveAgentsPanel } from './components/layout/ActiveAgentsPanel';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomBar } from './components/layout/BottomBar';
import { MainContent } from './components/layout/MainContent';
import { ApprovalDialog } from './components/ApprovalDialog';
import { NewProjectModal } from './components/NewProjectModal';
import { useAppStore, useActiveAgents, useOrchestratorEvents } from './store/index';
import { fetchTaskEvents, sendOrchestratorMessage, getArtifacts, submitApproval } from './api';
import type { Task, AgentEvent, Artifact, ProjectPlan } from './types';

export default function App() {
  // Zustand store state
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentTask = useAppStore((state) => state.currentTask);
  const events = useAppStore((state) => state.events);
  const approvalRequest = useAppStore((state) => state.approvalRequest);
  const activeTab = useAppStore((state) => state.activeTab);
  const isExecuting = useAppStore((state) => state.isExecuting);
  const designPhase = useAppStore((state) => state.designPhase);
  const stylesheetApproved = useAppStore((state) => state.stylesheetApproved);
  const screensApproved = useAppStore((state) => state.screensApproved);

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
  const approveStylesheet = useAppStore((state) => state.approveStylesheet);
  const approveScreens = useAppStore((state) => state.approveScreens);

  // Derived state from store
  const activeAgents = useActiveAgents();
  const orchestratorEvents = useOrchestratorEvents();

  // Compute token usage by aggregating from all agent events
  const tokenUsage = useMemo<TokenUsageStats | undefined>(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;

    for (const event of events) {
      if (event.activity?.tokenUsage) {
        inputTokens += event.activity.tokenUsage.input || 0;
        outputTokens += event.activity.tokenUsage.output || 0;
        cacheCreationTokens += event.activity.tokenUsage.cacheCreation || 0;
        cacheReadTokens += event.activity.tokenUsage.cacheRead || 0;
      }
    }

    // Only return stats if we have any token data
    if (inputTokens === 0 && outputTokens === 0) {
      return undefined;
    }

    return {
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
    };
  }, [events]);

  // Count parallel agents currently running (from active agents with 'working' status)
  const parallelAgentCount = useMemo(() => {
    return activeAgents.filter(a => a.status === 'working').length;
  }, [activeAgents]);

  // Local UI state for modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // Artifacts state
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  // Extract project plan from PM agent events
  const projectPlan = useMemo<ProjectPlan | null>(() => {
    // Find the last project_manager agent event with plan data
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event.agent === 'project_manager' && event.activity?.response) {
        try {
          // Try to parse plan from response
          const response = event.activity.response;
          // Look for JSON in the response
          const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                           response.match(/\{[\s\S]*"epics"[\s\S]*\}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            if (parsed.epics && Array.isArray(parsed.epics)) {
              return parsed as ProjectPlan;
            }
          }
        } catch {
          // Continue to next event if parsing fails
        }
      }
    }
    return null;
  }, [events]);

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

  // Fetch artifacts when task changes or when we receive artifact events
  useEffect(() => {
    async function fetchArtifactsForTask() {
      if (!currentTask) {
        setArtifacts([]);
        return;
      }
      try {
        const taskArtifacts = await getArtifacts(currentTask.id);
        setArtifacts(taskArtifacts);
      } catch (error) {
        console.error('Failed to fetch artifacts:', error);
      }
    }
    fetchArtifactsForTask();
  }, [currentTask?.id, events.length]); // Refetch when events change (new artifacts may have been created)

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

  // Send message to orchestrator
  const onSendOrchestratorMessage = useCallback(async (message: string) => {
    if (!currentTask) {
      console.warn('No active task for orchestrator message');
      return;
    }
    try {
      await sendOrchestratorMessage(currentTask.id, message);
    } catch (error) {
      console.error('Failed to send orchestrator message:', error);
      throw error; // Re-throw so the chat component can handle it
    }
  }, [currentTask]);

  // Design approval callbacks
  const onApproveStylesheet = useCallback(async () => {
    if (!currentTask) return;
    try {
      await submitApproval(currentTask.id, true, { feedback: 'Stylesheet approved' });
      approveStylesheet();
    } catch (error) {
      console.error('Failed to approve stylesheet:', error);
    }
  }, [currentTask, approveStylesheet]);

  const onRejectStylesheet = useCallback(async (feedback: string) => {
    if (!currentTask) return;
    try {
      await submitApproval(currentTask.id, false, { feedback });
    } catch (error) {
      console.error('Failed to reject stylesheet:', error);
    }
  }, [currentTask]);

  const onApproveScreens = useCallback(async () => {
    if (!currentTask) return;
    try {
      await submitApproval(currentTask.id, true, { feedback: 'Screens approved' });
      approveScreens();
    } catch (error) {
      console.error('Failed to approve screens:', error);
    }
  }, [currentTask, approveScreens]);

  const onRejectScreens = useCallback(async (feedback: string) => {
    if (!currentTask) return;
    try {
      await submitApproval(currentTask.id, false, { feedback });
    } catch (error) {
      console.error('Failed to reject screens:', error);
    }
  }, [currentTask]);

  // Navigate to design tab and show specific mockup
  const onNavigateToDesign = useCallback((mockupPath: string) => {
    console.log('Navigate to design:', mockupPath);
    setActiveTab('design');
    // Could store mockupPath in state to highlight/scroll to it
  }, [setActiveTab]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={onTabChange}
        isExecuting={isExecuting}
        currentBranch={currentTask ? `task/${currentTask.id.slice(0, 8)}` : 'main'}
        onNewProject={onNewProject}
        tokenUsage={tokenUsage}
        parallelAgents={parallelAgentCount}
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
          artifacts={artifacts}
          designPhase={designPhase}
          stylesheetApproved={stylesheetApproved}
          screensApproved={screensApproved}
          onApproveStylesheet={onApproveStylesheet}
          onRejectStylesheet={onRejectStylesheet}
          onApproveScreens={onApproveScreens}
          onRejectScreens={onRejectScreens}
          projectPlan={projectPlan}
          onNavigateToDesign={onNavigateToDesign}
        />

        {/* Right Sidebar */}
        <RightSidebar
          isExecuting={isExecuting}
          currentAgent={events[events.length - 1]?.agent}
          orchestratorEvents={orchestratorEvents}
          taskId={currentTask?.id}
          onSendMessage={onSendOrchestratorMessage}
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
