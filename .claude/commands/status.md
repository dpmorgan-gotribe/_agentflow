---
description: Check current development status, phase progress, and context
---

# Development Status Check

## Current State

### Phase Information
Read and summarize the current phase from `.meta/current-phase.md`

### Implementation Plan Progress
Check `.meta/plans/current-plan.md` and report:
- Current phase number and name
- Completed tasks (count and list)
- Pending tasks (count and list)  
- Any blocked tasks and why
- Next recommended action

### Recent Activity
Check git log for recent commits:
```bash
git log --oneline -5 2>/dev/null || echo "Not a git repository yet"
```

### Test Status
```bash
npm test 2>/dev/null | tail -5 || echo "Tests not configured yet"
```

### Recent Lessons to Keep in Mind
List the 3 most recent lessons from `.meta/lessons/` that are relevant to the current phase.

## Summary

Provide a brief summary:
1. Where we are (phase/task)
2. What's next
3. Any blockers or concerns
4. Relevant lessons to remember for current work
