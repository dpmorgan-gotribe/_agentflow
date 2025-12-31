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

import { projects } from './projects.js';
import { tenants } from './tenants.js';

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
  (table) => [
    index('tasks_tenant_idx').on(table.tenantId),
    index('tasks_project_idx').on(table.projectId),
    index('tasks_status_idx').on(table.status),
  ]
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
