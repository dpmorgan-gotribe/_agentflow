# Bug Fix: Design Workflow Phase Enforcement

**Created:** 2026-01-04
**Status:** ✅ COMPLETED
**Completed:** 2026-01-04
**Category:** Bug Fix - Design Workflow
**Priority:** High

## Problem Statement

UI Designer generates screens directly instead of following the expected design-first workflow:

**Expected Flow:**
1. Analyst researches styles → creates 5 style packages
2. UI Designer creates mega page/styleguide (5 options in parallel)
3. **User approves one style** ← APPROVAL GATE
4. UI Designer generates all screens using approved style
5. **User approves screens** ← APPROVAL GATE

**Actual Flow:**
1. Analyst researches styles → creates style packages ✓
2. UI Designer generates screens directly ✗ (skips mega page + approval)

---

## Root Cause Analysis

### Gap 1: No Explicit Mode Flags in Dispatch

**Location:** `packages/langgraph/src/nodes/parallel-dispatch.ts`

The parallel dispatcher passes file paths but **not** explicit mode flags:

```typescript
// What's passed:
{
  stylePackagePath: string,      // ✓ File path
  componentInventoryPath: string, // ✓ File path
  screensPath: string,           // ✓ File path
  // Missing:
  isMegaPageRequest: ???,        // ✗ NOT SET
  isFullDesignRequest: ???,      // ✗ NOT SET
}
```

### Gap 2: UI Designer Relies on Implicit Detection

**Location:** `packages/agents/src/agents/ui-designer.ts:376-388`

```typescript
// Current (fragile implicit detection):
const stylePackageContext = context.items.find(
  (i) => i.type === 'style_package'
);
if (stylePackageContext?.content) {
  // Auto-assumes mega page mode if style_package exists
  return this.buildMegaPageSystemPrompt(...);
}

// Expected (explicit flag check):
if (request.isMegaPageRequest) {
  return this.buildMegaPageSystemPrompt(...);
}
if (request.isFullDesignRequest) {
  return this.buildFullDesignSystemPrompt(...);
}
```

### Gap 3: Design Phase State Not Tracked

**Location:** `packages/langgraph/src/state.ts`

State channels exist but aren't being updated:
```typescript
designPhase: 'research' | 'stylesheet' | 'screens' | 'complete'
stylesheetApproved: boolean  // Never set to true after approval
screensApproved: boolean     // Never set to true after approval
selectedStyleId: string      // Set during approval but not gating next phase
```

### Gap 4: Orchestrator Thinking Doesn't Check Phase Gates

**Location:** `packages/langgraph/src/prompts/orchestrator-thinking.ts`

The orchestrator prompt describes the phases but the decision logic doesn't enforce:
- Can't dispatch to full design until `stylesheetApproved === true`
- Can't complete until `screensApproved === true`

---

## Implementation Plan

### Phase 1: Add Explicit Mode Context Type

**File:** `packages/agents/src/types.ts`

Add a new context type for design mode:

```typescript
export const ContextTypeEnum = {
  // ... existing types
  DESIGN_MODE: 'design_mode',
} as const;
```

### Phase 2: Update Parallel Dispatch to Set Mode

**File:** `packages/langgraph/src/nodes/parallel-dispatch.ts`

When dispatching UI Designers, add explicit mode context:

```typescript
// For style competition (mega pages):
const contextItems = [
  {
    type: ContextTypeEnum.DESIGN_MODE,
    content: {
      mode: 'mega_page',
      stylePackageId: stylePackage.id,
      stylePackageName: stylePackage.name,
    }
  },
  {
    type: ContextTypeEnum.STYLE_PACKAGE,
    documentRef: stylePackagePath,
  },
  // ... other context
];

// For full design (screens):
const contextItems = [
  {
    type: ContextTypeEnum.DESIGN_MODE,
    content: {
      mode: 'full_design',
      approvedStyleId: selectedStyleId,
      approvedStyleName: selectedStyleName,
      screenIds: assignedScreenIds,
    }
  },
  // ... other context
];
```

### Phase 3: Update UI Designer to Check Mode Explicitly

**File:** `packages/agents/src/agents/ui-designer.ts`

Replace implicit detection with explicit mode check:

```typescript
protected buildSystemPrompt(context: AgentContext, request?: AgentRequest): string {
  // Look for explicit design mode context
  const designModeContext = context.items.find(
    (i) => i.type === ContextTypeEnum.DESIGN_MODE
  );

  if (!designModeContext?.content) {
    // Fallback to basic mockup mode (no style package)
    return this.buildBasicSystemPrompt(context);
  }

  const mode = (designModeContext.content as { mode: string }).mode;

  if (mode === 'mega_page') {
    const stylePackage = await this.getContextContent<StylePackage>(...);
    return this.buildMegaPageSystemPrompt(stylePackage);
  }

  if (mode === 'full_design') {
    const approvedStyle = await this.getContextContent<StylePackage>(...);
    const screens = await this.getContextContent<Screen[]>(...);
    return this.buildFullDesignSystemPrompt(approvedStyle, screens);
  }

  return this.buildBasicSystemPrompt(context);
}
```

### Phase 4: Update State After Approval

**File:** `packages/langgraph/src/nodes/approve.ts`

After style selection approval:
```typescript
// When user selects a style:
return {
  selectedStyleId: response.selectedStyleId,
  selectedStyleName: selectedStyle.name,
  stylesheetApproved: true,           // ← ADD THIS
  designPhase: 'screens' as const,    // ← ADD THIS
};
```

After screens approval:
```typescript
// When user approves screens:
return {
  screensApproved: true,              // ← ADD THIS
  designPhase: 'complete' as const,   // ← ADD THIS
};
```

### Phase 5: Enforce Phase Gates in Orchestrator

**File:** `packages/langgraph/src/nodes/think.ts`

Add phase gate checks in the thinking node:

```typescript
function buildThinkingContext(state: OrchestratorState): string {
  // Add explicit phase gate warnings
  let phaseWarnings = '';

  if (state.stylePackagePaths?.length > 0 && !state.stylesheetApproved) {
    phaseWarnings += `
⚠️ PHASE GATE: Style packages exist but stylesheet NOT approved.
   REQUIRED: Dispatch UI Designers for mega page generation, then get approval.
   DO NOT: Generate screens until stylesheetApproved === true
`;
  }

  if (state.stylesheetApproved && !state.screensApproved && state.screenMockups?.length === 0) {
    phaseWarnings += `
⚠️ PHASE GATE: Stylesheet approved, screens NOT generated.
   REQUIRED: Dispatch UI Designers for full design (screens).
`;
  }

  return `${phaseWarnings}\n${existingContext}`;
}
```

### Phase 6: Update Thinking Prompt with Enforcement

**File:** `packages/langgraph/src/prompts/orchestrator-thinking.ts`

Add explicit phase enforcement to the system prompt:

```typescript
export const ORCHESTRATOR_THINKING_PROMPT = `
...existing prompt...

## CRITICAL PHASE GATES (MUST ENFORCE)

1. **BEFORE screens can be generated:**
   - stylePackages must exist (from Analyst)
   - megaPagePreviews must exist (from parallel UI Designers)
   - stylesheetApproved MUST be true (user selected a style)

   IF stylesheetApproved === false:
     → MUST request approval with style_selection type
     → CANNOT dispatch full_design mode

2. **BEFORE workflow completes:**
   - screensApproved MUST be true

   IF screensApproved === false:
     → MUST request approval for screens
     → CANNOT mark workflow complete
`;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/agents/src/types.ts` | Add `DESIGN_MODE` context type |
| `packages/langgraph/src/nodes/parallel-dispatch.ts` | Add explicit mode context |
| `packages/agents/src/agents/ui-designer.ts` | Check mode explicitly |
| `packages/langgraph/src/nodes/approve.ts` | Set phase flags after approval |
| `packages/langgraph/src/nodes/think.ts` | Add phase gate checks |
| `packages/langgraph/src/prompts/orchestrator-thinking.ts` | Add enforcement rules |

---

## Testing Strategy

1. **Test mega page flow:**
   - Create task → Analyst completes → UI Designer should create mega pages
   - Verify 5 mega page options are generated
   - Verify approval gate is triggered

2. **Test approval gate:**
   - Select one style → Verify `stylesheetApproved = true`
   - Verify next dispatch is for full design, not more mega pages

3. **Test full design flow:**
   - After approval → UI Designer generates screens with selected style
   - Verify screens use the approved style package

4. **Test gate enforcement:**
   - Manually set bad state → Verify orchestrator doesn't skip phases

---

## Current Step

**✅ COMPLETED:** All phases implemented and verified.

### Implementation Summary

1. ✅ **Phase 1:** Added `DESIGN_MODE` context type to `types.ts` and `context-manager.ts`
2. ✅ **Phase 2:** Updated `parallel-dispatch.ts` to set `designMode` (mega_page or full_design)
3. ✅ **Phase 3:** Updated `ui-designer.ts` to check `DESIGN_MODE` context explicitly first
4. ✅ **Phase 4:** Updated `approve.ts` to set `stylesheetApproved` and `designPhase` after approval
5. ✅ **Phase 5:** Added `enforcePhaseGates()` function in `think.ts` with programmatic enforcement
6. ✅ **Phase 6:** Orchestrator prompt already had CRITICAL gate text; added phase status to context

### Key Changes

- `DesignMode` type exported from `@aigentflow/langgraph` (mega_page | full_design)
- `DESIGN_MODE` context item set by orchestrator with `mode` and `selectedStyleId`
- Phase gate enforcement runs after AI decision parsing - corrects violations
- Fallback decision logic respects phase gates
- `stylesheetApproved` and `screensApproved` flags gate phase transitions

---

## Diagram: Expected vs Actual Flow

```
EXPECTED:
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│ Analyst │───▶│ UI Designer  │───▶│  APPROVAL   │───▶│ UI Designer  │
│ (style  │    │ (mega pages  │    │ (select 1   │    │ (screens     │
│ research)│    │ x5 parallel) │    │  style)     │    │  parallel)   │
└─────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                     │                    │                   │
              stylesheetApproved=false    │            screensApproved=false
                                    stylesheetApproved=true

ACTUAL (buggy):
┌─────────┐    ┌──────────────┐
│ Analyst │───▶│ UI Designer  │───▶ DONE (screens generated, no approval)
│ (style  │    │ (screens     │
│ research)│    │  directly!)  │
└─────────┘    └──────────────┘
                     │
              Skipped mega pages + approval gate!
```

---

## References

- State definition: `packages/langgraph/src/state.ts:501-527`
- Parallel dispatch: `packages/langgraph/src/nodes/parallel-dispatch.ts`
- UI Designer: `packages/agents/src/agents/ui-designer.ts:376-388`
- Orchestrator thinking: `packages/langgraph/src/prompts/orchestrator-thinking.ts`
