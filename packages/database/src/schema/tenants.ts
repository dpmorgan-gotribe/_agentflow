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
  (table) => [
    index('tenants_slug_idx').on(table.slug),
    index('tenants_status_idx').on(table.status),
  ]
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
