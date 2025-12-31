# Checkpoint Validation Criteria

> **Version:** 3.0.2 (Architecture Aligned)
> **Total Checkpoints:** 12
> **Total Tests:** 900+ (estimated)

This document defines the acceptance criteria for each checkpoint aligned with ARCHITECTURE.md.

---

## Checkpoint Overview

| Phase | Checkpoint | Steps | Tests | Key Validation |
|-------|------------|-------|-------|----------------|
| 1 | CP0: Foundation | 01-11 | ~120 | Monorepo, PostgreSQL, LangGraph, NestJS |
| 1 | CP1: Agent System | 12-19 (incl. 12a) | ~130 | LangGraph agents, self-review, orchestrator |
| 1 | CP2: Design System | 20-24a | ~70 | UI Designer, design tokens, early web UI |
| 1 | CP3: Git Worktrees | 25-27 | ~40 | Feature isolation |
| 1 | CP4: Build & Test | 28-33 | ~70 | Developer agents, testing |
| 2 | CP5: Messaging | 34-37 | ~50 | NATS, BullMQ, WebSockets |
| 2 | CP6: Integration | 38-41 | ~40 | CI/CD, releases |
| 2 | CP7: Self-Evolution | 42-45 | ~70 | Pattern detection, DSPy |
| 2 | CP8: Enterprise | 46-49 | ~80 | Compliance, security |
| 2 | CP9: Platform Infra | 50-53 | ~60 | Multi-tenant, feature flags |
| 3 | CP10: Web Frontend | 54-58 | ~80 | React dashboard |
| 3 | CP11: Infrastructure | 59-62 | ~50 | OpenTofu, K3s, Hetzner |
| 3 | CP12: Mobile/Desktop | 63-64 | ~30 | Expo, Tauri |

---

## CP0: Foundation

**Steps:** 01-11
**Tag:** `cp0-foundation`

### Validation Checklist

```
□ Monorepo Setup (Step 01)
  □ pnpm install completes without errors
  □ turbo build compiles all packages
  □ apps/api, apps/cli directories exist
  □ packages/core, packages/database, packages/langgraph exist
  □ Shared TypeScript configs work

□ PostgreSQL Setup (Step 02)
  □ Docker Compose starts PostgreSQL + AGE
  □ Drizzle migrations run successfully
  □ RLS policies created for all tenant tables
  □ Apache AGE graph queries work
  □ Connection pooling configured

□ LangGraph Core (Step 03)
  □ LangGraph.js workflow compiles
  □ State channels defined correctly
  □ Orchestrator graph runs
  □ PostgreSQL checkpointer persists state
  □ Human-in-the-loop interrupt works

□ NestJS API (Step 04)
  □ API server starts on port 3000
  □ Swagger docs at /api/docs
  □ Tasks endpoint creates workflows
  □ SSE streaming works
  □ Auth guard validates tokens

□ CLI Foundation (Step 05)
  □ aigentflow --version shows version
  □ aigentflow run creates task via API
  □ aigentflow status shows task state
  □ aigentflow approve sends approval

□ Persistence Layer (Step 06)
  □ All Drizzle repositories work
  □ Tenant isolation enforced
  □ CRUD operations for projects/tasks
  □ Migrations versioned

□ Qdrant Vectors (Step 07)
  □ Qdrant container runs
  □ Embedding generation works
  □ Collections created
  □ Similarity search returns results

□ Prompt Architecture (Step 08)
  □ Meta-prompt templates load
  □ Variable interpolation works
  □ Prompt versioning tracked

□ Hooks & Guardrails (Step 09)
  □ Pre/post execution hooks fire
  □ Guardrail validation blocks bad input
  □ Secret detection works
  □ Cost tracking enabled

□ Audit Logging (Step 10)
  □ All operations logged to PostgreSQL
  □ LangSmith tracing connected
  □ Structured log format
  □ Query interface works

□ Checkpoint Recovery (Step 11)
  □ LangGraph checkpoints persist
  □ Workflow resumes from checkpoint
  □ Partial execution recovery works
```

### Automated Test Suite

```bash
# Run all CP0 tests
pnpm turbo test --filter=@aigentflow/api --filter=@aigentflow/cli --filter=@aigentflow/database --filter=@aigentflow/langgraph

# Expected: ~120 tests passed
```

---

## CP1: Agent System

**Steps:** 12-19 (including 12a: Self-Review)
**Tag:** `cp1-agent-system`

### Validation Checklist

```
□ Agent Framework (Step 12)
  □ Base LangGraph agent node defined
  □ Agent context manager works
  □ Structured output validation
  □ Routing hints included

□ Self-Review Framework (Step 12a)
  □ SelfReviewLoop class implemented
  □ SelfReviewResult schema with scores
  □ Gap schema (severity, category, suggestedFix)
  □ RequirementCoverage tracking works
  □ Quality scoring (0.0-1.0) calculates correctly
  □ Decision logic (approved/needs_work/escalate)
  □ Max iterations (default 3) enforced
  □ Escalation triggers on critical gaps
  □ Gap addressing prompt generation works
  □ BaseAgent integration with review hooks
  □ UI Designer review criteria implemented
  □ Project Manager review criteria implemented
  □ Learning integration captures patterns

□ Orchestrator Graph (Step 13)
  □ Main workflow graph compiles
  □ Conditional routing works
  □ All nodes connected correctly
  □ End states reachable

□ Context Manager (Step 14)
  □ Qdrant context retrieval works
  □ Relevant lessons fetched
  □ Token budget respected
  □ Context prioritization works

□ Orchestrator Agent (Step 15)
  □ Task analysis determines type
  □ Agent queue built correctly
  □ Routing decisions logged
  □ Status updates emitted

□ Project Manager Agent (Step 16)
  □ Work breakdown generated
  □ Dependencies identified
  □ Task estimation works
  □ Scheduling logic correct

□ Architect Agent (Step 17)
  □ Tech stack recommendations
  □ ADR generation works
  □ Architecture diagrams created
  □ Trade-off analysis included

□ Analyst Agent (Step 18)
  □ Research reports generated
  □ Best practices documented
  □ Comparisons with pros/cons
  □ Source citations included

□ Skills Framework (Step 19)
  □ Skill packs load correctly
  □ Skill injection works
  □ Token budget respected
  □ Skill conflicts resolved
```

### Automated Test Suite

```bash
# Run all CP1 tests
pnpm turbo test --filter=@aigentflow/agents

# Expected: ~100 tests passed
```

---

## CP2: Design System

**Steps:** 20-24a
**Tag:** `cp2-design-system`

### Validation Checklist

```
□ UI Designer Agent (Step 20)
  □ HTML mockups generated
  □ Responsive design considered
  □ Accessibility attributes present
  □ Design tokens applied

□ Design Tokens (Step 21)
  □ Token schema defined
  □ CSS variables generated
  □ Theme variants work
  □ Tokens stored in config

□ User Flows (Step 22)
  □ Flow diagrams generated
  □ State transitions documented
  □ Approval gates pause execution

□ Design Workflow (Step 23)
  □ Competitive design mode works
  □ Multiple mockups generated
  □ User selection recorded
  □ Winner propagated

□ Activity System (Step 24)
  □ Real-time events streamed
  □ Activity history queryable
  □ Filtering by type works

□ Early Web Interface (Step 24a)
  □ React app builds and runs at localhost:5173
  □ Prompt bar submits to API
  □ SSE connection receives agent events
  □ Agent messages display in feed with agent name
  □ Timestamps show for each message
  □ Mockup HTML renders in iframe
  □ Stylesheet displays with syntax highlighting
  □ Flow diagrams render as markdown
  □ Approval dialog appears when required
  □ Approve/Reject updates task state
  □ Responsive layout works on mobile
```

---

## CP3: Git Worktrees

**Steps:** 25-27
**Tag:** `cp3-git-worktrees`

### Validation Checklist

```
□ Git Agent (Step 25)
  □ Branch creation works
  □ Worktree creation works
  □ Commit generation works
  □ Branch naming conventions

□ Worktree Isolation (Step 26)
  □ Per-feature worktrees
  □ Independent builds work
  □ Parallel development works

□ Conflict Detection (Step 27)
  □ Overlapping changes detected
  □ Resolution suggestions provided
  □ Merge workflow works
```

---

## CP4: Build & Test

**Steps:** 28-33
**Tag:** `cp4-build-test`

### Validation Checklist

```
□ Frontend Developer Agent (Step 28)
  □ Components created with tests
  □ TypeScript types correct
  □ Design tokens applied
  □ Accessibility implemented

□ Backend Developer Agent (Step 29)
  □ Endpoints with tests
  □ Input validation present
  □ Error handling complete
  □ Auth considered

□ Tester Agent (Step 30)
  □ Test suite executed
  □ Coverage report generated
  □ Failures identified
  □ Security tests included

□ Bug Fixer Agent (Step 31)
  □ Fix generated from failure
  □ Re-test verification
  □ Max retries enforced
  □ Escalation on failure

□ Reviewer Agent (Step 32)
  □ Code review completed
  □ Quality issues identified
  □ Approval/rejection decision

□ Lesson Extraction (Step 33)
  □ Lessons extracted from execution
  □ Lessons stored in Qdrant
  □ Similar lessons retrieved
```

---

## CP5: Messaging (NEW)

**Steps:** 34-37
**Tag:** `cp5-messaging`

### Validation Checklist

```
□ NATS JetStream (Step 34)
  □ NATS server runs
  □ Pub/sub works
  □ Message persistence works
  □ Consumer groups work

□ BullMQ Jobs (Step 35)
  □ Job queues created
  □ Background processing works
  □ Job retries work
  □ Dead letter queue works

□ WebSocket Streaming (Step 36)
  □ WebSocket server runs
  □ Real-time events stream
  □ Connection management works
  □ Reconnection works

□ Agent Pool Scaling (Step 37)
  □ Max 15 concurrent agents
  □ Pool utilization tracked
  □ Queue management works
  □ Priority scheduling works
```

---

## CP6: Integration

**Steps:** 38-41
**Tag:** `cp6-integration`

### Validation Checklist

```
□ Merge Workflow (Step 38)
  □ Worktree merged correctly
  □ Cleanup works

□ Integration Branch (Step 39)
  □ Feature merged to integration
  □ Integration tests pass

□ CI/CD Integration (Step 40)
  □ GitHub Actions workflow exists
  □ All checks pass

□ Release Workflow (Step 41)
  □ Version tag created
  □ Changelog updated
  □ Release notes generated
```

---

## CP7: Self-Evolution

**Steps:** 42-45
**Tag:** `cp7-self-evolution`

### Validation Checklist

```
□ Execution Tracing (Step 42)
  □ LangSmith integration works
  □ All executions traced
  □ Traces queryable

□ Pattern Detection (Step 43)
  □ Pattern miner runs
  □ Patterns stored in Qdrant
  □ Similarity detection works

□ Agent Generation (Step 44)
  □ DSPy integration works
  □ Agent config generated
  □ Constitutional validation

□ Tournament Promotion (Step 45)
  □ TrueSkill ratings work
  □ Matches run correctly
  □ Promotion criteria evaluated
```

---

## CP8: Enterprise

**Steps:** 46-49
**Tag:** `cp8-enterprise`

### Validation Checklist

```
□ Incident Response (Step 46)
  □ Incident detection works
  □ Severity classification
  □ Runbook execution

□ GDPR Operations (Step 47)
  □ DSAR processing works
  □ Consent management
  □ Data export/deletion

□ Compliance Dashboards (Step 48)
  □ Compliance status display
  □ Evidence collection
  □ Report generation

□ Vendor Security (Step 49)
  □ Vendor assessment works
  □ Risk scoring
  □ Dependency scanning
```

---

## CP9: Platform Infrastructure

**Steps:** 50-53
**Tag:** `cp9-platform-infra`

### Validation Checklist

```
□ Model Abstraction (Step 50)
  □ Multi-provider support
  □ Fallback routing
  □ Cost tracking

□ Multi-Tenant (Step 51)
  □ RLS isolation works
  □ Quota enforcement
  □ Rate limiting

□ Feature Flags (Step 52)
  □ Flag evaluation works
  □ Targeting rules
  □ A/B experiments

□ GenUI Output (Step 53)
  □ Structured output schema
  □ Streaming works
  □ Progress indicators
```

---

## CP10: Web Frontend (NEW)

**Steps:** 54-58
**Tag:** `cp10-web-frontend`

### Validation Checklist

```
□ React Setup (Step 54)
  □ React app builds
  □ TanStack Router works
  □ Zustand state management
  □ TanStack Query integration

□ Dashboard UI (Step 55)
  □ Project list displays
  □ Task list displays
  □ Navigation works
  □ Responsive design

□ Workflow Visualization (Step 56)
  □ LangGraph workflow rendered
  □ Node states shown
  □ Real-time updates

□ Agent Monitoring (Step 57)
  □ Agent status display
  □ Log streaming
  □ Metrics display

□ Design Preview (Step 58)
  □ Mockup viewer works
  □ Design comparison
  □ Selection interface
```

---

## CP11: Infrastructure (NEW)

**Steps:** 59-62
**Tag:** `cp11-infrastructure`

### Validation Checklist

```
□ OpenTofu Setup (Step 59)
  □ Modules defined
  □ State backend configured
  □ Variables parameterized

□ K3s Cluster (Step 60)
  □ Cluster manifests defined
  □ Service deployments work
  □ Ingress configured

□ Hetzner Deployment (Step 61)
  □ Server provisioning works
  □ DNS configured
  □ TLS certificates

□ Observability (Step 62)
  □ Prometheus scraping
  □ Grafana dashboards
  □ Alerting rules
```

---

## CP12: Mobile/Desktop (NEW)

**Steps:** 63-64
**Tag:** `cp12-mobile-desktop`

### Validation Checklist

```
□ Expo Mobile (Step 63)
  □ iOS build works
  □ Android build works
  □ API connection
  □ Push notifications

□ Tauri Desktop (Step 64)
  □ macOS build works
  □ Windows build works
  □ Linux build works
  □ Native features
```

---

## Full System Validation

After all checkpoints pass:

```bash
#!/bin/bash
# Full System Validation

echo "=== FULL SYSTEM VALIDATION ==="

# 1. Fresh install
rm -rf node_modules .turbo
pnpm install
pnpm build

# 2. Start infrastructure
docker-compose up -d

# 3. Run migrations
pnpm db:migrate

# 4. Start API
pnpm --filter=@aigentflow/api dev &

# 5. Run CLI test
./apps/cli/bin/aigentflow run "Build a counter component"

# 6. Verify all systems
pnpm test

echo "=== FULL SYSTEM VALIDATION PASSED ==="
```

---

## Checkpoint Sign-off Template

```markdown
## Checkpoint Sign-off: CP[X]

**Date:** YYYY-MM-DD
**Git Tag:** cp[x]-[name]

### Validation Results

- [ ] All automated tests pass
- [ ] All checklist items verified
- [ ] Performance benchmarks met

### Deviations from Plan

[Document any changes]

### Known Issues

[List any non-critical issues]

### Sign-off

- [ ] Ready for next checkpoint
```
