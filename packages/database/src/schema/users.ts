/**
 * User Schema
 *
 * User accounts within tenants for authentication and authorization.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'pending',
  'suspended',
  'deleted',
]);

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    email?: boolean;
    inApp?: boolean;
    taskUpdates?: boolean;
    approvalRequests?: boolean;
  };
  defaultProjectId?: string;
}

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Identity
    email: text('email').notNull(),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),

    // Auth (external provider IDs)
    externalId: text('external_id'), // e.g., Clerk user ID
    authProvider: text('auth_provider'), // e.g., 'clerk', 'auth0'

    // Role and status
    role: userRoleEnum('role').notNull().default('member'),
    status: userStatusEnum('status').notNull().default('pending'),

    // Preferences
    preferences: jsonb('preferences').$type<UserPreferences>().default({}),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('users_tenant_idx').on(table.tenantId),
    index('users_email_idx').on(table.email),
    index('users_external_id_idx').on(table.externalId),
    uniqueIndex('users_tenant_email_idx').on(table.tenantId, table.email),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
