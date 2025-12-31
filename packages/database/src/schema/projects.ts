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

import { tenants } from './tenants.js';

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'archived',
  'deleted',
]);

export interface ProjectConfig {
  aiModel?: string;
  maxConcurrentAgents?: number;
  designTokens?: Record<string, unknown>;
  hooks?: Record<string, string>;
}

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
  (table) => [
    index('projects_tenant_idx').on(table.tenantId),
    index('projects_status_idx').on(table.status),
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
