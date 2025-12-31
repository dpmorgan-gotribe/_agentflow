---
description: Start working on a specific phase of the implementation plan
---

# Start Phase $ARGUMENTS

## Phase Initialization Workflow

### Step 1: Load Phase Context

Read `.meta/plans/current-plan.md` and locate Phase $ARGUMENTS.

Extract and display:
- Phase name and description
- Gate type (automatic or human_approval)
- Checkpoint criteria
- All tasks with their dependencies and acceptance criteria
- Any phase-specific notes or warnings

### Step 2: Check Prerequisites

Verify previous phases are complete:
- If Phase $ARGUMENTS > 1, confirm Phase $ARGUMENTS-1 checkpoint exists in `.meta/checkpoints/`
- If previous phase required human approval, confirm approval exists
- List any dependencies from previous phases that this phase builds on

### Step 3: Load Relevant Lessons

Search `.meta/lessons/` for lessons tagged with:
- This phase number
- Components/areas this phase touches
- Patterns that apply to this phase's tasks

Display a summary of relevant lessons to keep in mind.

### Step 4: Update Current Phase Tracking

Update `.meta/current-phase.md` with:
```markdown
# Current Phase

**Phase**: $ARGUMENTS
**Started**: [current date/time]
**Status**: in_progress

## Focus Areas
[List from plan]

## Tasks
[List with checkboxes]

## Lessons to Remember
[Relevant lessons]

## Session Notes
[Empty - to be filled during work]
```

### Step 5: Provide Phase Briefing

Give me a briefing:
1. What this phase accomplishes
2. Key challenges to anticipate
3. Lessons from past work that apply
4. Recommended task order (considering dependencies)
5. First task to start with

Ask if I'm ready to begin or have questions about the phase.
