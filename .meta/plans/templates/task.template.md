# Task: $TITLE

## Metadata
| Field | Value |
|-------|-------|
| Created | $TIMESTAMP |
| Status | in_progress |
| Type | task |
| Phase | $PHASE |
| Task ID | $TASK_ID |

## Original Prompt
> $PROMPT

## Context Loaded
- Current Phase: $PHASE_NAME
- Task from Plan: $TASK_ID - $TASK_NAME
- Dependencies: $DEPENDENCIES
- Relevant Lessons: $LESSONS

## Acceptance Criteria
$ACCEPTANCE

## Steps
### Analysis
- [ ] 1. Architect review (design fit)
- [ ] 2. Security scan (blocking)
- [ ] 3. Identify file boundaries

### Implementation
- [ ] 4. Create/modify files
- [ ] 5. Follow patterns from rules/
- [ ] 6. Add tests (80% coverage)

### Verification
- [ ] 7. pnpm typecheck
- [ ] 8. pnpm test
- [ ] 9. pnpm lint
- [ ] 10. Mark task complete in current-plan.md

## Current Step
**Step 1**: Architect review

## File Boundaries
| Agent | Can Modify |
|-------|-----------|
| frontend_dev | apps/web/**, packages/ui/** |
| backend_dev | apps/api/**, packages/** |

## Files to Modify
| File | Action | Status |
|------|--------|--------|

## Agent Work
| Agent | Task | Status | Output |
|-------|------|--------|--------|

## Resume Notes
Last action:
Next action:
Blockers:
