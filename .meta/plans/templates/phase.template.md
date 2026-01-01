# Phase $PHASE_NUM: $PHASE_NAME

## Metadata
| Field | Value |
|-------|-------|
| Created | $TIMESTAMP |
| Status | in_progress |
| Type | phase |
| Phase | $PHASE_NUM |
| Gate | $GATE_TYPE |
| Total Tasks | $TASK_COUNT |

## Original Prompt
> $PROMPT

## Phase Overview
$DESCRIPTION

## Tasks in Phase
| # | Task ID | Name | Status | Dependencies |
|---|---------|------|--------|--------------|
$TASK_TABLE

## Current Task
**$CURRENT_TASK_ID**: $CURRENT_TASK_NAME

## Dependency Graph
```
$DEPENDENCY_GRAPH
```

## Steps (Per Task)
Repeat for each task:
1. Analysis (architect, security, reviewer)
2. Implementation (frontend_dev, backend_dev)
3. Verification (tester, typecheck, lint)
4. Mark complete

## Progress
- Completed: $COMPLETED_COUNT / $TASK_COUNT
- Current: $CURRENT_TASK_ID
- Blocked: $BLOCKED_TASKS

## Files Modified (All Tasks)
| File | Task | Action | Status |
|------|------|--------|--------|

## Resume Notes
Last completed task:
Current task:
Next task:
Blockers:

## Gate Checklist
- [ ] All tasks complete
- [ ] All tests passing
- [ ] Checkpoint created
- [ ] Gate type: $GATE_TYPE
- [ ] If human_approval: Awaiting approval
