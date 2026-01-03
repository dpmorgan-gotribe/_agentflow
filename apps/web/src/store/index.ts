/**
 * Zustand store with localStorage persistence
 *
 * Persists critical state across page refreshes:
 * - Current project and task
 * - Agent events (last 100 per task)
 * - UI state (active tab, execution status)
 * - Approval requests
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Task,
  AgentEvent,
  ApprovalRequest,
  ActiveAgent,
  ExtendedAgentEvent,
  Project,
} from '../types';

/** Maximum events to persist per task */
const MAX_EVENTS_PER_TASK = 100;

/** View tab types */
export type ViewTab = 'activity' | 'kanban' | 'viewer' | 'design' | 'planning';

/** Design workflow phase */
export type DesignPhase = 'research' | 'stylesheet' | 'screens' | 'complete';

/** Store state interface */
interface AppState {
  // Project state
  currentProjectId: string | null;
  projects: Project[];

  // Task state
  currentTask: Task | null;
  events: AgentEvent[];
  approvalRequest: ApprovalRequest | null;

  // Design phase state
  designPhase: DesignPhase;
  stylesheetApproved: boolean;
  screensApproved: boolean;

  // UI state
  activeTab: ViewTab;
  isExecuting: boolean;

  // Actions
  setCurrentProjectId: (projectId: string | null) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  setCurrentTask: (task: Task | null) => void;
  addEvent: (event: AgentEvent) => void;
  setEvents: (events: AgentEvent[]) => void;
  clearEvents: () => void;
  setApprovalRequest: (request: ApprovalRequest | null) => void;
  setActiveTab: (tab: ViewTab) => void;
  setIsExecuting: (isExecuting: boolean) => void;

  // Design phase actions
  setDesignPhase: (phase: DesignPhase) => void;
  approveStylesheet: () => void;
  approveScreens: () => void;
  resetDesignPhase: () => void;

  // Composite actions
  handleTaskCreated: (task: Task) => void;
  handleProjectChange: (projectId: string) => void;
  handleEvent: (event: AgentEvent) => void;
  handleApprovalComplete: () => void;
  handlePause: () => void;
  handleStop: () => void;
  resetSession: () => void;
}

/** Compute active agents from events */
function computeActiveAgents(events: AgentEvent[]): ActiveAgent[] {
  const agentMap = new Map<string, ActiveAgent>();

  // Debug: Log agent events being processed
  const agentEvents = events.filter(e => e.agent && e.agent !== 'system' && e.agent !== 'orchestrator');
  if (agentEvents.length > 0) {
    console.log('[Store Debug] Processing agent events:', agentEvents.map(e => ({
      agent: e.agent,
      status: e.status,
      message: e.message?.substring(0, 50),
    })));
  }

  for (const event of events) {
    const agentType = event.agent;
    // Skip system and orchestrator (only show sub-agents)
    if (!agentType || agentType === 'system' || agentType === 'orchestrator') continue;

    // Use executionId if available (for parallel agents), otherwise use agent type + timestamp
    const extEvent = event as ExtendedAgentEvent;
    const executionId = extEvent.parallelExecution?.agentId;
    const key = executionId
      ? `${agentType}-${executionId}`
      : agentType;

    // Check for agent working statuses (agent_working, analyzing)
    // Also include 'orchestrating' when we have a valid non-orchestrator agent (routing to agent)
    // And 'pending' as initial state for agents about to work
    const isAgentWorking = event.status === 'agent_working' ||
                           event.status === 'analyzing' ||
                           event.status === 'orchestrating' ||
                           event.status === 'pending';

    if (isAgentWorking) {
      // Agent started working - add to map
      const existing = agentMap.get(key);
      agentMap.set(key, {
        type: agentType,
        status: 'working',
        startedAt: existing?.startedAt || event.timestamp,
        message: event.message?.split('\n')[0],
        artifactCount: event.artifacts?.length,
        executionId,
        // Preserve existing activity or use new activity
        activity: extEvent.activity || existing?.activity,
      });
    } else if (event.status === 'completed' || event.status === 'failed') {
      // Agent finished - update status and merge activity
      const existing = agentMap.get(key);
      agentMap.set(key, {
        type: agentType,
        status: event.status === 'completed' ? 'completed' : 'failed',
        startedAt: existing?.startedAt || event.timestamp,
        completedAt: event.timestamp,
        message: event.message?.split('\n')[0],
        artifactCount: event.artifacts?.length,
        executionId: existing?.executionId || executionId,
        // Merge activity: prefer new activity, fall back to existing
        activity: extEvent.activity || existing?.activity,
      });
    }
  }

  // Return all agents, sorted by start time (working first, then completed)
  return Array.from(agentMap.values()).sort((a, b) => {
    // Working agents first
    if (a.status === 'working' && b.status !== 'working') return -1;
    if (b.status === 'working' && a.status !== 'working') return 1;
    // Then by start time
    return new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime();
  });
}

/** Compute orchestrator events from all events */
function computeOrchestratorEvents(events: AgentEvent[]): ExtendedAgentEvent[] {
  return (events as ExtendedAgentEvent[])
    .filter((e) => e.agent === 'orchestrator' || e.agent === 'system')
    .slice(-20);
}

/** Create the store with persistence */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentProjectId: null,
      projects: [],
      currentTask: null,
      events: [],
      approvalRequest: null,
      activeTab: 'activity',
      isExecuting: false,
      designPhase: 'research',
      stylesheetApproved: false,
      screensApproved: false,

      // Basic setters
      setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),
      setProjects: (projects) => set({ projects }),
      addProject: (project) => set((state) => ({
        projects: [...state.projects, project],
      })),
      setCurrentTask: (task) => set({ currentTask: task }),
      addEvent: (event) => set((state) => ({
        events: [...state.events, event].slice(-MAX_EVENTS_PER_TASK),
      })),
      setEvents: (events) => set({ events: events.slice(-MAX_EVENTS_PER_TASK) }),
      clearEvents: () => set({ events: [] }),
      setApprovalRequest: (request) => set({ approvalRequest: request }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setIsExecuting: (isExecuting) => set({ isExecuting }),

      // Design phase actions
      setDesignPhase: (phase) => set({ designPhase: phase }),
      approveStylesheet: () => set({
        stylesheetApproved: true,
        designPhase: 'screens',
      }),
      approveScreens: () => set({
        screensApproved: true,
        designPhase: 'complete',
      }),
      resetDesignPhase: () => set({
        designPhase: 'research',
        stylesheetApproved: false,
        screensApproved: false,
      }),

      // Composite actions
      handleTaskCreated: (task) => set({
        currentTask: task,
        currentProjectId: task.projectId,
        events: [],
        approvalRequest: null,
        isExecuting: true,
        activeTab: 'activity',
        designPhase: 'research',
        stylesheetApproved: false,
        screensApproved: false,
      }),

      handleProjectChange: (projectId) => set({
        // Convert empty string to null for proper clearing
        currentProjectId: projectId || null,
        currentTask: null,
        events: [],
        approvalRequest: null,
        isExecuting: false,
      }),

      handleEvent: (event) => {
        const state = get();
        const newEvents = [...state.events, event].slice(-MAX_EVENTS_PER_TASK);

        const updates: Partial<AppState> = { events: newEvents };

        // Check for approval request
        if (event.status === 'awaiting_approval' && event.approvalRequest) {
          updates.approvalRequest = event.approvalRequest;
          updates.isExecuting = false;
        }

        // Check for completion
        if (event.status === 'completed' || event.status === 'failed') {
          updates.isExecuting = false;
        }

        set(updates);
      },

      handleApprovalComplete: () => set({
        approvalRequest: null,
        isExecuting: true,
      }),

      handlePause: () => set({ isExecuting: false }),

      handleStop: () => set({
        isExecuting: false,
        currentTask: null,
        events: [],
      }),

      resetSession: () => set({
        currentTask: null,
        events: [],
        approvalRequest: null,
        isExecuting: false,
        activeTab: 'activity',
      }),
    }),
    {
      name: 'aigentflow-app-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        currentProjectId: state.currentProjectId,
        currentTask: state.currentTask,
        events: state.events.slice(-MAX_EVENTS_PER_TASK),
        approvalRequest: state.approvalRequest,
        activeTab: state.activeTab,
        isExecuting: state.isExecuting,
      }),
      version: 1,
    }
  )
);

/**
 * Hook to get active agents (computed from events)
 *
 * Uses useMemo to cache the computed result and prevent infinite re-renders.
 * Only recomputes when events array reference changes.
 */
export function useActiveAgents(): ActiveAgent[] {
  const events = useAppStore((state) => state.events);
  return useMemo(() => computeActiveAgents(events), [events]);
}

/**
 * Hook to get orchestrator events (computed from events)
 *
 * Uses useMemo to cache the computed result and prevent infinite re-renders.
 * Only recomputes when events array reference changes.
 */
export function useOrchestratorEvents(): ExtendedAgentEvent[] {
  const events = useAppStore((state) => state.events);
  return useMemo(() => computeOrchestratorEvents(events), [events]);
}

/** Hook to check if there's an active session to restore */
export function useHasActiveSession(): boolean {
  return useAppStore((state) => state.currentTask !== null);
}
