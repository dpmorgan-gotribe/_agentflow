---
description: Comprehensive code review with security and quality checks (project)
---

# Code Review: $ARGUMENTS

> **Task Tool Pattern**: This command uses parallel Task agents for multi-perspective code review covering security, quality, performance, and testing.

---

## Phase 1: Scope Identification

### 1.1 Determine Review Scope

Interpret `$ARGUMENTS`:
- If file path → Review that specific file
- If "recent" → Review files changed in last commit
- If "staged" → Review staged files
- If directory → Review all files in directory
- If empty → Review files changed since last checkpoint

```bash
# Get files based on scope
git diff --name-only HEAD~1 2>/dev/null || \
find src -name "*.ts" -newer .meta/checkpoints/ 2>/dev/null | head -20
```

### 1.2 Load Context

Read `.meta/current-phase.md` and `.meta/lessons/index.md` for:
- Current phase context
- Recent lessons that might apply
- Known patterns to verify

---

## Phase 2: Parallel Review (Task Tool)

**Spawn these Task agents IN PARALLEL for comprehensive review:**

### Task 1: Security Review (MANDATORY)
```
Task(subagent_type='Explore', prompt='
Perform MANDATORY security review for: $ARGUMENTS

Check against .meta/compliance/security-requirements.md:

1. **Input Validation**
   - All external inputs validated with Zod
   - No string concatenation in SQL
   - Proper sanitization

2. **Authentication/Authorization**
   - All endpoints have auth guards
   - RLS policies on new tables
   - Ownership checks on mutations

3. **Secrets**
   - No hardcoded API keys, passwords, tokens
   - No hardcoded URLs that should be env vars
   - No private IPs or internal hostnames

4. **Injection Prevention**
   - SQL: Parameterized queries only
   - Command: No shell with user input
   - XSS: Content sanitized

5. **OWASP Top 10**
   - Check each applicable item

CRITICAL: Block review if security issues found.

Reference: .claude/agents/security/CLAUDE.md context
')
```

### Task 2: Code Quality Review
```
Task(subagent_type='Explore', prompt='
Review code quality for: $ARGUMENTS

Check:
1. **Readability**
   - Clear, self-documenting code
   - Meaningful variable/function names
   - Appropriate structure

2. **TypeScript Standards**
   - Explicit types (no implicit any)
   - Proper interface usage
   - Null safety

3. **Patterns**
   - Follows .meta/rules/component-structure.md
   - Follows .meta/rules/error-handling-patterns.md
   - Follows .meta/rules/constants-separation.md
   - DRY principle applied

4. **Architecture**
   - Fits with ARCHITECTURE.md
   - No circular dependencies
   - Proper layer separation

Reference: .claude/agents/reviewer/CLAUDE.md context
')
```

### Task 3: Test Coverage Review
```
Task(subagent_type='Explore', prompt='
Review test coverage for: $ARGUMENTS

Verify:
1. **Coverage**
   - New code has corresponding tests
   - Coverage >= 80% threshold
   - Critical paths covered

2. **Test Quality**
   - Edge cases tested
   - Error scenarios tested
   - Mocks used appropriately

3. **Test Patterns**
   - Follows .claude/agents/tester/CLAUDE.md patterns
   - Proper test organization
   - Clear test descriptions

4. **Missing Tests**
   - Identify untested code paths
   - Flag missing edge cases

Reference: .claude/agents/tester/CLAUDE.md context
')
```

### Task 4: Performance Review
```
Task(subagent_type='Explore', prompt='
Review performance implications for: $ARGUMENTS

Check:
1. **Database**
   - No N+1 query patterns
   - Proper indexing considerations
   - Efficient queries

2. **Async Operations**
   - Proper async/await usage
   - No blocking operations
   - Parallel where possible

3. **Memory**
   - No obvious memory leaks
   - Proper cleanup/disposal
   - Reasonable object sizes

4. **Caching**
   - Appropriate caching strategy
   - Cache invalidation handled

Reference: General performance best practices
')
```

---

## Phase 3: Aggregate Results

### 3.1 Security Findings

**Security Status:** ✅ PASS | ⚠️ WARNINGS | ❌ BLOCKED

| Check | Status | Details |
|-------|--------|---------|
| Input Validation | ✅/⚠️/❌ | |
| Auth/Authz | ✅/⚠️/❌ | |
| Secrets | ✅/⚠️/❌ | |
| Injection Prevention | ✅/⚠️/❌ | |
| OWASP Coverage | ✅/⚠️/❌ | |

### 3.2 Code Quality Findings

**Quality Status:** ✅ PASS | ⚠️ WARNINGS | ❌ NEEDS CHANGES

| Check | Status | Details |
|-------|--------|---------|
| Readability | ✅/⚠️/❌ | |
| TypeScript Standards | ✅/⚠️/❌ | |
| Pattern Compliance | ✅/⚠️/❌ | |
| Architecture Fit | ✅/⚠️/❌ | |

### 3.3 Test Coverage Findings

**Test Status:** ✅ PASS | ⚠️ WARNINGS | ❌ NEEDS TESTS

| Metric | Value | Threshold |
|--------|-------|-----------|
| Statement Coverage | X% | 80% |
| Branch Coverage | X% | 75% |
| New Code Tested | Yes/No | Yes |
| Edge Cases | X/Y | All |

### 3.4 Performance Findings

**Performance Status:** ✅ PASS | ⚠️ WARNINGS | ❌ NEEDS OPTIMIZATION

| Check | Status | Details |
|-------|--------|---------|
| Query Efficiency | ✅/⚠️/❌ | |
| Async Patterns | ✅/⚠️/❌ | |
| Memory Usage | ✅/⚠️/❌ | |
| Caching | ✅/⚠️/❌ | |

---

## Phase 4: Detailed Findings

### 🔴 Critical Issues (Must Fix Before Merge)

> Security vulnerabilities, major bugs, or blocking issues

1. **[Issue Title]**
   - File: `path/to/file.ts:line`
   - Issue: [Description]
   - Fix: [Required action]

### 🟡 Warnings (Should Fix)

> Code quality issues, minor security concerns, missing tests

1. **[Issue Title]**
   - File: `path/to/file.ts:line`
   - Issue: [Description]
   - Suggestion: [Recommended action]

### 🔵 Suggestions (Nice to Have)

> Improvements that would enhance code but aren't required

1. **[Suggestion Title]**
   - File: `path/to/file.ts:line`
   - Suggestion: [Description]
   - Benefit: [Why this would help]

### ✅ Good Practices Observed

> Positive feedback on well-written code

1. **[Good Practice]**
   - [What was done well and why it's good]

---

## Phase 5: Lessons Check

### 5.1 Verify Lessons Applied

Check `.meta/lessons/` for relevant lessons:

| Lesson | Applicable | Applied |
|--------|------------|---------|
| [lesson-001] | Yes/No | Yes/No |
| [lesson-002] | Yes/No | Yes/No |

### 5.2 New Patterns Identified

If this review reveals new patterns worth capturing:
- [ ] Consider `/capture-lesson` for new patterns
- [ ] Update `.meta/rules/` if recurring pattern

---

## Phase 6: Review Summary

### Overall Status

```
┌─────────────────────────────────────────────────────────────────┐
│                     REVIEW STATUS: [STATUS]                      │
├─────────────────────────────────────────────────────────────────┤
│  ✅ APPROVED      - Ready for merge                             │
│  ⚠️  NEEDS CHANGES - Issues must be addressed                   │
│  ❌ BLOCKED       - Critical issues, cannot proceed             │
└─────────────────────────────────────────────────────────────────┘
```

### Summary Table

| Category | Status | Critical | Warnings | Suggestions |
|----------|--------|----------|----------|-------------|
| Security | ✅/⚠️/❌ | 0 | 0 | 0 |
| Quality | ✅/⚠️/❌ | 0 | 0 | 0 |
| Testing | ✅/⚠️/❌ | 0 | 0 | 0 |
| Performance | ✅/⚠️/❌ | 0 | 0 | 0 |

### Required Actions

If status is NEEDS CHANGES or BLOCKED:

1. [ ] [Required action 1]
2. [ ] [Required action 2]
3. [ ] [Required action 3]

### Recommendations

Optional improvements:

1. [Recommendation 1]
2. [Recommendation 2]

---

## Phase 7: Follow-up

### If Changes Needed
```
After addressing the issues above, run:
  /review $ARGUMENTS
to verify all issues are resolved.
```

### If Approved
```
Code looks good! Next steps:
  /checkpoint - Save progress if task complete
  /implement [next task] - Continue with next task
```

### Review Tracking

Add to `.meta/current-phase.md`:
```markdown
### Code Reviews
- [date] Reviewed: $ARGUMENTS - Status: [APPROVED/NEEDS CHANGES]
```
