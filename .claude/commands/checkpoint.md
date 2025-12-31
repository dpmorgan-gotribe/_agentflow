---
description: Create a checkpoint - save progress and verify state (project)
---

# Checkpoint Creation

> **Task Tool Pattern**: This command uses parallel Task agents to validate project state before creating a checkpoint.

---

## Phase 1: Gather Current State

### 1.1 Git Status
```bash
git status --short 2>/dev/null || echo "Not a git repository"
git log --oneline -5 2>/dev/null || echo "No commits yet"
```

### 1.2 Build Status
```bash
pnpm type-check 2>&1 | tail -10 || echo "Type check not configured"
pnpm lint 2>&1 | tail -10 || echo "Lint not configured"
```

### 1.3 Test Status
```bash
pnpm test 2>&1 | tail -20 || echo "Tests not configured"
```

---

## Phase 2: Parallel Validation (Task Tool)

**Spawn these Task agents IN PARALLEL to validate checkpoint readiness:**

### Task 1: Compliance Validation
```
Task(subagent_type='Explore', prompt='
Validate compliance status for checkpoint.

Check against .meta/compliance/COMPLIANCE-CHECKLIST.md:

1. **Security Compliance**
   - [ ] All new endpoints have auth guards
   - [ ] All new tables have RLS policies
   - [ ] No hardcoded secrets in code
   - [ ] Input validation on all endpoints
   - [ ] Check .meta/compliance/security-requirements.md

2. **Privacy Compliance**
   - [ ] New PII fields documented
   - [ ] Data flows documented
   - [ ] Check .meta/compliance/privacy-requirements.md

3. **Quality Gates**
   - [ ] Test coverage >= 80%
   - [ ] No critical lint errors
   - [ ] TypeScript strict mode passes

Report any blocking compliance issues.
')
```

### Task 2: Plan Progress Review
```
Task(subagent_type='Explore', prompt='
Review progress against implementation plan.

Read .meta/plans/current-plan.md and .meta/current-phase.md:

1. **Phase Progress**
   - What tasks are completed?
   - What tasks remain?
   - Any blocked tasks?

2. **Plan Alignment**
   - Are we on track?
   - Any scope creep?
   - Any missed dependencies?

3. **Gate Criteria**
   - What type of gate? (automatic/human_approval)
   - Are gate criteria satisfied?
   - Any blockers for phase completion?

Report current progress percentage and blockers.
')
```

### Task 3: Lessons Applied Check
```
Task(subagent_type='Explore', prompt='
Verify lessons have been applied this session.

Search .meta/lessons/ for:
1. Lessons relevant to current phase work
2. Patterns that should have been followed
3. Anti-patterns that should have been avoided

Report:
- Which lessons were applicable
- Whether they were applied
- Any new lessons that should be captured
')
```

### Task 4: Architecture Consistency
```
Task(subagent_type='Explore', prompt='
Verify architecture consistency.

Check:
1. Do new files follow ARCHITECTURE.md structure?
2. Are new components in correct directories?
3. Do dependencies flow in correct direction?
4. Any new circular dependencies?
5. ADR needed for new decisions?

Reference: .claude/agents/architect/CLAUDE.md context
')
```

---

## Phase 3: Aggregate Validation Results

### 3.1 Compliance Status

| Category | Status | Details |
|----------|--------|---------|
| Security | ✅/⚠️/❌ | |
| Privacy | ✅/⚠️/❌ | |
| Quality | ✅/⚠️/❌ | |
| Licensing | ✅/⚠️/❌ | |

### 3.2 Plan Progress

| Metric | Value |
|--------|-------|
| Phase | [N] |
| Tasks Completed | X/Y |
| Tasks Remaining | Z |
| Blocked Tasks | B |
| Progress | X% |

### 3.3 Quality Metrics

| Metric | Status | Value |
|--------|--------|-------|
| Tests | ✅/❌ | X passing, Y failing |
| Type Check | ✅/❌ | Pass/Fail |
| Lint | ✅/❌ | X warnings, Y errors |
| Coverage | ✅/❌ | X% |

### 3.4 Architecture Status

| Check | Status |
|-------|--------|
| Structure Compliance | ✅/❌ |
| Dependency Flow | ✅/❌ |
| No Circular Deps | ✅/❌ |
| ADRs Updated | ✅/N/A |

---

## Phase 4: Phase Completion Check

### 4.1 Is Current Phase Complete?

Based on validation:

**If NO (more tasks remain):**
- Create mid-phase checkpoint
- Note remaining tasks
- Proceed to checkpoint creation

**If YES (all tasks complete):**
- Verify gate criteria from plan
- Check gate type

### 4.2 Gate Type Handling

**If gate type is `automatic`:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    ✅ AUTOMATIC GATE PASSED                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  All phase tasks are complete.                                  │
│  All quality gates pass.                                        │
│  Proceeding to next phase is approved.                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**If gate type is `human_approval`:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    ⏸️  HUMAN APPROVAL REQUIRED                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase [N] checkpoint requires your approval.                   │
│                                                                 │
│  Please review:                                                 │
│  - [ ] Architecture decisions are sound                         │
│  - [ ] Security considerations addressed                        │
│  - [ ] Performance is acceptable                                │
│  - [ ] Code quality meets standards                             │
│  - [ ] Tests provide adequate coverage                          │
│  - [ ] Compliance requirements met                              │
│                                                                 │
│  Type 'approved' to proceed to next phase                       │
│  Or provide feedback for changes needed                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 5: Create Checkpoint File

Create checkpoint at `.meta/checkpoints/checkpoint-[NNN]-phase-[N]-[YYYY-MM-DD].md`:

```markdown
# Checkpoint [NNN]: Phase [N] - [Description]

**Created**: [timestamp]
**Git SHA**: [commit hash or "uncommitted"]
**Phase**: [N]
**Status**: [in_progress | phase_complete | approved]

## Validation Summary

| Category | Status |
|----------|--------|
| Compliance | ✅/⚠️/❌ |
| Plan Progress | X% |
| Quality Gates | ✅/❌ |
| Architecture | ✅/❌ |

## Progress Summary

### Completed Tasks
- [x] Task 1 - [date]
- [x] Task 2 - [date]

### Remaining Tasks
- [ ] Task 3
- [ ] Task 4

### Blocked Tasks
- [ ] Task 5 - Blocked by: [reason]

## Quality Metrics

| Metric | Status | Value |
|--------|--------|-------|
| Tests | ✅/❌ | X passing, Y failing |
| Type Check | ✅/❌ | Pass/Fail |
| Lint | ✅/⚠️ | X warnings, Y errors |
| Coverage | ✅/❌ | X% |

## Compliance Status

| Requirement | Status |
|-------------|--------|
| Security checks | ✅/❌ |
| Privacy compliance | ✅/❌ |
| License compliance | ✅/❌ |
| Accessibility (if applicable) | ✅/N/A |

## Session Notes
[Key decisions made, issues encountered, context for future sessions]

## Lessons Applied
- [lesson-XXX]: [How it was applied]

## New Lessons to Capture
- [ ] [Description of pattern/insight to capture]

## Files Changed
[Key files created or modified this session]

## Next Steps
1. [Next task or action]
2. [Following task]

## Human Approval
**Required**: [Yes/No]
**Status**: [Pending/Approved/N/A]
**Approved By**: [Name if approved]
**Approved At**: [Timestamp if approved]
**Notes**: [Any approval notes]
```

---

## Phase 6: Update Tracking Files

### 6.1 Update `.meta/current-phase.md`

Add checkpoint reference:
```markdown
## Session Notes

### Checkpoint [NNN] - [date]
- Progress: X/Y tasks complete
- Status: [in_progress/phase_complete]
- Next: [what to do next]
```

### 6.2 Update `.meta/plans/current-plan.md`

Mark completed tasks:
```markdown
- [x] Task name ✓ [date]
```

### 6.3 Update `.meta/lessons/index.md`

If new lessons identified, add placeholders for `/capture-lesson`.

---

## Phase 7: Summary

### Checkpoint Created

```
📍 Checkpoint saved to: .meta/checkpoints/checkpoint-[NNN]-phase-[N]-[date].md
```

### Status Summary

| Metric | Value |
|--------|-------|
| Phase | [N] |
| Progress | X/Y tasks (Z%) |
| Quality Gates | All Pass / X Failing |
| Compliance | Pass / Needs Review |
| Gate Type | Automatic / Human Approval |
| Gate Status | Passed / Pending |

### Recommendations

Based on current state:

**If phase complete and approved:**
> Ready for next phase! Run `/start-phase [N+1]`

**If phase complete, pending approval:**
> Waiting for human review. See approval checklist above.

**If in progress:**
> Continue with: `/implement [next task]`

**If quality gates failing:**
> Fix issues before continuing:
> - Run `pnpm test` to see failing tests
> - Run `pnpm type-check` for type errors
> - Run `pnpm lint` for lint issues

---

## Quick Commands

After checkpoint:
- `/start-phase [N+1]` - Begin next phase (if current complete + approved)
- `/implement [task]` - Continue with next task
- `/status` - Review full project status
- `/capture-lesson` - Capture any new learnings
