import { useState, useCallback } from 'react';
import { Header } from './components/layout/Header';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomBar } from './components/layout/BottomBar';
import { MainContent } from './components/layout/MainContent';
import { ApprovalDialog } from './components/ApprovalDialog';
import type { Task, AgentEvent, ApprovalRequest, AgentLogEntry } from './types';

type ViewTab = 'activity' | 'kanban' | 'viewer';

export default function App() {
  // Project state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Task state
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<ViewTab>('activity');
  const [isExecuting, setIsExecuting] = useState(false);

  // Derived state for logs
  const agentLogs: AgentLogEntry[] = events.slice(-20).map((e) => ({
    time: new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false }),
    action: e.status === 'failed' ? 'error' : 'spawned',
    agent: e.agent || 'system',
    message: (e.message || e.status || 'Event').split('\n')[0].slice(0, 50),
  }));

  const handleTaskCreated = useCallback((task: Task) => {
    setCurrentTask(task);
    setCurrentProjectId(task.projectId); // Set the project from the task
    setEvents([]);
    setApprovalRequest(null);
    setIsExecuting(true);
    setActiveTab('activity');
  }, []);

  const handleProjectChange = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    // Clear current task when switching projects
    setCurrentTask(null);
    setEvents([]);
    setApprovalRequest(null);
    setIsExecuting(false);
  }, []);

  const handleEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => [...prev, event]);

    // Check for approval request
    if (event.status === 'awaiting_approval' && event.approvalRequest) {
      setApprovalRequest(event.approvalRequest);
      setIsExecuting(false);
    }

    // Check for completion
    if (event.status === 'completed' || event.status === 'failed') {
      setIsExecuting(false);
    }
  }, []);

  const handleApprovalComplete = useCallback(() => {
    setApprovalRequest(null);
    setIsExecuting(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsExecuting(false);
    // TODO: Call API to pause task
  }, []);

  const handleStop = useCallback(() => {
    setIsExecuting(false);
    setCurrentTask(null);
    setEvents([]);
    // TODO: Call API to stop task
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isExecuting={isExecuting}
        currentBranch={currentTask ? `task/${currentTask.id.slice(0, 8)}` : 'main'}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          currentProjectId={currentProjectId}
          onProjectChange={handleProjectChange}
          activeWorktreeCount={currentTask ? 1 : 0}
          currentTaskId={currentTask?.id}
          currentAgent={events[events.length - 1]?.agent}
        />

        {/* Main Content */}
        <MainContent
          activeTab={activeTab}
          currentTask={currentTask}
          events={events}
          onEvent={handleEvent}
        />

        {/* Right Sidebar */}
        <RightSidebar
          isExecuting={isExecuting}
          currentAgent={events[events.length - 1]?.agent}
          agentLogs={agentLogs}
        />
      </div>

      {/* Bottom Bar */}
      <BottomBar
        onTaskCreated={handleTaskCreated}
        disabled={isExecuting}
        isExecuting={isExecuting}
        onPause={handlePause}
        onStop={handleStop}
      />

      {/* Approval Dialog */}
      {approvalRequest && currentTask && (
        <ApprovalDialog
          taskId={currentTask.id}
          request={approvalRequest}
          onComplete={handleApprovalComplete}
        />
      )}
    </div>
  );
}
