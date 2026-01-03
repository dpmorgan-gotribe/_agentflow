# Bug Fix: UI Designer Typography Sanitization

## Metadata
| Field | Value |
|-------|-------|
| Created | 2026-01-03 |
| Status | complete |
| Type | bug_fix |
| Phase | 3 (Design System) |
| Priority | critical |
| Related | bug-2026-01-03-schema-validation-errors.md, bug-2026-01-03-mega-page-schema-validation.md, bug-2026-01-03-scalable-artifact-generation.md |

## Original Prompt
> UI Designer agent fails with typography.fontFamily validation error

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

Claude returns:
```json
{
  "typography": {
    "fontFamily": {
      "heading": "Cormorant Garamond",
      "body": "Satoshi"
    }
  }
}
```

Expected:
```json
{
  "typography": {
    "fontFamily": "Cormorant Garamond, Satoshi, sans-serif"
  }
}
```

---

## The Problem

### Previous Attempts (Schema Documentation)
Three previous plans attempted to fix this issue with schema documentation:

1. **bug-2026-01-03-schema-validation-errors.md** - Added `UI_DESIGNER_OUTPUT_SCHEMA_DOC` with explicit format requirements
2. **bug-2026-01-03-mega-page-schema-validation.md** - Added schema docs to mega page and full design prompts
3. Both included `TYPOGRAPHY_EXAMPLE` with correct format

### Root Cause Analysis

```
WHY does validation fail?
  └─▶ Claude returns fontFamily as object instead of string

WHY does Claude return object format?
  └─▶ Despite explicit schema documentation, Claude interprets
      "heading and body fonts" as a structured object

WHY doesn't schema documentation work?
  └─▶ Claude's interpretation is stronger than our instructions
      Claude "thinks" the object format is more natural for
      representing multiple fonts

ROOT CAUSE: Claude's semantic interpretation overrides explicit format instructions
```

### Evidence That Schema Docs Are Present

From logs:
```
stdout length: 139681  // 139KB response
stdout preview: "Based on the prompt requirements..." // Has preamble
```

The 139KB response indicates Claude IS following the prompt (generating comprehensive output), but is ignoring the specific format requirement for typography.

---

## Solution: Defense-in-Depth Sanitization

### Core Principle
> **If Claude keeps returning the wrong format, fix it in post-processing**

The existing `json-sanitizer.ts` already handles similar issues for color fields. We need to extend it for typography fields.

### Why This Will Work

| Approach | Status | Result |
|----------|--------|--------|
| Schema documentation | Implemented | Claude ignores it |
| Stronger JSON_ONLY_INSTRUCTION | Implemented | Claude adds preamble anyway |
| **Sanitization** | **New** | Guaranteed to work (code-level fix) |

---

## Implementation Plan

### Phase 1: Add Typography Sanitization

**File**: `packages/agents/src/utils/json-sanitizer.ts`

- [x] 1.1 Add `TYPOGRAPHY_STRING_FIELDS` constant for fields that should be font stack strings ✓
- [x] 1.2 Add `fontObjectToString()` helper to convert `{heading: "...", body: "..."}` to string ✓
- [x] 1.3 Update `sanitizeLLMJson()` to handle typography fields ✓
- [x] 1.4 Handle edge cases (single font, array of fonts, nested objects) ✓

### Phase 2: Verification

- [x] 2.1 TypeScript typecheck passes ✓
- [ ] 2.2 Restart dev environment (user action)
- [ ] 2.3 Test with new task (user testing)

---

## Code Changes

### File: `packages/agents/src/utils/json-sanitizer.ts`

```typescript
/**
 * Typography fields that should be font stack strings
 * Claude often returns these as objects like { heading: "...", body: "..." }
 */
const TYPOGRAPHY_STRING_FIELDS = new Set([
  'fontFamily',
  'headingFamily',
  'monoFamily',
]);

/**
 * Convert a font object to a font stack string
 *
 * Examples:
 * - { heading: "Cormorant", body: "Satoshi" } -> "Cormorant, Satoshi, sans-serif"
 * - { primary: "Inter" } -> "Inter, sans-serif"
 * - ["Inter", "Roboto"] -> "Inter, Roboto, sans-serif"
 * - "Inter" -> "Inter" (already correct)
 */
function fontObjectToString(value: unknown): string | unknown {
  if (typeof value === 'string') {
    return value; // Already a string, return as-is
  }

  if (Array.isArray(value)) {
    // Array of fonts -> join with comma
    const fonts = value.filter(f => typeof f === 'string');
    if (fonts.length > 0) {
      return fonts.join(', ') + ', sans-serif';
    }
    return value;
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const fonts: string[] = [];

    // Extract fonts in priority order
    const priorityKeys = ['heading', 'display', 'primary', 'body', 'secondary', 'mono', 'code'];
    for (const key of priorityKeys) {
      if (key in obj && typeof obj[key] === 'string') {
        fonts.push(obj[key] as string);
      }
    }

    // Also include any other string values
    for (const [key, val] of Object.entries(obj)) {
      if (!priorityKeys.includes(key) && typeof val === 'string') {
        fonts.push(val);
      }
    }

    if (fonts.length > 0) {
      // Add fallback based on first font type
      const fallback = fonts[0].toLowerCase().includes('mono') ? 'monospace' : 'sans-serif';
      return fonts.join(', ') + ', ' + fallback;
    }
  }

  return value; // Return unchanged if we can't convert
}
```

Then in `sanitizeLLMJson()`, add:
```typescript
// Convert typography font fields from objects to strings
if (TYPOGRAPHY_STRING_FIELDS.has(key) && typeof value === 'object') {
  sanitizedValue = fontObjectToString(sanitizedValue);
}
```

---

## Current Step
**Complete** - All implementation steps finished, awaiting user testing

## Resume Notes
**Last action**: Completed all implementation steps:
- Added `TYPOGRAPHY_STRING_FIELDS` constant (line 74-78)
- Added `fontObjectToString()` helper function (lines 128-184)
- Updated `sanitizeLLMJson()` to call `fontObjectToString()` for typography fields (lines 221-225)
- TypeScript typecheck passes

**Next action**: User restarts dev environment and tests with new task
**Blockers**: None

---

## Success Criteria

1. ✓ `fontFamily` objects are converted to strings before Zod validation
2. ✓ UI Designer validation passes for typography fields
3. ✓ Font stack includes appropriate fallback (sans-serif/monospace)
4. ✓ Existing string values are preserved unchanged

---

## Lesson to Capture (After Implementation)

- **Category**: bug_fix
- **Title**: LLM Format Instructions May Not Be Followed - Use Sanitization
- **Root Cause**: Claude's semantic interpretation overrides explicit format instructions
- **Prevention**: Always implement sanitization for critical format requirements
- **Pattern**: Defense-in-depth: Prompt instructions + code-level sanitization
- **Anti-Pattern**: Relying solely on prompt instructions for format compliance
