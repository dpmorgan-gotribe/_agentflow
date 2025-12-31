# Aigentflow: Enterprise Multi-Agent AI Orchestrator Technology Stack

Building a self-hosted, enterprise-grade multi-agent orchestrator for full-stack development requires a carefully balanced technology stack optimizing for **developer velocity with Claude**, **self-hosted deployment on Hetzner**, and **maximum code reuse** across platforms. The recommended stack centers on **TypeScript + LangGraph.js + NestJS** for the backend, **PostgreSQL + Qdrant** for data, **React + Expo + Tauri** for cross-platform UI, and **OpenTofu + K3s** for infrastructure as code—delivering production-ready capabilities with minimal third-party dependencies.

---

## TypeScript wins for agent orchestration backends

**Primary recommendation: TypeScript/Node.js with NestJS (Fastify adapter)**

The language decision hinges on three factors: LLM ecosystem maturity, orchestration performance, and Claude Code compatibility. While Python dominates raw framework count (CrewAI, DSPy, AutoGen are Python-only), TypeScript now achieves **feature parity with LangChain/LangGraph** and offers compelling advantages for a full-stack orchestrator:

| Factor | TypeScript | Python |
|--------|------------|--------|
| **Orchestration performance** | 15-25% faster, 4-6x lower memory | GIL limits concurrency |
| **LangGraph support** | Full parity (v0.2.0+) | Primary |
| **Claude SDK quality** | Excellent + Zod type validation | Excellent |
| **Full-stack monorepo** | Single language across stack | Frontend requires JS anyway |
| **Claude Code velocity** | Compile-time feedback guides iterations | Runtime type hints only |

LangChain.js benchmarks show **0.2-0.5 seconds faster per LLM API call** and **150-200MB memory usage** versus Python's 800-1200MB for 1,000 concurrent requests. For agent orchestration—which involves many parallel LLM calls—this difference compounds significantly.

**NestJS with Fastify adapter** provides the ideal backend framework: enterprise patterns (dependency injection, modular architecture), excellent WebSocket support via `@nestjs/websockets`, and stable performance under heavy load (15% throughput drop versus Fastify's 22% at 10K concurrent connections). Start with a **modular monolith architecture**—clear module boundaries enable future service extraction without premature microservices complexity.

---

## LangGraph.js powers the orchestration engine

**Multi-agent framework recommendation: LangGraph.js**

For complex agent workflows, LangGraph provides unmatched control through its graph-based architecture:

- **Production-proven** at Replit, Uber, LinkedIn, GitLab, Klarna
- **Graph-based workflows** with cycles, conditional branching, parallel execution
- **Built-in state persistence** with checkpointing and human-in-the-loop patterns
- **Time-travel debugging** via LangGraph Studio
- **Full TypeScript support** since v0.2.0

CrewAI and AutoGen offer simpler abstractions but lack TypeScript support and the fine-grained control needed for enterprise orchestration. LangGraph's approach—where developers define explicit state machines rather than rely on "autonomous" agents—produces more predictable, debuggable systems.

```typescript
// LangGraph provides explicit control flow
const workflow = new StateGraph({ schema: AgentState })
  .addNode("planner", planningAgent)
  .addNode("executor", executorAgent)
  .addConditionalEdges("planner", routeToExecutor)
  .addEdge("executor", END);
```

---

## PostgreSQL anchors the database architecture

**Multi-tenant strategy: Shared database with Row-Level Security (RLS)**

For agent orchestration data, PostgreSQL 16+ serves as the foundation with three extensions covering all data needs:

| Requirement | Solution | Rationale |
|-------------|----------|-----------|
| **Multi-tenancy** | RLS (Row-Level Security) | Database-enforced isolation, simple schema management |
| **Graph queries** | Apache AGE extension | OpenCypher in PostgreSQL, no separate graph DB needed |
| **Vector search** | Qdrant (self-hosted) | Best tail latency, strong filtering, Docker-ready |

**Row-Level Security** eliminates the "forgotten WHERE clause" problem—every query automatically filters by tenant. Agent relationship graphs rarely exceed 2-3 hops (agent→tool→conversation), making Neo4j's 180x performance advantage at 3+ hops irrelevant. Apache AGE provides openCypher query syntax directly in PostgreSQL with full ACID compliance.

**Qdrant** over pgvector for production vector search: while pgvector achieves higher throughput (471 QPS versus Qdrant's 41 QPS), Qdrant delivers **better p95/p99 latencies** and handles high-frequency index updates more gracefully. Deploy via Docker on Hetzner with minimal configuration:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    volumes: ["./qdrant_storage:/qdrant/storage"]
    ports: ["6333:6333", "6334:6334"]
```

Use **PostgreSQL everywhere**—including local development—to avoid SQLite's single-writer limitations and missing extensions (RLS, ltree, Apache AGE).

---

## NATS + BullMQ minimizes message queue dependencies

**Real-time architecture: NATS JetStream + BullMQ + uWebSockets.js**

Self-hosted agent orchestration requires lightweight message infrastructure. The recommended stack uses only **three services** (PostgreSQL, Redis, NATS):

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Agent messaging** | NATS JetStream | Sub-millisecond pub/sub, 8-11M msgs/sec, 3MB binary |
| **Task queues** | BullMQ (Redis) | Job scheduling, priorities, retries, parent-child flows |
| **Client streaming** | uWebSockets.js + SSE | 10x faster than Socket.IO, 120K connections per instance |

**Critical finding**: Avoid PostgreSQL LISTEN/NOTIFY for production messaging—it acquires a **global database lock** during COMMIT, causing stalls under concurrent writes.

NATS JetStream replaces Kafka/RabbitMQ without JVM or Erlang dependencies. It benchmarks 20-25% faster than Redis Streams while providing exactly-once delivery, message replay, and built-in key-value storage.

**For client activity streams**, use **SSE (Server-Sent Events)** for unidirectional updates (agent status, task progress, logs) and reserve WebSockets for bidirectional requirements (real-time agent commands, collaborative features). SSE offers automatic reconnection, HTTP/2 multiplexing, and better proxy compatibility.

---

## React + Expo + Tauri maximizes code sharing

**Cross-platform strategy: React (web) + Expo (mobile) + Tauri 2.0 (desktop)**

This combination shares **70-80% of UI code** across platforms while delivering native performance:

| Platform | Technology | Key Benefits |
|----------|------------|--------------|
| **Web** | React (Next.js or Vite) | SSR capability, direct component sharing |
| **Mobile** | Expo (managed workflow) | Meta-recommended, SOC 2 compliant, OTA updates |
| **Desktop** | Tauri 2.0 | 2.5-10MB bundles (vs Electron's 85-150MB), Rust backend |

Expo's managed workflow now covers ~90% of mobile app requirements through config plugins—ejecting to bare workflow is rarely necessary. Tauri 2.0 (stable October 2024) leverages OS WebViews instead of bundling Chromium, dramatically reducing bundle size and memory footprint.

**State management**: **Zustand** for client state (3KB, minimal boilerplate, works identically across React and React Native) combined with **TanStack Query** for server state. Both work seamlessly in a shared package.

**Styling**: **NativeWind v4** (Tailwind CSS for React Native) enables the same utility classes across web and mobile, compiling to native StyleSheet at build time with no runtime performance cost.

---

## Monorepo structure optimized for Claude development

**Recommended layout: Turborepo + pnpm workspaces**

```
aigentflow/
├── apps/
│   ├── api/               # NestJS API server
│   ├── web/               # Next.js web dashboard
│   ├── mobile/            # Expo React Native app
│   └── desktop/           # Tauri desktop app
├── packages/
│   ├── orchestrator/      # LangGraph workflow engine
│   ├── agents/            # Agent implementations
│   ├── mcp-servers/       # Custom MCP servers
│   │   ├── filesystem/
│   │   ├── database/
│   │   └── workflow/
│   ├── ui/                # Shared NativeWind components
│   ├── store/             # Zustand stores
│   ├── api-client/        # tRPC client + React Query
│   └── shared/            # Types, utilities, validation
├── docs/
│   ├── architecture.md    # System overview + code map
│   └── decisions/         # ADRs (0001-langgraph.md, etc.)
├── CLAUDE.md              # AI development configuration
├── .claude/
│   └── commands/          # Custom Claude commands
├── turbo.json
└── pnpm-workspace.yaml
```

Turborepo over Nx for this project: **15 minutes setup** versus 2.5 hours, ~20 lines of config versus ~200, with sufficient caching and parallel execution for agent orchestrator needs.

---

## CLAUDE.md and documentation architecture

**Claude-optimized project structure enables AI-assisted development velocity:**

### CLAUDE.md (keep under 150 lines)

```markdown
# CLAUDE.md - Aigentflow Development

## 🚨 CRITICAL RULES
- Complete implementations only—no placeholders
- TypeScript strict mode required
- All agents implement AgentInterface from @aigentflow/shared
- Test every agent with mocked LLM responses

## 📁 PROJECT LAYOUT
- `packages/orchestrator/` - LangGraph workflows
- `packages/agents/` - Agent implementations
- `packages/mcp-servers/` - MCP server implementations
- `apps/api/` - NestJS API server

## 🔧 COMMANDS
- `pnpm dev` - Start all services
- `pnpm test` - Run tests
- `pnpm build` - Production build

## 🧠 AI PATTERNS
- Use Extended Thinking for architectural decisions
- Reference architecture.md for system design
- Check docs/decisions/ for prior ADRs
```

### architecture.md (stable, rarely updated)

```markdown
# Architecture

## Bird's Eye View
Aigentflow orchestrates multi-agent workflows for full-stack development.
LangGraph manages workflow state; MCP servers provide tool access.

## Code Map
packages/orchestrator/  → Core LangGraph workflow definitions
packages/agents/        → Individual agent implementations
packages/mcp-servers/   → MCP protocol implementations
apps/api/              → NestJS API gateway

## Invariants
- All agents must be serializable for checkpoint persistence
- MCP servers must implement graceful shutdown
- Tenant isolation enforced via PostgreSQL RLS

## Layer Boundaries
[API] → [Orchestrator] → [Agents] → [MCP Servers] → [External Tools]
```

### Custom commands (.claude/commands/)

Create reusable workflows in `.claude/commands/create-agent.md`:
```markdown
Create a new LangGraph agent with:
- Name: $ARGUMENTS
- Base template: packages/agents/templates/base-agent.ts
- Include unit tests with mocked LLM responses
- Register in packages/agents/registry.ts
```

---

## MCP integration strategy

**Leverage existing servers, build custom ones for business logic:**

The Model Context Protocol (MCP) is now the industry standard for connecting agents to tools, adopted by OpenAI and Google DeepMind following Anthropic's release.

### Servers to use (from official repository)

| Server | Purpose |
|--------|---------|
| **Filesystem** | Local file operations |
| **Git** | Repository operations |
| **PostgreSQL** | Database queries |
| **Brave Search** | Web search capability |
| **Puppeteer** | Browser automation |

### Custom servers to build

| Server | Purpose |
|--------|---------|
| **Workflow State** | Persist/retrieve LangGraph checkpoints |
| **Agent Registry** | Manage agent configurations |
| **Enterprise Data** | Connect to internal business systems |
| **Audit/Logging** | Track all agent actions for compliance |

Use **STDIO transport** for local MCP servers and **StreamableHTTP** for distributed deployment. The TypeScript MCP SDK (10.7k stars) provides the foundation for custom server development.

---

## OpenTofu + K3s for Hetzner infrastructure

**IaC recommendation: OpenTofu (not Terraform)**

OpenTofu—the Linux Foundation fork of Terraform—provides identical HCL syntax with true open-source licensing (MPL 2.0 versus HashiCorp's BSL). The official Hetzner provider (`hetznercloud/hcloud`) works seamlessly with OpenTofu.

**Container orchestration: K3s (lightweight Kubernetes)**

K3s delivers full Kubernetes API compatibility in a **512MB memory footprint**—ideal for single-tenant deployment stamps:

```
┌─────────────────────────────────────────────────────────┐
│                    CONTROL PLANE (Multi-tenant)         │
│  [API Layer] [Metadata DB] [Observability Stack]       │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Tenant A    │ │  Tenant B    │ │  Tenant C    │
│  K3s Stamp   │ │  K3s Stamp   │ │  K3s Stamp   │
│  Hetzner CX  │ │  Hetzner CX  │ │  Hetzner CX  │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Deployment stamps pattern**: Each tenant gets an isolated K3s cluster on dedicated Hetzner servers (CX21 for small, CPX31 for medium workloads). This provides:
- Complete data isolation per tenant
- No noisy neighbor problems
- Easy tenant offboarding (delete entire stamp)
- Compliance-ready architecture

The Kubernetes Cluster Autoscaler has **official Hetzner Cloud support** for horizontal scaling.

---

## Local development environment

**Developer experience stack:**

| Tool | Purpose |
|------|---------|
| **Ollama** | Local LLM testing (llama3.1, mistral, qwen2.5-coder) |
| **LangGraph Studio** | Visual workflow debugging with hot reload |
| **MCP Inspector** | Visual MCP server testing |
| **Docker Compose** | Local PostgreSQL + Redis + NATS |

Configure environment switching for seamless local-to-production transitions:

```typescript
const llm = process.env.NODE_ENV === 'development'
  ? createOllamaLLM({ model: "llama3.1:8b", baseUrl: "http://localhost:11434/v1" })
  : createClaudeLLM(productionConfig);
```

**Testing strategy** follows a four-layer approach:
1. **Unit tests** with mocked LLM responses (Vitest + respx)
2. **Integration tests** with real tool implementations, mocked external services
3. **Evaluation tests** using DeepEval for semantic assertions
4. **E2E tests** sparingly with real LLMs, traced via LangSmith

---

## Complete technology stack summary

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Language** | TypeScript | Full-stack monorepo, better performance, Claude Code velocity |
| **Backend Framework** | NestJS (Fastify) | Enterprise patterns, excellent WebSocket support |
| **Agent Framework** | LangGraph.js | Graph-based workflows, production-proven, TypeScript support |
| **API Layer** | tRPC (internal) + REST (public) | Type safety + universal compatibility |
| **Primary Database** | PostgreSQL 16+ with RLS | Multi-tenant isolation, extensions ecosystem |
| **Graph Queries** | Apache AGE | OpenCypher in PostgreSQL, no separate DB needed |
| **Vector Database** | Qdrant (self-hosted) | Best latency, strong filtering, Docker-ready |
| **Message Queue** | NATS JetStream | Sub-ms latency, 3MB binary, event sourcing |
| **Task Queue** | BullMQ (Redis) | Job scheduling, priorities, flows |
| **Real-time (server)** | uWebSockets.js | 10x faster than Socket.IO |
| **Real-time (client)** | SSE + WebSocket | SSE for streams, WS for bidirectional |
| **Web** | React (Next.js) | SSR capability, component sharing |
| **Mobile** | Expo (managed) | Meta-recommended, SOC 2 compliant |
| **Desktop** | Tauri 2.0 | 10x smaller than Electron, Rust backend |
| **State Management** | Zustand + TanStack Query | Lightweight, cross-platform |
| **Styling** | NativeWind (Tailwind) | Universal web/mobile styling |
| **Monorepo** | Turborepo + pnpm | Simple config, fast builds |
| **IaC** | OpenTofu | True open-source Terraform fork |
| **Orchestration** | K3s | Lightweight Kubernetes, CNCF-certified |
| **MCP** | TypeScript SDK + official servers | Standard protocol, extensible |
| **Local LLM** | Ollama | Free local testing |
| **Observability** | LangSmith + Prometheus + Grafana | Agent tracing + infrastructure metrics |

This stack prioritizes **self-hosted deployment**, **minimal third-party dependencies**, **maximum code reuse**, and **Claude-optimized development velocity**—delivering enterprise-grade capabilities suitable for Aigentflow's multi-agent orchestration requirements.