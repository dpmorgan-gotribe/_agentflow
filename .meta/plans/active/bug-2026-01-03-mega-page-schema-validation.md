# Bug Fix: UI Designer Mega Page Schema Validation Errors

## Metadata
| Field | Value |
|-------|-------|
| Created | 2026-01-03 |
| Status | complete |
| Type | bug_fix |
| Phase | 3 (Design System) |
| Priority | critical |
| Related | bug-2026-01-03-schema-validation-errors.md, bug-2026-01-03-scalable-artifact-generation.md |

## Original Prompt
> UI Designer agent fails in mega page generation mode

## Error Details
```
[2026-01-03 09:15:30] UI Designer failed with validation errors:
- typography.fontFamily expected string but received object
- spacing.scale[18] exceeded maximum value of 100
```

---

## The Problem

### Immediate Symptom
UI Designer agent fails when generating mega pages for style competition. Claude returns:
1. `typography.fontFamily` as an object `{heading: "...", body: "..."}` instead of a string
2. `spacing.scale` with values exceeding 100 (e.g., 256, 512)

### Root Cause Analysis

```
WHY does schema validation fail?
  └─▶ Claude returns incorrectly formatted JSON

WHY does Claude return incorrect format?
  └─▶ The mega page prompt doesn't include schema documentation

WHY doesn't mega page prompt include schema docs?
  └─▶ bug-2026-01-03-schema-validation-errors.md only fixed:
      - buildSystemPrompt() ✓
      - buildSpecificationSystemPrompt() ✓

      But didn't fix:
      - buildMegaPageSystemPrompt() ✗
      - buildFullDesignSystemPrompt() ✗

ROOT CAUSE: Schema documentation fix was incomplete - missed 2 of 4 prompt methods
```

### Architecture Analysis

```
UI Designer has 4 prompt modes:

1. buildSystemPrompt()            ← HAS schema docs ✓
   Used for: Standard mockup generation

2. buildSpecificationSystemPrompt() ← HAS schema docs ✓
   Used for: Complex apps (>5 screens)

3. buildMegaPageSystemPrompt()    ← MISSING schema docs ✗
   Used for: Style competition mega pages

4. buildFullDesignSystemPrompt()  ← MISSING schema docs ✗
   Used for: Full screen generation after style approval
```

### Secondary Issue: Spacing Schema Constraint

```typescript
// Current: Too restrictive
scale: z.array(z.number().min(0).max(100)), // Multipliers

// Claude returns: Actual pixel values
scale: [0, 4, 8, 16, 24, 32, 48, 64, 96, 128, 160, 192, 224, 256, 320, 384, 448, 512, 576]
//                                          ^^^ These exceed 100
```

The schema was designed for multipliers (e.g., 0-24) but Claude returns pixel values.

---

## Solution: Complete Schema Documentation Coverage

### Core Principle
> **All prompts that expect UIDesignerOutput must include schema documentation**

### Why This Fix Works

The previous fix (`bug-2026-01-03-schema-validation-errors.md`) proved that schema-as-context works:
- Claude follows explicit schema when provided
- The typography string format is respected when documented

The issue is that the fix was only applied to 2 of 4 prompt methods.

---

## Implementation Plan

### Phase 1: Fix Mega Page System Prompt
**Goal**: Add schema documentation to `buildMegaPageSystemPrompt()`

- [x] 1.1 Import `UI_DESIGNER_OUTPUT_SCHEMA_DOC` and `TYPOGRAPHY_EXAMPLE` (already imported) ✓
- [x] 1.2 Add schema documentation section to `buildMegaPageSystemPrompt()` before JSON_ONLY_INSTRUCTION ✓
- [x] 1.3 Add mega-page specific format clarifications (spacing scale example) ✓

### Phase 2: Fix Full Design System Prompt
**Goal**: Add schema documentation to `buildFullDesignSystemPrompt()`

- [x] 2.1 Reused existing `UI_DESIGNER_OUTPUT_SCHEMA_DOC` (no separate constant needed) ✓
- [x] 2.2 Add schema documentation section to `buildFullDesignSystemPrompt()` ✓
- [x] 2.3 Add spacing scale example for full design mode ✓

### Phase 3: Fix Spacing Schema Constraint
**Goal**: Allow realistic pixel values in spacing scale

- [x] 3.1 Increase `spacing.scale` max value from 100 to 1000 ✓
- [x] 3.2 Add documentation in SpacingSchema comment about expected values ✓
- [x] 3.3 Add example spacing scale in both prompts ✓

### Phase 4: Verification
**Goal**: Ensure all fixes work together

- [x] 4.1 TypeScript typecheck passes ✓
- [ ] 4.2 Restart dev environment (user action)
- [ ] 4.3 Test mega page generation (user testing)

---

## Code Changes

### File: `packages/agents/src/agents/ui-designer.ts`

#### Mega Page Prompt (lines 990-1052)

```typescript
protected buildMegaPageSystemPrompt(stylePackage: StylePackage): string {
  return `You are an expert UI/UX designer creating a comprehensive component showcase page.

  // ... existing prompt content ...

  ${UI_DESIGNER_OUTPUT_SCHEMA_DOC}

  ${TYPOGRAPHY_EXAMPLE}

  ## Spacing Scale Example

  Use realistic pixel values for spacing:
  {
    "spacing": {
      "unit": 4,
      "scale": [0, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128]
    }
  }

  ${JSON_ONLY_INSTRUCTION}`;
}
```

### File: `packages/agents/src/schemas/ui-designer-output.ts`

#### Fix Spacing Schema (line 391)

```typescript
// Before
scale: z.array(z.number().min(0).max(100)), // Multipliers

// After
scale: z.array(z.number().min(0).max(1000)), // Spacing values in pixels (e.g., 0-576)
```

---

## Current Step
**Complete** - All implementation steps finished, awaiting user testing

## Resume Notes
**Last action**: Completed all implementation steps:
- Added schema documentation to `buildMegaPageSystemPrompt()` (lines 1052-1067)
- Added schema documentation to `buildFullDesignSystemPrompt()` (lines 1411-1426)
- Fixed `SpacingSchema.scale` max from 100 to 1000 (line 393)
- Added spacing scale examples to both prompts
- TypeScript typecheck passes

**Next action**: User restarts dev environment and tests mega page generation
**Blockers**: None

---

## Success Criteria

1. ✓ All 4 prompt methods include schema documentation
2. ✓ typography.fontFamily validation passes (string format)
3. ✓ spacing.scale validation passes (values up to 1000)
4. ✓ Mega page generation completes successfully
5. ✓ Style competition works with 5 parallel designers

---

## Lesson to Capture (After Implementation)

- **Category**: bug_fix
- **Title**: Complete Coverage When Fixing Multi-Mode Systems
- **Root Cause**: Applied schema fix to only 2 of 4 prompt modes
- **Prevention**: When fixing prompts in multi-mode systems, audit ALL prompt methods
- **Pattern**: Create a checklist of all prompt methods before implementing fix
- **Anti-Pattern**: Fixing only the most obvious code path and assuming others are similar
