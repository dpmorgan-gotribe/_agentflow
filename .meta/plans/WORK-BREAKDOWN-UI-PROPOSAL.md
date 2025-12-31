# Work Breakdown Display Enhancement

**Date**: 2025-12-30
**Status**: Pending Approval
**Affects**: Step 24a (Early Web Interface)

---

## Phased Implementation Placement

### Where This Belongs

| Checkpoint | Step | What | When Testable |
|------------|------|------|---------------|
| CP1 | 16-PROJECT-MANAGER | Creates work breakdown data | End of CP1 |
| CP2 | 24a-EARLY-WEB-INTERFACE | **Displays work breakdown UI** | End of CP2 |

### Why Step 24a (Not a New Step)

1. **Data already exists** - PM agent (Step 16) creates the work breakdown structure
2. **UI component** - Displaying it is a feature of the web interface, not separate functionality
3. **Same checkpoint** - Work breakdown display is validated at CP2 completion
4. **No renumbering** - Extends 24a rather than adding 24b

### Testable At CP2 Completion

When CP2 is complete, users can:
```
□ Open http://localhost:5173
□ Enter "Build a task management app"
□ See Project Manager create work breakdown structure ← NEW
□ View epics, features, and tasks in tree view ← NEW
□ Watch task status update as agents complete work ← NEW
□ View and approve designs
```

### Phase 2 (v1.0) Rollout Coverage

From `PHASED-ROLLOUT.md`:
- Phase 2 includes CP1-CP4
- Work breakdown visibility is a Phase 2 feature
- Full agent suite with visible project planning

---

## Summary

Enhance the Early Web Interface (Step 24a) to display the **work breakdown structure** created by the Project Manager agent. This gives users visibility into:

1. **Epics** - Large initiatives with objectives
2. **Features** - Deliverable units with user stories
3. **Tasks** - Atomic work items with status tracking

---

## Current State

The Early Web Interface currently shows:
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Prompt Bar                                                              │
├─────────────────────────────┬───────────────────────────────────────────┤
│  Agent Activity Feed        │  Design Preview                           │
│  (real-time SSE events)     │  (mockups, stylesheets, flows)            │
└─────────────────────────────┴───────────────────────────────────────────┘
```

**Missing**: The hierarchical project plan from Project Manager

---

## Proposed Enhancement

### New Layout (Three Columns)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Prompt Bar                                                                      │
├──────────────────────┬────────────────────────────┬─────────────────────────────┤
│  Work Breakdown      │  Agent Activity Feed       │  Design Preview             │
│                      │                            │                             │
│  ▼ Epic: Auth System │  🤖 Orchestrator           │  ┌───────────────────────┐  │
│    ├─ Feature: Login │  Analyzing task...         │  │   Login Mockup        │  │
│    │  ├─ ✓ Design    │                            │  │                       │  │
│    │  ├─ → Frontend  │  📋 Project Manager        │  └───────────────────────┘  │
│    │  └─ ○ Testing   │  Created breakdown:        │                             │
│    │                 │  • 2 epics, 5 features     │  [Mockups] [Styles] [Flows] │
│    └─ Feature: OAuth │  • 12 tasks total          │                             │
│       ├─ ○ Design    │                            │                             │
│       └─ ○ Backend   │  🎨 UI Designer            │                             │
│                      │  Working on Login page...  │                             │
│  ▼ Epic: Dashboard   │                            │                             │
│    └─ Feature: Home  │                            │                             │
│                      │                            │                             │
├──────────────────────┴────────────────────────────┴─────────────────────────────┤
│  Summary: 2 epics | 5 features | 12 tasks | 2 completed | 1 in progress         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Task Status Icons

| Icon | Status | Description |
|------|--------|-------------|
| ○ | pending | Not yet started |
| → | in_progress | Agent currently working |
| ✓ | completed | Task finished successfully |
| ✗ | failed | Task failed (may retry) |
| ⏸ | blocked | Waiting on dependency |

---

## New Components

### 1. WorkBreakdownPanel.tsx

```typescript
interface WorkBreakdownPanelProps {
  taskId: string | undefined;
}

export function WorkBreakdownPanel({ taskId }: WorkBreakdownPanelProps) {
  const { breakdown, loading } = useWorkBreakdown(taskId);

  if (!taskId || !breakdown) {
    return <EmptyState />;
  }

  return (
    <div className="work-breakdown">
      <Summary breakdown={breakdown} />
      {breakdown.epics.map(epic => (
        <EpicCard key={epic.id} epic={epic} />
      ))}
    </div>
  );
}
```

### 2. EpicCard.tsx

```typescript
interface EpicCardProps {
  epic: Epic;
}

export function EpicCard({ epic }: EpicCardProps) {
  const [expanded, setExpanded] = useState(true);
  const progress = calculateProgress(epic);

  return (
    <div className="epic-card">
      <div className="epic-header" onClick={() => setExpanded(!expanded)}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span className="epic-title">{epic.title}</span>
        <ProgressBar value={progress} />
      </div>
      {expanded && (
        <div className="epic-features">
          {epic.features.map(feature => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. FeatureCard.tsx

```typescript
interface FeatureCardProps {
  feature: Feature;
}

export function FeatureCard({ feature }: FeatureCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="feature-card">
      <div className="feature-header">
        <span className={`priority priority-${feature.priority}`}>
          {feature.priority}
        </span>
        <span className="feature-title">{feature.title}</span>
      </div>
      <div className="feature-user-story">{feature.userStory}</div>
      {expanded && (
        <div className="feature-tasks">
          {feature.tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 4. TaskCard.tsx

```typescript
interface TaskCardProps {
  task: Task;
}

const STATUS_ICONS = {
  pending: '○',
  in_progress: '→',
  completed: '✓',
  failed: '✗',
  blocked: '⏸',
};

const TYPE_COLORS = {
  design: 'text-pink-400',
  frontend: 'text-blue-400',
  backend: 'text-green-400',
  database: 'text-yellow-400',
  testing: 'text-purple-400',
  // ...
};

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className={`task-card task-${task.status}`}>
      <span className="task-status">{STATUS_ICONS[task.status]}</span>
      <span className={`task-type ${TYPE_COLORS[task.type]}`}>
        [{task.type}]
      </span>
      <span className="task-title">{task.title}</span>
      <span className="task-complexity">{task.complexity}</span>
      {task.assignedAgents.length > 0 && (
        <span className="task-agents">
          {task.assignedAgents.join(', ')}
        </span>
      )}
    </div>
  );
}
```

### 5. BreakdownSummary.tsx

```typescript
interface BreakdownSummaryProps {
  breakdown: WorkBreakdown;
}

export function BreakdownSummary({ breakdown }: BreakdownSummaryProps) {
  const { summary } = breakdown;

  return (
    <div className="breakdown-summary">
      <span>{summary.totalEpics} epics</span>
      <span>{summary.totalFeatures} features</span>
      <span>{summary.totalTasks} tasks</span>
      <span className="text-green-400">
        {getCompletedCount(breakdown)} completed
      </span>
      <span className="text-yellow-400">
        {getInProgressCount(breakdown)} in progress
      </span>
    </div>
  );
}
```

---

## New Hook

### useWorkBreakdown.ts

```typescript
export function useWorkBreakdown(taskId: string | undefined) {
  const [breakdown, setBreakdown] = useState<WorkBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setBreakdown(null);
      return;
    }

    let cancelled = false;

    const fetchBreakdown = async () => {
      setLoading(true);
      try {
        const data = await getWorkBreakdown(taskId);
        if (!cancelled) {
          setBreakdown(data);
        }
      } catch (error) {
        console.error('Failed to fetch breakdown:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchBreakdown();

    // Poll for updates (task status changes)
    const interval = setInterval(fetchBreakdown, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId]);

  return { breakdown, loading };
}
```

---

## New API Endpoint

### GET /api/v1/tasks/:id/breakdown

**Response:**
```typescript
interface WorkBreakdownResponse {
  epics: Epic[];
  summary: WorkBreakdownSummary;
  suggestedOrder: string[];
  parallelizable: string[][];
  currentTaskId?: string; // Currently executing task
}
```

### NestJS Implementation

```typescript
// apps/api/src/modules/tasks/tasks.controller.ts

@Get(':id/breakdown')
@ApiOperation({ summary: 'Get task work breakdown structure' })
@ApiResponse({ status: 200, type: WorkBreakdownDto })
async getWorkBreakdown(
  @TenantContext() tenant: { tenantId: string },
  @Param('id') id: string,
): Promise<WorkBreakdownDto> {
  return this.tasksService.getWorkBreakdown(tenant.tenantId, id);
}
```

```typescript
// apps/api/src/modules/tasks/tasks.service.ts

async getWorkBreakdown(tenantId: string, taskId: string): Promise<WorkBreakdownDto> {
  // Get task to verify access
  await this.findOne(tenantId, taskId);

  // Get from checkpoint state
  const checkpoint = await this.checkpointer.getTuple({
    configurable: { thread_id: taskId },
  });

  if (!checkpoint?.checkpoint) {
    return { epics: [], summary: createEmptySummary() };
  }

  const state = checkpoint.checkpoint as OrchestratorStateType;

  // Find PM output with work breakdown
  const pmOutput = state.agentOutputs?.find(
    o => o.agentId === 'project_manager'
  );

  if (!pmOutput?.result?.epics) {
    return { epics: [], summary: createEmptySummary() };
  }

  // Enrich with current status
  const enrichedEpics = this.enrichWithStatus(
    pmOutput.result.epics,
    state
  );

  return {
    epics: enrichedEpics,
    summary: pmOutput.result.summary,
    suggestedOrder: pmOutput.result.suggestedOrder,
    parallelizable: pmOutput.result.parallelizable,
    currentTaskId: state.currentTaskId,
  };
}

private enrichWithStatus(epics: Epic[], state: OrchestratorStateType): Epic[] {
  // Map task IDs to their current status based on agent outputs
  const taskStatus = new Map<string, TaskStatus>();

  for (const output of state.agentOutputs || []) {
    if (output.taskId) {
      taskStatus.set(output.taskId, output.success ? 'completed' : 'failed');
    }
  }

  if (state.currentTaskId) {
    taskStatus.set(state.currentTaskId, 'in_progress');
  }

  // Apply status to all tasks
  return epics.map(epic => ({
    ...epic,
    features: epic.features.map(feature => ({
      ...feature,
      tasks: feature.tasks.map(task => ({
        ...task,
        status: taskStatus.get(task.id) || 'pending',
      })),
    })),
  }));
}
```

---

## New Types

### src/types.ts (additions)

```typescript
// Work breakdown types (matching Project Manager output)

export type TaskType =
  | 'design'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'testing'
  | 'integration'
  | 'documentation'
  | 'devops'
  | 'review';

export type Complexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

export interface WorkTask {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  complexity: Complexity;
  status: TaskStatus;
  dependencies: string[];
  acceptanceCriteria: string[];
  assignedAgents: string[];
  complianceRelevant: boolean;
  tags: string[];
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  userStory: string;
  tasks: WorkTask[];
  acceptanceCriteria: string[];
  priority: Priority;
  dependencies: string[];
  complianceRelevant: boolean;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  objective: string;
  features: Feature[];
  successMetrics: string[];
  risks: Array<{
    description: string;
    mitigation: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface WorkBreakdownSummary {
  totalEpics: number;
  totalFeatures: number;
  totalTasks: number;
  complexityDistribution: Record<Complexity, number>;
  taskTypeDistribution: Record<TaskType, number>;
  estimatedTotalEffort: string;
  criticalPath: string[];
  complianceTaskCount: number;
}

export interface WorkBreakdown {
  epics: Epic[];
  summary: WorkBreakdownSummary;
  suggestedOrder: string[];
  parallelizable: string[][];
  currentTaskId?: string;
}
```

---

## Updated App Layout

### src/App.tsx (modified)

```typescript
export default function App() {
  // ... existing state ...

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold text-primary">
          Aigentflow <span className="text-gray-500 text-sm">Early Preview</span>
        </h1>
      </header>

      {/* Prompt Bar */}
      <div className="border-b border-gray-800 p-4">
        <PromptBar
          onTaskCreated={handleTaskCreated}
          disabled={currentTask?.status === 'running'}
        />
      </div>

      {/* Main Content - Three Columns */}
      <div className="flex h-[calc(100vh-180px)]">
        {/* Work Breakdown */}
        <div className="w-1/4 border-r border-gray-800 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">
            Work Breakdown
          </h2>
          <WorkBreakdownPanel taskId={currentTask?.id} />
        </div>

        {/* Agent Feed */}
        <div className="w-1/2 border-r border-gray-800 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">
            Agent Activity
          </h2>
          <AgentFeed
            taskId={currentTask?.id}
            events={events}
            onEvent={handleEvent}
          />
        </div>

        {/* Design Preview */}
        <div className="w-1/4 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">
            Design Preview
          </h2>
          <DesignPreview taskId={currentTask?.id} />
        </div>
      </div>

      {/* Summary Bar */}
      <div className="border-t border-gray-800 p-3 bg-gray-800/50">
        <BreakdownSummary taskId={currentTask?.id} />
      </div>

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
```

---

## Updated Validation Checklist

Add to Step 24a validation:

```
□ Work Breakdown Display
  □ Epics display with expand/collapse
  □ Features display with priority badges
  □ Tasks display with status icons
  □ Task types show with color coding
  □ Dependencies indicated visually
  □ Progress updates in real-time
  □ Summary bar shows counts
  □ Completed tasks marked with checkmark
  □ In-progress task highlighted
  □ Complexity shown for each task
  □ Assigned agents displayed
```

---

## Implementation Steps

1. **Add new types** to `src/types.ts`
2. **Create API endpoint** `GET /tasks/:id/breakdown` in NestJS
3. **Create hook** `useWorkBreakdown.ts`
4. **Create components**:
   - `WorkBreakdownPanel.tsx`
   - `EpicCard.tsx`
   - `FeatureCard.tsx`
   - `TaskCard.tsx`
   - `BreakdownSummary.tsx`
5. **Update layout** in `App.tsx` to three columns
6. **Add styles** for work breakdown display
7. **Update tests** to cover new components

---

## Why This Matters

1. **Visibility** - Users see the full project plan, not just activity
2. **Progress tracking** - Clear indication of what's done and what's next
3. **Understanding** - See how the PM broke down their request
4. **Debugging** - Identify where in the workflow issues occur
5. **Approval context** - Know what you're approving in relation to the plan

---

## Recommendation

**Approve this enhancement** because:

1. **Complete picture** - Users need to see the work breakdown to understand what's happening
2. **Already available** - PM agent already creates this structure, we just need to display it
3. **Minimal API work** - One new endpoint that reads existing checkpoint data
4. **Better UX** - Three-column layout provides comprehensive view
5. **Progress visibility** - Real-time status updates as agents complete tasks

---

## Files to Create/Modify

### New Files:
```
apps/web/src/components/WorkBreakdownPanel.tsx
apps/web/src/components/EpicCard.tsx
apps/web/src/components/FeatureCard.tsx
apps/web/src/components/TaskCard.tsx
apps/web/src/components/BreakdownSummary.tsx
apps/web/src/hooks/useWorkBreakdown.ts
```

### Modified Files:
```
apps/web/src/App.tsx (layout change)
apps/web/src/types.ts (new types)
apps/web/src/api.ts (new API call)
apps/web/src/styles/main.css (new styles)
apps/api/src/modules/tasks/tasks.controller.ts (new endpoint)
apps/api/src/modules/tasks/tasks.service.ts (new method)
IMPLEMENTATION/CP2-DESIGN-SYSTEM/24a-EARLY-WEB-INTERFACE.md (update)
```

---

## Upon Approval

1. Update `24a-EARLY-WEB-INTERFACE.md` with work breakdown components
2. Update validation checklist
3. Update the file structure in the step document
