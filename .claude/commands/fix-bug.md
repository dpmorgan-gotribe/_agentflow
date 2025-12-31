---
description: Systematic bug analysis and resolution with automatic lesson capture (project)
---

# Bug Resolution: $ARGUMENTS

> **Task Tool Pattern**: This command uses parallel Task agents for comprehensive bug investigation and analysis.

---

## Phase 1: Context Loading

### 1.1 Current State

Read `.meta/current-phase.md` to understand:
- What phase we're in
- Recent work that might be related

```bash
git log --oneline -10 2>/dev/null || echo "No git history"
git diff --stat HEAD~3 2>/dev/null || echo "Cannot show diff"
```

### 1.2 Search for Similar Past Issues

Search `.meta/lessons/` for lessons with:
- Similar error messages or symptoms
- Same files/components affected
- Related categories (bug_fix, security, performance)

If found, display: "**Found similar past issue**: [lesson ID] - [summary]"

---

## Phase 2: Parallel Investigation (Task Tool)

**Spawn these Task agents IN PARALLEL for comprehensive bug analysis:**

### Task 1: Code Investigation
```
Task(subagent_type='Explore', prompt='
Investigate the bug: $ARGUMENTS

Focus on:
1. Locate the likely source code location
2. Trace the execution path
3. Identify recent changes that might have caused this
4. Find related code that might also be affected
5. Check for similar patterns elsewhere that might have same bug

Use git blame and git log to find recent changes.
')
```

### Task 2: Architecture Analysis
```
Task(subagent_type='Explore', prompt='
Analyze architecture implications of bug: $ARGUMENTS

Check:
1. What component/layer is affected?
2. Is this a design flaw vs implementation bug?
3. Are there systemic implications?
4. Does this reveal architectural debt?
5. Check ARCHITECTURE.md for relevant patterns

Reference: .claude/agents/architect/CLAUDE.md context
')
```

### Task 3: Security Impact Analysis (MANDATORY)
```
Task(subagent_type='Explore', prompt='
MANDATORY security analysis for bug: $ARGUMENTS

Determine:
1. Could this bug be exploited?
2. Is there data exposure risk?
3. Are there auth/authz implications?
4. Does this create injection vulnerabilities?
5. Check against .meta/compliance/security-requirements.md

CRITICAL: Flag any security implications for immediate action.

Reference: .claude/agents/security/CLAUDE.md context
')
```

### Task 4: Test Gap Analysis
```
Task(subagent_type='Explore', prompt='
Analyze testing gaps for bug: $ARGUMENTS

Investigate:
1. Why didn't existing tests catch this?
2. What test cases are missing?
3. What edge cases weren't covered?
4. Is there a pattern of missing coverage?
5. What regression tests are needed?

Reference: .claude/agents/tester/CLAUDE.md context
')
```

---

## Phase 3: Aggregate & Analyze

### 3.1 Synthesize Investigation Results

**Code Investigation Summary:**
- Likely source location
- Execution path traced
- Recent changes identified
- Related areas identified

**Architecture Analysis:**
- Component/layer affected
- Design vs implementation issue
- Systemic implications

**Security Impact:** (BLOCKING if issues found)
- [ ] No exploitable vulnerabilities
- [ ] No data exposure risk
- [ ] Auth/authz intact
- [ ] No injection vectors

**Test Gap Analysis:**
- Missing test cases identified
- Coverage gaps found
- Regression tests needed

### 3.2 Root Cause Analysis (5 Whys)

Based on investigation results, perform 5 Whys analysis:

1. **Why** did [symptom] happen?
   → [Cause 1]
2. **Why** did [cause 1] happen?
   → [Cause 2]
3. **Why** did [cause 2] happen?
   → [Cause 3]
4. **Why** did [cause 3] happen?
   → [Cause 4]
5. **Why** did [cause 4] happen?
   → **ROOT CAUSE**

---

## Phase 4: Solution Options

Generate 2-3 solution options:

### Option A: [Name]
| Aspect | Assessment |
|--------|------------|
| **Approach** | [Description] |
| **Pros** | [Benefits] |
| **Cons** | [Drawbacks] |
| **Complexity** | Low / Medium / High |
| **Regression Risk** | Low / Medium / High |
| **Security Impact** | None / Positive / Needs Review |

### Option B: [Name]
| Aspect | Assessment |
|--------|------------|
| **Approach** | [Description] |
| **Pros** | [Benefits] |
| **Cons** | [Drawbacks] |
| **Complexity** | Low / Medium / High |
| **Regression Risk** | Low / Medium / High |
| **Security Impact** | None / Positive / Needs Review |

### Recommendation
[Which option and why, based on multi-agent analysis]

**Ask for approval before proceeding with high-risk or architectural fixes.**

---

## Phase 5: Implementation

Once approved:

### 5.1 Implement the Fix
- Follow patterns from `.meta/rules/`
- Apply lessons from similar past issues
- Use typed errors per `error-handling-patterns.md`

### 5.2 Security Pre-Write Check
Before each file write, verify:
- [ ] Fix doesn't introduce new vulnerabilities
- [ ] Input validation maintained/improved
- [ ] No hardcoded values added
- [ ] Audit logging if sensitive area

### 5.3 Add Regression Tests
```typescript
// Test the specific bug case
describe('Bug fix: $ARGUMENTS', () => {
  it('should handle the edge case that caused the bug', () => {
    // Reproduce the exact condition
    // Verify correct behavior
  });

  it('should not regress related functionality', () => {
    // Test related code paths
  });
});
```

### 5.4 Verify the Fix
```bash
pnpm test -- --related
pnpm type-check
pnpm lint
```

- Verify original reproduction steps now work
- Confirm no new failures introduced
- Check coverage of new tests

---

## Phase 6: Knowledge Capture

### 6.1 Create Lesson Entry

Create file in `.meta/lessons/` with format: `[NNN]-[short-description].md`

```markdown
# Lesson: [Descriptive Title]

**Date**: [Today]
**Category**: bug_fix
**Phase**: [Current phase]
**Severity**: low | medium | high | critical

## Problem
$ARGUMENTS

### Symptoms
[What we observed - from investigation]

### Root Cause
[From 5 Whys analysis]

## Solution
[What we did to fix it]

### Code Changes
[Key files and what changed]

### Test Added
[What test now catches this]

## Prevention
[How to avoid this in the future]

### Patterns to Follow
- [Good pattern from this fix]

### Patterns to Avoid
- [Anti-pattern that caused this]

### Checklist Addition
- [ ] [New check for future reviews]

## Related
- Security implications: [Yes/No - details if yes]
- Architecture impact: [Yes/No - details if yes]

## Tags
#[component] #[category] #[tech]
```

### 6.2 Update Tracking

1. Add entry to `.meta/lessons/index.md`
2. If critical bug, update `CLAUDE.md` under "Known Gotchas"
3. If security-related, update `.meta/compliance/security-requirements.md`

---

## Phase 7: Summary

### Bug Resolution Summary

| Item | Details |
|------|---------|
| **Bug** | $ARGUMENTS |
| **Root Cause** | [From 5 Whys] |
| **Solution Applied** | [Option chosen] |
| **Tests Added** | [Count and description] |
| **Lesson Captured** | `.meta/lessons/[filename]` |
| **Security Impact** | None / Addressed / N/A |

### Follow-up Actions
- [ ] Monitor for recurrence
- [ ] Review related code areas
- [ ] Consider `/checkpoint` if significant fix

### Next Steps
- If more bugs: `/fix-bug [next bug]`
- If ready for review: `/review recent`
- If milestone complete: `/checkpoint`
