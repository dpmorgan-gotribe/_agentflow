# CLAUDE.md - Aigentflow Development Context

## 🎯 What We're Building

Aigentflow is an enterprise multi-agent AI orchestrator for full-stack development. Users self-host it on their own servers (Hetzner target) and use it to build web, mobile, and desktop applications through coordinated AI agents.

## 🚨 Critical Rules (Never Break These)

1. **Complete implementations only** — No placeholder code, no "TODO" comments, no stubs
2. **TypeScript strict mode** — All code must pass `tsc --strict`
3. **Test everything** — Minimum 80% coverage, test edge cases
4. **No secrets in code** — Use environment variables, never hardcode
5. **Follow the plan** — Check `.meta/plans/current-plan.md` before major work

## 📁 Project Structure

```
src/                    # Application code
├── orchestrator/       # Core orchestration engine
├── agents/            # Agent implementations
├── mcp-servers/       # MCP server implementations
├── api/               # NestJS API
└── shared/            # Shared types and utilities

.meta/                  # Development orchestration (YOU ARE HERE)
├── plans/             # Implementation plans
├── lessons/           # Learned patterns and fixes
├── checkpoints/       # Progress snapshots
└── perspectives/      # Analysis viewpoints
```

## 🔧 Commands Available

### Development Workflow
- `/status` — Check current phase, progress, and context
- `/start-phase [n]` — Begin working on phase n
- `/implement [task]` — Implement a feature/task
- `/fix-bug [description]` — Systematic bug resolution
- `/analyze [question]` — Multi-perspective analysis
- `/review [scope]` — Code review
- `/checkpoint` — Save progress and verify state
- `/capture-lesson` — Extract and save a learning

### Dev Environment Control
- `/dev` — Start dev server (in-memory mode, fast)
- `/dev db` — Start PostgreSQL container only
- `/dev full` — Start full stack (PostgreSQL + API + Web)
- `/stop` — Stop all services (Docker + dev servers)
- `/restart` — Restart development environment
- `/docker-status` — Check Docker container status and health
- `/db push` — Push schema changes to database
- `/db reset` — Reset database (fresh start)

## 📋 Current Phase

@.meta/current-phase.md

## 📚 Recent Lessons (Always Consider These)

<!-- Updated automatically when lessons are captured -->
@.meta/lessons/index.md

## 🏗️ Architecture Decisions

Key decisions made:
- **Backend**: TypeScript + NestJS + LangGraph.js
- **Database**: PostgreSQL + RLS for multi-tenancy, Qdrant for vectors
- **Messaging**: NATS JetStream + BullMQ
- **Frontend**: React + Expo + Tauri (web/mobile/desktop)
- **IaC**: OpenTofu + K3s for Hetzner deployment

## 🔒 Security Patterns

- All endpoints require authentication
- Use parameterized queries (never string concatenation for SQL)
- Validate all inputs with Zod schemas
- Sanitize all outputs
- Audit log sensitive operations

## 📝 Code Patterns

### Agent Definition
```typescript
interface Agent {
  id: string;
  role: string;
  goal: string;
  tools: Tool[];
  constraints: string[];
}
```

### Structured Response
```typescript
interface AgentResponse<T> {
  status: 'success' | 'error' | 'blocked';
  data: T;
  reasoning?: string;
  nextAction?: string;
}
```

### Error Handling
```typescript
// Always use typed errors
class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

## ⚠️ Known Gotchas

<!-- Updated when lessons are captured -->
1. Token refresh requires mutex lock (see lesson-001)
2. [More will be added as we learn]

## 📖 Reference Documents

- Architecture: `docs/architecture.md`
- API Spec: `docs/api/openapi.yaml`
- ADRs: `docs/decisions/`

## 🎯 Current Focus

Check `.meta/current-phase.md` for what we're currently working on.

## 🚀 Session Startup (Plan-First Architecture)

On every new session start, **always check for active plans first**:

1. **Check** `.meta/plans/active/` for any `.md` files
2. **If found**: Ask "Found incomplete plan: [filename]. Resume? [Y/n]"
   - If resume → Read plan and continue from **Current Step**
   - If no → Ask what to do: archive / delete / ignore
3. **If no active plans**: Proceed normally

### Creating New Plans

When receiving prompts, **create a plan file BEFORE execution**:

| Prompt Pattern | Template | Plan File |
|----------------|----------|-----------|
| "fix [issue]" | `bug-fix.template.md` | `bug-YYYY-MM-DD-[slug].md` |
| "implement [task]" | `task.template.md` | `task-YYYY-MM-DD-[slug].md` |
| "implement phase N" | `phase.template.md` | `phase-YYYY-MM-DD-[name].md` |
| "add [feature]" | `task.template.md` | `task-YYYY-MM-DD-[slug].md` |

### Plan File Locations

```
.meta/plans/
├── current-plan.md      # Master roadmap (READ-ONLY reference)
├── active/              # Currently executing plans (SURVIVES CRASHES)
├── archive/             # Completed plans (for reference)
└── templates/           # Plan templates by type
```

### Plan Execution Flow

```
1. CREATE PLAN → Save to .meta/plans/active/
2. EXECUTE     → Update checkboxes + Current Step as you work
3. COMPLETE    → Move to archive/, capture lessons
```

**Why Plan-First?** If the CLI crashes mid-workflow, the plan file survives. Next session reads the plan and resumes from where it left off. No work is lost.

---
*This file is the primary context for all Claude sessions. Keep it focused and updated.*
