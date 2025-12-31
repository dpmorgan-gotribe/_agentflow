# Comprehensive System Analysis: Aigentflow Meta-Orchestrator

> **Date:** 2025-12-31
> **Status:** Analysis Complete (Updated for CLI-First Approach)
> **Scope:** Full system review of meta-orchestrator and implementation plans
> **Key Decision:** Use Claude CLI for development (cost-effective), support API mode for production

---

## Executive Summary

We are building **two interconnected systems**:

1. **Meta-Orchestrator** (OUTER) - Claude CLI with Task tool for subagent spawning
2. **Aigentflow** (INNER) - Multi-agent platform supporting both CLI and API modes

**Key Architecture Decision:** Use Claude CLI (subscription-based) for all development work instead of Anthropic API (per-token). Claude CLI's built-in Task tool provides subagent spawning capabilities without requiring custom SDK integration.

**Aigentflow Dual-Mode:** The platform being built must support both:
- `CLAUDE_CLI=true` - Development mode using Claude CLI processes
- `CLAUDE_CLI=false` - Production mode using Anthropic API

The CLAUDE-ARCHITECTURE.md provides excellent design patterns. The IMPLEMENTATION plans provide detailed specs. This analysis identifies gaps and provides solutions for compliance enforcement, developer best practices, and CLI/API abstraction.

---

## Part 1: What Works Well

### 1.1 CLAUDE-ARCHITECTURE.md (Meta-Orchestrator Design)

| Aspect | Assessment |
|--------|------------|
| **Parallel subagent design** | Excellent - 3-5 agents with role isolation |
| **Lessons learned system** | Comprehensive - immediate + queryable storage |
| **Phase-gated workflow** | Well-designed with human approval points |
| **File structure template** | Complete and production-ready |
| **Hook system** | Smart automation (format on save, lesson indexing) |

### 1.2 IMPLEMENTATION Plans (Aigentflow Specs)

| Aspect | Assessment |
|--------|------------|
| **Checkpoint system** | Excellent - 12 checkpoints with 900+ tests |
| **Technology choices** | Well-researched, modern stack |
| **Self-review framework** | Strong quality gates for agent output |
| **Phased rollout** | Realistic MVP → Enterprise progression |
| **Validation checklists** | Detailed acceptance criteria per step |

### 1.3 Current .meta Structure

The existing structure has good foundations:
- `perspectives/` - Multi-viewpoint analysis (architect, frontend, backend, security, tester, reviewer)
- `lessons/` - Knowledge capture system
- `rules/` - Typescript patterns, testing requirements
- `plans/` - Implementation tracking

---

## Part 2: Critical Gaps Identified

### 2.1 Gap: Skills Not Leveraging Task Tool for Subagent Patterns

**Problem:** The current `.claude/commands/` use simple prompt templates instead of leveraging Claude CLI's built-in Task tool for parallel subagent spawning.

**Current State:**
```
.claude/commands/implement.md  <- Simple prompt template (no Task tool usage)
.claude/commands/fix-bug.md    <- Simple prompt template (no parallel analysis)
```

**Required State:**
```
.claude/
├── agents/                    <- Role-specific contexts (NEW)
│   ├── architect/CLAUDE.md    <- Architecture-focused context
│   ├── backend/CLAUDE.md      <- Backend development context
│   ├── security/CLAUDE.md     <- Security analysis context
│   └── tester/CLAUDE.md       <- Testing patterns context
│
├── commands/                  <- Skills using Task tool
│   ├── implement.md           <- Spawns parallel Task agents
│   ├── fix-bug.md             <- Uses Task for multi-perspective analysis
│   └── review.md              <- Uses Task for comprehensive review
```

**Impact:** Without Task tool integration in skills, we don't get parallel analysis, role-isolated contexts, or the efficiency improvements from concurrent subagent execution.

**Solution:** Update skills to use Task tool pattern:
```markdown
# In /implement skill:
1. Spawn Task(subagent_type='Explore', prompt='Analyze architecture...')
2. Spawn Task(subagent_type='Explore', prompt='Review backend patterns...')
3. Spawn Task(subagent_type='Explore', prompt='Check security implications...')
4. Aggregate results in main session
5. Present implementation plan
```

---

### 2.2 Gap: Compliance Not Enforced at Build Time

**Problem:** Aigentflow is enterprise software with GDPR/compliance requirements, but the agents building it have no compliance constraints.

**What's Missing:**

| Compliance Area | Current State | Required |
|-----------------|---------------|----------|
| **Data handling** | No rules | Agents must use PII detection |
| **Audit logging** | In inner system | Meta-orchestrator needs it too |
| **Secret management** | "No secrets" rule | Pre-commit hook enforcement |
| **Security review** | Optional perspective | Mandatory gate before merge |
| **License compliance** | Not mentioned | Dependency scanning |

**Solution Needed:**
```yaml
# .meta/rules/compliance-enforcement.yaml
pre_write_checks:
  - no_hardcoded_secrets
  - no_console_log_in_production
  - pii_detection_required
  - license_compatible_dependencies

mandatory_reviews:
  - security_perspective  # Before any file write
  - compliance_check      # Before checkpoint approval
```

---

### 2.3 Gap: Developer Best Practices Not Codified

**Problem:** You mentioned constants, environment files, separation of concerns - these aren't enforced.

**Missing Patterns:**

```typescript
// BAD: What agents might produce without guidance
const API_URL = "https://api.example.com";
const MAX_RETRIES = 3;

export function fetchData() {
  return fetch(API_URL);
}

// GOOD: What we need to enforce
// src/constants/api.constants.ts
export const API_CONSTANTS = {
  BASE_URL: process.env.API_BASE_URL,
  MAX_RETRIES: parseInt(process.env.API_MAX_RETRIES ?? '3'),
  TIMEOUT_MS: parseInt(process.env.API_TIMEOUT_MS ?? '30000'),
} as const;

// src/config/env.ts
import { z } from 'zod';

export const envSchema = z.object({
  API_BASE_URL: z.string().url(),
  API_MAX_RETRIES: z.coerce.number().default(3),
  DATABASE_URL: z.string(),
  // ...all configurable values
});

export const env = envSchema.parse(process.env);
```

**Missing Rules Files:**
- `.meta/rules/constants-separation.md`
- `.meta/rules/environment-configuration.md`
- `.meta/rules/component-structure.md`
- `.meta/rules/error-handling-patterns.md`
- `.meta/rules/api-response-formats.md`

---

### 2.4 Gap: No Source of Truth Enforcement

**Problem:** Design tokens, API contracts, database schema - should be single source of truth that agents reference.

**Missing:**
```
packages/shared/
├── contracts/
│   ├── api.contract.ts        # All API endpoint definitions
│   ├── events.contract.ts     # All event types
│   └── errors.contract.ts     # All error codes
├── constants/
│   ├── agent.constants.ts     # Agent IDs, capabilities
│   ├── limits.constants.ts    # Rate limits, quotas
│   └── features.constants.ts  # Feature flag names
└── schemas/
    ├── database.schema.ts     # Drizzle schema (single source)
    └── validation.schema.ts   # Zod schemas for all inputs
```

---

### 2.5 Gap: Implementation Plans Don't Reference Meta-Orchestrator

**Problem:** The 66 implementation steps describe WHAT to build but not HOW the meta-orchestrator executes them.

**Example - Step 01: MONOREPO-SETUP**

Current (what's in the file):
```markdown
## Deliverables
1. Root package.json with workspaces configuration
2. pnpm-workspace.yaml defining workspace packages
...
```

Missing (how meta-orchestrator executes):
```markdown
## Meta-Orchestrator Execution

### Subagent Assignment
- **Architect**: Review monorepo structure against ARCHITECTURE.md
- **Backend Dev**: Create package.json, turbo.json configurations
- **Reviewer**: Validate against best practices

### Compliance Checks
- [ ] All dependencies use approved licenses (MIT, Apache-2.0)
- [ ] No private registry references
- [ ] TypeScript strict mode configured

### Self-Review Criteria
- pnpm install completes in < 30 seconds
- turbo build --dry-run shows correct task graph
- No circular dependencies
```

---

### 2.6 Gap: Missing CP5-MESSAGING and CP10-12 Content

**Problem:** These checkpoints have no v2.x content - completely empty.

| Checkpoint | v2.x Files | Impact |
|------------|------------|--------|
| CP5-MESSAGING | 0 | NATS, BullMQ, WebSocket not designed |
| CP10-WEB-FRONTEND | 0 | React dashboard not designed |
| CP11-INFRASTRUCTURE | 0 | OpenTofu, K3s not designed |
| CP12-MOBILE-DESKTOP | 0 | Expo, Tauri not designed |

---

## Part 3: Compliance From The Start

### 3.1 Compliance Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLIANCE ENFORCEMENT LAYERS                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LAYER 1: META-ORCHESTRATOR RULES                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Security perspective MANDATORY before file writes        │ │
│  │ • PII detection on all generated code                      │ │
│  │ • License scanning on dependency additions                 │ │
│  │ • Audit logging of all orchestrator actions                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  LAYER 2: PRE-COMMIT HOOKS                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Secret detection (gitleaks)                              │ │
│  │ • TypeScript strict compliance                             │ │
│  │ • Test coverage threshold (80%)                            │ │
│  │ • Dependency vulnerability scan                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  LAYER 3: CI/CD GATES                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • SAST (static analysis security testing)                  │ │
│  │ • DAST (dynamic analysis - staging)                        │ │
│  │ • License compliance report                                │ │
│  │ • Accessibility audit (axe-core)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                   │
│  LAYER 4: RUNTIME ENFORCEMENT (In Aigentflow)                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • PostgreSQL RLS (tenant isolation)                        │ │
│  │ • Input validation (Zod schemas)                           │ │
│  │ • Output sanitization                                      │ │
│  │ • Audit logging (all operations)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Required Compliance Files

```
.meta/
├── compliance/
│   ├── COMPLIANCE-CHECKLIST.md       # Master compliance requirements
│   ├── security-requirements.md       # OWASP Top 10 coverage
│   ├── privacy-requirements.md        # GDPR Article compliance
│   ├── accessibility-requirements.md  # WCAG 2.1 AA
│   └── license-allowlist.yaml         # Approved licenses
│
├── rules/
│   ├── no-hardcoded-secrets.md        # Secret detection patterns
│   ├── pii-handling.md                # PII classification + handling
│   ├── sql-injection-prevention.md    # Parameterized queries only
│   ├── xss-prevention.md              # Output encoding rules
│   └── audit-logging-required.md      # What must be logged
```

### 3.3 Compliance-Enforcing Meta-Orchestrator Prompt

```markdown
# Security Perspective (MANDATORY)

Before ANY file write, the security perspective MUST be invoked.

## Checks
1. **Secret Detection**
   - No API keys, passwords, tokens
   - No hardcoded URLs that should be environment variables
   - No private IPs or internal hostnames

2. **Injection Prevention**
   - SQL: Only parameterized queries via Drizzle ORM
   - Command: No shell command construction from user input
   - XSS: All user content must go through sanitization

3. **Authentication/Authorization**
   - All new endpoints MUST have auth guard
   - RLS policies MUST exist for new tables
   - Tenant isolation MUST be verified

4. **Data Handling**
   - PII fields MUST be marked in schema
   - Encryption at rest for sensitive fields
   - Audit logging for data access

## Output Format
```json
{
  "approved": true | false,
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "file": "path/to/file.ts",
      "line": 42,
      "issue": "Description",
      "recommendation": "How to fix"
    }
  ],
  "requiresHumanReview": true | false
}
```
```

---

## Part 4: Developer Best Practices for Agents

### 4.1 Constants Separation

```markdown
# Rule: Constants Separation

## Purpose
All magic numbers, strings, and configurable values MUST be in dedicated constant files.

## Structure
```
packages/shared/src/constants/
├── index.ts              # Re-exports all constants
├── api.constants.ts      # API-related constants
├── agent.constants.ts    # Agent definitions
├── limits.constants.ts   # Rate limits, quotas, thresholds
├── features.constants.ts # Feature flag names
├── errors.constants.ts   # Error codes and messages
└── ui.constants.ts       # UI-related constants
```

## Pattern
```typescript
// packages/shared/src/constants/limits.constants.ts
export const LIMITS = {
  MAX_CONCURRENT_AGENTS: 15,
  MAX_TASK_RETRIES: 3,
  MAX_CONTEXT_TOKENS: 100000,
  DEFAULT_TIMEOUT_MS: 60000,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
} as const;

// Type extraction for type safety
export type LimitKey = keyof typeof LIMITS;
```

## Anti-Patterns (NEVER DO)
```typescript
// BAD: Magic number in code
if (agents.length > 15) { ... }

// BAD: String literal for feature flag
if (featureFlags.get('enable-self-evolution')) { ... }

// BAD: Hardcoded error message
throw new Error('Too many retries');
```

## Correct Usage
```typescript
import { LIMITS } from '@aigentflow/shared/constants';
import { FEATURE_FLAGS } from '@aigentflow/shared/constants';
import { ERRORS } from '@aigentflow/shared/constants';

if (agents.length > LIMITS.MAX_CONCURRENT_AGENTS) { ... }
if (featureFlags.get(FEATURE_FLAGS.SELF_EVOLUTION)) { ... }
throw new DomainError(ERRORS.MAX_RETRIES_EXCEEDED);
```
```

### 4.2 Environment Configuration

```markdown
# Rule: Environment Configuration

## Purpose
ALL configurable values MUST come from environment variables with validation.

## Required Files
```
apps/api/src/config/
├── env.ts              # Zod schema + validation
├── database.config.ts  # Database configuration
├── auth.config.ts      # Authentication configuration
├── features.config.ts  # Feature flags from env
└── index.ts            # Unified config export
```

## Pattern
```typescript
// apps/api/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Required
  NODE_ENV: z.enum(['development', 'test', 'production']),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),

  // Optional with defaults
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MAX_CONCURRENT_AGENTS: z.coerce.number().default(15),

  // Feature flags (default off in production)
  ENABLE_SELF_EVOLUTION: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

// Validate on startup - fail fast
export const env = envSchema.parse(process.env);
```

## Usage
```typescript
import { env } from '@/config/env';

// Always use typed, validated values
const port = env.PORT;
const isProduction = env.NODE_ENV === 'production';
```

## .env.example Template
```bash
# Required
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/aigentflow
ANTHROPIC_API_KEY=sk-ant-...

# Optional
PORT=3000
LOG_LEVEL=debug
MAX_CONCURRENT_AGENTS=15
ENABLE_SELF_EVOLUTION=false
```
```

### 4.3 Component Structure

```markdown
# Rule: Component File Structure

## Purpose
Maintain consistent, predictable component organization.

## Frontend Component Structure
```
src/components/AgentCard/
├── index.ts                 # Re-export
├── AgentCard.tsx           # Main component
├── AgentCard.test.tsx      # Tests
├── AgentCard.styles.ts     # Styled components / Tailwind classes
├── AgentCard.types.ts      # TypeScript interfaces
├── AgentCard.constants.ts  # Component-specific constants
└── AgentCard.utils.ts      # Helper functions (if needed)
```

## Backend Service Structure
```
src/services/agent/
├── index.ts                 # Re-export
├── agent.service.ts         # Service class
├── agent.service.test.ts    # Tests
├── agent.repository.ts      # Data access
├── agent.types.ts           # TypeScript interfaces
├── agent.constants.ts       # Service constants
├── agent.validators.ts      # Zod schemas
└── agent.errors.ts          # Domain errors
```

## Import Pattern
```typescript
// Always import from index
import { AgentCard } from '@/components/AgentCard';
import { AgentService } from '@/services/agent';

// Never deep import
// BAD: import { AgentCard } from '@/components/AgentCard/AgentCard';
```
```

### 4.4 Error Handling

```markdown
# Rule: Error Handling Patterns

## Purpose
Consistent, typed, actionable error handling.

## Error Class Hierarchy
```typescript
// packages/shared/src/errors/base.error.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp = new Date().toISOString();

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}

// Specific error types
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

export class AgentExecutionError extends DomainError {
  readonly code = 'AGENT_EXECUTION_ERROR';
  readonly statusCode = 500;
}
```

## Usage in Services
```typescript
async function executeAgent(agentId: string): Promise<AgentOutput> {
  const agent = await this.agentRepository.findById(agentId);

  if (!agent) {
    throw new NotFoundError(`Agent not found: ${agentId}`, { agentId });
  }

  try {
    return await agent.execute();
  } catch (error) {
    throw new AgentExecutionError(
      `Agent ${agentId} failed to execute`,
      { agentId, originalError: error.message }
    );
  }
}
```

## API Response Format
```typescript
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "code": "AGENT_EXECUTION_ERROR",
    "message": "Agent xyz failed to execute",
    "context": { "agentId": "xyz" },
    "timestamp": "2025-01-28T14:30:00Z"
  }
}
```
```

---

## Part 5: Current vs Proposed Meta-Orchestrator

### 5.1 Current Meta-Orchestrator (What Exists)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT SYSTEM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User ─────► Claude CLI Session                                │
│                     │                                            │
│                     ▼                                            │
│              ┌─────────────────┐                                │
│              │ Single Claude   │                                │
│              │ Instance        │                                │
│              └────────┬────────┘                                │
│                       │                                          │
│          ┌────────────┼────────────┐                            │
│          ▼            ▼            ▼                            │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│   │ /status  │ │/implement│ │ /fix-bug │  (Prompt-based)       │
│   └──────────┘ └──────────┘ └──────────┘                       │
│                                                                  │
│   Capabilities:                                                  │
│   • Task tool for subagent spawning (built-in)                 │
│   • MCP server support                                          │
│   • CLAUDE.md context injection                                 │
│   • .claude/commands/ for skills                                │
│   • Session persistence                                         │
│                                                                  │
│   Current Limitations:                                          │
│   • Not leveraging Task tool for parallel analysis             │
│   • No role-specific CLAUDE.md files                           │
│   • Skills are simple prompts, not orchestrated workflows      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Proposed Meta-Orchestrator (CLI-Based with Task Tool)

> **Key Decision:** Use Claude CLI (subscription-based) for development instead of
> Anthropic API (per-token). Claude CLI provides Task tool for subagent spawning
> which achieves similar benefits to SDK-based parallel execution.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI-BASED META-ORCHESTRATOR                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User ─────► Claude CLI Session (Main Orchestrator)            │
│                     │                                            │
│                     ▼                                            │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              Task Tool Layer (Built into CLI)            │   │
│   │  • Spawns subagent tasks with isolated context          │   │
│   │  • Parallel execution via multiple Task calls            │   │
│   │  • Role-specific CLAUDE.md per subagent                 │   │
│   │  • Results aggregated in main session                    │   │
│   └───────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│     ┌─────────────────────┼─────────────────────┐               │
│     ▼                     ▼                     ▼               │
│ ┌──────────┐        ┌──────────┐        ┌──────────┐           │
│ │ Architect│        │ Backend  │        │ Security │           │
│ │ Task     │        │ Task     │        │ Task     │           │
│ │          │        │          │        │          │           │
│ │ Context: │        │ Context: │        │ Context: │           │
│ │ .claude/ │        │ .claude/ │        │ .claude/ │           │
│ │ agents/  │        │ agents/  │        │ agents/  │           │
│ │ architect│        │ backend  │        │ security │           │
│ └──────────┘        └──────────┘        └──────────┘           │
│                           │                                      │
│                           ▼                                      │
│                  ┌─────────────────┐                            │
│                  │ Main Session    │                            │
│                  │ Aggregates &    │                            │
│                  │ Synthesizes     │                            │
│                  └─────────────────┘                            │
│                                                                  │
│   Benefits:                                                      │
│   • Cost-effective (subscription vs per-token)                  │
│   • Native Task tool for subagent patterns                      │
│   • Built-in MCP server support                                 │
│   • Context isolation via role-specific configs                 │
│   • No custom orchestrator code needed                          │
│   • Parallel analysis via concurrent Task calls                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Implementation: Role-Specific Agent Contexts

Instead of building a custom orchestrator, we leverage Claude CLI's existing capabilities:

```
.claude/
├── agents/                      # Role-specific contexts
│   ├── architect/
│   │   └── CLAUDE.md           # Architecture focus, ADR patterns
│   ├── backend/
│   │   └── CLAUDE.md           # NestJS, PostgreSQL, API patterns
│   ├── frontend/
│   │   └── CLAUDE.md           # React, Tailwind, component patterns
│   ├── security/
│   │   └── CLAUDE.md           # OWASP, RLS, audit patterns
│   ├── tester/
│   │   └── CLAUDE.md           # Vitest, coverage, test patterns
│   └── reviewer/
│       └── CLAUDE.md           # Code review checklist, PR patterns
│
├── commands/                    # Orchestrated skills
│   ├── implement.md            # Uses Task tool for parallel analysis
│   ├── fix-bug.md              # Uses Task tool for investigation
│   ├── review.md               # Uses Task tool for multi-perspective
│   └── checkpoint.md           # Validation and state saving
│
└── settings.json               # MCP servers, permissions
```

### 5.4 Task Tool Usage Pattern

```markdown
# Example: /implement skill using Task tool

When implementing a feature, spawn parallel analysis tasks:

1. **Spawn Architect Task** (parallel)
   - Analyze architecture implications
   - Check ARCHITECTURE.md alignment
   - Identify integration points

2. **Spawn Backend Task** (parallel)
   - Review existing code patterns
   - Identify affected files
   - Plan database changes

3. **Spawn Security Task** (parallel)
   - Check for security implications
   - Verify RLS requirements
   - Audit logging needs

4. **Aggregate Results** (main session)
   - Combine insights from all tasks
   - Resolve conflicts
   - Present implementation plan to user
```

---

## Part 6: Example User Workflows (CLI-Based)

> All workflows use Claude CLI with Task tool for subagent spawning.
> No external SDK or API calls required during development.

### 6.1 Starting a New Development Session

```
┌──────────────────────────────────────────────────────────────────┐
│ USER PROMPT (in Claude CLI):                                      │
│ > /status                                                        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLAUDE CLI ACTIONS (using built-in tools):                        │
│                                                                   │
│ 1. Read .meta/current-phase.md → Phase: CP0, Step: 03            │
│ 2. Glob .meta/lessons/*.md for relevant lessons                  │
│ 3. Read .meta/checkpoints/latest.md                              │
│ 4. Bash: git status --porcelain                                  │
│ 5. Bash: pnpm test --passWithNoTests 2>&1 | head -20            │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ OUTPUT TO USER:                                                   │
│                                                                   │
│ ## Current Status                                                │
│                                                                   │
│ **Phase:** CP0 - Foundation                                      │
│ **Current Step:** 03-LANGGRAPH-CORE.md (In Progress)             │
│ **Progress:** 2/11 steps complete (18%)                          │
│                                                                   │
│ **Last Checkpoint:** 2025-12-30 22:15 UTC                        │
│ **Git Status:** 3 files modified, not committed                  │
│                                                                   │
│ **Health:**                                                      │
│ - Tests: 45 passing ✓                                            │
│ - Types: No errors ✓                                             │
│ - Lint: 2 warnings ⚠️                                            │
│                                                                   │
│ **Relevant Lessons:**                                            │
│ - None captured yet for CP0                                      │
│                                                                   │
│ **Next Tasks:**                                                   │
│ 1. Complete LangGraph state channel definitions                  │
│ 2. Implement PostgreSQL checkpointer                             │
│ 3. Create orchestrator graph skeleton                            │
│                                                                   │
│ **Suggested Command:** `/implement Complete state channels`       │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Implementing a Feature

```
┌──────────────────────────────────────────────────────────────────┐
│ USER PROMPT (in Claude CLI):                                      │
│ > /implement Add PostgreSQL checkpointer for LangGraph state     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLAUDE CLI PHASE 1: VALIDATION                                    │
│                                                                   │
│ Read .meta/current-phase.md → CP0 - Foundation                   │
│ Read IMPLEMENTATION/CP0-FOUNDATION/03-LANGGRAPH-CORE.md          │
│ ✓ Task aligns with current phase                                 │
│ ✓ Dependencies satisfied (PostgreSQL setup complete)            │
│                                                                   │
│ Spawning parallel Task agents...                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLAUDE CLI PHASE 2: PARALLEL ANALYSIS (via Task tool)            │
│                                                                   │
│ // Spawned in parallel - single message, multiple Task calls     │
│                                                                   │
│ Task(subagent_type='Explore',                                    │
│   prompt='Analyze LangGraph checkpointer interface and           │
│           integration points with ARCHITECTURE.md')              │
│                                                                   │
│ Task(subagent_type='Explore',                                    │
│   prompt='Review PostgreSQL setup in packages/database,          │
│           design checkpoint table schema')                       │
│                                                                   │
│ Task(subagent_type='Explore',                                    │
│   prompt='Check security implications: RLS policies needed,      │
│           credential handling, audit requirements')              │
│                                                                   │
│ // Results returned to main session                              │
│                                                                   │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│ │ ARCHITECT TASK  │  │ BACKEND TASK    │  │ SECURITY TASK   │   │
│ │ Result:         │  │ Result:         │  │ Result:         │   │
│ │ • BaseCheckpoint│  │ • checkpoints   │  │ • RLS policy    │   │
│ │   interface     │  │   table schema  │  │   required      │   │
│ │ • put/get/list  │  │ • tenant_id     │  │ • No secrets    │   │
│ │   methods       │  │   column        │  │   in state      │   │
│ └────────┬────────┘  └────────┬────────┘  └────────┬────────┘   │
│          │                    │                    │             │
│          └────────────────────┼────────────────────┘             │
│                               ▼                                   │
│                  ┌─────────────────────┐                         │
│                  │   Main Session      │                         │
│                  │   Aggregates &      │                         │
│                  │   Synthesizes       │                         │
│                  └─────────────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ AGGREGATED ANALYSIS RESULT:                                       │
│                                                                   │
│ ## Implementation Plan                                           │
│                                                                   │
│ ### Files to Create                                              │
│ 1. packages/langgraph/src/checkpointer/postgres.ts               │
│ 2. packages/langgraph/src/checkpointer/index.ts                  │
│ 3. packages/database/src/schema/checkpoints.ts                   │
│ 4. packages/langgraph/src/checkpointer/postgres.test.ts          │
│                                                                   │
│ ### Key Design Decisions                                         │
│ - Use Drizzle ORM for type-safe queries                          │
│ - Store checkpoint data as JSONB for flexibility                 │
│ - Include tenant_id for multi-tenant isolation                   │
│ - Add created_at, updated_at for debugging                       │
│                                                                   │
│ ### Security Considerations                                       │
│ - RLS policy required: tenant_id = current_tenant()              │
│ - Encrypt sensitive state with tenant key                        │
│ - Audit log checkpoint writes                                    │
│                                                                   │
│ **Proceed with implementation? [Y/n]**                           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ USER PROMPT:                                                      │
│ > Y                                                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ META-ORCHESTRATOR PHASE 3: IMPLEMENTATION                        │
│                                                                   │
│ Spawning Backend Dev subagent...                                 │
│                                                                   │
│ [Backend Dev] Creating packages/database/src/schema/checkpoints.ts │
│ [Security] Pre-write check: ✓ No secrets, ✓ RLS compatible      │
│ [Backend Dev] Creating packages/langgraph/src/checkpointer/...   │
│ [Security] Pre-write check: ✓ Passed                            │
│ [Tester] Generating test file...                                 │
│                                                                   │
│ Running tests...                                                 │
│ ✓ 8 new tests passing                                            │
│                                                                   │
│ Running type check...                                            │
│ ✓ No type errors                                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ IMPLEMENTATION COMPLETE:                                          │
│                                                                   │
│ ## Summary                                                       │
│                                                                   │
│ Created 4 files:                                                 │
│ - packages/database/src/schema/checkpoints.ts                    │
│ - packages/langgraph/src/checkpointer/postgres.ts                │
│ - packages/langgraph/src/checkpointer/index.ts                   │
│ - packages/langgraph/src/checkpointer/postgres.test.ts           │
│                                                                   │
│ Tests: 8 passing                                                 │
│ Coverage: 94% for new code                                       │
│                                                                   │
│ **Self-Review Score:** 92%                                       │
│ - Completeness: 95%                                              │
│ - Correctness: 90%                                               │
│ - Quality: 91%                                                   │
│                                                                   │
│ **Suggested Next:** `/checkpoint` to save progress               │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Fixing a Bug

```
┌──────────────────────────────────────────────────────────────────┐
│ USER PROMPT:                                                      │
│ > /fix-bug Race condition when multiple agents checkpoint        │
│ > simultaneously - sometimes checkpoints overwrite each other    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ META-ORCHESTRATOR PHASE 1: CONTEXT LOADING                        │
│                                                                   │
│ Loading relevant context...                                      │
│ ✓ Current phase: CP0 - Foundation                                │
│ ✓ Recent changes: packages/langgraph/src/checkpointer/*         │
│ ✓ Querying lessons database for: "race condition", "checkpoint"  │
│                                                                   │
│ Found 1 similar lesson:                                          │
│ → .meta/lessons/001-token-race-condition.md                      │
│   (Mutex lock pattern for shared resources)                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ LESSON CONTEXT LOADED:                                            │
│                                                                   │
│ ## Previous Similar Issue                                        │
│ **Token refresh race condition** (lesson-001)                    │
│                                                                   │
│ Root cause: No mutex on shared resource modification             │
│ Solution: Singleton pattern with async lock                      │
│ Pattern to apply: Use mutex for checkpoint writes                │
│                                                                   │
│ Spawning parallel analysis...                                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ META-ORCHESTRATOR PHASE 2: PARALLEL ANALYSIS                     │
│                                                                   │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│ │ ARCHITECT       │  │ TESTER          │  │ BACKEND DEV     │   │
│ │                 │  │                 │  │                 │   │
│ │ Analyzing       │  │ Creating        │  │ Reviewing       │   │
│ │ concurrency     │  │ reproduction    │  │ current         │   │
│ │ patterns in     │  │ test case       │  │ implementation  │   │
│ │ checkpointer    │  │                 │  │                 │   │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                   │
│ Results:                                                         │
│ - ARCHITECT: No locking mechanism, multiple writes possible     │
│ - TESTER: Created test that reproduces issue 80% of time        │
│ - BACKEND DEV: save() method lacks atomicity guarantees         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ SOLUTION OPTIONS:                                                 │
│                                                                   │
│ ## Option 1: Database-Level Locking (RECOMMENDED)                │
│ Use PostgreSQL advisory locks for checkpoint writes              │
│ - Complexity: Low                                                │
│ - Risk: Low                                                      │
│ - Performance: Minimal impact                                    │
│                                                                   │
│ ## Option 2: Application-Level Mutex                             │
│ Add async-mutex package for in-process locking                   │
│ - Complexity: Low                                                │
│ - Risk: Medium (doesn't work across processes)                   │
│ - Performance: Very fast                                         │
│                                                                   │
│ ## Option 3: Optimistic Locking                                  │
│ Add version column, retry on conflict                            │
│ - Complexity: Medium                                             │
│ - Risk: Low                                                      │
│ - Performance: Good under low contention                         │
│                                                                   │
│ **Recommendation:** Option 1 (Database-Level Locking)            │
│ Aligns with lesson-001 pattern & works across processes          │
│                                                                   │
│ **Apply Option 1? [Y/n/2/3]**                                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ USER PROMPT:                                                      │
│ > Y                                                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ META-ORCHESTRATOR PHASE 3: IMPLEMENTATION                        │
│                                                                   │
│ [Backend Dev] Adding advisory lock to save() method...           │
│ [Security] Pre-write check: ✓ Passed                            │
│ [Tester] Running reproduction test...                            │
│ ✓ Race condition no longer reproduces (100 iterations)          │
│ [Tester] Running full test suite...                              │
│ ✓ All 53 tests passing                                           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ META-ORCHESTRATOR PHASE 4: KNOWLEDGE CAPTURE                     │
│                                                                   │
│ ## Lesson Captured                                               │
│                                                                   │
│ **Title:** Checkpoint race condition with concurrent agents      │
│ **Category:** bug_fix                                            │
│ **Phase:** CP0                                                   │
│                                                                   │
│ **Root Cause:**                                                  │
│ PostgreSQL checkpointer save() lacked atomicity guarantees       │
│ when multiple agents checkpoint simultaneously                   │
│                                                                   │
│ **Solution:**                                                    │
│ Added pg_advisory_xact_lock() before checkpoint write            │
│                                                                   │
│ **Prevention:**                                                  │
│ - Always consider concurrency for shared state modifications    │
│ - Use database locks for cross-process coordination              │
│ - Add concurrent access tests for new storage operations         │
│                                                                   │
│ **Saved to:** .meta/lessons/002-checkpoint-race-condition.md     │
│                                                                   │
│ **CLAUDE.md Updated:** Added to "Known Gotchas" section          │
└──────────────────────────────────────────────────────────────────┘
```

### 6.4 Creating a Checkpoint

```
┌──────────────────────────────────────────────────────────────────┐
│ USER PROMPT:                                                      │
│ > /checkpoint                                                    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CHECKPOINT VALIDATION:                                            │
│                                                                   │
│ Running validation checks...                                     │
│                                                                   │
│ ✓ Tests: 53 passing, 0 failing                                   │
│ ✓ Coverage: 84% (meets 80% threshold)                            │
│ ✓ Types: No errors                                               │
│ ✓ Lint: 0 errors, 2 warnings                                     │
│ ✓ Security scan: No issues found                                 │
│ ✓ License check: All dependencies approved                       │
│                                                                   │
│ Phase gate check...                                              │
│ Current phase: CP0 - Foundation (Steps 1-11)                     │
│ Completed: Steps 1-3 (27%)                                       │
│ Gate type: Automatic (no human approval required)                │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CHECKPOINT CREATED:                                               │
│                                                                   │
│ ## Checkpoint: cp0-step03-langgraph-core                         │
│                                                                   │
│ **Date:** 2025-12-31T01:15:00Z                                   │
│ **Git SHA:** abc123def456                                        │
│ **Phase:** CP0 - Foundation                                      │
│ **Progress:** 3/11 steps (27%)                                   │
│                                                                   │
│ **Completed Since Last Checkpoint:**                             │
│ - [x] Step 03: LangGraph Core                                    │
│   - State channel definitions                                    │
│   - PostgreSQL checkpointer                                      │
│   - Orchestrator graph skeleton                                  │
│                                                                   │
│ **Metrics:**                                                     │
│ - Tests: 53 passing                                              │
│ - Coverage: 84%                                                  │
│ - Files created: 12                                              │
│ - Lines of code: 1,847                                           │
│                                                                   │
│ **Lessons Captured This Session:**                               │
│ - lesson-002: Checkpoint race condition                          │
│                                                                   │
│ **Saved to:** .meta/checkpoints/cp0-003-langgraph-core.md        │
│                                                                   │
│ **Next Step:** 04-NESTJS-API.md                                  │
│ **Suggested:** `/start-phase 0` to continue, or take a break     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 7: Recommendations

### 7.1 Immediate Actions (Before Starting CP0)

1. **Create missing rule files:**
   - `.meta/rules/constants-separation.md`
   - `.meta/rules/environment-configuration.md`
   - `.meta/rules/component-structure.md`
   - `.meta/rules/error-handling-patterns.md`
   - `.meta/compliance/COMPLIANCE-CHECKLIST.md`

2. **Add compliance enforcement to perspectives:**
   - Update `.meta/perspectives/security.md` to be MANDATORY
   - Add pre-write security checks

3. **Create source-of-truth package:**
   - `packages/shared/src/constants/`
   - `packages/shared/src/contracts/`
   - `packages/shared/src/schemas/`

4. **Set up CLI-based meta-orchestrator structure:**
   - Create `.claude/agents/` with role-specific CLAUDE.md files
   - Update `.claude/commands/` skills to use Task tool patterns
   - Configure MCP servers in `.claude/settings.json`

### 7.2 Short-Term Actions (During CP0-CP2)

5. **Update skills to use Task tool for parallel analysis:**
   - `/implement` - Spawn architect, backend, security tasks in parallel
   - `/fix-bug` - Spawn investigator tasks for multi-perspective analysis
   - `/review` - Spawn reviewer tasks for comprehensive coverage

6. **Fill missing implementation steps:**
   - Create CP5-MESSAGING content
   - Create CP10-WEB-FRONTEND content
   - Create CP11-INFRASTRUCTURE content
   - Create CP12-MOBILE-DESKTOP content

7. **Add AI provider abstraction to Aigentflow:**
   - Create `AIProvider` interface supporting both CLI and API modes
   - Add `CLAUDE_CLI=true|false` configuration
   - Implement `ClaudeCliProvider` (spawns `claude` processes)
   - Implement `AnthropicApiProvider` (uses `@anthropic-ai/sdk`)

8. **Add meta-orchestrator execution sections to each step:**
   - Task tool usage patterns
   - Compliance checks
   - Self-review criteria

### 7.3 Long-Term Actions (CP3+)

9. **Implement lessons vector search:**
   - Store lessons in Qdrant
   - Semantic search for relevant patterns

10. **Add compliance dashboard:**
    - Track compliance score over time
    - Alert on violations

11. **Create evaluation framework:**
    - Measure agent output quality
    - Track improvement over time

12. **Production API mode for Aigentflow:**
    - When deployed, switch to `CLAUDE_CLI=false`
    - Use Anthropic API for production workloads
    - Keep CLI mode for development and testing

---

## Part 8: Conclusion

The current system has **strong foundations** in both the meta-orchestrator design (CLAUDE-ARCHITECTURE.md) and the implementation plans (IMPLEMENTATION/). The key insight is that Claude CLI already provides the Task tool for subagent spawning - we don't need to build custom SDK integration.

**Key Insight:** You're building a multi-agent platform (Aigentflow) using Claude CLI as the meta-orchestrator. Both need to be compliant, both need best practices enforcement, and both need quality gates.

**Recommended Path:**
1. Enhance current Claude CLI setup with role-specific contexts and Task tool patterns
2. Use enhanced CLI to build CP0-CP4 of Aigentflow
3. Aigentflow should support both CLI mode (development) and API mode (production)
4. The inner system (Aigentflow) can eventually be used to build future products

This creates a **bootstrapping loop** where the quality of the tools you build improves the quality of what those tools produce.

---

## Part 9: CLI vs API Architecture

### 9.1 Cost Comparison

| Approach | Pricing | Best Use Case |
|----------|---------|---------------|
| **Claude CLI** | $20/mo (Pro) or $100/mo (Max 5x) | Development, building, iteration |
| **Anthropic API** | ~$3/MTok input, ~$15/MTok output (Opus) | Production, programmatic access |

**Decision:** Use Claude CLI for all development work on Aigentflow. It's significantly more cost-effective for iterative development.

### 9.2 Capability Comparison

| Feature | Claude CLI | Anthropic API |
|---------|------------|---------------|
| Interactive sessions | Native | Requires wrapper |
| Task tool (subagents) | Built-in | Via SDK |
| MCP servers | Native support | Via SDK |
| Context persistence | Session-based | Manual |
| Parallel execution | Multiple Task calls | Concurrent API calls |
| Cost control | Subscription cap | Pay per token |
| Tool permissions | Built-in system | Manual implementation |

### 9.3 Aigentflow Dual-Mode Architecture

Aigentflow must support both modes via configuration:

```typescript
// packages/agents/src/config/ai-provider.config.ts
import { z } from 'zod';

export const aiProviderConfigSchema = z.object({
  // Mode selection
  CLAUDE_CLI: z.coerce.boolean().default(true),

  // CLI mode settings
  CLAUDE_CLI_PATH: z.string().default('claude'),
  CLAUDE_CLI_TIMEOUT_MS: z.coerce.number().default(300000),

  // API mode settings (only needed when CLAUDE_CLI=false)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().default(8192),
});

export type AIProviderConfig = z.infer<typeof aiProviderConfigSchema>;
```

### 9.4 Provider Interface

```typescript
// packages/agents/src/providers/ai-provider.interface.ts

export interface AIProviderOptions {
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
}

export interface AIResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  /**
   * Execute a prompt and return the response
   */
  execute(prompt: string, options?: AIProviderOptions): Promise<AIResponse>;

  /**
   * Execute with streaming response
   */
  stream(prompt: string, options?: AIProviderOptions): AsyncIterable<string>;

  /**
   * Spawn a subagent for isolated task execution
   */
  spawnSubagent(role: string, task: string): Promise<AIResponse>;
}
```

### 9.5 CLI Provider Implementation

```typescript
// packages/agents/src/providers/claude-cli.provider.ts

import { spawn } from 'child_process';
import { AIProvider, AIResponse, AIProviderOptions } from './ai-provider.interface';

export class ClaudeCliProvider implements AIProvider {
  constructor(private config: { cliPath: string; timeoutMs: number }) {}

  async execute(prompt: string, options?: AIProviderOptions): Promise<AIResponse> {
    return new Promise((resolve, reject) => {
      const args = [
        '--print',                          // Non-interactive mode
        '-p', prompt,                       // Prompt
        '--output-format', 'json',          // Structured output
      ];

      if (options?.tools?.length) {
        args.push('--allowedTools', options.tools.map(t => t.name).join(','));
      }

      const proc = spawn(this.config.cliPath, args, {
        timeout: options?.timeout ?? this.config.timeoutMs,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ content: stdout.trim() });
        } else {
          reject(new Error(`CLI exited with code ${code}: ${stderr}`));
        }
      });
    });
  }

  async *stream(prompt: string, options?: AIProviderOptions): AsyncIterable<string> {
    const proc = spawn(this.config.cliPath, [
      '--print',
      '-p', prompt,
    ], {
      timeout: options?.timeout ?? this.config.timeoutMs,
      env: process.env,
    });

    for await (const chunk of proc.stdout) {
      yield chunk.toString();
    }
  }

  async spawnSubagent(role: string, task: string): Promise<AIResponse> {
    // Use role-specific CLAUDE.md context
    const env = {
      ...process.env,
      CLAUDE_MD_PATH: `.claude/agents/${role}/CLAUDE.md`,
    };

    const proc = spawn(this.config.cliPath, [
      '--print',
      '-p', task,
      '--output-format', 'json',
    ], {
      timeout: this.config.timeoutMs,
      env,
    });

    return new Promise((resolve, reject) => {
      let stdout = '';
      proc.stdout.on('data', (data) => { stdout += data; });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ content: stdout.trim() });
        } else {
          reject(new Error(`Subagent ${role} failed with code ${code}`));
        }
      });
    });
  }
}
```

### 9.6 API Provider Implementation

```typescript
// packages/agents/src/providers/anthropic-api.provider.ts

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIResponse, AIProviderOptions } from './ai-provider.interface';

export class AnthropicApiProvider implements AIProvider {
  private client: Anthropic;

  constructor(private config: { apiKey: string; model: string; maxTokens: number }) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async execute(prompt: string, options?: AIProviderOptions): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      messages: [{ role: 'user', content: prompt }],
      tools: options?.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      })),
    });

    const textContent = response.content.find(c => c.type === 'text');
    const toolCalls = response.content
      .filter(c => c.type === 'tool_use')
      .map(c => ({ name: c.name, input: c.input }));

    return {
      content: textContent?.text ?? '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async *stream(prompt: string, options?: AIProviderOptions): AsyncIterable<string> {
    const stream = await this.client.messages.stream({
      model: this.config.model,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  async spawnSubagent(role: string, task: string): Promise<AIResponse> {
    // For API mode, subagents are just separate API calls with role context
    const roleContext = await this.loadRoleContext(role);
    return this.execute(`${roleContext}\n\n${task}`);
  }

  private async loadRoleContext(role: string): Promise<string> {
    // Load from .claude/agents/{role}/CLAUDE.md
    const fs = await import('fs/promises');
    return fs.readFile(`.claude/agents/${role}/CLAUDE.md`, 'utf-8');
  }
}
```

### 9.7 Provider Factory

```typescript
// packages/agents/src/providers/index.ts

import { AIProvider } from './ai-provider.interface';
import { ClaudeCliProvider } from './claude-cli.provider';
import { AnthropicApiProvider } from './anthropic-api.provider';
import { aiProviderConfigSchema } from '../config/ai-provider.config';

export function createAIProvider(): AIProvider {
  const config = aiProviderConfigSchema.parse(process.env);

  if (config.CLAUDE_CLI) {
    return new ClaudeCliProvider({
      cliPath: config.CLAUDE_CLI_PATH,
      timeoutMs: config.CLAUDE_CLI_TIMEOUT_MS,
    });
  } else {
    if (!config.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY required when CLAUDE_CLI=false');
    }
    return new AnthropicApiProvider({
      apiKey: config.ANTHROPIC_API_KEY,
      model: config.ANTHROPIC_MODEL,
      maxTokens: config.ANTHROPIC_MAX_TOKENS,
    });
  }
}
```

### 9.8 Environment Configuration

```bash
# .env.example

# AI Provider Mode
# true = Use Claude CLI (subscription-based, for development)
# false = Use Anthropic API (per-token, for production)
CLAUDE_CLI=true

# CLI Mode Settings
CLAUDE_CLI_PATH=claude
CLAUDE_CLI_TIMEOUT_MS=300000

# API Mode Settings (only needed when CLAUDE_CLI=false)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ANTHROPIC_MAX_TOKENS=8192
```

### 9.9 Usage in Aigentflow Agents

```typescript
// packages/agents/src/agents/orchestrator.agent.ts

import { createAIProvider } from '../providers';

export class OrchestratorAgent {
  private ai = createAIProvider();

  async analyzeTask(task: string) {
    // Spawn parallel subagents for analysis
    const [architectResult, backendResult, securityResult] = await Promise.all([
      this.ai.spawnSubagent('architect', `Analyze architecture for: ${task}`),
      this.ai.spawnSubagent('backend', `Review backend patterns for: ${task}`),
      this.ai.spawnSubagent('security', `Check security implications for: ${task}`),
    ]);

    // Aggregate results
    return this.ai.execute(`
      Synthesize these analysis results into an implementation plan:

      Architecture: ${architectResult.content}
      Backend: ${backendResult.content}
      Security: ${securityResult.content}
    `);
  }
}
```

### 9.10 IMPLEMENTATION Files to Update

The following files need updates to support CLI/API dual-mode:

| File | Change Required |
|------|-----------------|
| `CP0-FOUNDATION/04f-AI-PROVIDER.md` | Add `AIProvider` interface and both implementations |
| `CP1-AGENT-SYSTEM/05-AGENT-FRAMEWORK.md` | Use `AIProvider` interface instead of direct API calls |
| `IMPLEMENTATION/00-OVERVIEW.md` | Add note about CLI-first development approach |
| `.env.example` (to create) | Add `CLAUDE_CLI` configuration |
