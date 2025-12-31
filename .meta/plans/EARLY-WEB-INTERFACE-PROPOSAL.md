# Early Web Interface Proposal

**Date**: 2025-12-30
**Status**: Pending Approval

---

## Summary

Add a **simple web interface** immediately after the Design System checkpoint (CP2) that allows users to:

1. **Prompt the orchestrator** with an app idea
2. **See real-time feedback** from all agents in a chat-like interface
3. **View design outputs** (mockups, stylesheets, screens, flows)
4. **Have oversight** of agent activity as they work

This interface will be placed in `apps/web/` and will be **overwritten** by the full dashboard in CP10.

---

## Proposed Location

```
CP2: DESIGN SYSTEM
├── 20-UI-DESIGNER-AGENT.md
├── 21-DESIGN-TOKENS.md
├── 22-USER-FLOWS.md
├── 23-DESIGN-WORKFLOW.md
├── 24-ACTIVITY-SYSTEM.md
└── 24a-EARLY-WEB-INTERFACE.md  ◀── NEW STEP
```

**Why here?**
- Comes immediately after design agents are functional
- Activity System (Step 24) provides the real-time event stream needed
- NestJS API with SSE is already available from CP0
- Before Git Worktrees (CP3) - no development agents needed yet
- Allows testing the orchestrator → design flow visually

---

## Step 24a: Early Web Interface

### Objective

Create a minimal React application that provides:

1. **Prompt Input** - Text area to enter app ideas
2. **Agent Activity Feed** - Real-time chat showing all agent messages
3. **Design Gallery** - View mockups, stylesheets, flows created by UI Designer
4. **Approval Interface** - Approve/reject designs when prompted

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EARLY WEB INTERFACE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Prompt Bar                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ ┌────────┐│
│  │ Build a task management app with user auth and categories   │ │  Run   ││
│  └─────────────────────────────────────────────────────────────┘ └────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────┬─────────────────────────────────────────┐
│  Agent Activity Feed              │  Design Preview                          │
│                                   │                                          │
│  ┌─────────────────────────────┐  │  ┌─────────────────────────────────────┐│
│  │ 🤖 Orchestrator             │  │  │  [Mockup Preview]                   ││
│  │ Analyzing task...           │  │  │                                     ││
│  │ Type: feature               │  │  │  ┌───────────────────────────────┐  ││
│  │ Complexity: moderate        │  │  │  │                               │  ││
│  └─────────────────────────────┘  │  │  │     Login Page Mockup         │  ││
│                                   │  │  │                               │  ││
│  ┌─────────────────────────────┐  │  │  │  ┌─────────────────────────┐  │  ││
│  │ 📋 Project Manager          │  │  │  │  │  Email: [_________]    │  │  ││
│  │ Breaking down into tasks:   │  │  │  │  │  Pass:  [_________]    │  │  ││
│  │ • User authentication       │  │  │  │  │  [Login]              │  │  ││
│  │ • Task CRUD                 │  │  │  │  └─────────────────────────┘  │  ││
│  │ • Categories                │  │  │  │                               │  ││
│  └─────────────────────────────┘  │  │  └───────────────────────────────┘  ││
│                                   │  │                                      ││
│  ┌─────────────────────────────┐  │  │  [Stylesheet]  [User Flow]  [Tokens]││
│  │ 🎨 UI Designer              │  │  │                                      ││
│  │ Creating mockups...         │  │  │  ┌──────────────┐ ┌──────────────┐  ││
│  │ ✓ Login page               │  │  │  │   Approve    │ │   Reject     │  ││
│  │ ✓ Dashboard                │  │  │  └──────────────┘ └──────────────┘  ││
│  │ ✓ Task list                │  │  │                                      ││
│  └─────────────────────────────┘  │  └─────────────────────────────────────┘│
│                                   │                                          │
│  ┌─────────────────────────────┐  │  Files Created:                         │
│  │ ⏳ Awaiting Approval        │  │  • designs/mockups/login.html           │
│  │ Please review the designs   │  │  • designs/mockups/dashboard.html       │
│  │ and approve to continue.    │  │  • designs/styles/tokens.css            │
│  └─────────────────────────────┘  │  • designs/flows/auth-flow.md           │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

### Technical Stack (Minimal)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React 18 | Same as final dashboard |
| Bundler | Vite | Fast dev experience |
| Styling | Tailwind CSS | Utility-first, quick styling |
| State | React useState/useReducer | No external deps needed |
| Real-time | EventSource (SSE) | Already in NestJS API |
| HTTP | fetch | Native, no deps needed |

### Key Features

#### 1. Prompt Input
```typescript
// Simple prompt form
const PromptBar = () => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async () => {
    const response = await fetch('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({ prompt, projectId }),
    });
    const task = await response.json();
    startEventStream(task.id);
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button type="submit">Run</button>
    </form>
  );
};
```

#### 2. Agent Activity Feed (SSE)
```typescript
// Real-time agent activity using Server-Sent Events
const AgentFeed = ({ taskId }) => {
  const [events, setEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/tasks/${taskId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [...prev, {
        agent: data.currentAgent,
        status: data.status,
        message: formatAgentMessage(data),
        timestamp: new Date(),
      }]);
    };

    return () => eventSource.close();
  }, [taskId]);

  return (
    <div className="agent-feed">
      {events.map((event, i) => (
        <AgentMessage key={i} event={event} />
      ))}
    </div>
  );
};
```

#### 3. Design Preview
```typescript
// View design outputs
const DesignPreview = ({ taskId }) => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<Artifact | null>(null);

  // Fetch artifacts when agent completes
  useEffect(() => {
    fetch(`/api/v1/tasks/${taskId}/artifacts`)
      .then(r => r.json())
      .then(setArtifacts);
  }, [taskId]);

  return (
    <div className="design-preview">
      <div className="artifact-tabs">
        {artifacts.map(a => (
          <button
            key={a.id}
            onClick={() => setSelected(a)}
            className={selected?.id === a.id ? 'active' : ''}
          >
            {a.type === 'mockup' ? '🎨' : a.type === 'stylesheet' ? '📝' : '📊'}
            {a.name}
          </button>
        ))}
      </div>

      <div className="artifact-content">
        {selected?.type === 'mockup' && (
          <iframe srcDoc={selected.content} />
        )}
        {selected?.type === 'stylesheet' && (
          <pre><code>{selected.content}</code></pre>
        )}
        {selected?.type === 'flow' && (
          <div className="markdown">{renderMarkdown(selected.content)}</div>
        )}
      </div>
    </div>
  );
};
```

#### 4. Approval Interface
```typescript
// Approve/reject when orchestrator pauses
const ApprovalInterface = ({ taskId, request, onComplete }) => {
  const handleApproval = async (approved: boolean, feedback?: string) => {
    await fetch(`/api/v1/tasks/${taskId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved, feedback }),
    });
    onComplete();
  };

  return (
    <div className="approval-interface">
      <h3>Review Required</h3>
      <p>{request.description}</p>

      <div className="approval-buttons">
        <button
          className="approve"
          onClick={() => handleApproval(true)}
        >
          ✓ Approve
        </button>
        <button
          className="reject"
          onClick={() => {
            const feedback = prompt('Rejection reason?');
            handleApproval(false, feedback);
          }}
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
};
```

### File Structure

```
apps/web/
├── src/
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Main app component
│   ├── components/
│   │   ├── PromptBar.tsx        # Prompt input
│   │   ├── AgentFeed.tsx        # Activity stream
│   │   ├── AgentMessage.tsx     # Single agent message
│   │   ├── DesignPreview.tsx    # Design viewer
│   │   ├── ArtifactViewer.tsx   # Individual artifact
│   │   └── ApprovalDialog.tsx   # Approval UI
│   ├── hooks/
│   │   ├── useTaskStream.ts     # SSE hook
│   │   └── useArtifacts.ts      # Artifact fetching
│   └── styles/
│       └── main.css             # Tailwind + custom styles
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

### API Endpoints Required (Already in CP0)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/tasks` | POST | Create new task |
| `/api/v1/tasks/:id` | GET | Get task status |
| `/api/v1/tasks/:id/stream` | GET (SSE) | Real-time events |
| `/api/v1/tasks/:id/artifacts` | GET | Get design artifacts |
| `/api/v1/tasks/:id/approve` | POST | Submit approval |

### New API Endpoint Needed

One new endpoint for artifacts:

```typescript
// apps/api/src/modules/tasks/tasks.controller.ts
@Get(':id/artifacts')
@ApiOperation({ summary: 'Get task artifacts (designs, files)' })
async getArtifacts(
  @TenantContext() tenant: { tenantId: string },
  @Param('id') id: string,
): Promise<ArtifactDto[]> {
  return this.tasksService.getArtifacts(tenant.tenantId, id);
}
```

---

## Updated Implementation Flow

```
CP2: DESIGN SYSTEM ───────────────────────────────────────────────────────────
│
├── 20-UI-DESIGNER-AGENT ──▶ 21-DESIGN-TOKENS ──▶ 22-USER-FLOWS
│   [Mockup generation]       [Theming]           [Flow diagrams]
│                                                       │
│                                                       ▼
├── 23-DESIGN-WORKFLOW ──▶ 24-ACTIVITY-SYSTEM ──▶ 24a-EARLY-WEB-INTERFACE
│   [Competitive design]      [Real-time stream]      [Simple React UI]
│                                                           │
│   ╔═══════════════════════════════════════════════════════╧════════════╗
│   ║  At this point you can:                                             ║
│   ║  • Open http://localhost:5173                                       ║
│   ║  • Enter "Build a task management app"                              ║
│   ║  • Watch agents work in real-time                                   ║
│   ║  • View and approve designs                                         ║
│   ╚════════════════════════════════════════════════════════════════════╝
│                                                           │
▼                                                           ▼
CP3: GIT WORKTREES ───────────────────────────────────────────────────────────
```

---

## Validation Checklist

```
□ Early Web Interface (Step 24a)
  □ React app builds and runs at localhost:5173
  □ Prompt bar submits to API
  □ SSE connection receives agent events
  □ Agent messages display in feed with agent name
  □ Timestamps show for each message
  □ Mockup HTML renders in iframe
  □ Stylesheet displays with syntax highlighting
  □ Flow diagrams render as markdown
  □ Approval dialog appears when required
  □ Approve/Reject updates task state
  □ Responsive layout works on mobile
```

---

## Why Before CP10?

| Aspect | Early Web (24a) | Full Dashboard (CP10) |
|--------|-----------------|----------------------|
| Purpose | Test orchestrator visually | Production-ready UI |
| Complexity | ~500 lines | ~10,000+ lines |
| Features | Prompt + feed + preview | Full project management |
| State mgmt | useState only | Zustand + TanStack Query |
| Router | None (single page) | TanStack Router |
| Auth | Hardcoded dev token | Full auth flow |
| Will overwrite? | Yes, in CP10 | Final version |

---

## Impact on Plan

### Changes Required

1. **Add Step 24a** to CP2-DESIGN-SYSTEM
2. **Update 00-OVERVIEW.md** - Add step to flow diagram
3. **Update CHECKPOINTS.md** - Add validation criteria
4. **Total steps**: 64 → 65

### No Renumbering Needed

Using "24a" preserves all existing step numbers. CP3 still starts at step 25.

---

## Recommendation

**Approve this addition** because:

1. **Immediate value** - Can test the orchestrator visually early
2. **Low effort** - ~500 lines of React, using existing API
3. **No disruption** - Uses "24a" numbering, no renumbering
4. **Will be replaced** - Clean overwrite in CP10
5. **Developer experience** - Much better than CLI-only testing
6. **Oversight** - Can watch agents work, catch issues early

---

## Next Steps (Upon Approval)

1. Create `IMPLEMENTATION/CP2-DESIGN-SYSTEM/24a-EARLY-WEB-INTERFACE.md`
2. Update `00-OVERVIEW.md` with new step
3. Update `CHECKPOINTS.md` with validation criteria
4. Add artifacts endpoint to NestJS API spec
