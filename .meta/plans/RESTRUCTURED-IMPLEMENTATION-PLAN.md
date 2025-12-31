# Restructured Implementation Plan

**Generated**: 2025-12-30
**Status**: Pending Approval

This document outlines the restructured implementation plan that aligns with `ARCHITECTURE.md`.

---

## Overview

The restructured plan consolidates and reorganizes checkpoints to:
1. Establish correct architectural foundation from day one
2. Reduce redundancy across implementation steps
3. Add missing capabilities (API, frontend, messaging)
4. Maintain the agent-centric development workflow

---

## New Checkpoint Structure

```
IMPLEMENTATION/
├── 00-OVERVIEW.md                    # Updated roadmap
├── CHECKPOINTS.md                    # Updated checkpoint definitions
│
├── CP0-FOUNDATION/                   # 🔄 RESTRUCTURED
│   ├── 01-MONOREPO-SETUP.md         # NEW - Turborepo + pnpm workspaces
│   ├── 02-POSTGRESQL-SETUP.md       # NEW - PostgreSQL + RLS + Apache AGE
│   ├── 03-LANGGRAPH-CORE.md         # REWRITE - LangGraph.js foundation
│   ├── 04-NESTJS-API.md             # NEW - NestJS + Fastify backend
│   ├── 05-CLI-FOUNDATION.md         # UPDATE - CLI wraps API
│   ├── 06-PERSISTENCE-LAYER.md      # REWRITE - PostgreSQL repositories
│   ├── 07-QDRANT-VECTORS.md         # NEW - Vector database integration
│   ├── 08-PROMPT-ARCHITECTURE.md    # KEEP - Move from 03a
│   ├── 09-HOOKS-GUARDRAILS.md       # UPDATE - Adapt to new arch
│   ├── 10-AUDIT-LOGGING.md          # UPDATE - PostgreSQL-based
│   └── 11-CHECKPOINT-RECOVERY.md    # REWRITE - LangGraph checkpointer
│
├── CP1-AGENT-SYSTEM/                 # 🔄 CONSOLIDATED
│   ├── 12-AGENT-FRAMEWORK.md        # REWRITE - LangGraph.js agents
│   ├── 13-ORCHESTRATOR-GRAPH.md     # NEW - Main workflow graph
│   ├── 14-CONTEXT-MANAGER.md        # UPDATE - Qdrant-powered
│   ├── 15-ORCHESTRATOR-AGENT.md     # REWRITE - LangGraph node
│   ├── 16-PROJECT-MANAGER-AGENT.md  # REWRITE - LangGraph node
│   ├── 17-ARCHITECT-AGENT.md        # REWRITE - LangGraph node
│   ├── 18-ANALYST-AGENT.md          # REWRITE - LangGraph node
│   └── 19-SKILLS-FRAMEWORK.md       # KEEP - Minor updates
│
├── CP2-DESIGN-SYSTEM/                # 🔄 CONSOLIDATED
│   ├── 20-UI-DESIGNER-AGENT.md      # REWRITE - LangGraph node
│   ├── 21-DESIGN-TOKENS.md          # KEEP - No changes
│   ├── 22-USER-FLOWS.md             # KEEP - No changes
│   ├── 23-DESIGN-WORKFLOW.md        # UPDATE - LangGraph integration
│   └── 24-ACTIVITY-SYSTEM.md        # KEEP - Minor updates
│
├── CP3-GIT-WORKTREES/                # ✅ KEEP MOSTLY
│   ├── 25-GIT-AGENT.md              # REWRITE - LangGraph node
│   ├── 26-WORKTREE-ISOLATION.md     # KEEP - No changes
│   └── 27-CONFLICT-DETECTION.md     # KEEP - No changes
│
├── CP4-BUILD-TEST/                   # 🔄 CONSOLIDATED
│   ├── 28-FRONTEND-DEV-AGENT.md     # REWRITE - LangGraph node
│   ├── 29-BACKEND-DEV-AGENT.md      # REWRITE - LangGraph node
│   ├── 30-TESTER-AGENT.md           # REWRITE - LangGraph node
│   ├── 31-BUG-FIXER-AGENT.md        # REWRITE - LangGraph node
│   ├── 32-REVIEWER-AGENT.md         # REWRITE - LangGraph node
│   └── 33-LESSON-EXTRACTION.md      # UPDATE - Qdrant storage
│
├── CP5-MESSAGING/                    # 🆕 NEW CHECKPOINT
│   ├── 34-NATS-JETSTREAM.md         # NEW - Pub/sub infrastructure
│   ├── 35-BULLMQ-JOBS.md            # NEW - Background job processing
│   ├── 36-WEBSOCKET-STREAMING.md    # NEW - Real-time client updates
│   └── 37-AGENT-POOL-SCALING.md     # NEW - Parallel agent execution
│
├── CP6-INTEGRATION/                  # 🔄 RENAMED (was CP4)
│   ├── 38-MERGE-WORKFLOW.md         # KEEP - Minor updates
│   ├── 39-INTEGRATION-BRANCH.md     # KEEP - Minor updates
│   ├── 40-CI-CD-INTEGRATION.md      # UPDATE - Monorepo CI
│   └── 41-RELEASE-WORKFLOW.md       # KEEP - Minor updates
│
├── CP7-SELF-EVOLUTION/               # 🔄 RENAMED (was CP5)
│   ├── 42-EXECUTION-TRACING.md      # UPDATE - LangSmith integration
│   ├── 43-PATTERN-DETECTION.md      # UPDATE - Qdrant embeddings
│   ├── 44-AGENT-GENERATION.md       # KEEP - DSPy integration
│   └── 45-TOURNAMENT-PROMOTION.md   # KEEP - Minor updates
│
├── CP8-ENTERPRISE/                   # 🔄 RENAMED (was CP6)
│   ├── 46-INCIDENT-RESPONSE.md      # KEEP - Minor updates
│   ├── 47-GDPR-OPERATIONS.md        # KEEP - Minor updates
│   ├── 48-COMPLIANCE-DASHBOARDS.md  # UPDATE - React components
│   └── 49-VENDOR-SECURITY.md        # KEEP - Minor updates
│
├── CP9-PLATFORM-INFRA/               # 🔄 RENAMED (was CP7)
│   ├── 50-MODEL-ABSTRACTION.md      # KEEP - Minor updates
│   ├── 51-MULTI-TENANT.md           # UPDATE - PostgreSQL RLS
│   ├── 52-FEATURE-FLAGS.md          # KEEP - Minor updates
│   └── 53-GENUI-OUTPUT.md           # UPDATE - React components
│
├── CP10-WEB-FRONTEND/                # 🆕 NEW CHECKPOINT
│   ├── 54-REACT-SETUP.md            # NEW - React + TanStack
│   ├── 55-DASHBOARD-UI.md           # NEW - Main dashboard
│   ├── 56-WORKFLOW-VIZ.md           # NEW - Workflow visualization
│   ├── 57-AGENT-MONITORING.md       # NEW - Agent status UI
│   └── 58-DESIGN-PREVIEW.md         # NEW - Design preview component
│
├── CP11-INFRASTRUCTURE/              # 🆕 NEW CHECKPOINT
│   ├── 59-OPENTOFU-SETUP.md         # NEW - IaC foundation
│   ├── 60-K3S-CLUSTER.md            # NEW - Kubernetes config
│   ├── 61-HETZNER-DEPLOY.md         # NEW - Cloud deployment
│   └── 62-OBSERVABILITY.md          # NEW - Prometheus + Grafana
│
└── CP12-MOBILE-DESKTOP/              # 🆕 NEW CHECKPOINT (Phase 3)
    ├── 63-EXPO-MOBILE.md            # NEW - React Native app
    └── 64-TAURI-DESKTOP.md          # NEW - Desktop wrapper
```

---

## Checkpoint Mapping (Old → New)

| Old Checkpoint | New Checkpoint | Changes |
|---------------|----------------|---------|
| CP0-FOUNDATION | CP0-FOUNDATION | Major restructure, +3 new steps |
| CP1-DESIGN-SYSTEM | CP1-AGENT-SYSTEM + CP2-DESIGN-SYSTEM | Split agents from design |
| CP2-GIT-WORKTREES | CP3-GIT-WORKTREES | Renumbered, minor updates |
| CP3-BUILD-TEST | CP4-BUILD-TEST | Renumbered, agent rewrites |
| CP4-INTEGRATION | CP6-INTEGRATION | Renumbered after new CP5 |
| CP5-SELF-EVOLUTION | CP7-SELF-EVOLUTION | Renumbered |
| CP6-ENTERPRISE | CP8-ENTERPRISE | Renumbered |
| CP7-PLATFORM-INFRA | CP9-PLATFORM-INFRA | Renumbered |
| — | CP5-MESSAGING | **NEW** |
| — | CP10-WEB-FRONTEND | **NEW** |
| — | CP11-INFRASTRUCTURE | **NEW** |
| — | CP12-MOBILE-DESKTOP | **NEW** |

---

## Key Technology Changes

### Database Layer
```diff
- import Database from 'better-sqlite3';
- const db = new Database('orchestrator.db');
+ import { Pool } from 'pg';
+ import { createClient } from '@libsql/client';
+ const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

### State Management
```diff
- export class StateGraph extends EventEmitter {
-   private state: WorkflowState = WorkflowState.IDLE;
-   async transition(event: string) { /* manual */ }
- }
+ import { StateGraph, END } from "@langchain/langgraph";
+ const workflow = new StateGraph<typeof graphState>({
+   channels: graphState,
+ })
+   .addNode("orchestrate", orchestrateNode)
+   .addNode("agent", executeAgentNode)
+   .addConditionalEdges("orchestrate", routeToAgent)
+   .compile({ checkpointer: postgresCheckpointer });
```

### Backend Framework
```diff
- import { Command } from 'commander';
- const program = new Command().name('aigentflow');
+ import { NestFactory } from '@nestjs/core';
+ import { FastifyAdapter } from '@nestjs/platform-fastify';
+ const app = await NestFactory.create(AppModule, new FastifyAdapter());
+ // CLI still available as thin wrapper
```

### Monorepo Structure
```diff
- src/
-   ├── agents/
-   ├── orchestrator/
-   └── shared/
+ apps/
+   ├── api/           # NestJS backend
+   ├── web/           # React frontend
+   └── cli/           # Commander.js CLI
+ packages/
+   ├── core/          # Business logic
+   ├── agents/        # Agent definitions
+   ├── langgraph/     # Workflow graphs
+   └── database/      # PostgreSQL/Qdrant clients
```

---

## Phase Timeline

### Phase 1: Foundation (CP0-CP4)
**Goal**: Establish correct architectural foundation

| Checkpoint | Focus | Key Deliverables |
|------------|-------|------------------|
| CP0 | Foundation | Monorepo, PostgreSQL, LangGraph, NestJS, CLI |
| CP1 | Agent System | LangGraph-based agent framework |
| CP2 | Design System | UI Designer agent, design workflow |
| CP3 | Git Worktrees | Isolated development environments |
| CP4 | Build & Test | Developer and tester agents |

### Phase 2: Scale & Integration (CP5-CP9)
**Goal**: Production-ready platform

| Checkpoint | Focus | Key Deliverables |
|------------|-------|------------------|
| CP5 | Messaging | NATS, BullMQ, WebSockets |
| CP6 | Integration | Merge, CI/CD, Release workflows |
| CP7 | Self-Evolution | Pattern learning, agent generation |
| CP8 | Enterprise | Compliance, security, incident response |
| CP9 | Platform | Multi-tenant, feature flags |

### Phase 3: Full Platform (CP10-CP12)
**Goal**: Complete multi-platform support

| Checkpoint | Focus | Key Deliverables |
|------------|-------|------------------|
| CP10 | Web Frontend | React dashboard, workflow viz |
| CP11 | Infrastructure | OpenTofu, K3s, Hetzner |
| CP12 | Mobile/Desktop | Expo mobile, Tauri desktop |

---

## Detailed Step Changes

### CP0-FOUNDATION (11 Steps)

#### 01-MONOREPO-SETUP.md (NEW)
```yaml
deliverables:
  - Turborepo configuration (turbo.json)
  - pnpm workspace setup (pnpm-workspace.yaml)
  - apps/api, apps/web, apps/cli directories
  - packages/core, packages/agents, packages/database
  - Shared TypeScript configuration
  - ESLint + Prettier shared config
  - Husky + lint-staged hooks

dependencies: []
```

#### 02-POSTGRESQL-SETUP.md (NEW)
```yaml
deliverables:
  - PostgreSQL schema design
  - Row-Level Security (RLS) policies
  - Apache AGE extension setup
  - Database migrations (Drizzle ORM)
  - Connection pooling (PgBouncer)
  - Local Docker Compose for development

dependencies: [01-MONOREPO-SETUP]
```

#### 03-LANGGRAPH-CORE.md (REWRITE)
```yaml
deliverables:
  - LangGraph.js workflow foundation
  - State channel definitions
  - PostgreSQL checkpointer integration
  - Human-in-the-loop patterns
  - Workflow visualization support

dependencies: [02-POSTGRESQL-SETUP]
replaces: [03-STATE-MACHINE.md]
```

#### 04-NESTJS-API.md (NEW)
```yaml
deliverables:
  - NestJS application structure
  - Fastify adapter configuration
  - Module structure (Orchestrator, Agents, MCP)
  - Guards, interceptors, filters
  - OpenAPI/Swagger documentation
  - tRPC routers for internal use

dependencies: [01-MONOREPO-SETUP, 02-POSTGRESQL-SETUP]
```

#### 05-CLI-FOUNDATION.md (UPDATE)
```yaml
deliverables:
  - Commander.js CLI (wraps NestJS API)
  - HTTP client for API communication
  - Local mode fallback
  - Configuration management
  - Interactive prompts

dependencies: [04-NESTJS-API]
changes_from_original:
  - CLI now calls API instead of direct execution
  - Supports both local and remote modes
```

#### 06-PERSISTENCE-LAYER.md (REWRITE)
```yaml
deliverables:
  - PostgreSQL repositories (Drizzle ORM)
  - State persistence tables
  - Project/task/execution tables
  - Lessons learned tables
  - Audit log tables

dependencies: [02-POSTGRESQL-SETUP]
replaces: [04-PERSISTENCE-LAYER.md SQLite version]
```

#### 07-QDRANT-VECTORS.md (NEW)
```yaml
deliverables:
  - Qdrant client configuration
  - Embedding generation (OpenAI/Anthropic)
  - Collections for lessons, context, code
  - Similarity search utilities
  - RAG pipeline foundation

dependencies: [02-POSTGRESQL-SETUP]
```

#### 08-PROMPT-ARCHITECTURE.md (MOVE)
```yaml
# Keep existing content, move from 03a
deliverables:
  - Meta-prompt system
  - Prompt templates
  - Variable interpolation
  - Prompt versioning

dependencies: [03-LANGGRAPH-CORE]
moved_from: [03a-PROMPT-ARCHITECTURE.md, 03b-META-PROMPTS.md]
```

#### 09-HOOKS-GUARDRAILS.md (UPDATE)
```yaml
deliverables:
  - LangGraph-compatible hooks
  - Pre/post execution hooks
  - Guardrail middleware
  - Rate limiting
  - Cost tracking

dependencies: [03-LANGGRAPH-CORE, 04-NESTJS-API]
changes_from_original:
  - Hooks now integrate with LangGraph nodes
  - NestJS interceptor-based guardrails
```

#### 10-AUDIT-LOGGING.md (UPDATE)
```yaml
deliverables:
  - PostgreSQL audit tables
  - Structured logging (Winston)
  - LangSmith integration
  - Audit event types
  - Query interface

dependencies: [06-PERSISTENCE-LAYER]
changes_from_original:
  - Uses PostgreSQL instead of SQLite
  - Integrates with LangSmith for LLM tracing
```

#### 11-CHECKPOINT-RECOVERY.md (REWRITE)
```yaml
deliverables:
  - LangGraph PostgreSQL checkpointer
  - Recovery workflows
  - Partial execution resume
  - Checkpoint pruning
  - Snapshot export/import

dependencies: [03-LANGGRAPH-CORE, 06-PERSISTENCE-LAYER]
replaces: [04c-CHECKPOINT-RECOVERY.md]
```

---

## What Gets Archived

The following original files will be archived (not deleted) as reference:

```
ARCHIVE/original-plans/
├── CP0-FOUNDATION/
│   ├── 01-PROJECT-SETUP.md      # Replaced by monorepo setup
│   ├── 03-STATE-MACHINE.md      # Replaced by LangGraph
│   └── 04-PERSISTENCE-LAYER.md  # Replaced by PostgreSQL version
├── CP1-DESIGN-SYSTEM/
│   └── 05-AGENT-FRAMEWORK.md    # Replaced by LangGraph agents
```

---

## Migration Script

Once approved, the following will be executed:

```bash
# 1. Create new directory structure
mkdir -p IMPLEMENTATION/{CP0-FOUNDATION,CP1-AGENT-SYSTEM,CP2-DESIGN-SYSTEM,...}

# 2. Archive original plans
mkdir -p ARCHIVE/original-plans
mv IMPLEMENTATION/CP0-FOUNDATION ARCHIVE/original-plans/

# 3. Copy updated/kept plans
cp -r NEW-PLANS/* IMPLEMENTATION/

# 4. Update overview and checkpoints
cp 00-OVERVIEW-NEW.md IMPLEMENTATION/00-OVERVIEW.md
cp CHECKPOINTS-NEW.md IMPLEMENTATION/CHECKPOINTS.md
```

---

## Approval Request

**Please confirm the following:**

- [ ] Restructure CP0 with new foundation (PostgreSQL, LangGraph, NestJS, monorepo)
- [ ] Add new checkpoints (CP5-Messaging, CP10-Frontend, CP11-Infrastructure, CP12-Mobile)
- [ ] Rewrite agent framework to use LangGraph.js
- [ ] Archive original SQLite/custom StateGraph plans
- [ ] Proceed with generating detailed step files

**Estimated work:**
- Foundation rebuild: 40% rewrite
- Agent system: 30% rewrite
- New checkpoints: 100% new content
- Existing compatible plans: Minor updates only
