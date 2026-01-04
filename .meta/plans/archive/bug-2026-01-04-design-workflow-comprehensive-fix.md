# Bug Fix Plan: Design Workflow Phase Enforcement - Comprehensive Fix

**Bug ID**: bug-2026-01-04-design-workflow-comprehensive-fix
**Created**: 2026-01-04
**Status**: PENDING_APPROVAL
**Previous Attempts**: bug-2026-01-04-design-workflow-phase-enforcement-v2.md (FAILED)

## Problem Statement

The UI Designer agent generates screens immediately instead of following the expected workflow:

1. **Expected Flow**:
   - Analyst → Style research + 5 style packages
   - UI Designer → Mega page/styleguide (for style competition)
   - User → Approves a style
   - UI Designer → Full design (all screens with approved style)

2. **Actual Flow**:
   - Analyst → Style research (correct)
   - UI Designer → **Generates screens directly** (WRONG - skips styleguide)

## Root Cause Analysis

After tracing through the entire codebase, I identified **multiple interconnected issues**:

### Issue 1: Race Condition in Artifact Writing

**Location**: `apps/api/src/modules/workflow/workflow.service.ts:274-292`

The artifact writing is fire-and-forget (async without await):
```typescript
this.writeAgentArtifacts(
  projectId, prompt, lastOutput.agentId, lastOutput.result, artifacts
).catch((err) => {
  this.logger.warn(`Failed to write artifacts...`);
});
// Workflow continues immediately - files may not be written!
```

**Sequence**:
1. Analyst completes → artifacts in memory with `stylePackagePaths`
2. `writeAgentArtifacts()` starts (async, not awaited)
3. Orchestrator thinks → dispatches UI Designer
4. UI Designer's `hydrateContextItems()` tries to read files
5. **FILES NOT WRITTEN YET** → read fails → content is null

### Issue 2: STYLE_PACKAGE Context Items Have Null Content

**Location**: `apps/api/src/modules/workflow/agent-adapter.ts:348-361`

When creating STYLE_PACKAGE context items:
```typescript
contextItems.push({
  type: ContextTypeEnum.STYLE_PACKAGE,
  content: null,  // NULL! Expecting file read later
  documentRef: stylePath,
});
```

The agent-adapter passes `content: null` because it expects the agent to read from files. But due to Issue 1, files don't exist yet.

### Issue 3: UI Designer Defensive Check Depends on Content

**Location**: `packages/agents/src/agents/ui-designer.ts:455-468`

The defensive check looks for `content`:
```typescript
const stylePackageContext = context.items.find(
  (i) => i.type === 'style_package' as never
);
if (stylePackageContext?.content && !designModeContext && !uiRequest?.designMode) {
  // Force mega_page mode
  return this.buildMegaPageSystemPrompt(stylePackageContext.content as StylePackage);
}
```

When `content` is null (due to Issues 1 & 2), this check FAILS SILENTLY and falls through to basic screen generation.

### Issue 4: designMode May Not Be Set

**Location**: `packages/langgraph/src/nodes/execute.ts:176-182`

```typescript
const hasStylePackages = stylePackagePaths && stylePackagePaths.length > 0;
const designMode = isUIDesigner && hasStylePackages
  ? (hasSelectedStyle ? 'full_design' : 'mega_page')
  : undefined;
```

If `stylePackagePaths` is not populated in state (e.g., Analyst didn't return them correctly, or extraction failed), `designMode` is `undefined`.

### Issue 5: Parallel Style Competition Flow Confusion

**Location**: `packages/langgraph/src/nodes/think.ts:62-138`

The phase gate enforcement logic is complex and has edge cases:
- Gate 1: Routes to Analyst if no style packages (correct)
- Gate 2: Forces parallel dispatch for 5 style packages (correct)
- Gate 3: Only blocks if mega page previews EXIST but not approved

**Problem**: Gate 3 doesn't trigger BEFORE the first UI Designer run - it only activates AFTER mega pages are generated. So the first UI Designer runs with potentially wrong mode.

## Proposed Solution

### Why NOT Inline Data Transfer

Initially considered passing style packages inline through state channels, but this has problems:
- **Truncation risk**: Complex apps can have 50-100KB+ style packages
- **Memory overhead**: State channels would balloon for large projects
- **LLM context limits**: Large inline data could cause context truncation

The file-based approach was intentionally designed for scalability. We need to **fix the race condition** while keeping file reads.

### Solution Architecture: **Synchronous File Writing in Agent**

The cleanest solution is to have the Analyst agent write files **before returning**, guaranteeing files exist when the workflow continues.

**Key insight**: The Analyst agent has access to `outputDir` through the context. Instead of:
1. Agent returns artifacts with content → workflow writes files async → race condition

We do:
1. Agent writes files directly using `outputDir` → returns paths → files guaranteed to exist

### Implementation Steps

#### Step 1: Analyst Writes Files Directly (Primary Fix)

**File**: `packages/agents/src/agents/analyst.ts`

Modify `processStyleResearchResult()` to write files immediately:

```typescript
private async processStyleResearchResult(
  parsed: StyleResearchOutput,
  request: AgentRequest
): Promise<{ result: StyleResearchOutput & StyleResearchPaths; artifacts: Artifact[] }> {
  const artifacts: Artifact[] = [];
  const outputDir = request.context.outputDir;

  // Build paths for file-based context pattern
  const stylePackagePaths: string[] = [];

  // 1. Write individual style packages to disk IMMEDIATELY
  for (const pkg of parsed.stylePackages) {
    const relativePath = `designs/research/style-packages/${pkg.id}.json`;
    const content = JSON.stringify(pkg, null, 2);

    // Write file directly if outputDir is available
    if (outputDir) {
      const fullPath = path.join(outputDir, relativePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      this.log('debug', `Wrote style package to ${fullPath}`);
    }

    stylePackagePaths.push(relativePath);
    artifacts.push({
      id: this.generateArtifactId(),
      type: ArtifactTypeEnum.REPORT,
      path: relativePath,
      content: outputDir ? `[File written to ${relativePath}]` : content,
      metadata: {
        stylePackageId: pkg.id,
        writtenToFile: !!outputDir,
      },
    });
  }

  // Similarly for componentInventory, screens, userFlows...
}
```

**Benefits**:
- Files exist **before** agent returns
- No race condition possible
- Artifact content shows placeholder when file is written (saves memory)
- Backward compatible with artifact writer (skips already-written files)

#### Step 2: Add File Existence Retry in UI Designer (Defensive)

**File**: `packages/agents/src/agents/ui-designer.ts`

Add retry logic in `hydrateContextItems()` as a safety net:

```typescript
private async hydrateContextItems(
  items: ContextItem[],
  outputDir?: string
): Promise<ContextItem[]> {
  const hydratedItems: ContextItem[] = [];
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 500;

  for (const item of items) {
    if (item.documentRef && !item.content) {
      let content: unknown = null;
      let lastError: string | null = null;

      // Retry loop for file reads
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const result = await this.getContextContent(item, outputDir);
        if (result) {
          content = result;
          break;
        }

        lastError = `File not found: ${item.documentRef}`;
        if (attempt < MAX_RETRIES) {
          this.log('warn', `File read attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
          await this.sleep(RETRY_DELAY_MS);
        }
      }

      if (content) {
        hydratedItems.push({ ...item, content });
        this.log('debug', `Loaded context from file: ${item.documentRef}`);
      } else {
        this.log('error', `Failed to load ${item.documentRef} after ${MAX_RETRIES} attempts: ${lastError}`);
        hydratedItems.push(item); // Keep item for error tracking
      }
    } else {
      hydratedItems.push(item);
    }
  }

  return hydratedItems;
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### Step 3: Await Artifact Writing in Workflow Service (Belt & Suspenders)

**File**: `apps/api/src/modules/workflow/workflow.service.ts`

Make artifact writing awaited to ensure files are written before next node:

```typescript
// In onNodeEnd callback for 'execute_agent':
if (lastOutput.success && lastOutput.artifacts) {
  // AWAIT artifact writing - ensure files exist before workflow continues
  try {
    await this.writeAgentArtifacts(
      projectId,
      prompt,
      lastOutput.agentId,
      lastOutput.result,
      (lastOutput.artifacts ?? []).map((a) => ({
        type: a.type,
        name: a.id,
        path: a.path,
        content: a.content,
        writtenToFile: (a.metadata as Record<string, unknown>)?.writtenToFile === true,
      }))
    );
  } catch (err) {
    this.logger.warn(`Failed to write artifacts for ${lastOutput.agentId}: ${err}`);
  }
}
```

**Note**: This is a fallback. With Step 1, most files will already be written by the agent.

#### Step 4: Strengthen UI Designer's Mode Detection (Keep from Original)

**File**: `packages/agents/src/agents/ui-designer.ts`

Update `buildSystemPrompt()` to fail explicitly instead of silent fallback:

```typescript
protected buildSystemPrompt(context: AgentContext): string {
  const uiRequest = context as unknown as UIDesignerRequest;
  const designModeContext = this.getDesignModeFromContext(context);

  // 1. Check for explicit designMode (highest priority)
  if (designModeContext?.mode === 'mega_page' || uiRequest?.designMode === 'mega_page') {
    const stylePackage = this.findStylePackageContent(context);
    if (stylePackage) {
      return this.buildMegaPageSystemPrompt(stylePackage);
    }
    // FAIL EXPLICITLY - don't silently fall through
    throw new Error(
      '[UIDesigner] mega_page mode requested but no style package content available. ' +
      'This indicates a file read failure or missing analyst output.'
    );
  }

  if (designModeContext?.mode === 'full_design' || uiRequest?.designMode === 'full_design') {
    const stylePackage = this.findStylePackageContent(context);
    if (stylePackage) {
      return this.buildFullDesignSystemPrompt(stylePackage);
    }
    throw new Error('[UIDesigner] full_design mode requires approved style package');
  }

  // 2. Check for style packages without explicit mode (defensive)
  const stylePackage = this.findStylePackageContent(context);
  if (stylePackage) {
    this.log('warn', 'Style package found but no designMode - defaulting to mega_page');
    return this.buildMegaPageSystemPrompt(stylePackage);
  }

  // 3. No style packages and no mode - basic screen generation is OK here
  return this.buildBasicScreenPrompt(context);
}
```

#### Step 5: Add Verbose Logging for Debugging

Add logging at critical points to trace the flow:

**In Analyst** (`processStyleResearchResult`):
```typescript
this.log('info', `Style research complete: ${stylePackagePaths.length} packages written to disk`);
```

**In execute.ts** (`executeAgentNode`):
```typescript
if (isUIDesigner) {
  console.log('[execute] UI Designer dispatch:', {
    designMode,
    hasStylePackagePaths: stylePackagePaths?.length ?? 0,
    hasSelectedStyle: !!selectedStyleId,
  });
}
```

**In UI Designer** (`hydrateContextItems`):
```typescript
this.log('info', `Hydrated ${hydratedCount}/${items.length} context items from files`);
```

### Files to Modify

1. **`packages/agents/src/agents/analyst.ts`** (PRIMARY FIX)
   - Write style package files directly in `processStyleResearchResult()`
   - Add file writing utilities (fs operations)
   - Mark artifacts as `writtenToFile: true`

2. **`packages/agents/src/agents/ui-designer.ts`**
   - Add retry logic in `hydrateContextItems()` (defensive)
   - Throw errors instead of silent fallbacks in `buildSystemPrompt()`
   - Add `findStylePackageContent()` helper

3. **`apps/api/src/modules/workflow/workflow.service.ts`**
   - Change `writeAgentArtifacts()` from fire-and-forget to awaited
   - Only as fallback - agent should write files directly

4. **`packages/agents/src/utils/file-writer.ts`** (may need updates)
   - Ensure `writeArtifactFile()` creates directories recursively
   - Add path validation

### Testing Strategy

1. **Unit Test**: Mock file system, verify Analyst writes files before returning
2. **Integration Test**: Full workflow, verify files exist when UI Designer reads them
3. **Stress Test**: Large style packages (100KB+) to verify no truncation
4. **Race Test**: Rapid sequential agent execution to verify no race conditions

### Success Criteria

- [ ] Style package files exist on disk when Analyst completes
- [ ] UI Designer successfully reads files (no retry needed in normal case)
- [ ] `designMode: 'mega_page'` is set on first UI Designer run
- [ ] Mega page HTML is generated (not screens)
- [ ] Full design mode works after style approval
- [ ] No truncation with large (100KB+) style packages

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing Analyst output | Medium | High | Check for outputDir before writing |
| File permission issues | Low | Medium | Recursive mkdir, proper error handling |
| Slower agent execution | Low | Low | File writes are fast (~10ms) |
| Regression in parallel execution | Medium | Medium | Test style competition with 5 designers |

## Estimated Effort

- Implementation: 2-3 hours
- Testing: 1-2 hours
- Total: 3-5 hours

## Approval Checklist

- [ ] Root cause analysis reviewed
- [ ] Solution approach approved
- [ ] Risk assessment acceptable
- [ ] Ready to implement

---

**Awaiting user approval to proceed with implementation.**
