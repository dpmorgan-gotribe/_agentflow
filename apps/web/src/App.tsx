import { useState, useCallback, useMemo } from 'react';
import { Header } from './components/layout/Header';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { ActiveAgentsPanel } from './components/layout/ActiveAgentsPanel';
import { RightSidebar } from './components/layout/RightSidebar';
import { BottomBar } from './components/layout/BottomBar';
import { MainContent } from './components/layout/MainContent';
import { ApprovalDialog } from './components/ApprovalDialog';
import type { Task, AgentEvent, ApprovalRequest, ActiveAgent, AgentType, ExtendedAgentEvent } from './types';

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

  // Derived state for orchestrator events (for right sidebar)
  const orchestratorEvents = useMemo((): ExtendedAgentEvent[] =>
    (events as ExtendedAgentEvent[])
      .filter((e) => e.agent === 'orchestrator' || e.agent === 'system')
      .slice(-20),
    [events]
  );

  // Derive active agents from events (excluding orchestrator which is always on)
  const activeAgents = useMemo((): ActiveAgent[] => {
    const agentMap = new Map<AgentType, ActiveAgent>();

    for (const event of events) {
      const agentType = event.agent;
      // Skip system and orchestrator (orchestrator is always on, no need to show)
      if (!agentType || agentType === 'system' || agentType === 'orchestrator') continue;

      const existing = agentMap.get(agentType);

      if (event.status === 'agent_working' || event.status === 'analyzing' || event.status === 'orchestrating') {
        agentMap.set(agentType, {
          type: agentType,
          status: 'working',
          startedAt: existing?.startedAt || event.timestamp,
          message: event.message?.split('\n')[0],
          artifactCount: event.artifacts?.length,
        });
      } else if (event.status === 'completed') {
        agentMap.set(agentType, {
          type: agentType,
          status: 'completed',
          startedAt: existing?.startedAt,
          completedAt: event.timestamp,
          message: event.message?.split('\n')[0],
          artifactCount: event.artifacts?.length || existing?.artifactCount,
        });
      } else if (event.status === 'failed') {
        agentMap.set(agentType, {
          type: agentType,
          status: 'failed',
          startedAt: existing?.startedAt,
          completedAt: event.timestamp,
          message: event.message?.split('\n')[0],
        });
      }
    }

    // Sort: working agents first, then completed, then failed
    const statusOrder = { working: 0, completed: 1, failed: 2, idle: 3 };
    return Array.from(agentMap.values()).sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status]
    );
  }, [events]);

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
        {/* Left Sidebar - Project, Git, Files */}
        <LeftSidebar
          currentProjectId={currentProjectId}
          onProjectChange={handleProjectChange}
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
          onEvent={handleEvent}
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
