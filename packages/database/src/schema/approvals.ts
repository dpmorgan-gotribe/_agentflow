/**
 * Approval Schema
 *
 * Human-in-the-loop approval workflow for task artifacts.
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

import { tasks } from './tasks.js';
import { users } from './users.js';

export const approvalTypeEnum = pgEnum('approval_type', [
  'design',
  'architecture',
  'implementation',
  'final',
  'security',
  'compliance',
]);

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'pending',
  'approved',
  'rejected',
  'deferred',
]);

export interface ApprovalRequest {
  type: string;
  description: string;
  artifactIds: string[];
  options?: string[];
  requiredBy?: string;
  deadline?: string;
}

export interface ApprovalResponse {
  selectedOption?: string;
  feedback?: string;
  requestedChanges?: string[];
  conditions?: string[];
}

export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),

    // Approval details
    type: approvalTypeEnum('type').notNull(),
    request: jsonb('request').$type<ApprovalRequest>().notNull(),

    // Decision
    decision: approvalDecisionEnum('decision').notNull().default('pending'),
    response: jsonb('response').$type<ApprovalResponse>(),

    // Approver
    requestedById: uuid('requested_by_id'),
    decidedById: uuid('decided_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    // Artifact references (denormalized for quick access)
    artifactIds: jsonb('artifact_ids').$type<string[]>().default([]),

    // Reason for decision
    reason: text('reason'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    decidedAt: timestamp('decided_at'),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    index('approvals_task_idx').on(table.taskId),
    index('approvals_type_idx').on(table.type),
    index('approvals_decision_idx').on(table.decision),
    index('approvals_created_idx').on(table.createdAt),
  ]
);

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
