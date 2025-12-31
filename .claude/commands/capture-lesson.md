---
description: Capture a lesson learned for future reference
---

# Capture Lesson

## Lesson Identification

I'll help you capture a lesson from recent work. Let's go through this systematically.

### What type of lesson is this?

1. **bug_fix** - We fixed a bug and learned something
2. **pattern** - We discovered a useful code pattern
3. **architecture** - We made an architectural decision
4. **performance** - We learned something about performance
5. **security** - We learned something about security
6. **process** - We learned something about our development process
7. **tool** - We learned something about a tool or library

---

## Lesson Details

I'll ask you a few questions to capture this properly:

### 1. What happened?
Describe the situation - what were you trying to do, what went wrong or what did you discover?

### 2. Why did it happen? (Root Cause)
Use the 5 Whys technique if helpful:
- Why did [symptom] happen?
- Why? (deeper)
- Why? (deeper)
- Why? (deeper)
- Why? (root cause)

### 3. What was the solution or insight?
What did you do to fix it, or what did you learn?

### 4. How can we prevent this / apply this in the future?
- What patterns should we follow?
- What patterns should we avoid?
- What checks should we add?

### 5. What components/areas does this apply to?
- Which parts of the codebase?
- Which phases of development?
- Which types of tasks?

---

## Generate Lesson File

Based on your answers, I'll create a lesson file.

### Determine lesson number
```bash
ls .meta/lessons/*.md 2>/dev/null | wc -l
```

### Create lesson file at `.meta/lessons/[NNN]-[slug].md`:

```markdown
# Lesson: [Descriptive Title]

**ID**: [NNN]
**Date**: [Today's date]
**Category**: [category from above]
**Phase**: [Current phase number]
**Severity**: low | medium | high | critical

## Context
[What were we trying to do?]

## Problem / Discovery
[What went wrong or what did we discover?]

## Root Cause
[Why did this happen? Include 5 Whys if applicable]

## Solution / Insight
[What we did or learned]

## Prevention / Application

### Do This ✅
- [Pattern to follow]
- [Check to add]

### Avoid This ❌
- [Anti-pattern]
- [Common mistake]

### Code Example

```typescript
// ❌ Before (problematic)
[bad code example if applicable]

// ✅ After (correct)
[good code example if applicable]
```

## Applicability

### Components
- [Component 1]
- [Component 2]

### Phases
- [Phase numbers where this applies]

### Task Types
- [Types of tasks where this is relevant]

## Tags
#[tag1] #[tag2] #[tag3]

## Related Lessons
- [Links to related lessons if any]
```

---

## Update Index

Add entry to `.meta/lessons/index.md`:

```markdown
| ID | Date | Category | Title | Tags |
|----|------|----------|-------|------|
| [NNN] | [Date] | [Category] | [Title] | [Tags] |
```

---

## Update CLAUDE.md (If Critical)

If this is a critical pattern that should ALWAYS be remembered:

Ask: "Is this critical enough to add to CLAUDE.md?"

If yes, add to the appropriate section:
- **Critical Patterns** - For patterns that must always be followed
- **Known Gotchas** - For common pitfalls to avoid
- **Security Patterns** - For security-related learnings

---

## Confirmation

### Lesson Captured ✅

**Saved to**: `.meta/lessons/[NNN]-[slug].md`
**Index updated**: `.meta/lessons/index.md`
**CLAUDE.md updated**: [Yes/No]

### This lesson will be automatically loaded when:
- Working on related components
- Starting phases where this applies
- Fixing similar bugs
- Implementing similar features

---

## Quick Capture Template

If you want to capture a lesson quickly, just tell me:

```
/capture-lesson

Bug: [what went wrong]
Cause: [why]
Fix: [what we did]
Prevent: [how to avoid in future]
```

And I'll format it properly.
