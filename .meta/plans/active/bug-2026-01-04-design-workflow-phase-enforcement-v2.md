# Bug Fix: Design Workflow Phase Enforcement (v2)

**Created:** 2026-01-04
**Status:** COMPLETED
**Category:** Bug Fix - Design Workflow
**Priority:** Critical
**Previous Plan:** bug-2026-01-04-design-workflow-phase-enforcement.md (marked complete but didn't work)

## Problem Statement

UI Designer generates screens directly instead of following the expected design-first workflow.

**Expected Flow (with `stylePackageCount=1` for testing):**
```
1. Analyst researches styles → creates 1 style package (file)
2. UI Designer creates 1 mega page/styleguide
3. **USER APPROVAL** ← Approve/reject/request changes to style
4. UI Designer generates all screens using approved style
5. **USER APPROVAL** ← Approve screens
```

**Expected Flow (with `stylePackageCount=5` for production):**
```
1. Analyst researches styles → creates 5 style packages (files)
2. UI Designer creates 5 mega pages in parallel (style competition)
3. **USER APPROVAL** ← Select one style
4. UI Designer generates all screens using approved style
5. **USER APPROVAL** ← Approve screens
```

**Actual Flow (broken):**
```
1. Analyst researches styles → creates style packages ✓
2. UI Designer generates screens directly ✗ (skips mega page + approval)
```

---

## Existing Settings Infrastructure

The settings system is already implemented and working:

| Setting | Location | Default | Description |
|---------|----------|---------|-------------|
| `stylePackageCount` | SettingsPanel, API | 1 | Number of style packages Analyst generates |
| `parallelDesignerCount` | SettingsPanel, API | 1 | Number of parallel UI Designers for screens |
| `enableStyleCompetition` | SettingsPanel, API | false | UI hint for selection vs approval dialog |
| `maxStyleRejections` | SettingsPanel, API | 5 | Max times user can reject all styles |

**Files involved:**
- `apps/web/src/components/SettingsPanel.tsx` - UI controls (already in RightSidebar)
- `apps/api/src/modules/settings/settings.schema.ts` - Zod schema
- `packages/langgraph/src/state.ts:572-578` - DEFAULT_WORKFLOW_SETTINGS
- `packages/agents/src/agents/analyst.ts:522-537` - getStylePackageCount()

---

## Why the Previous Implementation Failed

The previous plan (bug-2026-01-04-design-workflow-phase-enforcement.md) was marked "COMPLETED" but the bug persists because:

### Gap 1: `executeAgentNode` Does NOT Pass `designMode`

**Location:** `packages/langgraph/src/nodes/execute.ts:171-181`

The single agent execution path **never passes `designMode`** to the agent:

```typescript
// CURRENT CODE - designMode is MISSING!
const result = await agent.execute({
  tenantId,
  projectId,
  projectPath,
  taskId,
  prompt,
  analysis,
  previousOutputs: agentOutputs,
  workflowSettings,
  designResearchPaths,
  // designMode: ??? ← NOT PASSED!
  // selectedStyleId: ??? ← NOT PASSED!
});
```

The previous plan only added `designMode` to `parallel-dispatch.ts` (line 145-147):
```typescript
// parallel-dispatch.ts - HAS designMode
const designMode = isUIDesigner && hasStylePackages
  ? (hasSelectedStyle ? 'full_design' : 'mega_page')
  : undefined;
```

**But if the orchestrator uses the `dispatch` route instead of `parallel_dispatch`, UI Designer never receives the mode flag.**

### Gap 2: Orchestrator Routes to Single Dispatch Instead of Parallel

**Location:** `packages/langgraph/src/graphs/orchestrator.ts:46-55`

The graph has two execution paths:
- `dispatch` → `executeAgentNode` (single agent, **NO designMode**)
- `parallel_dispatch` → `parallelDispatchNode` (parallel agents, **HAS designMode**)

When `stylePackageCount=1`, the orchestrator may decide to use single `dispatch` instead of `parallel_dispatch`, but the single path doesn't set the mode.

### Gap 3: Phase Gate Enforcement Doesn't Force Correct Route

**Location:** `packages/langgraph/src/nodes/think.ts`

The `enforcePhaseGates()` function doesn't:
1. Force UI Designer to use appropriate dispatch route based on count
2. Set the correct `designMode` in the corrected decision
3. Handle the `stylePackageCount=1` case (should still create mega page first)

---

## Root Cause Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR AI                          │
│  "After Analyst, dispatch UI Designer to create designs"        │
│  (stylePackageCount=1, so decides single dispatch)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │     getOrchestratorRoute()    │
              │   Returns: "dispatch"         │
              │   (single agent for count=1)  │
              └───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────────┐
    │ executeAgentNode │             │ parallelDispatchNode │
    │ (single agent)   │             │ (parallel agents)    │
    │                  │             │                      │
    │ designMode: ❌   │             │ designMode: ✓        │
    │ NOT PASSED!      │             │ mega_page/full_design│
    └─────────────────┘             └─────────────────────┘
              │
              ▼
    ┌─────────────────┐
    │   UI Designer   │
    │                 │
    │ No mode flag    │
    │ Falls back to   │
    │ generating      │
    │ SCREENS!        │
    └─────────────────┘
```

---

## Solution

### Phase 1: Add `designMode` to `executeAgentNode`

**File:** `packages/langgraph/src/nodes/execute.ts`

Add the same `designMode` logic that exists in `parallel-dispatch.ts`:

```typescript
export async function executeAgentNode(
  state: OrchestratorStateType
): Promise<Partial<OrchestratorStateType>> {
  const {
    currentAgent,
    // ... existing destructuring
    stylePackagePaths,
    selectedStyleId,
  } = state;

  // ... existing validation code

  // ADD: Determine design mode for UI Designer
  const isUIDesigner = currentAgent === 'ui_designer';
  const hasStylePackages = stylePackagePaths && stylePackagePaths.length > 0;
  const hasSelectedStyle = !!selectedStyleId;

  const designMode = isUIDesigner && hasStylePackages
    ? (hasSelectedStyle ? 'full_design' : 'mega_page')
    : undefined;

  try {
    const result = await agent.execute({
      tenantId,
      projectId,
      projectPath,
      taskId,
      prompt,
      analysis,
      previousOutputs: agentOutputs,
      workflowSettings,
      designResearchPaths,
      designMode,                    // ← ADD THIS
      selectedStyleId: hasSelectedStyle ? selectedStyleId : undefined,  // ← ADD THIS
    });
    // ...
  }
}
```

### Phase 2: Force Parallel Dispatch for Style Competition (count > 1)

**File:** `packages/langgraph/src/nodes/think.ts`

In `enforcePhaseGates()`, force parallel dispatch when:
- `stylePackageCount > 1` AND style packages exist but no style selected

```typescript
function enforcePhaseGates(
  state: OrchestratorStateType,
  decision: OrchestratorDecision
): PhaseGateResult | null {
  const { stylesheetApproved, stylePackages, selectedStyleId, designPhase, workflowSettings } = state;
  const styleCount = workflowSettings?.stylePackageCount ?? 1;

  // Gate 1: After Analyst with style packages (count > 1), MUST use parallel dispatch
  if (
    stylePackages && stylePackages.length > 1 &&
    !stylesheetApproved &&
    decision.action === 'dispatch' &&
    decision.agentId === 'ui_designer'
  ) {
    // CORRECTION: Force parallel dispatch for style competition
    return {
      correctedDecision: {
        ...decision,
        action: 'parallel_dispatch',  // ← FORCE PARALLEL
        pendingAgents: stylePackages.map((pkg, i) => ({
          agentId: 'ui_designer',
          executionId: `ui_designer_style_${i}`,
          stylePackageId: pkg.id,
          stylePackagePath: state.stylePackagePaths?.[i],
        })),
        reasoning: `Phase gate: forcing parallel dispatch for style competition (${stylePackages.length} mega pages)`,
      },
      violation: {
        gate: 'stylesheet_approval',
        originalAction: decision.action,
        correctedAction: 'parallel_dispatch',
        reason: 'Multiple style packages exist - must run style competition',
      },
    };
  }

  // Gate 2: For single style (count=1), ensure designMode is set (handled in execute.ts now)
  // No correction needed - execute.ts will set designMode: 'mega_page'

  // Gate 3: Cannot proceed to full design without stylesheet approval
  // ... existing code
}
```

### Phase 3: Update Orchestrator Prompt for Clarity

**File:** `packages/langgraph/src/prompts/orchestrator-thinking.ts`

Update to clearly state the flow based on settings:

```typescript
function buildSettingsContext(settings?: WorkflowSettings): string {
  const styleCount = settings?.stylePackageCount ?? 1;

  if (styleCount === 1) {
    return `
## CURRENT SETTINGS (Single Style Mode)
- stylePackageCount: 1 (Analyst creates 1 style package)

FLOW:
1. Analyst → 1 style package
2. UI Designer → 1 mega page (designMode: mega_page)
3. USER APPROVAL → approve/reject/request changes
4. UI Designer → all screens (designMode: full_design)
5. USER APPROVAL for screens
`;
  }

  return `
## CURRENT SETTINGS (Style Competition Mode)
- stylePackageCount: ${styleCount} (Analyst creates ${styleCount} style packages)

FLOW:
1. Analyst → ${styleCount} style packages
2. parallel_dispatch: ${styleCount} UI Designers → ${styleCount} mega pages
3. USER APPROVAL → select 1 style (or reject all)
4. UI Designer → all screens (designMode: full_design)
5. USER APPROVAL for screens
`;
}
```

### Phase 4: Add Defensive Check in UI Designer

**File:** `packages/agents/src/agents/ui-designer.ts`

Add clear error when mode is ambiguous:

```typescript
protected buildSystemPrompt(context: AgentContext, request?: AgentRequest): string {
  const designModeContext = context.items.find(
    (i) => i.type === ContextTypeEnum.DESIGN_MODE
  );

  const stylePackageContext = context.items.find(
    (i) => i.type === ContextTypeEnum.STYLE_PACKAGE
  );

  // DEFENSIVE: If we have style package but no explicit mode, that's a bug
  if (stylePackageContext && !designModeContext && !request?.designMode) {
    console.error(
      '[UIDesigner] BUG: Style package context exists but no designMode provided. ' +
      'This indicates the orchestrator dispatch logic is broken. ' +
      'Forcing mega_page mode as safest default.'
    );
    // Force mega_page mode as safest default when style package exists
    return this.buildMegaPageSystemPrompt(/* ... */);
  }

  // ... rest of mode selection
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/langgraph/src/nodes/execute.ts` | Add `designMode` and `selectedStyleId` to agent execution |
| `packages/langgraph/src/nodes/think.ts` | Force parallel dispatch for style competition (count > 1) |
| `packages/langgraph/src/prompts/orchestrator-thinking.ts` | Add settings-aware flow documentation |
| `packages/agents/src/agents/ui-designer.ts` | Add defensive check and error logging |

---

## Settings Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETTINGS PANEL (RightSidebar)                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Style Packages: [1]  ← For testing (saves tokens)       │   │
│  │ Parallel Designers: [1]                                  │   │
│  │ Style Competition: [OFF] ← Auto-approve single style    │   │
│  │ Max Rejections: [5]                                      │   │
│  │ CLI Timeout: [15] minutes                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API (settings.service.ts)                     │
│                    Stores settings in memory                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW SERVICE                              │
│         Passes workflowSettings to LangGraph state              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT ADAPTER                                 │
│   Creates WORKFLOW_SETTINGS context item for agents             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYST AGENT                                 │
│   Reads stylePackageCount from context                          │
│   Generates N style packages                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (think.ts)                       │
│   - If count=1: dispatch with designMode='mega_page'            │
│   - If count>1: parallel_dispatch with N UI Designers           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Test 1: Single Style Mode (stylePackageCount=1)

1. Create task → Analyst creates 1 style package
2. Verify UI Designer receives `designMode: 'mega_page'`
3. Verify 1 mega page is generated
4. Verify **APPROVAL DIALOG** appears for the single style
5. User approves → Verify `stylesheetApproved: true` is set
6. Verify UI Designer then runs with `designMode: 'full_design'`

### Test 2: Style Competition Mode (stylePackageCount=5)

1. Set `stylePackageCount=5` via SettingsPanel
2. Create task → Analyst creates 5 style packages
3. Verify `parallel_dispatch` is used (not single dispatch)
4. Verify 5 UI Designers spawn with `designMode: 'mega_page'`
5. Verify approval dialog shows 5 options
6. Select one → Verify `stylesheetApproved: true`
7. Verify full design runs with selected style

### Test 3: Rejection Flow (single style)

1. Create task → 1 mega page generated
2. User clicks "Reject" with feedback
3. Verify Analyst re-runs with feedback
4. New style package generated → new mega page → approval again

### Test 4: Phase Gate Enforcement

1. Manually modify orchestrator to try single dispatch with count=5
2. Verify phase gate corrects to `parallel_dispatch`

### Test 5: Defensive Check

1. Remove designMode from execute.ts temporarily
2. Verify warning is logged
3. Verify mega_page mode is used as fallback

---

## Implementation Order

1. [x] **Phase 1**: Add `designMode` to `executeAgentNode` (fixes immediate bug for count=1)
2. [x] **Phase 2**: Force parallel dispatch in phase gates (ensures correct routing for count>1)
3. [x] **Phase 3**: Update orchestrator prompt with settings context
4. [x] **Phase 4**: Add defensive check in UI Designer (prevents future regressions)

---

## Current Step

**COMPLETED** - All phases implemented successfully. Build verified (21/21 packages pass).

---

## Diagram: Fixed Flow (Single Style Mode)

```
stylePackageCount=1

┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Analyst   │───▶│ UI Designer  │───▶│    USER     │───▶│ UI Designer  │
│ (1 style    │    │ designMode:  │    │  APPROVAL   │    │ designMode:  │
│  package)   │    │ 'mega_page'  │    │ (approve/   │    │ 'full_design'│
└─────────────┘    └──────────────┘    │  reject)    │    └──────────────┘
                          │            └─────────────┘           │
                   Creates 1 mega            │             Generates all
                   page styleguide    stylesheetApproved      screens
                                      = true (user approved)
```

## Diagram: Fixed Flow (Style Competition Mode)

```
stylePackageCount=5

┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Analyst   │───▶│ UI Designers │───▶│  USER       │───▶│ UI Designer  │
│ (5 style    │    │ x5 PARALLEL  │    │  APPROVAL   │    │ designMode:  │
│  packages)  │    │ designMode:  │    │ (picks 1)   │    │ 'full_design'│
└─────────────┘    │ 'mega_page'  │    └─────────────┘    └──────────────┘
                   └──────────────┘           │
                          │           stylesheetApproved
                   Creates 5 mega     = true (user choice)
                   page options
```
