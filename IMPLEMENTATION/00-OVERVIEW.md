# Aigentflow Implementation Plan

> **Version:** 3.0.3 (CLI-First Development)
> **Last Updated:** 2025-12-31
> **Total Steps:** 66
> **Checkpoints:** 12 (CP0-CP12)
> **Architecture:** Full alignment with ARCHITECTURE.md
> **AI Provider:** CLI-first development with API production fallback

---

## Migration Status

> **Note:** This plan contains content from v2.x with legacy step numbering (05-32) alongside v3.0 target numbering (01-64). During implementation, files will be renumbered to match the v3.0 structure defined below.

| Folder | Current State | Target Numbering |
|--------|---------------|------------------|
| CP0-FOUNDATION | v3.0 (01-11) | Ready |
| CP1-AGENT-SYSTEM | v2.x (05-08) + 12a | Will renumber to 12-19 |
| CP2-DESIGN-SYSTEM | v3.0 (24a) | Ready |
| CP2-CP7 (v2.x folders) | v2.x numbering | Will migrate during implementation |
| ARCHIVE/ | Reference docs | Not for implementation |

---

## Overview

This implementation plan has been restructured to align with `ARCHITECTURE.md`. Key changes:

- **Database**: PostgreSQL + RLS + Apache AGE (was SQLite)
- **Agent Framework**: LangGraph.js (was custom StateGraph)
- **Backend**: NestJS + Fastify API (was CLI-only)
- **Structure**: Turborepo monorepo (was single src/)
- **New Checkpoints**: Messaging, Web Frontend, Infrastructure, Mobile/Desktop

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Database** | PostgreSQL + RLS + Apache AGE | Multi-tenant data, graph queries |
| **Vectors** | Qdrant | Embeddings, RAG, semantic search |
| **Agent Framework** | LangGraph.js | Stateful graph-based workflows |
| **Backend** | NestJS + Fastify | API server, enterprise patterns |
| **CLI** | Commander.js | Developer interface (wraps API) |
| **Messaging** | NATS JetStream + BullMQ | Pub/sub, background jobs |
| **Real-time** | uWebSockets.js | WebSocket streaming |
| **Frontend** | React + TanStack | Web dashboard |
| **Mobile** | Expo | iOS/Android apps |
| **Desktop** | Tauri 2.0 | Native desktop wrapper |
| **Monorepo** | Turborepo + pnpm | Build orchestration |
| **IaC** | OpenTofu + K3s | Infrastructure automation |
| **Observability** | LangSmith + Prometheus | Tracing and metrics |

---

## CLI-First Development Approach

> **Key Decision:** Use Claude CLI (subscription-based) for all development work on Aigentflow instead of Anthropic API (per-token). This is significantly more cost-effective for iterative development.

### AI Provider Configuration

| Mode | Configuration | Use Case |
|------|---------------|----------|
| **CLI Mode** (Default) | `CLAUDE_CLI=true` | Development, building, iteration |
| **API Mode** | `CLAUDE_CLI=false` | Production deployments |

### How It Works

1. **During Development**: Claude CLI handles all AI execution with subscription-based pricing
2. **In Production**: Aigentflow switches to Anthropic API for programmatic access
3. **Dual-Mode Support**: `AIProvider` abstraction (Step 04f) enables seamless switching

### Configuration

```env
# Development (default)
CLAUDE_CLI=true
CLAUDE_CLI_PATH=claude
CLAUDE_CLI_TIMEOUT_MS=300000

# Production
CLAUDE_CLI=false
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### Subagent Pattern

Both modes support spawning subagents with role-specific context:

```typescript
// Works in both CLI and API modes
const [architect, backend, security] = await Promise.all([
  aiProvider.spawnSubagent('architect', 'Analyze architecture...'),
  aiProvider.spawnSubagent('backend', 'Review backend patterns...'),
  aiProvider.spawnSubagent('security', 'Check security implications...'),
]);
```

See `CP0-FOUNDATION/04f-AI-PROVIDER.md` and `CP1-AGENT-SYSTEM/05-AGENT-FRAMEWORK.md` for implementation details.

---

## Checkpoint Summary

| Phase | Checkpoint | Name | Steps | Key Deliverable |
|-------|------------|------|-------|-----------------|
| **1** | CP0 | Foundation | 01-11 | Monorepo, PostgreSQL, LangGraph, NestJS, CLI |
| **1** | CP1 | Agent System | 12-19 | LangGraph agent framework, core agents |
| **1** | CP2 | Design System | 20-24a | UI Designer, design tokens, early web UI |
| **1** | CP3 | Git Worktrees | 25-27 | Isolated feature development |
| **1** | CP4 | Build & Test | 28-33 | Developer and testing agents |
| **2** | CP5 | Messaging | 34-37 | NATS, BullMQ, WebSockets |
| **2** | CP6 | Integration | 38-41 | Merge, CI/CD, release workflows |
| **2** | CP7 | Self-Evolution | 42-45 | Pattern learning, agent generation |
| **2** | CP8 | Enterprise | 46-49 | Compliance, security |
| **2** | CP9 | Platform Infra | 50-53 | Multi-tenant, feature flags |
| **3** | CP10 | Web Frontend | 54-58 | React dashboard |
| **3** | CP11 | Infrastructure | 59-62 | OpenTofu, K3s, Hetzner |
| **3** | CP12 | Mobile/Desktop | 63-64 | Expo, Tauri apps |

---

## Implementation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: FOUNDATION (CP0-CP4)                            │
└─────────────────────────────────────────────────────────────────────────────┘

CP0: FOUNDATION ──────────────────────────────────────────────────────────────
│
├── 01-MONOREPO-SETUP ──▶ 02-POSTGRESQL-SETUP ──▶ 03-LANGGRAPH-CORE
│   [Turborepo + pnpm]    [DB + RLS + AGE]        [Workflow engine]
│                                                        │
│                                                        ▼
├── 04-NESTJS-API ──▶ 05-CLI-FOUNDATION ──▶ 06-PERSISTENCE-LAYER
│   [Fastify server]  [API wrapper CLI]      [PostgreSQL repos]
│                                                   │
│                                                   ▼
├── 07-QDRANT-VECTORS ──▶ 08-PROMPT-ARCHITECTURE ──▶ 09-HOOKS-GUARDRAILS
│   [Vector database]     [Meta-prompts]              [Controls]
│                                                          │
│                                                          ▼
└── 10-AUDIT-LOGGING ──▶ 11-CHECKPOINT-RECOVERY ──────────────────────────
    [LangSmith trace]     [LangGraph checkpointer]
                                    │
▼                                   ▼
CP1: AGENT SYSTEM ────────────────────────────────────────────────────────────
│
├── 12-AGENT-FRAMEWORK ──▶ 12a-SELF-REVIEW ──▶ 13-ORCHESTRATOR-GRAPH ──▶ 14-CONTEXT-MANAGER
│   [LangGraph agents]     [Quality loops]    [Main workflow]           [Qdrant context]
│                                                          │
│                                                          ▼
├── 15-ORCHESTRATOR-AGENT ──▶ 16-PROJECT-MANAGER ──▶ 17-ARCHITECT-AGENT
│   [Central routing]         [Planning]              [Tech decisions]
│                                                          │
│                                                          ▼
└── 18-ANALYST-AGENT ──▶ 19-SKILLS-FRAMEWORK ─────────────────────────────
    [Research]              [Reusable skills]
                                    │
▼                                   ▼
CP2: DESIGN SYSTEM ───────────────────────────────────────────────────────────
│
├── 20-UI-DESIGNER-AGENT ──▶ 21-DESIGN-TOKENS ──▶ 22-USER-FLOWS
│   [Mockup generation]       [Theming]           [Flow diagrams]
│                                                       │
│                                                       ▼
├── 23-DESIGN-WORKFLOW ──▶ 24-ACTIVITY-SYSTEM ──▶ 24a-EARLY-WEB-INTERFACE
│   [Competitive design]      [Real-time stream]      [Simple React UI]
│                                                           │
│   ╔═══════════════════════════════════════════════════════╧════════════╗
│   ║  At this point you can:                                             ║
│   ║  • Open http://localhost:5173                                       ║
│   ║  • Enter "Build a task management app"                              ║
│   ║  • Watch agents work in real-time                                   ║
│   ║  • View and approve designs                                         ║
│   ╚════════════════════════════════════════════════════════════════════╝
│                                                           │
▼                                                           ▼
CP3: GIT WORKTREES ───────────────────────────────────────────────────────────
│
├── 25-GIT-AGENT ──▶ 26-WORKTREE-ISOLATION ──▶ 27-CONFLICT-DETECTION
│   [Branch mgmt]    [Feature isolation]        [Merge conflicts]
│                                                      │
▼                                                      ▼
CP4: BUILD & TEST ────────────────────────────────────────────────────────────
│
├── 28-FRONTEND-DEV ──┬──▶ 30-TESTER-AGENT ──▶ 31-BUG-FIXER
├── 29-BACKEND-DEV ───┘        │                    │
│   [Parallel dev]         [Testing]           [Fix loops]
│                                                   │
│                                                   ▼
└── 32-REVIEWER-AGENT ──▶ 33-LESSON-EXTRACTION ───────────────────────────
    [Code review]            [Qdrant learning]

┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: SCALE & INTEGRATION (CP5-CP9)                   │
└─────────────────────────────────────────────────────────────────────────────┘

CP5: MESSAGING ───────────────────────────────────────────────────────────────
│
├── 34-NATS-JETSTREAM ──▶ 35-BULLMQ-JOBS ──▶ 36-WEBSOCKET-STREAMING
│   [Pub/sub]              [Background jobs]   [Real-time updates]
│                                                     │
│                                                     ▼
└── 37-AGENT-POOL-SCALING ────────────────────────────────────────────────
    [15 concurrent agents]
                │
▼               ▼
CP6-CP9: [Integration, Self-Evolution, Enterprise, Platform]

┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: FULL PLATFORM (CP10-CP12)                       │
└─────────────────────────────────────────────────────────────────────────────┘

CP10: WEB FRONTEND ───────────────────────────────────────────────────────────
│
├── 54-REACT-SETUP ──▶ 55-DASHBOARD-UI ──▶ 56-WORKFLOW-VIZ
│   [React + TanStack]  [Main UI]           [LangGraph viz]
│                                                 │
│                                                 ▼
└── 57-AGENT-MONITORING ──▶ 58-DESIGN-PREVIEW ────────────────────────────
    [Status display]          [Mockup viewer]

CP11: INFRASTRUCTURE ─────────────────────────────────────────────────────────
│
├── 59-OPENTOFU-SETUP ──▶ 60-K3S-CLUSTER ──▶ 61-HETZNER-DEPLOY
│   [IaC foundation]       [Kubernetes]       [Cloud deploy]
│                                                  │
│                                                  ▼
└── 62-OBSERVABILITY ─────────────────────────────────────────────────────
    [Prometheus + Grafana]

CP12: MOBILE/DESKTOP ─────────────────────────────────────────────────────────
│
└── 63-EXPO-MOBILE ──▶ 64-TAURI-DESKTOP ──────────────────────────────────
    [React Native]       [Desktop wrapper]
```

---

## File Structure (Current)

> Files will be renumbered to v3.0 scheme during implementation. Current structure shown below.

```
IMPLEMENTATION/
├── 00-OVERVIEW.md                    # This file
├── CHECKPOINTS.md                    # Validation criteria
├── PHASED-ROLLOUT.md                # Rollout strategy
│
├── ARCHIVE/                         # Reference docs (not for build)
│   ├── reference/                   # USER-FLOWS.md, USER-GUIDE.html
│   └── v2-duplicates/               # Superseded v2.x files
│
├── CP0-FOUNDATION/                  # Steps 01-11 (v3.0 ready)
│   ├── 01-MONOREPO-SETUP.md
│   ├── 02-POSTGRESQL-SETUP.md
│   ├── 03-LANGGRAPH-CORE.md
│   ├── 03a-PROMPT-ARCHITECTURE.md
│   ├── 03b-META-PROMPTS.md
│   ├── 04-NESTJS-API.md
│   ├── 04a-HOOKS-GUARDRAILS.md
│   ├── 04b-CLAUDE-MD-GENERATOR.md
│   ├── 04c-CHECKPOINT-RECOVERY.md
│   ├── 04d-AUDIT-LOGGING.md
│   ├── 04e-COMPONENT-INTEGRATION.md
│   └── 04f-AI-PROVIDER.md
│
├── CP1-AGENT-SYSTEM/                # v2.x (05-08) → v3.0 (12-19)
│   ├── 05-AGENT-FRAMEWORK.md        # → 12-AGENT-FRAMEWORK
│   ├── 05a-ORCHESTRATOR-AGENT.md    # → 15-ORCHESTRATOR-AGENT
│   ├── 05b-PROJECT-MANAGER-AGENT.md # → 16-PROJECT-MANAGER-AGENT
│   ├── 05c-ARCHITECT-AGENT.md       # → 17-ARCHITECT-AGENT
│   ├── 05d-ANALYST-AGENT.md         # → 18-ANALYST-AGENT
│   ├── 05e-PROJECT-ANALYZER-AGENT.md
│   ├── 05f-COMPLIANCE-AGENT.md
│   ├── 06-UI-DESIGNER-AGENT.md      # → 20-UI-DESIGNER-AGENT (CP2)
│   ├── 06a-SKILLS-FRAMEWORK.md      # → 19-SKILLS-FRAMEWORK
│   ├── 06b-MCP-SERVER-CONFIG.md
│   ├── 07-DESIGN-TOKENS.md          # → 21-DESIGN-TOKENS (CP2)
│   ├── 08-USER-FLOWS.md             # → 22-USER-FLOWS (CP2)
│   ├── 08a-ACTIVITY-SYSTEM.md       # → 24-ACTIVITY-SYSTEM (CP2)
│   ├── 08b-DESIGN-WORKFLOW.md       # → 23-DESIGN-WORKFLOW (CP2)
│   └── 12a-SELF-REVIEW-FRAMEWORK.md # v3.0 ready
│
├── CP2-DESIGN-SYSTEM/               # v3.0 ready
│   └── 24a-EARLY-WEB-INTERFACE.md
│
├── CP2-GIT-WORKTREES/               # v2.x (09-11) → v3.0 CP3 (25-27)
│   ├── 09-GIT-AGENT.md              # → 25-GIT-AGENT
│   ├── 10-WORKTREE-ISOLATION.md     # → 26-WORKTREE-ISOLATION
│   └── 11-CONFLICT-DETECTION.md     # → 27-CONFLICT-DETECTION
│
├── CP3-BUILD-TEST/                  # v2.x (12-16) → v3.0 CP4 (28-33)
│   ├── 12-FRONTEND-DEVELOPER.md     # → 28-FRONTEND-DEV-AGENT
│   ├── 13-BACKEND-DEVELOPER.md      # → 29-BACKEND-DEV-AGENT
│   ├── 14-TESTER-AGENT.md           # → 30-TESTER-AGENT
│   ├── 15-BUG-FIXER-AGENT.md        # → 31-BUG-FIXER-AGENT
│   ├── 16-REVIEWER-AGENT.md         # → 32-REVIEWER-AGENT
│   └── 16a-LESSON-EXTRACTION.md     # → 33-LESSON-EXTRACTION
│
├── CP4-INTEGRATION/                 # v2.x (17-20) → v3.0 CP6 (38-41)
│   ├── 17-MERGE-WORKFLOW.md         # → 38-MERGE-WORKFLOW
│   ├── 18-INTEGRATION-BRANCH.md     # → 39-INTEGRATION-BRANCH
│   ├── 19-CI-CD-INTEGRATION.md      # → 40-CI-CD-INTEGRATION
│   └── 20-RELEASE-WORKFLOW.md       # → 41-RELEASE-WORKFLOW
│
├── CP5-SELF-EVOLUTION/              # v2.x (21-24) → v3.0 CP7 (42-45)
│   ├── 21-EXECUTION-TRACING.md      # → 42-EXECUTION-TRACING
│   ├── 22-PATTERN-DETECTION.md      # → 43-PATTERN-DETECTION
│   ├── 23-AGENT-GENERATION.md       # → 44-AGENT-GENERATION
│   └── 24-TOURNAMENT-PROMOTION.md   # → 45-TOURNAMENT-PROMOTION
│
├── CP6-ENTERPRISE-OPS/              # v2.x (25-28) → v3.0 CP8 (46-49)
│   ├── 25-INCIDENT-RESPONSE.md      # → 46-INCIDENT-RESPONSE
│   ├── 26-GDPR-OPERATIONS.md        # → 47-GDPR-OPERATIONS
│   ├── 27-COMPLIANCE-DASHBOARDS.md  # → 48-COMPLIANCE-DASHBOARDS
│   └── 28-VENDOR-SECURITY.md        # → 49-VENDOR-SECURITY
│
└── CP7-PLATFORM-INFRA/              # v2.x (29-32) → v3.0 CP9 (50-53)
    ├── 29-MODEL-ABSTRACTION.md      # → 50-MODEL-ABSTRACTION
    ├── 30-MULTI-TENANT.md           # → 51-MULTI-TENANT
    ├── 31-FEATURE-FLAGS.md          # → 52-FEATURE-FLAGS
    └── 32-GENUI-OUTPUT.md           # → 53-GENUI-OUTPUT
```

> **Note:** CP5-MESSAGING, CP10-WEB-FRONTEND, CP11-INFRASTRUCTURE, CP12-MOBILE-DESKTOP will be created during implementation (no v2.x content exists for these).

---

## Monorepo Structure

```
aigentflow/
├── apps/
│   ├── api/                 # NestJS backend (CP0)
│   ├── cli/                 # Commander.js CLI (CP0)
│   ├── web/                 # React frontend (CP10)
│   ├── mobile/              # Expo app (CP12)
│   └── desktop/             # Tauri wrapper (CP12)
│
├── packages/
│   ├── core/                # Business logic
│   ├── agents/              # Agent definitions
│   ├── langgraph/           # Workflow graphs
│   ├── database/            # PostgreSQL/Qdrant clients
│   ├── mcp-servers/         # MCP server implementations
│   └── ui/                  # Shared UI components
│
├── infrastructure/          # OpenTofu configs (CP11)
│   ├── modules/
│   └── environments/
│
├── turbo.json               # Turborepo config
├── pnpm-workspace.yaml      # pnpm workspaces
└── package.json             # Root package
```

---

## Migration from v2.x

| v2.x Component | v3.0 Replacement |
|----------------|------------------|
| SQLite (better-sqlite3) | PostgreSQL + Drizzle ORM |
| Custom StateGraph | LangGraph.js |
| CLI-only | NestJS API + CLI wrapper |
| Single src/ folder | Turborepo monorepo |
| No vectors | Qdrant integration |
| No messaging | NATS JetStream + BullMQ |
| No frontend | React web app |

---

## Success Criteria

The implementation is complete when:

- [ ] All 64 steps completed with passing tests
- [ ] All 12 checkpoints validated
- [ ] Monorepo builds successfully with `turbo build`
- [ ] API server handles 1000 req/s
- [ ] Web dashboard displays workflow in real-time
- [ ] Mobile app connects to API
- [ ] Kubernetes deployment on Hetzner works
- [ ] Multi-tenant isolation verified

---

## Current Status

| Checkpoint | Status | Steps Complete |
|------------|--------|----------------|
| CP0: Foundation | 🔄 In Progress | 0/11 |
| CP1: Agent System | ⏳ Pending | 0/8 |
| CP2: Design System | ⏳ Pending | 0/5 |
| CP3: Git Worktrees | ⏳ Pending | 0/3 |
| CP4: Build & Test | ⏳ Pending | 0/6 |
| CP5: Messaging | ⏳ Pending | 0/4 |
| CP6: Integration | ⏳ Pending | 0/4 |
| CP7: Self-Evolution | ⏳ Pending | 0/4 |
| CP8: Enterprise | ⏳ Pending | 0/4 |
| CP9: Platform Infra | ⏳ Pending | 0/4 |
| CP10: Web Frontend | ⏳ Pending | 0/5 |
| CP11: Infrastructure | ⏳ Pending | 0/4 |
| CP12: Mobile/Desktop | ⏳ Pending | 0/2 |

---

## References

- `ARCHITECTURE.md` - Technical architecture specification
- `CHECKPOINTS.md` - Validation criteria for all checkpoints
- `.meta/plans/ARCHITECTURE-GAP-ANALYSIS.md` - Gap analysis
- `.meta/plans/RESTRUCTURED-IMPLEMENTATION-PLAN.md` - Migration plan
- `ARCHIVE/original-plans/` - Original v2.x plans for reference
