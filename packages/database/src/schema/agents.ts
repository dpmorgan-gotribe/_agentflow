/**
 * Agent Schema
 *
 * AI agent instances and their execution state.
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
  boolean,
} from 'drizzle-orm/pg-core';

import { tasks } from './tasks.js';
import { tenants } from './tenants.js';

export const agentStatusEnum = pgEnum('agent_status', [
  'idle',
  'initializing',
  'working',
  'waiting',
  'completed',
  'failed',
  'terminated',
]);

export const agentRoleEnum = pgEnum('agent_role', [
  'orchestrator',
  'architect',
  'backend',
  'frontend',
  'ui_designer',
  'reviewer',
  'tester',
  'devops',
]);

export interface AgentCapabilities {
  tools: string[];
  languages: string[];
  frameworks: string[];
  maxConcurrency: number;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tokensUsed: number;
  averageLatencyMs: number;
  successRate: number;
}

export interface AgentContext {
  workingDirectory?: string;
  environment?: Record<string, string>;
  activeFiles?: string[];
  memoryKeys?: string[];
}

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),

    // Agent identity
    role: agentRoleEnum('role').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    // State
    status: agentStatusEnum('status').notNull().default('idle'),
    isPooled: boolean('is_pooled').default(false),

    // Capabilities
    capabilities: jsonb('capabilities').$type<AgentCapabilities>().default({
      tools: [],
      languages: [],
      frameworks: [],
      maxConcurrency: 1,
    }),

    // Runtime context
    context: jsonb('context').$type<AgentContext>().default({}),

    // Performance metrics
    metrics: jsonb('metrics').$type<AgentMetrics>().default({
      tasksCompleted: 0,
      tokensUsed: 0,
      averageLatencyMs: 0,
      successRate: 1.0,
    }),

    // Resource tracking
    tokensUsedSession: integer('tokens_used_session').default(0),
    maxTokensSession: integer('max_tokens_session').default(100000),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at'),
    terminatedAt: timestamp('terminated_at'),
  },
  (table) => [
    index('agents_tenant_idx').on(table.tenantId),
    index('agents_task_idx').on(table.taskId),
    index('agents_status_idx').on(table.status),
    index('agents_role_idx').on(table.role),
    index('agents_pooled_idx').on(table.isPooled),
  ]
);

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
