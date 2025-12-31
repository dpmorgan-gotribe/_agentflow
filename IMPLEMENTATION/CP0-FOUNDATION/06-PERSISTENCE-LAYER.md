# Step 06: Persistence Layer

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 05-CLI-FOUNDATION.md
> **Next Step:** 07-QDRANT-VECTORS.md
> **Architecture Reference:** `ARCHITECTURE.md` - Database Layer

---

## Overview

The **Persistence Layer** provides PostgreSQL-based data access for Aigentflow using Drizzle ORM. This replaces the SQLite approach from v2.x with a production-ready PostgreSQL implementation featuring Row-Level Security (RLS) for multi-tenant isolation.

---

## Key Principles

1. **Type Safety**: Full TypeScript types via Drizzle ORM
2. **Multi-Tenant**: RLS policies enforce tenant isolation
3. **Migrations**: Versioned, reversible schema changes
4. **Repository Pattern**: Clean separation of data access
5. **Connection Pooling**: PgBouncer for efficient connections

---

## Deliverables

1. `packages/database/src/schema/` - Drizzle schema definitions
2. `packages/database/src/repositories/` - Repository implementations
3. `packages/database/src/migrations/` - Database migrations
4. `packages/database/src/client.ts` - Database client configuration
5. `packages/database/src/rls/` - RLS policy definitions

---

## 1. Schema Definitions

### 1.1 Core Tables

```typescript
// packages/database/src/schema/core.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enums
export const taskStateEnum = pgEnum('task_state', [
  'pending',
  'running',
  'awaiting_approval',
  'completed',
  'failed',
  'cancelled',
]);

export const agentTypeEnum = pgEnum('agent_type', [
  'orchestrator',
  'project_manager',
  'architect',
  'analyst',
  'ui_designer',
  'frontend_dev',
  'backend_dev',
  'tester',
  'bug_fixer',
  'reviewer',
  'git_agent',
]);

// Tenants
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  path: varchar('path', { length: 1000 }),
  config: jsonb('config').default({}),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tasks
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  userId: uuid('user_id').references(() => users.id),
  prompt: text('prompt').notNull(),
  state: taskStateEnum('state').default('pending').notNull(),
  currentAgent: agentTypeEnum('current_agent'),
  config: jsonb('config').default({}),
  result: jsonb('result'),
  error: text('error'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Task Executions (agent runs within a task)
export const taskExecutions = pgTable('task_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id).notNull(),
  agentType: agentTypeEnum('agent_type').notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  status: varchar('status', { length: 50 }).default('running').notNull(),
  durationMs: integer('duration_ms'),
  tokensUsed: integer('tokens_used'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Artifacts
export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id).notNull(),
  executionId: uuid('execution_id').references(() => taskExecutions.id),
  type: varchar('type', { length: 50 }).notNull(),
  path: varchar('path', { length: 1000 }).notNull(),
  content: text('content'),
  metadata: jsonb('metadata').default({}),
  approved: boolean('approved'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Approvals
export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id).notNull(),
  userId: uuid('user_id').references(() => users.id),
  decision: varchar('decision', { length: 20 }).notNull(), // 'approved' | 'rejected'
  reason: text('reason'),
  artifactIds: jsonb('artifact_ids').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 1.2 Lessons and Learning Tables

```typescript
// packages/database/src/schema/learning.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  real,
  index,
} from 'drizzle-orm/pg-core';
import { tenants, tasks, agentTypeEnum } from './core';

// Lessons learned
export const lessons = pgTable('lessons', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  taskId: uuid('task_id').references(() => tasks.id),
  category: varchar('category', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary').notNull(),
  details: text('details'),
  tags: jsonb('tags').default([]),
  sourceAgent: agentTypeEnum('source_agent'),
  confidence: real('confidence').default(0.5),
  applicationCount: integer('application_count').default(0),
  successRate: real('success_rate'),
  humanValidated: boolean('human_validated').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('lessons_tenant_idx').on(table.tenantId),
  categoryIdx: index('lessons_category_idx').on(table.category),
}));

// Self-review results
export const selfReviews = pgTable('self_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id).notNull(),
  executionId: uuid('execution_id').references(() => taskExecutions.id),
  agentType: agentTypeEnum('agent_type').notNull(),
  iteration: integer('iteration').notNull(),
  qualityScore: real('quality_score').notNull(),
  completenessScore: real('completeness_score').notNull(),
  correctnessScore: real('correctness_score').notNull(),
  overallScore: real('overall_score').notNull(),
  gaps: jsonb('gaps').default([]),
  requirements: jsonb('requirements').default([]),
  decision: varchar('decision', { length: 20 }).notNull(),
  reasoning: text('reasoning'),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Pattern detection results
export const patterns = pgTable('patterns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  agentType: agentTypeEnum('agent_type'),
  pattern: jsonb('pattern').notNull(),
  frequency: integer('frequency').default(1),
  lastSeen: timestamp('last_seen').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 1.3 Audit Log Tables

```typescript
// packages/database/src/schema/audit.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  inet,
  index,
} from 'drizzle-orm/pg-core';
import { tenants, users } from './core';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: uuid('resource_id'),
  details: jsonb('details').default({}),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantActionIdx: index('audit_tenant_action_idx').on(table.tenantId, table.action),
  resourceIdx: index('audit_resource_idx').on(table.resourceType, table.resourceId),
  createdAtIdx: index('audit_created_at_idx').on(table.createdAt),
}));
```

---

## 2. Database Client

### 2.1 Client Configuration

```typescript
// packages/database/src/client.ts

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

let db: Database | null = null;
let client: postgres.Sql | null = null;

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  ssl?: boolean;
}

export function createDatabase(config: DatabaseConfig): Database {
  if (db) {
    return db;
  }

  client = postgres(config.connectionString, {
    max: config.maxConnections || 10,
    ssl: config.ssl ? 'require' : false,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  db = drizzle(client, { schema });

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call createDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

// Tenant context for RLS
export async function withTenant<T>(
  database: Database,
  tenantId: string,
  callback: (db: Database) => Promise<T>
): Promise<T> {
  // Set tenant context for RLS
  await database.execute(
    sql`SET LOCAL app.current_tenant_id = ${tenantId}`
  );

  return callback(database);
}
```

---

## 3. Repository Implementations

### 3.1 Base Repository

```typescript
// packages/database/src/repositories/base.repository.ts

import { eq, and, SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { Database } from '../client';

export abstract class BaseRepository<T extends PgTable, TInsert, TSelect> {
  constructor(
    protected db: Database,
    protected table: T,
    protected tenantId?: string
  ) {}

  protected getTenantCondition(): SQL | undefined {
    if (!this.tenantId || !('tenantId' in this.table)) {
      return undefined;
    }
    return eq((this.table as any).tenantId, this.tenantId);
  }

  async findById(id: string): Promise<TSelect | undefined> {
    const conditions = [eq((this.table as any).id, id)];
    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    const result = await this.db
      .select()
      .from(this.table)
      .where(and(...conditions))
      .limit(1);

    return result[0] as TSelect | undefined;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<TSelect[]> {
    const tenantCondition = this.getTenantCondition();
    let query = this.db.select().from(this.table);

    if (tenantCondition) {
      query = query.where(tenantCondition) as any;
    }

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    return query as Promise<TSelect[]>;
  }

  async create(data: TInsert): Promise<TSelect> {
    const insertData = this.tenantId
      ? { ...data, tenantId: this.tenantId }
      : data;

    const result = await this.db
      .insert(this.table)
      .values(insertData as any)
      .returning();

    return result[0] as TSelect;
  }

  async update(id: string, data: Partial<TInsert>): Promise<TSelect | undefined> {
    const conditions = [eq((this.table as any).id, id)];
    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    const result = await this.db
      .update(this.table)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(...conditions))
      .returning();

    return result[0] as TSelect | undefined;
  }

  async delete(id: string): Promise<boolean> {
    const conditions = [eq((this.table as any).id, id)];
    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    const result = await this.db
      .delete(this.table)
      .where(and(...conditions))
      .returning();

    return result.length > 0;
  }
}
```

### 3.2 Task Repository

```typescript
// packages/database/src/repositories/task.repository.ts

import { eq, and, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { Database } from '../client';
import { tasks, taskExecutions, artifacts } from '../schema';

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskExecution = typeof taskExecutions.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;

export class TaskRepository extends BaseRepository<typeof tasks, NewTask, Task> {
  constructor(db: Database, tenantId?: string) {
    super(db, tasks, tenantId);
  }

  async findByState(state: Task['state']): Promise<Task[]> {
    const conditions = [eq(tasks.state, state)];
    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    return this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt));
  }

  async updateState(
    id: string,
    state: Task['state'],
    extra?: Partial<NewTask>
  ): Promise<Task | undefined> {
    return this.update(id, {
      state,
      ...extra,
      ...(state === 'completed' || state === 'failed'
        ? { completedAt: new Date() }
        : {}),
    });
  }

  async getWithExecutions(id: string): Promise<{
    task: Task;
    executions: TaskExecution[];
    artifacts: Artifact[];
  } | null> {
    const task = await this.findById(id);
    if (!task) return null;

    const executions = await this.db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.taskId, id))
      .orderBy(taskExecutions.createdAt);

    const taskArtifacts = await this.db
      .select()
      .from(artifacts)
      .where(eq(artifacts.taskId, id))
      .orderBy(artifacts.createdAt);

    return { task, executions, artifacts: taskArtifacts };
  }

  async getRecentByProject(
    projectId: string,
    limit: number = 10
  ): Promise<Task[]> {
    const conditions = [eq(tasks.projectId, projectId)];
    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    return this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);
  }
}
```

### 3.3 Lesson Repository

```typescript
// packages/database/src/repositories/lesson.repository.ts

import { eq, and, ilike, sql, desc } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { Database } from '../client';
import { lessons } from '../schema';

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

export class LessonRepository extends BaseRepository<typeof lessons, NewLesson, Lesson> {
  constructor(db: Database, tenantId?: string) {
    super(db, lessons, tenantId);
  }

  async findByCategory(category: string): Promise<Lesson[]> {
    const conditions = [eq(lessons.category, category)];
    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    return this.db
      .select()
      .from(lessons)
      .where(and(...conditions))
      .orderBy(desc(lessons.applicationCount));
  }

  async findByTags(tags: string[]): Promise<Lesson[]> {
    const tenantCondition = this.getTenantCondition();

    // Use JSONB contains operator for tag matching
    const tagCondition = sql`${lessons.tags} ?| array[${sql.join(tags, sql`, `)}]`;

    const conditions = tenantCondition
      ? and(tenantCondition, tagCondition)
      : tagCondition;

    return this.db
      .select()
      .from(lessons)
      .where(conditions)
      .orderBy(desc(lessons.confidence));
  }

  async search(query: string): Promise<Lesson[]> {
    const conditions = [
      sql`(
        ${lessons.title} ILIKE ${'%' + query + '%'} OR
        ${lessons.summary} ILIKE ${'%' + query + '%'}
      )`,
    ];

    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition);
    }

    return this.db
      .select()
      .from(lessons)
      .where(and(...conditions))
      .orderBy(desc(lessons.applicationCount))
      .limit(20);
  }

  async incrementApplicationCount(id: string): Promise<void> {
    await this.db
      .update(lessons)
      .set({
        applicationCount: sql`${lessons.applicationCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, id));
  }

  async updateSuccessRate(id: string, success: boolean): Promise<void> {
    // Calculate new success rate based on weighted moving average
    await this.db
      .update(lessons)
      .set({
        successRate: sql`
          CASE
            WHEN ${lessons.successRate} IS NULL THEN ${success ? 1.0 : 0.0}
            ELSE (${lessons.successRate} * 0.8 + ${success ? 1.0 : 0.0} * 0.2)
          END
        `,
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, id));
  }
}
```

---

## 4. RLS Policies

### 4.1 RLS Setup Migration

```typescript
// packages/database/src/migrations/0002_rls_policies.ts

import { sql } from 'drizzle-orm';
import { Database } from '../client';

export async function up(db: Database): Promise<void> {
  // Enable RLS on all tenant-scoped tables
  const tenantTables = [
    'users',
    'projects',
    'tasks',
    'task_executions',
    'artifacts',
    'approvals',
    'lessons',
    'self_reviews',
    'patterns',
    'audit_logs',
  ];

  for (const table of tenantTables) {
    await db.execute(sql.raw(`
      ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;

      -- Policy for tenant isolation
      CREATE POLICY tenant_isolation_policy ON ${table}
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

      -- Allow service role to bypass RLS
      CREATE POLICY service_role_policy ON ${table}
        USING (current_setting('app.role', true) = 'service');
    `));
  }

  // Create helper function for setting tenant context
  await db.execute(sql.raw(`
    CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id uuid)
    RETURNS void AS $$
    BEGIN
      PERFORM set_config('app.current_tenant_id', tenant_id::text, true);
    END;
    $$ LANGUAGE plpgsql;
  `));
}

export async function down(db: Database): Promise<void> {
  const tenantTables = [
    'users',
    'projects',
    'tasks',
    'task_executions',
    'artifacts',
    'approvals',
    'lessons',
    'self_reviews',
    'patterns',
    'audit_logs',
  ];

  for (const table of tenantTables) {
    await db.execute(sql.raw(`
      DROP POLICY IF EXISTS tenant_isolation_policy ON ${table};
      DROP POLICY IF EXISTS service_role_policy ON ${table};
      ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;
    `));
  }

  await db.execute(sql.raw(`DROP FUNCTION IF EXISTS set_tenant_context;`));
}
```

---

## 5. Migration Runner

### 5.1 Migration System

```typescript
// packages/database/src/migrations/runner.ts

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { Database, createDatabase } from '../client';
import path from 'path';

export async function runMigrations(connectionString: string): Promise<void> {
  const db = createDatabase({ connectionString });

  console.log('Running migrations...');

  await migrate(db, {
    migrationsFolder: path.join(__dirname, './migrations'),
  });

  console.log('Migrations complete');
}

// CLI entry point
if (require.main === module) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable required');
    process.exit(1);
  }

  runMigrations(connectionString)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
```

---

## Validation Checklist

```
□ Persistence Layer (Step 06)
  □ Drizzle schema compiles
  □ All tables created via migration
  □ RLS policies created
  □ Base repository CRUD works
  □ Task repository queries work
  □ Lesson repository search works
  □ Tenant isolation enforced
  □ Connection pooling configured
  □ Migrations versioned and reversible
  □ Tests pass with test database
```

---

## Next Step

Proceed to **07-QDRANT-VECTORS.md** to implement vector database integration for embeddings and semantic search.
