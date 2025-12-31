# Building a meta-orchestration system for Claude-powered software development

The Claude Agent SDK (formerly Claude Code SDK) enables programmatic orchestration of multiple Claude sessions with native parallel subagent support, making it ideal for building a "meta-orchestrator" that coordinates AI development of complex applications like Aigentflow. This report provides a complete architecture, workflows, schemas, and file templates for implementation.

## The Claude Agent SDK unlocks true multi-agent orchestration

The SDK (npm: `@anthropic-ai/claude-agent-sdk`, pip: `claude-agent-sdk`) provides the foundation for building custom orchestration layers. Its **parallel subagent execution** capability is the critical feature—each subagent maintains isolated context while the orchestrator synthesizes their outputs.

The core API uses an async generator pattern:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const result = query({
  prompt: "Analyze this codebase for security issues",
  options: {
    agents: {
      "architect": {
        description: "System architecture specialist",
        tools: ["Read", "Grep", "Glob"],
        prompt: "You are a security architect..."
      },
      "tester": {
        description: "Security test specialist", 
        tools: ["Bash", "Read"],
        prompt: "You are a penetration tester..."
      }
    },
    allowedTools: ["Read", "Grep", "Glob", "Bash", "Task"]
  }
});
```

Key capabilities for orchestration include **3-5 parallel subagents** running simultaneously, **context isolation** preventing window overflow, **session resume** via `session_id`, **MCP server integration** for custom tools, and **hooks** for pre/post execution control. Subagents cannot spawn their own subagents (one level of nesting), which forces clean architectural boundaries.

## Meta-orchestrator architecture for developing Aigentflow

The meta-orchestrator sits **outside** the Aigentflow application, coordinating Claude sessions that develop and maintain the inner orchestrator. This separation is crucial—the outer system remains stable while the inner system evolves.

```
┌─────────────────────────────────────────────────────────────┐
│                    META-ORCHESTRATOR                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Claude Agent SDK Layer                 │   │
│  │  - Session management & checkpointing               │   │
│  │  - Parallel subagent spawning                       │   │
│  │  - Context aggregation & synthesis                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│           ┌───────────────┼───────────────┐                │
│           ▼               ▼               ▼                │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│    │ Analyst  │    │ Planner  │    │ Reviewer │           │
│    │ Subagent │    │ Subagent │    │ Subagent │           │
│    └──────────┘    └──────────┘    └──────────┘           │
│           │               │               │                │
│           └───────────────┼───────────────┘                │
│                           ▼                                 │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│    │ Frontend │    │ Backend  │    │  Tester  │           │
│    │ Dev      │    │ Dev      │    │ Subagent │           │
│    └──────────┘    └──────────┘    └──────────┘           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │      AIGENTFLOW       │
              │  (Being Developed)    │
              │  - Multi-agent app    │
              │  - Its own patterns   │
              └───────────────────────┘
```

The meta-orchestrator implements the **Orchestrator-Worker pattern** documented by Anthropic, where a lead agent (Claude Opus 4) plans strategy, decomposes queries, and synthesizes results while worker agents (Claude Sonnet 4) execute specialized tasks in parallel. This pattern achieved **90.2% improvement** over single-agent approaches in Anthropic's internal research evaluations.

## Sub-agent workflow design with parallel role specialization

Each subagent receives role-specific prompts and restricted tool access. The workflow proceeds through **analysis**, **planning**, **implementation**, and **verification** phases with parallel execution within phases.

```yaml
# .claude/agents/definitions.yaml
agents:
  architect:
    description: "System design and architecture decisions"
    model: sonnet
    tools: [Read, Grep, Glob]
    prompt: |
      You are a senior software architect. Analyze code for:
      - Design pattern violations
      - Architectural inconsistencies  
      - Scalability concerns
      - Component coupling issues
      Return structured analysis with severity ratings.

  frontend_dev:
    description: "Frontend implementation specialist"
    model: sonnet
    tools: [Read, Write, Edit, Bash]
    prompt: |
      You are a frontend developer expert in React/TypeScript.
      Follow project conventions in CLAUDE.md.
      Write tests for all new components.

  backend_dev:
    description: "Backend implementation specialist"  
    model: sonnet
    tools: [Read, Write, Edit, Bash]
    prompt: |
      You are a backend developer expert in Node.js/Python.
      Ensure all endpoints have validation and error handling.
      Follow REST conventions and write integration tests.

  tester:
    description: "Testing and quality assurance"
    model: sonnet
    tools: [Read, Bash, Grep]
    prompt: |
      You are a QA engineer. Generate comprehensive test cases
      covering happy paths, edge cases, and error scenarios.
      Run test suites and analyze coverage gaps.

  reviewer:
    description: "Code review and security audit"
    model: sonnet
    tools: [Read, Grep, Glob]
    prompt: |
      You are a code reviewer. Check for:
      - Security vulnerabilities
      - Performance anti-patterns
      - Code style violations
      - Missing documentation
      Return actionable feedback with line references.
```

**Parallel analysis workflow** deploys architect, frontend, backend, and tester perspectives simultaneously on the same codebase:

```typescript
// Parallel analysis - all run simultaneously
const analyses = await Promise.all([
  query({ prompt: taskContext, options: { agents: { architect } } }),
  query({ prompt: taskContext, options: { agents: { frontend_dev } } }),
  query({ prompt: taskContext, options: { agents: { backend_dev } } }),
  query({ prompt: taskContext, options: { agents: { tester } } })
]);

// Aggregation - synthesize findings
const synthesis = await query({
  prompt: `Synthesize these analyses into unified recommendations:
           ${analyses.map(a => a.findings).join('\n---\n')}`,
  options: { model: 'opus' }
});
```

The **fan-out/fan-in aggregation pattern** distributes tasks to specialists, then uses an LLM-powered aggregator to reconcile insights—not just concatenate them. When agents disagree, the orchestrator can apply majority voting, confidence-weighted decisions, or spawn a judge agent to evaluate arguments.

## Problem-solving workflow for systematic bug resolution

When bugs occur during Aigentflow development, this systematic workflow ensures fixes are thorough and prevent recurrence:

```
┌─────────────────────────────────────────────────────────────┐
│                    BUG ENCOUNTERED                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: CONTEXTUAL ANALYSIS                                │
│ - Load implementation plan for current phase                │
│ - Retrieve relevant lessons learned                         │
│ - Spawn architect subagent for architectural context        │
│ - Spawn tester subagent for reproduction analysis           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: SOLUTION GENERATION (Parallel)                     │
│ - Frontend perspective: UI/component implications           │
│ - Backend perspective: API/data implications                │
│ - Architect perspective: System-wide impact                 │
│ - Generate 2-3 solution options with tradeoffs              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: SOLUTION REVIEW                                    │
│ - Review against implementation plan constraints            │
│ - Check for conflicts with other planned features           │
│ - Verify solution doesn't regress existing functionality    │
│ - Human approval checkpoint if high-risk                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: IMPLEMENTATION                                     │
│ - Apply fix with appropriate dev subagent                   │
│ - Run tests via tester subagent                             │
│ - Verify fix doesn't break other components                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: KNOWLEDGE CAPTURE                                  │
│ - Extract lesson learned (root cause + prevention)          │
│ - Update implementation plan with discovered constraints    │
│ - Add to queryable lessons database                         │
│ - Update CLAUDE.md if pattern is project-wide               │
└─────────────────────────────────────────────────────────────┘
```

The corresponding Claude command enforces this workflow:

```markdown
---
description: Systematic bug analysis and resolution workflow
allowed-tools: Read, Grep, Glob, Task, Write, Edit, Bash
argument-hint: [bug description or error message]
---

# Bug Resolution Workflow

## Context Loading
- Current implementation phase: !`cat .meta/current-phase.json`
- Recent changes: !`git log --oneline -10`
- Relevant lessons: @.meta/lessons/

## Your Task
Execute the systematic bug resolution workflow for: $ARGUMENTS

### Step 1: Contextual Analysis
Use subagents to analyze from multiple perspectives:
- Architect: How does this fit system architecture?
- Tester: Can we reproduce reliably? What's the minimal case?

### Step 2: Generate Solution Options
Create 2-3 solution approaches with:
- Implementation complexity
- Risk of regression
- Alignment with current phase goals

### Step 3: Review Against Plan
Check @.meta/plans/current-plan.md for:
- Conflicts with planned features
- Phase-appropriate scope

### Step 4: Implement
Apply the approved solution, run tests, verify.

### Step 5: Capture Learning
Create a lesson entry in .meta/lessons/ with:
- Root cause analysis (5 Whys)
- Prevention strategy
- Updated patterns
```

## Implementation plan schema for executable development

Implementation plans use **YAML frontmatter + Markdown body**, enabling both machine parsing and human readability. The schema supports checkpoint gates, dependency tracking, and automatic updates.

```yaml
---
plan_id: "aigentflow-v1"
version: "1.2"
status: in_progress
current_phase: 2
created: 2025-01-15
updated: 2025-01-28

metadata:
  project: Aigentflow
  description: Multi-agent orchestrator application
  architecture_docs: ["docs/architecture/", "ADR/"]
  
constitution:
  - "All code must have TypeScript types"
  - "Test coverage minimum 80%"
  - "No direct database queries outside repository layer"
  - "All API changes require OpenAPI spec update"
---

# Aigentflow Implementation Plan

## Phase 1: Foundation ✅
**Status**: Completed | **Gate**: Automatic
**Checkpoint**: All tests pass

### Tasks
- [x] Project scaffolding (Next.js + TypeScript)
- [x] Database schema design
- [x] Base repository pattern
- [x] Authentication module

### Verification
```bash
npm run test -- --coverage
npm run typecheck
```

### Lessons Applied
- @.meta/lessons/001-auth-race-condition.md

---

## Phase 2: Core Orchestration 🔄
**Status**: In Progress | **Gate**: Human Approval
**Checkpoint**: Architecture review required

### Tasks
- [x] Agent definition schema
- [ ] Task queue implementation
  - **Status**: in_progress
  - **Dependencies**: [database-schema]
  - **Assigned**: backend_dev subagent
- [ ] Context management system
  - **Status**: pending
  - **Dependencies**: [task-queue]
  - **Blocked by**: Task queue design decision
- [ ] Parallel execution engine
  - **Status**: pending
  
### Architecture Decisions
- ADR-003: Use Redis for task queue (selected over PostgreSQL queues)
- ADR-004: Context isolation via separate memory spaces

### Risks
| Risk | Mitigation | Owner |
|------|------------|-------|
| Race conditions in parallel execution | Implement optimistic locking | backend_dev |
| Context window overflow | Automatic compaction triggers | architect |

### Human Checkpoint
> ⏸️ **APPROVAL REQUIRED BEFORE PHASE 3**
> - [ ] Architecture review completed
> - [ ] Security audit passed
> - [ ] Performance benchmarks acceptable

---

## Phase 3: Agent Specialization (Pending)
**Status**: Pending | **Gate**: Test Pass
**Dependencies**: Phase 2 completion

### Tasks
- [ ] Role-based agent definitions
- [ ] Prompt template system
- [ ] Agent capability constraints
- [ ] Inter-agent communication protocol

---

## Appendix: Task State Machine

```
pending → in_progress → completed
              ↓
           blocked → in_progress (when unblocked)
```

## Appendix: Update Log

| Date | Change | Reason |
|------|--------|--------|
| 2025-01-20 | Added ADR-003 | Task queue design decision |
| 2025-01-25 | Blocked context-management | Waiting on queue design |
| 2025-01-28 | Applied lesson 001 | Auth race condition fix |
```

## Lessons learned system with immediate and long-term capture

The lessons system operates at two levels: **immediate CLAUDE.md updates** for critical patterns and a **queryable lessons database** for comprehensive knowledge.

### Structured lesson format

```json
{
  "id": "lesson-2025-001",
  "timestamp": "2025-01-28T14:30:00Z",
  "category": "bug_fix",
  "phase": "implementation",
  "title": "Race condition in token refresh during concurrent requests",
  
  "context": {
    "files_affected": ["src/auth/tokenService.ts", "src/middleware/auth.ts"],
    "components": ["authentication", "middleware"],
    "implementation_phase": "Phase 1: Foundation",
    "trigger": "Multiple API calls triggering simultaneous token refreshes"
  },
  
  "problem": {
    "symptoms": "Intermittent 401 errors under load, token corruption",
    "root_cause": "No mutex on token refresh operation allowed concurrent writes",
    "impact": "High - affected all authenticated users during peak load",
    "five_whys": [
      "Why did users get 401? Token was invalid",
      "Why was token invalid? Two refreshes overwrote each other",
      "Why two refreshes? No lock on refresh operation",
      "Why no lock? Original design assumed sequential requests",
      "Why that assumption? Didn't anticipate concurrent API calls"
    ]
  },
  
  "solution": {
    "approach": "Implemented mutex lock with token refresh queue",
    "code_pattern": "Singleton pattern for token manager with async lock",
    "rationale": "Ensures only one refresh executes, others wait for result",
    "commit": "abc123def"
  },
  
  "prevention": {
    "checks": [
      "Review all shared state for concurrent access patterns",
      "Add load testing for authentication flows",
      "Use locking primitives for singleton resources"
    ],
    "patterns_to_avoid": ["Concurrent writes to shared tokens without locks"],
    "patterns_to_follow": ["Mutex pattern for shared resource modification"]
  },
  
  "metadata": {
    "tags": ["concurrency", "authentication", "race-condition", "typescript"],
    "confidence": 0.95,
    "times_applied": 0,
    "applicable_phases": ["implementation", "testing"],
    "related_lessons": []
  }
}
```

### CLAUDE.md integration for immediate application

```markdown
# .meta/CLAUDE.md - Project Memory

## Critical Patterns (Auto-Updated)

### Concurrency
- IMPORTANT: Use mutex locks for any shared resource modification
- Token refresh MUST use singleton pattern with async queue
- Reference: @.meta/lessons/2025-001-token-race-condition.json

### Authentication
- Never cache tokens without TTL validation
- All token operations go through TokenManager singleton

## Phase-Specific Guidance

### Phase 2: Core Orchestration
- Task queue must handle duplicate task prevention
- Context isolation prevents cross-agent state leakage
- Lessons to review: @.meta/lessons/phase-2/

## Import Additional Rules
@.meta/rules/typescript-patterns.md
@.meta/rules/testing-requirements.md
@.meta/rules/security-checklist.md
```

### Query patterns for retrieval

```typescript
// Retrieve lessons relevant to current work
async function getRelevantLessons(context: WorkContext): Promise<Lesson[]> {
  const lessons = await lessonsDb.search({
    // Semantic search on current task description
    query: context.taskDescription,
    
    // Filter by applicable criteria
    filter: {
      applicable_phases: { $contains: context.currentPhase },
      confidence: { $gte: 0.7 },
      components: { $overlap: context.affectedComponents }
    },
    
    // Boost recent and frequently-applied lessons
    scoring: {
      recency_weight: 0.3,
      application_frequency_weight: 0.2,
      semantic_similarity_weight: 0.5
    },
    
    limit: 5
  });
  
  return lessons;
}
```

## Complete file structure template

```
aigentflow-workspace/
├── .claude/
│   ├── commands/                    # Reusable Claude CLI commands
│   │   ├── analyze/
│   │   │   ├── architecture.md      # /analyze:architecture
│   │   │   ├── security.md          # /analyze:security
│   │   │   └── performance.md       # /analyze:performance
│   │   ├── implement/
│   │   │   ├── feature.md           # /implement:feature [name]
│   │   │   ├── fix-bug.md           # /implement:fix-bug [issue]
│   │   │   └── refactor.md          # /implement:refactor [scope]
│   │   ├── review/
│   │   │   ├── code.md              # /review:code [files]
│   │   │   ├── pr.md                # /review:pr [number]
│   │   │   └── plan.md              # /review:plan
│   │   ├── workflow/
│   │   │   ├── start-phase.md       # /workflow:start-phase [n]
│   │   │   ├── checkpoint.md        # /workflow:checkpoint
│   │   │   └── complete-phase.md    # /workflow:complete-phase
│   │   └── debug/
│   │       ├── trace.md             # /debug:trace [error]
│   │       └── diagnose.md          # /debug:diagnose
│   │
│   ├── settings.json                # Project Claude settings
│   └── settings.local.json          # Local overrides (gitignored)
│
├── .meta/                           # Meta-orchestration artifacts
│   ├── agents/
│   │   ├── definitions.yaml         # Subagent role definitions
│   │   ├── prompts/
│   │   │   ├── architect.md
│   │   │   ├── frontend-dev.md
│   │   │   ├── backend-dev.md
│   │   │   ├── tester.md
│   │   │   └── reviewer.md
│   │   └── capabilities.yaml        # Tool restrictions per agent
│   │
│   ├── plans/
│   │   ├── current-plan.md          # Active implementation plan
│   │   ├── archive/                 # Completed plans
│   │   └── templates/
│   │       ├── feature-plan.md
│   │       └── bug-fix-plan.md
│   │
│   ├── lessons/
│   │   ├── index.json               # Searchable lesson index
│   │   ├── by-phase/
│   │   │   ├── phase-1/
│   │   │   └── phase-2/
│   │   ├── by-category/
│   │   │   ├── bugs/
│   │   │   ├── architecture/
│   │   │   └── performance/
│   │   └── templates/
│   │       └── lesson-template.json
│   │
│   ├── checkpoints/
│   │   ├── checkpoint-001.json      # Saved state snapshots
│   │   └── approvals/
│   │       └── phase-1-approval.md
│   │
│   ├── rules/
│   │   ├── typescript-patterns.md
│   │   ├── testing-requirements.md
│   │   ├── security-checklist.md
│   │   └── api-conventions.md
│   │
│   ├── workflows/
│   │   ├── bug-resolution.yaml      # Workflow definitions
│   │   ├── feature-development.yaml
│   │   └── code-review.yaml
│   │
│   ├── current-phase.json           # Active phase tracking
│   └── CLAUDE.md                    # Meta-level project memory
│
├── CLAUDE.md                        # Main project context
├── CLAUDE.local.md                  # Personal notes (gitignored)
│
├── orchestrator/                    # Meta-orchestrator implementation
│   ├── src/
│   │   ├── index.ts
│   │   ├── agents/
│   │   │   ├── spawner.ts           # Subagent creation
│   │   │   ├── aggregator.ts        # Result synthesis
│   │   │   └── definitions.ts       # Type definitions
│   │   ├── workflows/
│   │   │   ├── analyze.ts
│   │   │   ├── implement.ts
│   │   │   └── review.ts
│   │   ├── checkpoints/
│   │   │   ├── manager.ts
│   │   │   └── gates.ts
│   │   ├── lessons/
│   │   │   ├── extractor.ts
│   │   │   ├── store.ts
│   │   │   └── retriever.ts
│   │   └── utils/
│   │       ├── context.ts
│   │       └── logging.ts
│   ├── package.json
│   └── tsconfig.json
│
├── src/                             # Aigentflow application code
│   └── ...
│
├── docs/
│   ├── architecture/
│   │   └── decisions/               # Architecture Decision Records
│   └── meta-orchestrator.md         # This system's documentation
│
├── .mcp.json                        # MCP server configurations
└── README.md                        # Project and meta-orchestrator guide
```

## Claude commands library for common workflows

### /analyze:architecture - Multi-perspective codebase analysis

```markdown
---
description: Analyze codebase architecture from multiple perspectives
allowed-tools: Read, Grep, Glob, Task
---

# Architecture Analysis

## Context
- Project structure: !`find . -type f -name "*.ts" | head -50`
- Recent changes: !`git log --oneline -5`
- Current plan: @.meta/plans/current-plan.md

## Analysis Task
Spawn parallel subagents to analyze architecture:

1. **Architect Perspective**: Overall system design, patterns, coupling
2. **Security Perspective**: Vulnerability patterns, auth flows, data exposure
3. **Performance Perspective**: Bottlenecks, inefficient patterns, scaling concerns

For each perspective, produce:
- Key findings (severity rated)
- Specific file:line references
- Recommended actions

Synthesize into unified report with prioritized action items.
```

### /implement:feature - Phase-aware feature implementation

```markdown
---
description: Implement a feature following the current plan
allowed-tools: Read, Write, Edit, Bash, Task, Grep, Glob
argument-hint: [feature name or task ID]
---

# Feature Implementation Workflow

## Pre-Implementation
- Current phase: !`cat .meta/current-phase.json`
- Implementation plan: @.meta/plans/current-plan.md
- Relevant lessons: @.meta/lessons/

## Task: Implement $ARGUMENTS

### Step 1: Validate Against Plan
Verify this feature is appropriate for current phase.
Check dependencies are satisfied.

### Step 2: Retrieve Relevant Lessons
Query lessons database for:
- Similar past implementations
- Known gotchas for affected components
- Required patterns

### Step 3: Implementation (Use Appropriate Subagent)
- Frontend work → frontend_dev subagent
- Backend work → backend_dev subagent
- Both → coordinate sequentially

### Step 4: Verification
- Run relevant tests: `npm test -- --related`
- Type check: `npm run typecheck`
- Lint: `npm run lint`

### Step 5: Update Progress
Mark task complete in .meta/plans/current-plan.md
```

### /implement:fix-bug - Systematic bug resolution

```markdown
---
description: Systematic bug analysis and resolution
allowed-tools: Read, Write, Edit, Bash, Task, Grep, Glob
argument-hint: [bug description or error]
---

# Bug Resolution Workflow

## Context
- Error/bug: $ARGUMENTS
- Git status: !`git status --short`
- Recent commits: !`git log --oneline -10`
- Current phase: !`cat .meta/current-phase.json`

## Workflow

### Phase 1: Contextual Analysis
1. Load relevant lessons: search .meta/lessons/ for similar issues
2. Identify affected components
3. Spawn architect subagent for system-wide context
4. Spawn tester subagent to create reproduction case

### Phase 2: Solution Generation
Generate 2-3 solution options considering:
- Implementation complexity
- Risk of regression  
- Alignment with architecture
- Impact on current phase work

### Phase 3: Implementation
1. Select best solution (or request human decision if high-risk)
2. Implement fix with appropriate subagent
3. Run tests to verify fix
4. Run regression tests for affected areas

### Phase 4: Knowledge Capture
Create lesson entry at .meta/lessons/ with:
```json
{
  "category": "bug_fix",
  "problem": { "symptoms": "...", "root_cause": "..." },
  "solution": { "approach": "...", "code_pattern": "..." },
  "prevention": { "checks": [...], "patterns_to_avoid": [...] }
}
```

Update CLAUDE.md if pattern is project-wide.
```

### /workflow:checkpoint - Capture state and verify progress

```markdown
---
description: Create checkpoint and verify phase progress
allowed-tools: Read, Bash, Grep, Write
---

# Checkpoint Workflow

## Current State
- Phase: !`cat .meta/current-phase.json`
- Git status: !`git status`
- Test results: !`npm test -- --passWithNoTests 2>&1 | tail -20`
- Type check: !`npm run typecheck 2>&1 | tail -10`

## Checkpoint Creation

### 1. Verify All Tests Pass
Run full test suite and type checking.

### 2. Save Checkpoint State
Create checkpoint at .meta/checkpoints/ with:
- Current phase and task progress
- Git commit SHA
- Test coverage metrics
- Outstanding issues

### 3. Update Plan Progress
Mark completed tasks in .meta/plans/current-plan.md

### 4. Evaluate Gate Conditions
For current phase, check if gate conditions are met:
- All required tasks complete?
- Tests passing?
- Human approval needed?

Report checkpoint status and next steps.
```

## Hooks configuration for automated workflows

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write(*.ts)|Write(*.tsx)",
        "hooks": [{
          "type": "command",
          "command": "npx prettier --write \"$file\" && npx eslint --fix \"$file\""
        }]
      },
      {
        "matcher": "Write(.meta/lessons/*.json)",
        "hooks": [{
          "type": "command", 
          "command": "node .meta/scripts/update-lesson-index.js"
        }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "prompt",
          "prompt": "Before modifying files, verify this change aligns with current implementation phase. Check .meta/plans/current-plan.md for relevant constraints."
        }]
      }
    ],
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{
          "type": "command",
          "command": "echo '=== Project Status ===' && cat .meta/current-phase.json && echo '=== Recent Lessons ===' && ls -t .meta/lessons/by-phase/$(cat .meta/current-phase.json | jq -r .phase)/ | head -3"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "prompt",
          "prompt": "Before ending, check if any lessons should be captured from this session. If a bug was fixed or pattern discovered, create an entry in .meta/lessons/."
        }]
      }
    ]
  }
}
```

## README template for the meta-orchestrator

```markdown
# Aigentflow Meta-Orchestrator

A Claude-powered development system that coordinates multiple specialized AI agents 
to build and maintain the Aigentflow multi-agent orchestrator application.

## Quick Start

### Prerequisites
- Node.js 18+
- Claude API key (`ANTHROPIC_API_KEY`)
- Claude CLI installed

### Setup
```bash
npm install
export ANTHROPIC_API_KEY=your-key
```

### Start Development Session
```bash
# Initialize with current phase context
claude --project .

# Or run orchestrator directly
npm run orchestrate
```

## Core Workflows

### Starting a New Phase
```
/workflow:start-phase 2
```
Loads phase context, relevant lessons, and prepares subagent configurations.

### Implementing Features
```
/implement:feature task-queue-system
```
Validates against plan, retrieves lessons, delegates to appropriate subagents.

### Fixing Bugs
```
/implement:fix-bug "Race condition in token refresh"
```
Runs systematic analysis, generates solutions, captures lessons.

### Creating Checkpoints
```
/workflow:checkpoint
```
Saves state, verifies tests, updates plan progress.

## Architecture

### Subagent Roles
- **Architect**: System design, patterns, scalability
- **Frontend Dev**: React/TypeScript implementation
- **Backend Dev**: Node.js/API implementation  
- **Tester**: Test generation and execution
- **Reviewer**: Code review and security audit

### Workflow Phases
1. **Analysis** - Parallel multi-perspective review
2. **Planning** - Architecture decisions and task breakdown
3. **Implementation** - Delegated to specialized subagents
4. **Verification** - Tests, type checking, review
5. **Knowledge Capture** - Lessons extraction and storage

## File Structure

```
.claude/commands/     # Reusable Claude commands
.meta/agents/         # Subagent definitions and prompts
.meta/plans/          # Implementation plans
.meta/lessons/        # Knowledge base
.meta/checkpoints/    # State snapshots
```

## Lessons System

Lessons are automatically captured when bugs are fixed or patterns discovered.
Query lessons before implementation:

```typescript
const lessons = await getLessonsFor({
  phase: "implementation",
  components: ["authentication"],
  tags: ["concurrency"]
});
```

## Human Checkpoints

Certain phases require human approval:
1. Architecture reviews
2. Security-sensitive changes
3. Phase completions

Approval workflow:
```
/workflow:checkpoint → Review summary → Approve/Reject → Continue
```

## Configuration

### .claude/settings.json
```json
{
  "model": "claude-sonnet-4-20250514",
  "permissions": {
    "allow": ["Read", "Write(src/**)", "Bash(npm *)"],
    "deny": ["Write(.env*)", "Bash(rm -rf:*)"]
  }
}
```

### CLAUDE.md
Project memory and critical patterns. Auto-updated when lessons are captured.

## Extending

### Adding New Commands
Create `.md` file in `.claude/commands/`:
```markdown
---
description: Your command description
allowed-tools: Read, Write
---
Your prompt template with $ARGUMENTS
```

### Adding Subagent Roles
Update `.meta/agents/definitions.yaml` and create prompt in `.meta/agents/prompts/`.

## Troubleshooting

### Context Overflow
Run `/compact` to summarize conversation. Subagents maintain isolated contexts.

### Subagent Failures
Check tool restrictions in `.meta/agents/capabilities.yaml`. 
Subagents cannot spawn their own subagents (one level only).

### Lesson Retrieval Issues
Rebuild index: `node .meta/scripts/update-lesson-index.js`
```

## Key implementation insights

**Token usage drives multi-agent performance**. Anthropic found that Claude Agent SDK multi-agent systems use approximately **15× more tokens** than single-agent chat, but enable parallelism that single agents cannot achieve. The tradeoff is worthwhile for complex development tasks.

**Subagent output handling prevents information loss**. Have subagents write outputs to the filesystem rather than returning large text blocks. This avoids the "telephone game" where information degrades as it passes through context windows.

**Start simple, add complexity only when needed**. Many development tasks can be solved with a single well-prompted agent with multiple tools. Reserve multi-agent orchestration for genuinely complex, multi-perspective problems like architectural analysis or parallel feature development.

**Memory management requires active strategies**. Use session resume for continuity, automatic compaction when context limits approach, and external storage (lessons database) for cross-session knowledge. The CLAUDE.md file provides immediate access to critical patterns without database queries.

The meta-orchestrator pattern—keeping the coordinating system outside the application being built—ensures stability during active development and creates a clear separation between the "developer" (meta-orchestrator) and the "product" (Aigentflow). This architecture scales as Aigentflow grows in complexity while maintaining a consistent, reliable development workflow.