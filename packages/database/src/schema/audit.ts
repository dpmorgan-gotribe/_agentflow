/**
 * Audit Schema
 *
 * Comprehensive audit logging for security and compliance.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
  inet,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

export const auditActionEnum = pgEnum('audit_action', [
  // Authentication
  'auth.login',
  'auth.logout',
  'auth.token_refresh',
  'auth.password_change',
  'auth.mfa_enable',
  'auth.mfa_disable',

  // Tenant operations
  'tenant.create',
  'tenant.update',
  'tenant.suspend',
  'tenant.delete',

  // Project operations
  'project.create',
  'project.update',
  'project.archive',
  'project.delete',

  // Task operations
  'task.create',
  'task.start',
  'task.complete',
  'task.fail',
  'task.abort',

  // Agent operations
  'agent.spawn',
  'agent.terminate',
  'agent.assign',

  // Security events
  'security.permission_change',
  'security.api_key_create',
  'security.api_key_revoke',
  'security.rate_limit_hit',

  // Data operations
  'data.export',
  'data.import',
  'data.backup',
  'data.restore',
]);

export const auditOutcomeEnum = pgEnum('audit_outcome', [
  'success',
  'failure',
  'blocked',
  'error',
]);

export interface AuditDetails {
  resourceType?: string;
  resourceId?: string;
  changes?: {
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
  }[];
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface AuditRequestInfo {
  method?: string;
  path?: string;
  userAgent?: string;
  correlationId?: string;
}

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Action details
    action: auditActionEnum('action').notNull(),
    outcome: auditOutcomeEnum('outcome').notNull(),

    // Actor information
    actorId: uuid('actor_id'), // user or agent ID
    actorType: text('actor_type').notNull(), // 'user', 'agent', 'system'
    actorEmail: text('actor_email'),

    // Target resource
    targetType: text('target_type'),
    targetId: uuid('target_id'),

    // Additional context
    details: jsonb('details').$type<AuditDetails>().default({}),

    // Request metadata
    requestInfo: jsonb('request_info').$type<AuditRequestInfo>().default({}),
    ipAddress: inet('ip_address'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_tenant_idx').on(table.tenantId),
    index('audit_action_idx').on(table.action),
    index('audit_outcome_idx').on(table.outcome),
    index('audit_actor_idx').on(table.actorId),
    index('audit_target_idx').on(table.targetId),
    index('audit_created_idx').on(table.createdAt),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
