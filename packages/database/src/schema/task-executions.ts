/**
 * Task Execution Schema
 *
 * Individual agent executions within a task workflow.
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

import { tasks } from './tasks.js';
import { agentRoleEnum } from './agents.js';

export const executionStatusEnum = pgEnum('execution_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export interface ExecutionInput {
  prompt: string;
  context?: Record<string, unknown>;
  previousOutputs?: Record<string, unknown>[];
  artifacts?: string[];
}

export interface ExecutionOutput {
  result: unknown;
  artifacts?: string[];
  routingHints?: {
    suggestNext?: string[];
    skipAgents?: string[];
    needsApproval?: boolean;
    hasFailures?: boolean;
    isComplete?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ExecutionMetrics {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  modelId?: string;
  retryAttempts?: number;
}

export const taskExecutions = pgTable(
  'task_executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),

    // Agent info
    agentType: agentRoleEnum('agent_type').notNull(),
    agentInstanceId: uuid('agent_instance_id'),

    // Execution data
    input: jsonb('input').$type<ExecutionInput>().notNull(),
    output: jsonb('output').$type<ExecutionOutput>(),
    status: executionStatusEnum('status').notNull().default('pending'),

    // Metrics
    durationMs: integer('duration_ms'),
    tokensUsed: integer('tokens_used'),
    metrics: jsonb('metrics').$type<ExecutionMetrics>(),

    // Error tracking
    error: text('error'),
    errorCode: text('error_code'),

    // Iteration tracking (for retries/revisions)
    iteration: integer('iteration').default(1),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('task_executions_task_idx').on(table.taskId),
    index('task_executions_agent_idx').on(table.agentType),
    index('task_executions_status_idx').on(table.status),
    index('task_executions_created_idx').on(table.createdAt),
  ]
);

export type TaskExecution = typeof taskExecutions.$inferSelect;
export type NewTaskExecution = typeof taskExecutions.$inferInsert;
