---
description: Implement a feature or task following the plan and applying lessons (project)
---

# Implement: $ARGUMENTS

> **Task Tool Pattern**: This command uses parallel Task agents for multi-perspective analysis before implementation.

---

## Phase 1: Pre-Implementation Validation

### 1.1 Validate Against Plan

Read `.meta/plans/current-plan.md` and `.meta/current-phase.md` to verify:
- [ ] This task is part of the current phase
- [ ] All dependencies are satisfied
- [ ] Task acceptance criteria are clear

If this task is NOT in the current phase, STOP and ask:
> "This task doesn't appear to be in the current phase. Should we:
> a) Add it to the plan first
> b) Proceed anyway (explain why)
> c) Work on a different task"

### 1.2 Retrieve Relevant Lessons

Search `.meta/lessons/` for lessons related to:
- The components this task touches
- Similar past implementations
- Patterns that should be applied

Display relevant lessons and confirm review.

---

## Phase 2: Parallel Analysis (Task Tool)

**Spawn these Task agents IN PARALLEL for comprehensive analysis:**

### Task 1: Architecture Analysis
```
Task(subagent_type='Explore', prompt='
Analyze architecture implications for implementing: $ARGUMENTS

Check:
1. How does this fit with ARCHITECTURE.md?
2. What components/modules are affected?
3. What integration points exist?
4. Are there architectural patterns to follow?
5. Any database schema changes needed?

Reference: .claude/agents/architect/CLAUDE.md context
')
```

### Task 2: Backend/Implementation Analysis
```
Task(subagent_type='Explore', prompt='
Review backend patterns and existing code for: $ARGUMENTS

Check:
1. What existing code can be reused?
2. What files need to be created/modified?
3. What Zod schemas are needed for validation?
4. What error types should be used?
5. Review .meta/rules/ for applicable patterns:
   - constants-separation.md
   - environment-configuration.md
   - component-structure.md
   - error-handling-patterns.md

Reference: .claude/agents/backend/CLAUDE.md context
')
```

### Task 3: Security Analysis (MANDATORY)
```
Task(subagent_type='Explore', prompt='
Perform MANDATORY security analysis for: $ARGUMENTS

Check against .meta/compliance/security-requirements.md:
1. Authentication/authorization requirements
2. Input validation needs (Zod schemas)
3. RLS policy requirements for new tables
4. Injection prevention (SQL, command, XSS)
5. Secrets handling - no hardcoded values
6. Audit logging requirements
7. OWASP Top 10 implications

CRITICAL: Block implementation if security issues found.

Reference: .claude/agents/security/CLAUDE.md context
')
```

### Task 4: Test Planning
```
Task(subagent_type='Explore', prompt='
Create test plan for: $ARGUMENTS

Check:
1. What unit tests are needed?
2. What integration tests are needed?
3. What edge cases must be covered?
4. What error scenarios to test?
5. Coverage targets (80% minimum)
6. Mock requirements for external dependencies

Reference: .claude/agents/tester/CLAUDE.md context
')
```

---

## Phase 3: Aggregate & Plan

### 3.1 Synthesize Analysis Results

Combine insights from all Task agents:

**Architecture Summary:**
- Integration points identified
- Patterns to follow
- Schema changes needed

**Implementation Summary:**
- Files to create/modify
- Reusable code identified
- Validation schemas needed

**Security Requirements:** (BLOCKING if issues)
- [ ] Auth requirements met
- [ ] Input validation planned
- [ ] RLS policies designed
- [ ] No secrets in code
- [ ] Audit logging included

**Test Plan:**
- Unit tests planned
- Integration tests planned
- Edge cases identified

### 3.2 Implementation Plan

Present implementation approach:

1. **Files to Create:**
   - `path/to/file.ts` - Description

2. **Files to Modify:**
   - `path/to/existing.ts` - Changes

3. **Key Design Decisions:**
   - Decision 1: Rationale
   - Decision 2: Rationale

4. **Test Strategy:**
   - Unit tests for: ...
   - Integration tests for: ...

5. **Compliance Checklist:**
   - [ ] Constants separated per `.meta/rules/constants-separation.md`
   - [ ] Environment config per `.meta/rules/environment-configuration.md`
   - [ ] Component structure per `.meta/rules/component-structure.md`
   - [ ] Error handling per `.meta/rules/error-handling-patterns.md`
   - [ ] Security requirements per `.meta/compliance/security-requirements.md`

**Ask for approval before proceeding.**

---

## Phase 4: Implementation

Once approved, implement the feature:

### 4.1 Create/Modify Files
- Follow project patterns in CLAUDE.md
- Apply rules from `.meta/rules/`
- Use typed errors from error-handling-patterns.md

### 4.2 Write Tests Alongside
- Create test file next to implementation
- Cover happy path, edge cases, error cases
- Mock external dependencies

### 4.3 Security Pre-Write Check
Before each file write, verify:
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Auth guards on endpoints
- [ ] RLS on new tables

### 4.4 Verify Implementation
```bash
pnpm test -- --related
pnpm type-check
pnpm lint
```

---

## Phase 5: Post-Implementation

### 5.1 Self-Review
Run self-review against criteria:
- [ ] All tests pass
- [ ] No type errors
- [ ] No lint errors
- [ ] Acceptance criteria met
- [ ] Security checklist passed
- [ ] Coverage >= 80%

### 5.2 Update Progress
Mark task complete in `.meta/current-phase.md`:
```markdown
- [x] $ARGUMENTS ✓ [date]
```

### 5.3 Lesson Check
Ask: "Did we encounter anything unexpected or learn something that should be captured as a lesson?"

If yes, prompt to run `/capture-lesson`.

### 5.4 Next Steps
- Suggest next task from plan
- If last task in phase, suggest `/checkpoint`
- If security issues found, document and escalate
