# AgentFlow Comprehensive Improvements Plan

**Created**: 2026-01-03
**Status**: IN_PROGRESS
**Type**: Multi-Issue Enhancement Plan
**Current Step**: Phase 4 (Design Workflow)

---

## Executive Summary

This plan addresses 10 critical issues to prepare AgentFlow for developer integration. After comprehensive codebase review, I've identified that while the foundation is solid (LangGraph orchestration, SSE streaming, agent framework), significant gaps exist in:

1. **Activity visibility** - Sub-agent details are partially implemented but not fully surfaced
2. **Orchestrator interaction** - No conversational interface exists
3. **Design workflow** - Stylesheet-first workflow is defined in schemas but not enforced
4. **State persistence** - Backend persists tasks/artifacts, but frontend loses state on refresh
5. **UI organization** - Missing dedicated tabs for Design and Planning

---

## Issue Analysis

### Issue 1: Sub-Agent Active Panel

**Current State:**
- `ActiveAgentsPanel.tsx` shows a simple list of working agents
- Uses `activeAgents` derived from events in `App.tsx`
- Shows: agent type, status (working/completed/failed), message, artifact count
- **Missing**: hooks, tools, thinking, responses, model info, multiple instances

**Root Cause:**
- `activeAgents` is keyed by `AgentType` (line 37-38 in App.tsx), so multiple UI designers collapse into one entry
- Activity data exists in events but isn't stored per-agent-instance
- No tracking of execution instances (the `executionId` from parallel dispatch)

**Proposed Solution:**

1. **Refactor active agent tracking to use `executionId` as key**
   - Each parallel agent instance gets unique key: `${agentType}-${executionId}`
   - Store full activity data per instance

2. **Create `AgentCard` component** with:
   - Header: Agent type, instance ID, model (from settings)
   - Collapsible sections: Thinking, Tools, Hooks, Response
   - Token usage metrics
   - Real-time status updates

3. **Backend enhancement:**
   - Emit `executionId` in all agent events (already in parallel dispatch)
   - Add `model` field to agent activity data

**Files to Modify:**
- `apps/web/src/App.tsx` - Refactor `activeAgents` derivation
- `apps/web/src/components/layout/ActiveAgentsPanel.tsx` - Complete rewrite
- `apps/web/src/types.ts` - Add `ActiveAgentInstance` type
- `packages/langgraph/src/utils/streaming.ts` - Add executionId to all events

---

### Issue 2: Activity Window Agent Messages

**Current State:**
- `AgentMessage.tsx` has expandable activity details section
- Shows thinking, tools, hooks, response when available
- `useTaskStream.ts` extracts activity from SSE events
- **Problem**: Activity data often missing because backend doesn't always include it

**Root Cause:**
- `agent-adapter.ts` only extracts activity when certain fields are present
- `extractActivity()` function has limited extraction logic
- Activity data isn't always propagated through the event chain

**Proposed Solution:**

1. **Enhance activity extraction in `agent-adapter.ts`**
   - Parse agent response to extract thinking blocks (`<thinking>...</thinking>`)
   - Track all tool calls with timing
   - Record hook executions

2. **Add activity store on backend**
   - Store full activity per execution in memory
   - Allow frontend to fetch detailed activity via REST endpoint

3. **Enhanced `AgentMessage` component**
   - Always show expandable section if any data exists
   - Add syntax highlighting for code in responses
   - Add search/filter within activity

**Files to Modify:**
- `apps/api/src/modules/workflow/agent-adapter.ts` - Enhance extractActivity
- `apps/api/src/modules/tasks/tasks.controller.ts` - Add activity endpoint
- `apps/web/src/components/AgentMessage.tsx` - Enhanced display

---

### Issue 3: Orchestrator Panel

**Current State:**
- `RightSidebar.tsx` shows orchestrator status and thinking
- Displays recent orchestrator events with reasoning
- **Missing**: Conversational interface, direct interaction, full history

**Root Cause:**
- Orchestrator is treated as background process, not interactive agent
- No API endpoint for sending messages to orchestrator mid-workflow
- No persistent orchestrator conversation history

**Proposed Solution:**

1. **Create OrchestratorChat component**
   - Chat-style interface similar to Claude CLI
   - Message history with timestamps
   - User input field for sending messages
   - Real-time thinking display with typewriter effect

2. **Add orchestrator interaction API**
   - `POST /api/v1/tasks/:id/orchestrator/message` - Send message to orchestrator
   - `GET /api/v1/tasks/:id/orchestrator/history` - Get conversation history
   - WebSocket upgrade option for bidirectional communication

3. **Orchestrator state machine enhancement**
   - Add `user_message_received` trigger type
   - Allow orchestrator to pause for user input at any point
   - Maintain conversation context across interactions

**Files to Create:**
- `apps/web/src/components/OrchestratorChat.tsx`
- `apps/api/src/modules/orchestrator/orchestrator.controller.ts`
- `apps/api/src/modules/orchestrator/orchestrator.service.ts`

**Files to Modify:**
- `apps/web/src/components/layout/RightSidebar.tsx` - Integrate chat
- `packages/langgraph/src/state.ts` - Add user messages channel
- `packages/langgraph/src/prompts/orchestrator-thinking.ts` - Handle user interrupts

---

### Issue 4: UI Designer Workflow

**Current State:**
- Analyst generates style packages (`StylePackage` schema exists)
- UI designers can create mega pages (kitchen sink) in parallel
- Style competition flow exists with approval gate
- **Missing**: Explicit stylesheet-first enforcement, proper sequencing

**Current Flow:**
```
Analyst → Style Packages → N Parallel UI Designers (mega page) → Approval → Full Design
```

**Required Flow:**
```
Analyst (research) → Analyst (style packages) → N UI Designers (stylesheet demo)
  → Stylesheet Approval → N UI Designers (all screens) → Screen Approval
```

**Proposed Solution:**

1. **Split design into two phases:**
   - Phase A: Stylesheet Demo (kitchen sink with all components in one page)
   - Phase B: Full Screen Generation (after stylesheet approval)

2. **Enforce workflow through orchestrator prompts**
   - Update `orchestrator-thinking.ts` to mandate stylesheet approval first
   - Add `design_phase` to state: `'stylesheet' | 'screens'`

3. **Create Stylesheet Approval Gate**
   - Special approval type for stylesheet review
   - Show component inventory with each style option
   - Allow "approve and generate screens" action

**Files to Modify:**
- `packages/langgraph/src/prompts/orchestrator-thinking.ts` - Enforce flow
- `packages/langgraph/src/state.ts` - Add design_phase channel
- `packages/langgraph/src/nodes/approve.ts` - Stylesheet approval type
- `apps/web/src/components/ApprovalDialog.tsx` - Stylesheet approval UI

---

### Issue 5: Design Tab

**Current State:**
- No dedicated Design tab exists
- `DesignPreview.tsx` shows artifacts in Activity tab
- `DesignReview.tsx` exists but isn't integrated
- `StyleCompetition.tsx` exists but only used in approval dialog

**Proposed Solution:**

1. **Create Design tab with two pages:**
   - **Mockups Page**: Kitchen sink component showcase
     - Grid of style options (during competition)
     - Selected style's mega page
     - Component inventory with live examples
   - **User Flows Page**:
     - Flow diagram (Mermaid rendered)
     - Screen panels showing each step
     - Navigation between flow steps

2. **Add approval controls to both pages**
   - "Approve Stylesheet" button on Mockups page
   - "Approve All Screens" button on User Flows page
   - Inline feedback for rejection

3. **State management:**
   - Track design phase progression
   - Show appropriate page based on workflow state

**Files to Create:**
- `apps/web/src/pages/DesignPage.tsx` - Main design page container
- `apps/web/src/components/design/MockupsPage.tsx`
- `apps/web/src/components/design/UserFlowsPage.tsx`
- `apps/web/src/components/design/ComponentShowcase.tsx`
- `apps/web/src/components/design/FlowViewer.tsx`

**Files to Modify:**
- `apps/web/src/App.tsx` - Add 'design' tab
- `apps/web/src/components/layout/Header.tsx` - Add Design tab button
- `apps/web/src/components/layout/MainContent.tsx` - Route to Design page

---

### Issue 6: Long Context for Sub-Agents

**Current State:**
- Analyst produces detailed design specs in `StyleResearchOutput`
- Context passed via `AgentContext.items[]` with token budgets
- `ContextManager` enforces 8000 token budget
- Claude CLI uses temp files for input (see `executeCliCommandWithFile`)

**Root Cause:**
- Token budget may truncate important information
- No document-passing mechanism between agents
- Context serialization may lose structure

**Proposed Solution:**

1. **Implement Artifact-based Context Passing**
   - Analyst saves design spec as artifact file (JSON/Markdown)
   - UI Designer receives artifact path, loads directly
   - Bypass token budget for file-based context

2. **Create Context Documents Store**
   - `packages/context-store/` - Dedicated package for context documents
   - Save analyst output as structured document
   - UI Designer references document by ID

3. **CLI Input Enhancement**
   - Use `--file` argument to pass context document path
   - Set `CLAUDE_CODE_MAX_OUTPUT_TOKENS=200000` for long responses

4. **Token Budget Reallocation**
   - Increase design context budget from 1000 to 4000 tokens
   - Add `unlimited` option for critical context types

**Files to Create:**
- `packages/context-store/src/index.ts`
- `packages/context-store/src/document-store.ts`

**Files to Modify:**
- `packages/agents/src/context-manager.ts` - Add document reference support
- `packages/ai-provider/src/providers/claude-cli.ts` - Add file input mode
- `apps/api/src/modules/workflow/agent-adapter.ts` - Pass document refs

---

### Issue 7: Token Efficiency

**Current State:**
- Each agent call includes full system prompt (~2-4K tokens)
- Context curation includes all previous outputs
- No caching between similar requests
- Parallel agents duplicate shared context

**Token Usage Analysis:**
```
Per Agent Call:
- System prompt: ~2,000 tokens
- User prompt: ~1,000 tokens
- Context (previous outputs): ~2,000 tokens
- Response: ~3,000 tokens
- Total: ~8,000 tokens/agent

Workflow Example (5 agents):
- Analyst: 8,000
- Architect: 10,000 (includes analyst output)
- 5x UI Designers: 5 x 12,000 = 60,000 (each includes analyst + architect)
- Project Manager: 14,000 (includes all previous)
- Total: ~92,000 tokens
```

**Proposed Optimizations:**

1. **Prompt Caching (Anthropic API feature)**
   - Cache system prompts (they're identical per agent type)
   - Saves 40-50% on repeat calls
   - Add `cache_control: { type: "ephemeral" }` to system messages

2. **Selective Context Passing**
   - UI Designer only needs: style package, component inventory
   - Don't include: architect's full output, other designer outputs
   - Implement `contextRefs` filtering in parallel dispatch

3. **Response Compression**
   - Store agent outputs in compressed format
   - Only expand when needed for context
   - Deduplicate repeated structures (design tokens appear in every UI designer output)

4. **Shared Context Deduplication**
   - Extract common context (project config, design tokens) once
   - Reference by ID in subsequent calls
   - Particularly important for parallel UI designers

5. **Streaming Token Tracking**
   - Add real-time token usage display in UI
   - Alert when approaching budget limits
   - Allow user to pause and review before expensive operations

**Estimated Savings:**
- Prompt caching: 40% on system prompts
- Selective context: 50% on context tokens
- Deduplication: 30% on parallel workflows
- **Total: ~60% reduction in token usage**

**Files to Modify:**
- `packages/ai-provider/src/providers/anthropic-api.ts` - Add cache control
- `packages/agents/src/context-manager.ts` - Selective context filtering
- `packages/langgraph/src/nodes/parallel-dispatch.ts` - Dedup shared context
- `apps/web/src/components/layout/Header.tsx` - Token usage display

---

### Issue 8: Planning Tab

**Current State:**
- Project Manager outputs Epic/Feature/Task hierarchy
- `ProjectManagerOutput` schema exists with full structure
- No UI to display the planning breakdown
- Tasks include `designReference` linking to mockups

**Proposed Solution:**

1. **Create Planning Tab with hierarchical view:**
   - Left panel: Epic list (collapsible)
   - Middle panel: Features under selected epic
   - Right panel: Tasks under selected feature

2. **Detail Modal for each item:**
   - Epic: objective, success metrics, risks
   - Feature: user story, acceptance criteria, dependencies
   - Task: complexity, assigned agents, design reference, implementation notes

3. **Integration with Design:**
   - Task design references link to mockups
   - Click to navigate to relevant design

4. **Export functionality:**
   - Export as markdown for documentation
   - Export as JSON for external tools
   - Generate GitHub issues (future)

**Files to Create:**
- `apps/web/src/pages/PlanningPage.tsx`
- `apps/web/src/components/planning/EpicList.tsx`
- `apps/web/src/components/planning/FeatureList.tsx`
- `apps/web/src/components/planning/TaskList.tsx`
- `apps/web/src/components/planning/DetailModal.tsx`

**Files to Modify:**
- `apps/web/src/App.tsx` - Add 'planning' tab
- `apps/web/src/components/layout/Header.tsx` - Add Planning tab button
- `apps/web/src/types.ts` - Add Epic, Feature, Task types

---

### Issue 9: New Project Button

**Current State:**
- Project created automatically when task submitted
- Project name inferred from prompt via `extractProjectName()`
- No explicit project creation flow
- Project directory structure created by `ProjectDirectoryService`

**Proposed Solution:**

1. **Add "New Project" button in Header**
   - Opens modal with project name input
   - Validates name (alphanumeric, no spaces → slug)
   - Creates empty project structure

2. **Modal flow:**
   - Input: Project name (required)
   - Optional: Description, tech stack hints
   - Submit: Creates directory, loads in sidebar

3. **Decouple project creation from task submission**
   - Task submission uses `currentProjectId`
   - Prompt no longer determines project name
   - Project must exist before task can be created

4. **Project structure initialization:**
   - Create `.aigentflow.json` with metadata
   - Initialize git repository
   - Create standard directories (src, docs, designs)
   - Generate initial CLAUDE.md

**Files to Create:**
- `apps/web/src/components/NewProjectModal.tsx`

**Files to Modify:**
- `apps/web/src/components/layout/Header.tsx` - Add button
- `apps/web/src/App.tsx` - Manage modal state
- `apps/api/src/modules/projects/projects.controller.ts` - Add POST /projects
- `apps/api/src/modules/tasks/tasks.service.ts` - Require existing projectId

---

### Issue 10: Session Persistence

**Current State:**
- Backend: Tasks and artifacts persisted to `.aigentflow/data/`
- Backend: Event history kept in memory (5-min TTL)
- Frontend: All state in React useState (lost on refresh)
- No localStorage or IndexedDB usage

**What Gets Lost on Refresh:**
- `events[]` - All agent activity
- `activeAgents` - Currently working agents
- `approvalRequest` - Pending approval state
- `currentTask` - Active task reference
- `currentProjectId` - Selected project
- `activeTab` - Current view

**Proposed Solution:**

1. **Frontend State Persistence (localStorage)**
   - Save critical state to localStorage on change
   - Restore on page load
   - Use `zustand` with `persist` middleware for cleaner state management

2. **Backend Event Persistence**
   - Extend event history TTL or persist indefinitely per task
   - Store events in task record (not just in-memory subject)
   - Add `GET /tasks/:id/events` endpoint for full history

3. **Reconnection Logic**
   - On page load, check for active tasks
   - Reconnect SSE stream and replay missed events
   - Resume from last known state

4. **State Recovery Flow:**
   ```
   Page Load → Check localStorage → Restore UI state
            → Fetch active tasks from API
            → Reconnect SSE streams
            → Replay events since last seen timestamp
   ```

5. **State to Persist:**
   - `currentProjectId`
   - `currentTaskId`
   - `events[]` (last 100 per task)
   - `activeTab`
   - `isExecuting`
   - `approvalRequest`

**Files to Create:**
- `apps/web/src/store/index.ts` - Zustand store
- `apps/web/src/store/persist.ts` - Persistence middleware
- `apps/api/src/modules/tasks/events.service.ts` - Event persistence

**Files to Modify:**
- `apps/web/src/App.tsx` - Use store instead of useState
- `apps/api/src/modules/tasks/tasks.service.ts` - Persist events
- `apps/api/src/modules/tasks/tasks.controller.ts` - Add events endpoint

---

## Dependency Graph

```
Issue 10 (Persistence) ←─────────────────────────┐
    ↓                                            │
Issue 9 (New Project) ←──┐                       │
    ↓                    │                       │
Issue 3 (Orchestrator) ←─┼─── Issue 2 (Activity Messages)
    ↓                    │           ↓
Issue 4 (UI Designer Workflow) ←─────┤
    ↓                                │
Issue 5 (Design Tab) ←───────────────┤
    ↓                                │
Issue 6 (Long Context) ←─────────────┘
    ↓
Issue 7 (Token Efficiency)
    ↓
Issue 8 (Planning Tab) ←── Issue 1 (Active Agents Panel)
```

**Critical Path:**
1. Issue 10 (Persistence) - Foundation for all other work
2. Issue 9 (New Project) - Required for proper project flow
3. Issue 1 + 2 (Activity Visibility) - Can be done in parallel
4. Issue 3 (Orchestrator) - Requires activity data
5. Issue 4 (Workflow) - Requires orchestrator changes
6. Issue 5 (Design Tab) - Requires workflow changes
7. Issue 6 (Long Context) - Can be done after workflow
8. Issue 7 (Token Efficiency) - Optimization pass
9. Issue 8 (Planning Tab) - Can be done independently

---

## Implementation Phases

### Phase 1: Foundation (Issues 10, 9) ✓ COMPLETE

**Goal:** Establish persistent state and explicit project creation

**Tasks:**
1. [x] Implement Zustand store with localStorage persistence
2. [x] Add event persistence in backend (events stored per task)
3. [x] Create New Project modal and API endpoint
4. [x] Decouple project creation from task submission
5. [x] Add reconnection/replay logic for SSE (ReplaySubject with 50 events)

**Commit:** `5725f85 feat: implement Phase 1 foundation (persistence and new project)`

---

### Phase 2: Activity Visibility (Issues 1, 2) ✓ COMPLETE

**Goal:** Show complete sub-agent activity

**Tasks:**
1. [x] Refactor ActiveAgentsPanel for multiple instances (executionId as unique key)
2. [x] Enhance activity extraction in agent-adapter (metrics, artifacts as tools)
3. [x] Add executionId to all streaming events (parallel agent events)
4. [x] Create detailed AgentCard component (expandable thinking/tools/hooks/response)
5. [x] Add activity history endpoint (events persisted in Zustand store with localStorage)

**Commit:** `70512ce feat: implement Phase 2 activity visibility improvements`

---

### Phase 3: Orchestrator Interaction (Issue 3) ✓ COMPLETE

**Goal:** Enable conversation with orchestrator

**Tasks:**
1. [x] Create OrchestratorChat component
2. [x] Add orchestrator message API endpoint
3. [x] Update orchestrator prompts for user interrupts
4. [x] Add user messages to workflow state
5. [x] Implement real-time thinking display

**Commits:**
- `a7ea2b7 feat: add orchestrator chat interface (Phase 3 - Orchestrator Interaction)`
- `848c3b5 feat: add user message support in workflow state and orchestrator prompts`

---

### Phase 4: Design Workflow (Issues 4, 5)

**Goal:** Enforce stylesheet-first workflow with dedicated UI

**Tasks:**
1. Split design into stylesheet/screens phases
2. Update orchestrator prompts for workflow enforcement
3. Create Design tab with Mockups and User Flows pages
4. Add stylesheet approval gate
5. Integrate approval controls in Design tab

**Estimated Scope:** 10-12 files modified/created

---

### Phase 5: Context & Efficiency (Issues 6, 7)

**Goal:** Handle long context and reduce token usage

**Tasks:**
1. Implement artifact-based context passing
2. Add prompt caching for Anthropic API
3. Implement selective context filtering
4. Add shared context deduplication
5. Add token usage display in UI

**Estimated Scope:** 8-10 files modified/created

---

### Phase 6: Planning (Issue 8)

**Goal:** Display project breakdown

**Tasks:**
1. Create Planning tab with hierarchical view
2. Build Epic/Feature/Task list components
3. Create detail modal for each item type
4. Add design reference linking
5. Implement export functionality

**Estimated Scope:** 6-8 files modified/created

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSE reconnection complexity | Medium | High | Implement robust retry with exponential backoff |
| State sync between tabs | Medium | Medium | Use broadcast channel for cross-tab sync |
| Orchestrator interruption handling | High | Medium | Add graceful pause points in workflow |
| Token budget exceeded | Medium | High | Add hard limits with user confirmation |
| Parallel execution race conditions | Low | High | Use proper async locking |

---

## Testing Strategy

1. **Unit Tests:**
   - State persistence/restoration
   - Activity extraction
   - Token counting

2. **Integration Tests:**
   - SSE reconnection
   - Approval workflow
   - Project creation flow

3. **E2E Tests:**
   - Full workflow with page refresh
   - Multiple browser tabs
   - Long-running workflows

---

## Success Criteria

1. **Issue 1:** Active panel shows individual cards for parallel agents with full activity
2. **Issue 2:** Every agent message expandable with thinking, tools, hooks, response
3. **Issue 3:** Can type messages to orchestrator and see real-time responses
4. **Issue 4:** Stylesheet approval required before screen generation
5. **Issue 5:** Design tab shows mockups and user flows with approval controls
6. **Issue 6:** Analyst output successfully passed to UI designers without truncation
7. **Issue 7:** Token usage reduced by at least 40%
8. **Issue 8:** Planning tab shows hierarchical Epic/Feature/Task breakdown
9. **Issue 9:** Can create named project before submitting prompts
10. **Issue 10:** All state survives page refresh

---

## Awaiting Approval

Please review this plan and provide:
1. Approval to proceed
2. Priority adjustments for phases
3. Any clarifications or scope changes needed

**Next Step:** Upon approval, I will begin with Phase 1 (Foundation).
