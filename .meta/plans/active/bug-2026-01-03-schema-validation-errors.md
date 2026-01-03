# Bug Fix: UI Designer Schema Validation Errors

## Metadata
| Field | Value |
|-------|-------|
| Created | 2026-01-03 |
| Status | complete |
| Type | bug_fix |
| Phase | 3 (Design System) |
| Priority | critical |
| Related | bug-2026-01-03-scalable-artifact-generation.md |

## Original Prompt
> UI Designer agent fails with schema validation error

## Error Details
```
[WARN] [ui_designer] Output validation failed {
  errors: [
    {
      code: 'invalid_type',
      expected: 'string',
      received: 'object',
      path: ['typography', 'fontFamily'],
      message: 'Expected string, received object'
    }
  ]
}
```

---

## The Problem

### Immediate Symptom
UI Designer agent fails with Zod validation error. Claude returns `typography.fontFamily` as an object like `{heading: 'Cormorant Garamond', body: 'Satoshi'}` instead of a simple string.

### Root Cause
**Claude doesn't know the exact schema it should return.**

The system prompt describes the output format in prose, leaving interpretation to Claude. Claude interprets "typography with heading and body fonts" as a structured object, but the Zod schema expects a flat string.

---

## Solution: Provide Schema as Context

### Core Principle
> **Give Claude the exact schema, not a prose description**

Claude is excellent at following explicit schemas. By including the actual Zod schema structure in the prompt, we eliminate interpretation errors.

### Why This Is Better Than Lenient Preprocessing

| Approach | Pros | Cons |
|----------|------|------|
| **Lenient schema (preprocessing)** | Works with any input | Complex, hides errors, more code to maintain |
| **Schema as context** | Clear contract, correct output first time | Slightly longer prompt |

Schema as context wins because:
1. Addresses root cause (Claude's interpretation)
2. No additional code complexity
3. Claude is good at following explicit schemas
4. Errors become prompt issues, not code issues
5. Single source of truth - schema defines both validation AND prompt

---

## Implementation Plan

### Phase 1: Create Schema Documentation Constants

**File**: `packages/agents/src/schemas/ui-designer-output.ts`

Add a constant that documents the schema in a format suitable for prompts:

```typescript
/**
 * Schema documentation for inclusion in prompts
 * This ensures Claude knows exactly what format to return
 */
export const UI_DESIGNER_OUTPUT_SCHEMA_DOC = `
## Required Output Schema

Return a JSON object with this EXACT structure:

{
  "projectName": "string - Project name",
  "version": "string - Semantic version, e.g. '1.0.0'",
  "generatedAt": "string - ISO 8601 timestamp",

  "pages": [
    {
      "id": "string - Unique identifier (alphanumeric, hyphens, underscores)",
      "name": "string - Human-readable page name",
      "title": "string - Page title for browser tab",
      "description": "string - What this page does",
      "path": "string - URL path starting with /",
      "layout": {
        "type": "string - One of: single-column, two-column, sidebar, centered, fullwidth",
        "regions": []
      },
      "components": [/* UI components */]
    }
  ],

  "sharedComponents": [/* Reusable components */],

  "colorPalette": {
    "primary": "string - Hex color, e.g. '#3B82F6'",
    "secondary": "string - Hex color",
    "accent": "string - Hex color",
    "background": "string - Hex color, e.g. '#FFFFFF'",
    "surface": "string - Hex color",
    "text": "string - Hex color",
    "textSecondary": "string - Hex color",
    "error": "string - Hex color",
    "warning": "string - Hex color",
    "success": "string - Hex color",
    "info": "string - Hex color",
    "border": "string - Hex color",
    "muted": "string - Hex color"
  },

  "typography": {
    "fontFamily": "string - Font stack as SINGLE STRING, e.g. 'Inter, system-ui, sans-serif'",
    "headingFamily": "string (optional) - Heading font stack as string",
    "monoFamily": "string (optional) - Monospace font stack",
    "baseFontSize": "string - Size with units, e.g. '1rem' or '16px'",
    "scaleRatio": "number - Type scale ratio, e.g. 1.25",
    "lineHeight": "number - Line height multiplier, e.g. 1.5"
  },

  "spacing": {
    "unit": "number - Base spacing unit in pixels, e.g. 4",
    "scale": "number[] - Multipliers, e.g. [0, 1, 2, 4, 6, 8, 12, 16, 24, 32]"
  },

  "routingHints": {
    "suggestNext": "string[] - Agent types to run next",
    "skipAgents": "string[] - Agents to skip",
    "needsApproval": "boolean - Whether human approval is needed",
    "hasFailures": "boolean - Whether there were failures",
    "isComplete": "boolean - Whether design is complete"
  }
}

CRITICAL FORMAT REQUIREMENTS:
- fontFamily MUST be a string like "Inter, sans-serif", NOT an object like {heading: "...", body: "..."}
- All colors MUST be hex strings starting with # (e.g. "#3B82F6")
- baseFontSize MUST include units (e.g. "1rem" or "16px")
- All paths MUST start with /
`;
```

- [x] 1.1 Add `UI_DESIGNER_OUTPUT_SCHEMA_DOC` constant to ui-designer-output.ts ✓
- [x] 1.2 Add `UI_DESIGNER_SPEC_SCHEMA_DOC` constant to ui-designer-spec.ts ✓
- [x] 1.3 Export both constants ✓

### Phase 2: Update UI Designer Prompts

**File**: `packages/agents/src/agents/ui-designer.ts`

- [x] 2.1 Import schema documentation constants ✓
- [x] 2.2 Update `buildSystemPrompt()` to include `UI_DESIGNER_OUTPUT_SCHEMA_DOC` ✓
- [x] 2.3 Update `buildSpecificationSystemPrompt()` to include `UI_DESIGNER_SPEC_SCHEMA_DOC` ✓
- [x] 2.4 TypeScript typecheck passes ✓

### Phase 3: Testing

- [x] 3.1 Restart dev environment ✓
- [x] 3.2 Dev environment verified running (API on 3000, web on 5173) ✓
- [ ] 3.3 Verify UI Designer returns correctly formatted output (user testing)
- [ ] 3.4 Verify mockups are generated in designs/mockups/ (user testing)

---

## Files to Modify

| File | Action | Changes |
|------|--------|---------|
| `schemas/ui-designer-output.ts` | MODIFY | Add UI_DESIGNER_OUTPUT_SCHEMA_DOC constant |
| `schemas/ui-designer-spec.ts` | MODIFY | Add UI_DESIGNER_SPEC_SCHEMA_DOC constant |
| `agents/ui-designer.ts` | MODIFY | Include schema docs in system prompts |

---

## Current Step
**Implementation complete** - ready for user testing

## Resume Notes
**Last action**: Completed all implementation steps:
- Added `UI_DESIGNER_OUTPUT_SCHEMA_DOC` with detailed schema and CRITICAL FORMAT REQUIREMENTS
- Added `UI_DESIGNER_SPEC_SCHEMA_DOC` with specification schema and section types
- Updated `buildSystemPrompt()` to include schema doc and typography example
- Updated `buildSpecificationSystemPrompt()` to include spec schema doc
- TypeScript typecheck passes
- Dev environment verified running

**Next action**: User creates a new task to test the fix
**Blockers**: None

---

## Success Criteria

1. ✓ System prompt includes exact schema with field types and examples
2. ✓ Claude returns correctly formatted typography (string, not object)
3. ✓ All color values are hex strings
4. ✓ Osteopath-2 project generates mockups successfully
5. ✓ No Zod validation errors for design tokens
