# Step 02: PostgreSQL Setup

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 01-MONOREPO-SETUP.md
> **Next Step:** 03-LANGGRAPH-CORE.md

---

## Overview

This step establishes PostgreSQL as the primary database with:

- **Row-Level Security (RLS)** for multi-tenant data isolation
- **Apache AGE** extension for graph queries (agent relationships, task dependencies)
- **Drizzle ORM** for type-safe database access
- **Database migrations** for schema evolution

---

## Deliverables

1. `packages/database/` - Database client package
2. PostgreSQL schema with RLS policies
3. Apache AGE graph schema
4. Drizzle ORM configuration
5. Migration system
6. Docker Compose for local development
7. Connection pooling configuration

---

## 1. Database Package Structure

```
packages/database/
├── src/
│   ├── index.ts              # Public exports
│   ├── client.ts             # Database client
│   ├── schema/
│   │   ├── index.ts          # Schema exports
│   │   ├── tenants.ts        # Tenant schema
│   │   ├── projects.ts       # Project schema
│   │   ├── tasks.ts          # Task schema
│   │   ├── agents.ts         # Agent execution schema
│   │   ├── lessons.ts        # Lessons learned schema
│   │   └── audit.ts          # Audit log schema
│   ├── graph/
│   │   ├── index.ts          # Graph exports
│   │   ├── queries.ts        # AGE graph queries
│   │   └── types.ts          # Graph types
│   ├── rls/
│   │   ├── index.ts          # RLS policy definitions
│   │   └── policies.sql      # SQL policies
│   └── migrations/
│       └── 0001_initial.sql
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 2. Package Configuration

### 2.1 packages/database/package.json

```json
{
  "name": "@aigentflow/database",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./schema": {
      "types": "./dist/schema/index.d.ts",
      "import": "./dist/schema/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts src/schema/index.ts --format esm --dts",
    "dev": "tsup src/index.ts src/schema/index.ts --format esm --dts --watch",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "drizzle-orm": "^0.32.0",
    "postgres": "^3.5.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@aigentflow/tsconfig": "workspace:*",
    "@types/node": "^20.0.0",
    "drizzle-kit": "^0.24.0",
    "tsup": "^8.0.0",
    "typescript": "^5.6.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 3. Database Client

### 3.1 packages/database/src/client.ts

```typescript
/**
 * Database Client
 *
 * Provides connection pooling and tenant-aware queries.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeout?: number;
}

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

/**
 * Create database client with connection pooling
 */
export function createDatabase(config: DatabaseConfig) {
  const client = postgres(config.connectionString, {
    max: config.maxConnections ?? 20,
    idle_timeout: config.idleTimeout ?? 30,
    prepare: false, // Required for some RLS operations
  });

  const db = drizzle(client, { schema });

  return {
    db,
    client,

    /**
     * Execute query with tenant context
     * Sets RLS context for the connection
     */
    async withTenant<T>(
      context: TenantContext,
      fn: (db: typeof db) => Promise<T>
    ): Promise<T> {
      // Set tenant context for RLS
      await client`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;

      if (context.userId) {
        await client`SELECT set_config('app.user_id', ${context.userId}, true)`;
      }

      return fn(db);
    },

    /**
     * Execute raw SQL query
     */
    async raw<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return client.unsafe(sql, params as any[]) as unknown as T[];
    },

    /**
     * Close database connection
     */
    async close(): Promise<void> {
      await client.end();
    },
  };
}

export type Database = ReturnType<typeof createDatabase>;
```

---

## 4. Schema Definitions

### 4.1 packages/database/src/schema/tenants.ts

```typescript
/**
 * Tenant Schema
 *
 * Multi-tenant organizations with RLS isolation.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
} from 'drizzle-orm/pg-core';

export const tenantTypeEnum = pgEnum('tenant_type', [
  'free',
  'starter',
  'professional',
  'enterprise',
]);

export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'suspended',
  'pending',
  'deleted',
]);

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    type: tenantTypeEnum('type').notNull().default('free'),
    status: tenantStatusEnum('status').notNull().default('pending'),

    // Owner
    ownerUserId: uuid('owner_user_id').notNull(),
    ownerEmail: text('owner_email').notNull(),
    ownerName: text('owner_name').notNull(),

    // Settings
    settings: jsonb('settings').$type<TenantSettings>().default({}),

    // Quotas
    quotas: jsonb('quotas').$type<TenantQuotas>().notNull(),

    // Usage tracking
    usage: jsonb('usage').$type<TenantUsage>().default({
      currentUsers: 0,
      currentProjects: 0,
      tokensThisMonth: 0,
      storageUsedGB: 0,
    }),

    // Billing
    stripeCustomerId: text('stripe_customer_id'),
    subscriptionId: text('subscription_id'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    suspendedAt: timestamp('suspended_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    slugIdx: index('tenants_slug_idx').on(table.slug),
    statusIdx: index('tenants_status_idx').on(table.status),
  })
);

export interface TenantSettings {
  defaultModel?: string;
  allowedModels?: string[];
  complianceFrameworks?: string[];
  dataResidency?: 'us' | 'eu' | 'ap';
}

export interface TenantQuotas {
  maxUsers: number;
  maxProjects: number;
  maxTokensPerMonth: number;
  maxStorageGB: number;
  maxConcurrentAgents: number;
}

export interface TenantUsage {
  currentUsers: number;
  currentProjects: number;
  tokensThisMonth: number;
  storageUsedGB: number;
}
```

### 4.2 packages/database/src/schema/projects.ts

```typescript
/**
 * Project Schema
 *
 * Development projects within a tenant.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'archived',
  'deleted',
]);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('active'),

    // Configuration
    config: jsonb('config').$type<ProjectConfig>().default({}),

    // Tech stack
    techStack: jsonb('tech_stack').$type<string[]>().default([]),

    // Repository
    repositoryUrl: text('repository_url'),
    defaultBranch: text('default_branch').default('main'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (table) => ({
    tenantIdx: index('projects_tenant_idx').on(table.tenantId),
    statusIdx: index('projects_status_idx').on(table.status),
  })
);

export interface ProjectConfig {
  aiModel?: string;
  maxConcurrentAgents?: number;
  designTokens?: Record<string, unknown>;
  hooks?: Record<string, string>;
}
```

### 4.3 packages/database/src/schema/tasks.ts

```typescript
/**
 * Task Schema
 *
 * Orchestration tasks and their execution state.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
  integer,
} from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { tenants } from './tenants';

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'analyzing',
  'orchestrating',
  'agent_working',
  'awaiting_approval',
  'completing',
  'completed',
  'failed',
  'aborted',
]);

export const taskTypeEnum = pgEnum('task_type', [
  'feature',
  'bugfix',
  'refactor',
  'docs',
  'config',
  'test',
]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Task details
    prompt: text('prompt').notNull(),
    type: taskTypeEnum('type').notNull(),
    status: taskStatusEnum('status').notNull().default('pending'),

    // Analysis results
    analysis: jsonb('analysis').$type<TaskAnalysis>(),

    // Execution state
    currentAgent: text('current_agent'),
    completedAgents: jsonb('completed_agents').$type<string[]>().default([]),
    agentQueue: jsonb('agent_queue').$type<string[]>().default([]),

    // Retry tracking
    retryCount: integer('retry_count').default(0),
    maxRetries: integer('max_retries').default(3),

    // Error info
    error: jsonb('error').$type<TaskError>(),

    // Checkpoints
    checkpoints: jsonb('checkpoints').$type<TaskCheckpoint[]>().default([]),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    tenantIdx: index('tasks_tenant_idx').on(table.tenantId),
    projectIdx: index('tasks_project_idx').on(table.projectId),
    statusIdx: index('tasks_status_idx').on(table.status),
  })
);

export interface TaskAnalysis {
  taskType: string;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  requiresUI: boolean;
  requiresBackend: boolean;
  requiresArchitecture: boolean;
  requiresApproval: boolean;
  suggestedAgents: string[];
}

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface TaskCheckpoint {
  id: string;
  state: string;
  timestamp: string;
  artifacts: string[];
}
```

### 4.4 packages/database/src/schema/index.ts

```typescript
/**
 * Schema Exports
 */

export * from './tenants';
export * from './projects';
export * from './tasks';
export * from './agents';
export * from './lessons';
export * from './audit';
```

---

## 5. Row-Level Security Policies

### 5.1 packages/database/src/rls/policies.sql

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create helper function to get current tenant
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Create helper function to get current user
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Projects RLS Policies
CREATE POLICY projects_tenant_isolation ON projects
  USING (tenant_id = current_tenant_id());

CREATE POLICY projects_tenant_insert ON projects
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY projects_tenant_update ON projects
  FOR UPDATE
  USING (tenant_id = current_tenant_id());

CREATE POLICY projects_tenant_delete ON projects
  FOR DELETE
  USING (tenant_id = current_tenant_id());

-- Tasks RLS Policies
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = current_tenant_id());

CREATE POLICY tasks_tenant_insert ON tasks
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

-- Agent Executions RLS Policies
CREATE POLICY agent_executions_tenant_isolation ON agent_executions
  USING (tenant_id = current_tenant_id());

-- Lessons RLS Policies
CREATE POLICY lessons_tenant_isolation ON lessons
  USING (tenant_id = current_tenant_id());

-- Audit Logs RLS Policies (read-only for tenants)
CREATE POLICY audit_logs_tenant_read ON audit_logs
  FOR SELECT
  USING (tenant_id = current_tenant_id());

-- Service role bypass (for background jobs)
CREATE ROLE aigentflow_service;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY service_bypass ON projects TO aigentflow_service USING (true);
```

---

## 6. Apache AGE Graph Schema

### 6.1 packages/database/src/graph/queries.ts

```typescript
/**
 * Apache AGE Graph Queries
 *
 * Graph operations for agent relationships and task dependencies.
 */

import type { Database } from '../client';

export interface GraphNode {
  id: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  label: string;
  startId: string;
  endId: string;
  properties: Record<string, unknown>;
}

/**
 * Initialize AGE extension and create graph
 */
export async function initializeGraph(db: Database): Promise<void> {
  await db.raw(`
    CREATE EXTENSION IF NOT EXISTS age;
    LOAD 'age';
    SET search_path = ag_catalog, "$user", public;
  `);

  await db.raw(`
    SELECT create_graph('aigentflow');
  `).catch(() => {
    // Graph already exists
  });
}

/**
 * Create agent node
 */
export async function createAgentNode(
  db: Database,
  agent: { id: string; type: string; name: string }
): Promise<void> {
  await db.raw(`
    SELECT * FROM cypher('aigentflow', $$
      CREATE (a:Agent {
        id: '${agent.id}',
        type: '${agent.type}',
        name: '${agent.name}',
        created_at: datetime()
      })
      RETURN a
    $$) as (a agtype);
  `);
}

/**
 * Create task node
 */
export async function createTaskNode(
  db: Database,
  task: { id: string; type: string; status: string }
): Promise<void> {
  await db.raw(`
    SELECT * FROM cypher('aigentflow', $$
      CREATE (t:Task {
        id: '${task.id}',
        type: '${task.type}',
        status: '${task.status}',
        created_at: datetime()
      })
      RETURN t
    $$) as (t agtype);
  `);
}

/**
 * Create dependency edge between tasks
 */
export async function createTaskDependency(
  db: Database,
  fromTaskId: string,
  toTaskId: string
): Promise<void> {
  await db.raw(`
    SELECT * FROM cypher('aigentflow', $$
      MATCH (a:Task {id: '${fromTaskId}'}), (b:Task {id: '${toTaskId}'})
      CREATE (a)-[r:DEPENDS_ON]->(b)
      RETURN r
    $$) as (r agtype);
  `);
}

/**
 * Create execution edge (agent executed task)
 */
export async function createExecutionEdge(
  db: Database,
  agentId: string,
  taskId: string,
  result: 'success' | 'failure'
): Promise<void> {
  await db.raw(`
    SELECT * FROM cypher('aigentflow', $$
      MATCH (a:Agent {id: '${agentId}'}), (t:Task {id: '${taskId}'})
      CREATE (a)-[r:EXECUTED {result: '${result}', timestamp: datetime()}]->(t)
      RETURN r
    $$) as (r agtype);
  `);
}

/**
 * Get task dependency graph
 */
export async function getTaskDependencies(
  db: Database,
  taskId: string
): Promise<GraphNode[]> {
  const result = await db.raw<{ deps: string }>(`
    SELECT * FROM cypher('aigentflow', $$
      MATCH (t:Task {id: '${taskId}'})-[:DEPENDS_ON*]->(dep:Task)
      RETURN dep
    $$) as (deps agtype);
  `);

  return result.map((r) => JSON.parse(r.deps));
}

/**
 * Get agent execution history
 */
export async function getAgentHistory(
  db: Database,
  agentId: string,
  limit: number = 10
): Promise<{ task: GraphNode; result: string }[]> {
  const result = await db.raw<{ task: string; result: string }>(`
    SELECT * FROM cypher('aigentflow', $$
      MATCH (a:Agent {id: '${agentId}'})-[r:EXECUTED]->(t:Task)
      RETURN t, r.result
      ORDER BY r.timestamp DESC
      LIMIT ${limit}
    $$) as (task agtype, result agtype);
  `);

  return result.map((r) => ({
    task: JSON.parse(r.task),
    result: JSON.parse(r.result),
  }));
}
```

---

## 7. Docker Compose for Local Development

### 7.1 docker-compose.yml (root)

```yaml
version: '3.8'

services:
  postgres:
    image: apache/age:PG16-latest
    container_name: aigentflow-postgres
    environment:
      POSTGRES_USER: aigentflow
      POSTGRES_PASSWORD: aigentflow
      POSTGRES_DB: aigentflow
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./packages/database/src/rls/policies.sql:/docker-entrypoint-initdb.d/01-rls.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aigentflow"]
      interval: 5s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:latest
    container_name: aigentflow-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  postgres_data:
  qdrant_data:
```

---

## 8. Drizzle Configuration

### 8.1 packages/database/drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

---

## Test Scenarios

```typescript
// packages/database/tests/database.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase } from '../src/client';
import { tenants, projects, tasks } from '../src/schema';
import { eq } from 'drizzle-orm';

describe('Database', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeAll(async () => {
    db = createDatabase({
      connectionString: process.env.DATABASE_URL!,
    });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('Tenant Isolation', () => {
    it('should only return data for current tenant', async () => {
      // Create two tenants
      const [tenant1] = await db.db.insert(tenants).values({
        name: 'Tenant 1',
        slug: 'tenant-1',
        ownerUserId: '00000000-0000-0000-0000-000000000001',
        ownerEmail: 'admin@tenant1.com',
        ownerName: 'Admin 1',
        quotas: {
          maxUsers: 10,
          maxProjects: 50,
          maxTokensPerMonth: 1000000,
          maxStorageGB: 100,
          maxConcurrentAgents: 15,
        },
      }).returning();

      const [tenant2] = await db.db.insert(tenants).values({
        name: 'Tenant 2',
        slug: 'tenant-2',
        ownerUserId: '00000000-0000-0000-0000-000000000002',
        ownerEmail: 'admin@tenant2.com',
        ownerName: 'Admin 2',
        quotas: {
          maxUsers: 10,
          maxProjects: 50,
          maxTokensPerMonth: 1000000,
          maxStorageGB: 100,
          maxConcurrentAgents: 15,
        },
      }).returning();

      // Create project for tenant 1
      await db.withTenant({ tenantId: tenant1.id }, async (db) => {
        await db.insert(projects).values({
          tenantId: tenant1.id,
          name: 'Project A',
        });
      });

      // Create project for tenant 2
      await db.withTenant({ tenantId: tenant2.id }, async (db) => {
        await db.insert(projects).values({
          tenantId: tenant2.id,
          name: 'Project B',
        });
      });

      // Tenant 1 should only see their project
      const tenant1Projects = await db.withTenant(
        { tenantId: tenant1.id },
        async (db) => db.select().from(projects)
      );

      expect(tenant1Projects).toHaveLength(1);
      expect(tenant1Projects[0].name).toBe('Project A');
    });
  });

  describe('Schema Validation', () => {
    it('should create tenant with required fields', async () => {
      const [tenant] = await db.db.insert(tenants).values({
        name: 'Test Tenant',
        slug: 'test-tenant',
        ownerUserId: '00000000-0000-0000-0000-000000000003',
        ownerEmail: 'test@example.com',
        ownerName: 'Test User',
        quotas: {
          maxUsers: 5,
          maxProjects: 10,
          maxTokensPerMonth: 100000,
          maxStorageGB: 10,
          maxConcurrentAgents: 5,
        },
      }).returning();

      expect(tenant.id).toBeDefined();
      expect(tenant.status).toBe('pending');
      expect(tenant.type).toBe('free');
    });
  });
});
```

---

## Validation Checklist

```
□ packages/database created with Drizzle ORM
□ PostgreSQL schema defined (tenants, projects, tasks)
□ RLS policies created for all tenant-scoped tables
□ Apache AGE extension configured
□ Graph schema for agent/task relationships
□ Docker Compose with PostgreSQL + AGE image
□ Migrations generated and applied
□ Connection pooling configured
□ Tenant context middleware working
□ All tests passing
```

---

## Next Step

Proceed to **03-LANGGRAPH-CORE.md** to implement the LangGraph.js workflow engine.
