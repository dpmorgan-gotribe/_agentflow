# Aigentflow Development Orchestrator

A structured workflow system for building Aigentflow using Claude CLI. This meta-orchestrator coordinates your development sessions through implementation plans, checkpoints, multi-perspective analysis, and automatic lesson capture.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  YOUR DEVELOPMENT SESSION                    │
│                                                              │
│   You ──► Claude CLI ──► Implementation Plan Execution      │
│                │                                             │
│                ├── /analyze (multi-perspective)              │
│                ├── /implement (phase-aware)                  │
│                ├── /fix-bug (systematic resolution)          │
│                ├── /checkpoint (save & verify)               │
│                └── /capture-lesson (knowledge extraction)    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE SYSTEM                          │
│                                                              │
│   .meta/plans/          ◄── Implementation roadmap          │
│   .meta/lessons/        ◄── Captured learnings              │
│   .meta/checkpoints/    ◄── Progress snapshots              │
│   CLAUDE.md             ◄── Active project memory           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Setup
```bash
# Clone/copy this workspace alongside your Aigentflow project
cp -r aigentflow-dev-orchestrator/ /path/to/your/aigentflow/

# Navigate to your project
cd /path/to/your/aigentflow/

# Start Claude CLI session
claude
```

### 2. Drop Your Implementation Plan
Copy your implementation plan markdown file into `.meta/plans/`:
```bash
cp my-implementation-plan.md .meta/plans/current-plan.md
```

### 3. Start a Phase
```
/start-phase 1
```
This loads the phase context, relevant lessons, and prepares Claude for that phase's work.

### 4. Work Through Tasks
```
/implement Add user authentication module
```

### 5. When Issues Arise
```
/fix-bug Authentication tokens expiring prematurely
```

### 6. Create Checkpoints
```
/checkpoint
```

### 7. Capture Learnings
```
/capture-lesson
```

---

## Directory Structure

```
your-project/
├── CLAUDE.md                    # Project context (Claude reads this automatically)
├── .claude/
│   ├── settings.json            # Claude CLI configuration
│   └── commands/                # Custom slash commands
│       ├── start-phase.md
│       ├── implement.md
│       ├── fix-bug.md
│       ├── analyze.md
│       ├── review.md
│       ├── checkpoint.md
│       ├── capture-lesson.md
│       └── status.md
│
├── .meta/                       # Meta-orchestration system
│   ├── plans/
│   │   ├── current-plan.md      # Active implementation plan
│   │   └── archive/             # Completed plans
│   │
│   ├── lessons/
│   │   ├── index.md             # Quick reference of all lessons
│   │   └── [lesson-files].md    # Individual lesson entries
│   │
│   ├── checkpoints/
│   │   └── [checkpoint-files].md
│   │
│   ├── perspectives/            # Multi-perspective analysis prompts
│   │   ├── architect.md
│   │   ├── frontend-dev.md
│   │   ├── backend-dev.md
│   │   ├── tester.md
│   │   ├── security.md
│   │   └── reviewer.md
│   │
│   ├── rules/                   # Project conventions
│   │   └── [rule-files].md
│   │
│   ├── current-phase.md         # Active phase tracking
│   └── session-context.md       # Current session state
│
└── src/                         # Your actual project code
```

---

## Core Workflows

### Starting a Development Session

Always start by checking status:
```
/status
```

This shows:
- Current phase and progress
- Recent lessons to keep in mind
- Pending tasks
- Any blockers

### The Implementation Loop

```
┌─────────────────┐
│  /start-phase   │ Load phase context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   /implement    │ Work on tasks ◄─────────────┐
└────────┬────────┘                             │
         │                                      │
         ▼                                      │
    ┌────────────┐     Yes    ┌─────────────┐  │
    │ Tests pass?├───────────►│ /checkpoint │──┘
    └─────┬──────┘            └─────────────┘
          │ No
          ▼
    ┌─────────────┐
    │  /fix-bug   │ Systematic resolution
    └─────┬───────┘
          │
          ▼
┌──────────────────┐
│ /capture-lesson  │ Extract learning
└──────────────────┘
```

### Multi-Perspective Analysis

When facing complex decisions, use:
```
/analyze Should we use Redis or PostgreSQL for the task queue?
```

This runs analysis from multiple perspectives:
1. **Architect**: System design implications
2. **Backend Dev**: Implementation complexity
3. **Tester**: Testability concerns
4. **Security**: Security implications

Claude will synthesize these into a recommendation.

### Bug Resolution Workflow

The `/fix-bug` command enforces systematic resolution:

1. **Context Loading**: Reads current phase, relevant lessons
2. **Multi-Perspective Analysis**: Considers architecture, implementation, tests
3. **Solution Generation**: Produces 2-3 options with tradeoffs
4. **Review Against Plan**: Checks solution fits overall plan
5. **Implementation**: Makes the fix
6. **Knowledge Capture**: Prompts to save lesson

---

## Implementation Plan Format

Your implementation plan should follow this structure:

```markdown
# [Project Name] Implementation Plan

## Plan Metadata
- **Version**: 1.0
- **Status**: in_progress
- **Current Phase**: 1

## Constitution (Rules That Never Break)
- All code must have TypeScript types
- Test coverage minimum 80%
- No secrets in code

---

## Phase 1: [Phase Name]
**Status**: in_progress | **Gate**: automatic | human_approval
**Checkpoint**: [What must be true to complete this phase]

### Tasks
- [ ] Task 1 description
  - Dependencies: none
  - Acceptance: [criteria]
- [ ] Task 2 description
  - Dependencies: Task 1
  - Acceptance: [criteria]

### Phase Notes
[Any important context for this phase]

---

## Phase 2: [Phase Name]
**Status**: pending
**Depends On**: Phase 1

### Tasks
- [ ] Task description

---

## Appendix: Decisions Made
| Date | Decision | Rationale |
|------|----------|-----------|
```

---

## Lessons System

### Automatic Capture
After fixing bugs or discovering patterns, run:
```
/capture-lesson
```

Claude will prompt you for:
- What was the problem?
- What was the root cause?
- How did you fix it?
- How can we prevent this in the future?

### Lesson Format
Lessons are saved as markdown in `.meta/lessons/`:

```markdown
# Lesson: [Title]
**Date**: 2025-01-28
**Category**: bug_fix | pattern | architecture | performance
**Phase**: Phase 1
**Files Affected**: src/auth/token.ts

## Problem
[What went wrong]

## Root Cause
[Why it went wrong - use 5 Whys if helpful]

## Solution
[How we fixed it]

## Prevention
[How to avoid this in the future]

## Code Pattern
\`\`\`typescript
// Good pattern
\`\`\`

## Tags
#authentication #concurrency #typescript
```

### Querying Lessons
Lessons are automatically loaded when:
- Starting a new phase (phase-relevant lessons)
- Running `/fix-bug` (similar past issues)
- Using `/implement` (relevant patterns)

---

## Checkpoints

### Creating Checkpoints
```
/checkpoint
```

This:
1. Runs tests and type checking
2. Captures current git state
3. Records completed tasks
4. Saves to `.meta/checkpoints/`

### Checkpoint Contents
```markdown
# Checkpoint: Phase 1 - Task 3 Complete
**Date**: 2025-01-28 14:30
**Git SHA**: abc123
**Phase**: 1
**Progress**: 3/5 tasks complete

## Completed Since Last Checkpoint
- [x] Task 1: Database schema
- [x] Task 2: Repository pattern
- [x] Task 3: Authentication module

## Test Status
- Tests: 45 passing, 0 failing
- Coverage: 82%
- Types: No errors

## Notes
[Any observations]

## Next Steps
- [ ] Task 4: API endpoints
```

### Human Approval Gates
Some phases require human approval before proceeding:

```
/checkpoint

>>> HUMAN APPROVAL REQUIRED
>>> This checkpoint requires your approval before Phase 2 can begin.
>>> 
>>> Review the following:
>>> - [ ] Architecture decisions are sound
>>> - [ ] Security review passed
>>> - [ ] Performance acceptable
>>>
>>> Type 'approve' to continue or provide feedback.
```

---

## Tips for Effective Use

### 1. Keep CLAUDE.md Updated
Critical patterns should be in CLAUDE.md so Claude always has access:
```markdown
## Critical Patterns
- Always use TokenManager singleton for auth
- Task queue requires Redis lock
```

### 2. Reference Lessons Explicitly
When working on related code:
```
Before implementing the refresh token logic, please review 
.meta/lessons/001-token-race-condition.md
```

### 3. Use Perspectives for Decisions
For any non-trivial decision:
```
/analyze [your question]
```

### 4. Checkpoint Frequently
Don't wait until phase end. Checkpoint after each significant task.

### 5. Capture Lessons Immediately
Don't wait — capture lessons right after fixing bugs while context is fresh.

### 6. Review Status Often
```
/status
```
Keeps you oriented, especially in long sessions.

---

## Customization

### Adding New Commands
Create a new `.md` file in `.claude/commands/`:

```markdown
---
description: What this command does
---

# Command Name

Your prompt template here.

Use $ARGUMENTS for user input.
Reference files with @path/to/file
```

### Adding New Perspectives
Add new `.md` files in `.meta/perspectives/` following the existing format.

### Adding Rules
Add new `.md` files in `.meta/rules/` for project conventions that should always apply.

---

## Troubleshooting

### Context Getting Long
Run `/compact` or start a new session. Critical context is in CLAUDE.md and will persist.

### Claude Not Following Plan
Explicitly reference the plan:
```
Check .meta/plans/current-plan.md - we're in Phase 2, Task 3.
```

### Lessons Not Being Applied
Ensure lessons are in `.meta/lessons/` and referenced in CLAUDE.md under "Recent Lessons" or explicitly mention them.

### Commands Not Found
Ensure files are in `.claude/commands/` with `.md` extension and proper frontmatter.

---

## Philosophy

This system embodies **documentation-driven AI development**:

1. **Plans are executable** — Not just documentation, but active guidance
2. **Lessons compound** — Every bug fixed makes the system smarter
3. **Checkpoints enable recovery** — Never lose significant progress
4. **Multiple perspectives reduce blind spots** — Architecture, security, testing views
5. **Human gates maintain control** — You approve critical transitions

The goal: **Build Aigentflow systematically, learn from every issue, and create a reproducible, improvable development process.**
