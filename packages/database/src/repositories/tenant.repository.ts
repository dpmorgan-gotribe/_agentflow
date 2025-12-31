/**
 * Tenant Repository
 *
 * Repository for tenant operations (not tenant-scoped itself).
 */

import { eq, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
import type { Database } from '../client.js';
import {
  tenants,
  projects,
  tasks,
  users,
  type Tenant,
  type NewTenant,
  type TenantUsage,
} from '../schema/index.js';

/**
 * Tenant with usage statistics
 */
export interface TenantWithStats extends Tenant {
  projectCount: number;
  taskCount: number;
  userCount: number;
}

/**
 * Tenant repository (no tenant isolation - operates on all tenants)
 */
export class TenantRepository extends BaseRepository<
  typeof tenants,
  NewTenant,
  Tenant
> {
  constructor(db: Database) {
    // No tenantId - tenants table is not tenant-scoped
    super(db, tenants, undefined);
  }

  /**
   * Find tenant by slug
   */
  async findBySlug(slug: string): Promise<Tenant | undefined> {
    const results = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    return results[0] as Tenant | undefined;
  }

  /**
   * Find tenant by owner email
   */
  async findByOwnerEmail(email: string): Promise<Tenant | undefined> {
    const results = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.ownerEmail, email))
      .limit(1);

    return results[0] as Tenant | undefined;
  }

  /**
   * Find tenants by status
   */
  async findByStatus(status: Tenant['status']): Promise<Tenant[]> {
    const results = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.status, status))
      .orderBy(desc(tenants.createdAt));

    return results as Tenant[];
  }

  /**
   * Find active tenants
   */
  async findActive(): Promise<Tenant[]> {
    return this.findByStatus('active');
  }

  /**
   * Activate a tenant
   */
  async activate(id: string): Promise<Tenant | undefined> {
    return this.update(id, {
      status: 'active',
      suspendedAt: null,
    });
  }

  /**
   * Suspend a tenant
   */
  async suspend(id: string): Promise<Tenant | undefined> {
    return this.update(id, {
      status: 'suspended',
      suspendedAt: new Date(),
    });
  }

  /**
   * Soft delete a tenant
   */
  async softDelete(id: string): Promise<Tenant | undefined> {
    return this.update(id, {
      status: 'deleted',
      deletedAt: new Date(),
    });
  }

  /**
   * Get tenant with usage statistics
   */
  async getWithStats(id: string): Promise<TenantWithStats | null> {
    const tenant = await this.findById(id);
    if (!tenant) {
      return null;
    }

    const [projectStats, taskStats, userStats] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.tenantId, id)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.tenantId, id)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.tenantId, id)),
    ]);

    return {
      ...tenant,
      projectCount: projectStats[0]?.count ?? 0,
      taskCount: taskStats[0]?.count ?? 0,
      userCount: userStats[0]?.count ?? 0,
    };
  }

  /**
   * Update tenant usage
   */
  async updateUsage(
    id: string,
    usage: Partial<TenantUsage>
  ): Promise<Tenant | undefined> {
    const tenant = await this.findById(id);
    if (!tenant) {
      return undefined;
    }

    const defaultUsage: TenantUsage = {
      currentUsers: 0,
      currentProjects: 0,
      tokensThisMonth: 0,
      storageUsedGB: 0,
    };

    const mergedUsage: TenantUsage = {
      ...defaultUsage,
      ...tenant.usage,
      ...usage,
    };
    return this.update(id, { usage: mergedUsage });
  }

  /**
   * Increment token usage
   */
  async incrementTokenUsage(id: string, tokens: number): Promise<void> {
    await this.db
      .update(tenants)
      .set({
        usage: sql`jsonb_set(
          ${tenants.usage},
          '{tokensThisMonth}',
          to_jsonb(COALESCE((${tenants.usage}->>'tokensThisMonth')::int, 0) + ${tokens})
        )`,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id));
  }

  /**
   * Reset monthly token usage (for billing cycle)
   */
  async resetMonthlyTokenUsage(id: string): Promise<void> {
    await this.db
      .update(tenants)
      .set({
        usage: sql`jsonb_set(${tenants.usage}, '{tokensThisMonth}', '0')`,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id));
  }

  /**
   * Check if tenant is within quota
   */
  async isWithinQuota(
    id: string,
    quotaType: keyof Tenant['quotas']
  ): Promise<boolean> {
    const tenant = await this.findById(id);
    if (!tenant) {
      return false;
    }

    const quota = tenant.quotas?.[quotaType];
    if (quota === undefined) {
      return true; // No quota set means unlimited
    }

    // Map quota types to usage types
    const usageMap: Record<string, keyof TenantUsage> = {
      maxUsers: 'currentUsers',
      maxProjects: 'currentProjects',
      maxTokensPerMonth: 'tokensThisMonth',
      maxStorageGB: 'storageUsedGB',
    };

    const usageKey = usageMap[quotaType];
    if (!usageKey) {
      return true;
    }

    const currentUsage = tenant.usage?.[usageKey] ?? 0;
    return currentUsage < quota;
  }

  /**
   * Find tenants by Stripe customer ID
   */
  async findByStripeCustomerId(stripeCustomerId: string): Promise<Tenant | undefined> {
    const results = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.stripeCustomerId, stripeCustomerId))
      .limit(1);

    return results[0] as Tenant | undefined;
  }
}
