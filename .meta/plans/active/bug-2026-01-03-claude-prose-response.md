# Bug Fix: Claude CLI Returns Prose Instead of JSON

## Metadata
| Field | Value |
|-------|-------|
| Created | 2026-01-03 |
| Status | complete |
| Type | bug_fix |
| Phase | 3 (Design System) |
| Priority | critical |
| Related | bug-2026-01-03-schema-validation-errors.md, bug-2026-01-03-gap-and-content-sanitization.md |

## Original Prompt
> UI Designer agent fails with JSON parse error - Claude responds with prose

## Error Details
```
[ClaudeCliProvider] stdout length: 1366
[ClaudeCliProvider] stdout preview: I've generated a comprehensive UI design for the Tribes community platform. The design includes:

**6 Complete Pages:**
1. **Home** - Dashboard with My Tribes (horizontal scroll), Upcoming Events list, and Recent Activity feed
2. **Discover** - Search, categories, featured tribes, nearby tribes, and upcoming public events
3. **Tribe Detail** - Cover image, tribe info, join button, and tabs (About, Feed, Chat, Events, Members)
4. **Event Detail** - Event cover, RSVP options (Going/Interested), de...

[DEBUG] [ui_designer] JSON parse failed {
  rawLength: 1365,
  extractedLength: 1365,
  rawPreview: "I've generated a comprehensive UI design for the Tribes..."
}

[ERROR] [ui_designer] Agent execution failed {
  error: `Failed to parse JSON response: SyntaxError: Unexpected token 'I', "I've gener"... is not valid JSON`
}
```

---

## The Problem

### Immediate Symptom
UI Designer agent fails because Claude CLI returns natural language prose instead of JSON. The response is a conversational summary ("I've generated a comprehensive UI design...") with no JSON content whatsoever.

### This is DIFFERENT from Previous Bugs

| Bug | Symptom | Claude Returns | Solution |
|-----|---------|----------------|----------|
| Schema validation | Wrong types | JSON with wrong types | Sanitization |
| Gap/content | Number instead of string | JSON `"gap": 0` | Type coercion |
| **This bug** | **No JSON at all** | **Prose summary** | **Prompt enforcement** |

### Root Cause Analysis

```
WHY does JSON.parse() fail?
  └─▶ No JSON in the response - just prose text

WHY does Claude return prose?
  └─▶ Claude CLI is ignoring the JSON_ONLY_INSTRUCTION

WHY is the instruction ignored?
  └─▶ Several possibilities:
      1. Instruction buried too deep in system prompt
      2. User prompt doesn't reinforce the JSON requirement
      3. Claude interprets task as "conversational"
      4. No explicit format prefix requirement

ROOT CAUSE: Weak prompt enforcement
  - JSON instruction only appears at END of system prompt
  - User prompt ends with "Output valid JSON only" but doesn't FORCE it
  - No explicit "start with {" requirement that Claude MUST follow
```

### Evidence from Logs

```
[ClaudeCliProvider] Executing via bash: export CLAUDE_CODE_MAX_OUTPUT_TOKENS=200000;
  cat 'C:/Users/nagro/AppData/Local/Temp/claude-prompt-xxx.txt' | claude -p
```

The prompt is being sent correctly, but Claude's response starts with "I've generated" instead of `{`.

---

## Solution: Stronger JSON Enforcement

### Core Principle
> **If Claude can start with ANY text other than `{`, it might.**
> Force the first character by making it an explicit requirement.

### Solution Design

Add a "RESPONSE FORMAT LOCK" that:
1. Appears at the END of the system prompt (existing `JSON_ONLY_INSTRUCTION`)
2. Appears at the START of the user prompt (NEW)
3. Specifies the EXACT first characters required (NEW)

```typescript
const JSON_RESPONSE_PREFIX = `
RESPONSE FORMAT REMINDER:
Your response MUST start with exactly this text: {"projectName":
Do NOT include any other text before this JSON opening.
`;
```

### Why This Will Work

| Approach | Position | Strength |
|----------|----------|----------|
| JSON_ONLY_INSTRUCTION | End of system prompt | Medium |
| "Output valid JSON only" | End of user prompt | Medium |
| **JSON_RESPONSE_PREFIX** | **Start of user prompt** | **Strong** |
| **Exact prefix requirement** | **Both prompts** | **Strong** |

By sandwiching the user's actual request between two format requirements, Claude has no opportunity to "slip" into conversational mode.

---

## Implementation Plan

### Phase 1: Add JSON Response Prefix Constant

**File**: `packages/agents/src/agents/ui-designer.ts`

- [x] 1.1 Create `JSON_RESPONSE_PREFIX` constant with exact prefix requirement ✓
- [x] 1.2 Add projectName-specific example for UI Designer ✓

### Phase 2: Update User Prompt

**File**: `packages/agents/src/agents/ui-designer.ts`

- [x] 2.1 Prepend `JSON_RESPONSE_PREFIX` to `buildUserPrompt()` return value ✓
- [x] 2.2 Prepend to `buildMegaPageUserPrompt()` return value ✓
- [x] 2.3 Prepend to `buildFullDesignUserPrompt()` return value ✓
- [x] 2.4 Prepend to `buildSpecificationUserPrompt()` (if exists) - N/A (uses system prompt)

### Phase 3: Strengthen Error Handling

**File**: `packages/agents/src/base-agent.ts`

- [x] 3.1 Add prose detection in `parseJSON()` before parse attempt ✓
- [x] 3.2 Add specific error message when response looks like prose ✓
- [x] 3.3 Include first 50 chars in error for debugging ✓

### Phase 4: Verification

- [x] 4.1 TypeScript typecheck passes ✓
- [ ] 4.2 Restart dev environment (user action)
- [ ] 4.3 Test with new task (user testing)
- [ ] 4.4 Verify JSON is returned (not prose) (user testing)

---

## Code Changes

### File: `packages/agents/src/agents/ui-designer.ts`

#### Add Constant (after `JSON_ONLY_INSTRUCTION`)

```typescript
/**
 * Prefix for user prompts to reinforce JSON-only output
 * This appears at the START of the user prompt to "sandwich" the content
 */
const JSON_RESPONSE_PREFIX = `
CRITICAL: Your response must be ONLY valid JSON.
- Start your response with EXACTLY: {"projectName":
- Include ONLY the JSON object
- NO prose, NO explanations, NO markdown

`;
```

#### Update buildUserPrompt (line 412)

```typescript
protected buildUserPrompt(request: AgentRequest): string {
  // ... existing code ...

  // PREPEND format reminder at the start
  return JSON_RESPONSE_PREFIX + prompt;
}
```

### File: `packages/agents/src/base-agent.ts`

#### Update parseJSON (line 538)

```typescript
protected parseJSON<T>(text: string): T {
  // Detect prose response before attempting parse
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    const proseIndicators = ["I've", "Here", "I have", "I will", "Let me", "Sure"];
    const looksLikeProse = proseIndicators.some(p => trimmed.startsWith(p));

    if (looksLikeProse) {
      this.log('error', 'Claude returned prose instead of JSON', {
        preview: trimmed.substring(0, 200),
      });
      throw new AgentExecutionError(
        `Claude returned prose instead of JSON. Response starts with: "${trimmed.substring(0, 50)}..."`,
        'PROSE_RESPONSE',
        true // Recoverable - retry may succeed with stronger prompting
      );
    }
  }

  // ... existing extraction and parsing code ...
}
```

---

## Current Step
**Complete** - Implementation finished, awaiting user testing

## Resume Notes
**Last action**: Implemented all code changes:
- Added `JSON_RESPONSE_PREFIX` constant to ui-designer.ts (line 105-109)
- Updated `buildUserPrompt()` to prepend prefix (line 448)
- Updated `buildMegaPageUserPrompt()` to prepend prefix (line 1093)
- Updated `buildFullDesignUserPrompt()` to prepend prefix (line 1456)
- Added prose detection in base-agent.ts `parseJSON()` (lines 539-556)
- TypeScript typecheck passes
**Next action**: User restarts dev environment and tests with new task
**Blockers**: None

---

## Success Criteria

1. [ ] UI Designer returns JSON starting with `{`
2. [ ] No prose responses like "I've generated..."
3. [ ] All mockups generate successfully
4. [ ] Retry logic works for edge cases

---

## Lesson to Capture (After Implementation)

- **Category**: bug_fix
- **Title**: Force JSON Output with Prefix Requirements
- **Root Cause**: LLM ignored JSON instruction and responded conversationally
- **Prevention**: Add explicit prefix requirement ("start with exactly: {")
- **Pattern**: Sandwich user request between format requirements
- **Anti-Pattern**: Relying on a single instruction at the end of a long prompt

---

## Alternative Approaches Considered

### 1. Retry with Stronger Prompt (Rejected)
- Adds latency and cost
- Doesn't fix the root cause
- Would still fail sometimes

### 2. Claude API Forced JSON Mode (Not Available)
- Claude CLI doesn't support forced JSON mode
- Would require API key (cost increase)

### 3. Multiple JSON Extraction Attempts (Weak)
- If there's no JSON, no amount of extraction helps
- Already have robust `extractJSON()` function

### 4. Prefix Requirement (Selected)
- Zero additional cost
- No latency increase
- Addresses root cause directly
- Easy to implement and maintain
