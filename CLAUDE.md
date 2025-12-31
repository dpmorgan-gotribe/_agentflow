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

- `/status` — Check current phase, progress, and context
- `/start-phase [n]` — Begin working on phase n
- `/implement [task]` — Implement a feature/task
- `/fix-bug [description]` — Systematic bug resolution
- `/analyze [question]` — Multi-perspective analysis
- `/review [scope]` — Code review
- `/checkpoint` — Save progress and verify state
- `/capture-lesson` — Extract and save a learning

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

---
*This file is the primary context for all Claude sessions. Keep it focused and updated.*
