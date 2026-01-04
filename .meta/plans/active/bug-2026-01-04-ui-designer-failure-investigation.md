# Bug Fix: UI Designer Schema Validation - Layout Regions

**Created:** 2026-01-04
**Status:** Complete
**Category:** Bug Fix - UI Designer Agent
**Related Plan:** `bug-2026-01-03-schema-validation-errors.md` (Complete - established pattern)

## Problem Statement

UI Designer agent fails during execution with Zod validation error on `layout.regions`.

## Actual Error Found

### Error Message (from server logs)
```
[ERROR] [ui_designer] Agent execution failed
error: 'Invalid output format: [
  {
    "code": "invalid_type",
    "expected": "object",
    "received": "string",
    "path": ["pages", 0, "layout", "regions", 0],
    "message": "Expected object, received string"
  },
]
```

### Root Cause
**Same pattern as bug-2026-01-03:** Claude doesn't know the exact schema for `regions`.

The `UI_DESIGNER_OUTPUT_SCHEMA_DOC` at line 998 shows:
```json
"layout": {
  "type": "string - One of: single-column, two-column, sidebar, centered, fullwidth",
  "regions": []  // <-- No format specified!
}
```

Claude interprets this as allowing simple strings, but the Zod schema expects objects.

---

## Solution: Schema as Context (Established Pattern)

Following the pattern from `bug-2026-01-03-schema-validation-errors.md`:

> **Give Claude the exact schema, not a prose description**
>
> **Why This Is Better Than Lenient Preprocessing:**
> 1. Addresses root cause (Claude's interpretation)
> 2. No additional code complexity
> 3. Claude is good at following explicit schemas

---

## Implementation Plan

### Step 1: Update UI_DESIGNER_OUTPUT_SCHEMA_DOC

**File:** `packages/agents/src/schemas/ui-designer-output.ts`

Update the `layout` section to explicitly show regions format:

**Current (line 996-999):**
```json
"layout": {
  "type": "string - One of: single-column, two-column, sidebar, centered, fullwidth",
  "regions": []
}
```

**Updated:**
```json
"layout": {
  "type": "string - One of: single-column, two-column, sidebar, centered, fullwidth, custom",
  "regions": [
    {
      "name": "string - Region name, e.g. 'header', 'main', 'footer'",
      "area": "string - CSS grid area name",
      "components": ["string[] - Component IDs in this region"]
    }
  ],
  "gridTemplate": "string (optional) - CSS grid-template",
  "gap": "string (optional) - CSS gap value"
}
```

### Step 2: Add CRITICAL FORMAT REQUIREMENT

Add to the CRITICAL FORMAT REQUIREMENTS section (after line 1060):

```markdown
7. **layout.regions MUST be an array of objects**, NOT strings
   - WRONG: ["header", "main", "footer"]
   - CORRECT: [{"name": "header", "area": "header", "components": []}]
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/agents/src/schemas/ui-designer-output.ts` | Update `UI_DESIGNER_OUTPUT_SCHEMA_DOC` with regions format and add requirement #7 |

---

## Testing Strategy

1. **Run test task:** Create a new task and verify UI Designer passes validation
2. **Check logs:** Confirm no Zod errors on `pages[*].layout.regions`
3. **Verify output:** Confirm mockups are generated correctly

---

## Current Step

**Complete:** Implementation done. Ready for testing.

### Implementation Summary
- [x] Updated `UI_DESIGNER_OUTPUT_SCHEMA_DOC` with explicit regions object format
- [x] Added CRITICAL FORMAT REQUIREMENT #7 for regions
- [x] Build passes
- [x] Typecheck passes

---

## References

- Pattern established by: `bug-2026-01-03-schema-validation-errors.md`
- UI Designer Output Schema: `packages/agents/src/schemas/ui-designer-output.ts:978-1061`
- Schema Location: `LayoutRegionSchema` at line 232-236
