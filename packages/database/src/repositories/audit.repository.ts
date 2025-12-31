/**
 * Audit Repository
 *
 * Repository for audit log operations with filtering and analytics.
 */

import { eq, and, desc, sql, gte, lte, or } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
import type { Database } from '../client.js';
import { auditLogs, type AuditLog, type NewAuditLog } from '../schema/index.js';

/**
 * Audit log filter options
 */
export interface AuditLogFilter {
  action?: AuditLog['action'];
  outcome?: AuditLog['outcome'];
  actorType?: 'user' | 'agent' | 'system';
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit statistics
 */
export interface AuditStats {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  blockedCount: number;
  byAction: Record<string, number>;
  byOutcome: Record<string, number>;
}

/**
 * Audit repository (read-heavy, append-only for writes)
 */
export class AuditRepository extends BaseRepository<
  typeof auditLogs,
  NewAuditLog,
  AuditLog
> {
  constructor(db: Database, tenantId?: string) {
    super(db, auditLogs, tenantId);
  }

  /**
   * Create audit log entry (append-only)
   * Overrides base create to ensure no modification of existing records
   */
  override async create(data: NewAuditLog): Promise<AuditLog> {
    return super.create(data);
  }

  /**
   * Update is not allowed for audit logs (immutable)
   */
  override async update(): Promise<AuditLog | undefined> {
    throw new Error('Audit logs are immutable and cannot be updated');
  }

  /**
   * Delete is not allowed for audit logs (immutable)
   */
  override async delete(): Promise<boolean> {
    throw new Error('Audit logs are immutable and cannot be deleted');
  }

  /**
   * Find audit logs by action
   */
  async findByAction(
    action: AuditLog['action'],
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<AuditLog[]> {
    const conditions = [eq(auditLogs.action, action)];
    const tenantCondition = this.getTenantCondition();

    if (tenantCondition) {
      conditions.push(tenantCondition as ReturnType<typeof eq>);
    }

    if (options?.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }

    let query = this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return query as Promise<AuditLog[]>;
  }

  /**
   * Find audit logs by outcome
   */
  async findByOutcome(
    outcome: AuditLog['outcome'],
    limit: number = 100
  ): Promise<AuditLog[]> {
    const condition = this.withTenantFilter(eq(auditLogs.outcome, outcome));

    const query = this.db.select().from(auditLogs);
    const results = condition
      ? await (query.where(condition) as typeof query)
          .orderBy(desc(auditLogs.createdAt))
          .limit(limit)
      : await query.orderBy(desc(auditLogs.createdAt)).limit(limit);

    return results as AuditLog[];
  }

  /**
   * Find audit logs by actor
   */
  async findByActor(
    actorId: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<AuditLog[]> {
    const tenantCondition = this.getTenantCondition();
    const actorCondition = eq(auditLogs.actorId, actorId);

    const conditions: ReturnType<typeof eq>[] = [actorCondition];

    if (tenantCondition) {
      conditions.push(tenantCondition as ReturnType<typeof eq>);
    }

    if (options?.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }

    let query = this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return query as Promise<AuditLog[]>;
  }

  /**
   * Find audit logs by resource (target)
   */
  async findByResource(
    targetType: string,
    targetId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const tenantCondition = this.getTenantCondition();
    const resourceCondition = and(
      eq(auditLogs.targetType, targetType),
      eq(auditLogs.targetId, targetId)
    );

    const condition = tenantCondition
      ? and(tenantCondition, resourceCondition)
      : resourceCondition;

    const results = await this.db
      .select()
      .from(auditLogs)
      .where(condition!)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return results as AuditLog[];
  }

  /**
   * Advanced filter for audit logs
   */
  async filter(options: AuditLogFilter): Promise<AuditLog[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    const tenantCondition = this.getTenantCondition();

    if (tenantCondition) {
      conditions.push(tenantCondition as ReturnType<typeof eq>);
    }

    if (options.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }

    if (options.outcome) {
      conditions.push(eq(auditLogs.outcome, options.outcome));
    }

    if (options.actorType) {
      conditions.push(
        eq(auditLogs.actorType, options.actorType) as ReturnType<typeof eq>
      );
    }

    if (options.actorId) {
      conditions.push(
        eq(auditLogs.actorId, options.actorId) as ReturnType<typeof eq>
      );
    }

    if (options.resourceType) {
      conditions.push(
        eq(auditLogs.targetType, options.resourceType) as ReturnType<typeof eq>
      );
    }

    if (options.resourceId) {
      conditions.push(
        eq(auditLogs.targetId, options.resourceId) as ReturnType<typeof eq>
      );
    }

    if (options.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }

    if (options.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }

    let query = this.db.select().from(auditLogs);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.orderBy(desc(auditLogs.createdAt)) as typeof query;
    query = query.limit(options.limit ?? 100) as typeof query;

    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query as Promise<AuditLog[]>;
  }

  /**
   * Get audit statistics for a time period
   */
  async getStats(startDate: Date, endDate: Date): Promise<AuditStats> {
    const tenantCondition = this.getTenantCondition();
    const dateCondition = and(
      gte(auditLogs.createdAt, startDate),
      lte(auditLogs.createdAt, endDate)
    );

    const condition = tenantCondition
      ? and(tenantCondition, dateCondition)
      : dateCondition;

    // Get counts by outcome
    const outcomeStats = await this.db
      .select({
        outcome: auditLogs.outcome,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(condition!)
      .groupBy(auditLogs.outcome);

    // Get counts by action
    const actionStats = await this.db
      .select({
        action: auditLogs.action,
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(condition!)
      .groupBy(auditLogs.action);

    const byOutcome: Record<string, number> = {};
    let successCount = 0;
    let failureCount = 0;
    let blockedCount = 0;
    let totalEvents = 0;

    for (const row of outcomeStats) {
      byOutcome[row.outcome] = row.count;
      totalEvents += row.count;
      if (row.outcome === 'success') successCount = row.count;
      if (row.outcome === 'failure') failureCount = row.count;
      if (row.outcome === 'blocked') blockedCount = row.count;
    }

    const byAction: Record<string, number> = {};
    for (const row of actionStats) {
      byAction[row.action] = row.count;
    }

    return {
      totalEvents,
      successCount,
      failureCount,
      blockedCount,
      byAction,
      byOutcome,
    };
  }

  /**
   * Find recent security events
   */
  async findSecurityEvents(limit: number = 50): Promise<AuditLog[]> {
    const tenantCondition = this.getTenantCondition();
    const securityCondition = or(
      eq(auditLogs.action, 'security.permission_change'),
      eq(auditLogs.action, 'security.api_key_create'),
      eq(auditLogs.action, 'security.api_key_revoke'),
      eq(auditLogs.action, 'security.rate_limit_hit'),
      eq(auditLogs.outcome, 'blocked'),
      eq(auditLogs.outcome, 'failure')
    );

    const condition = tenantCondition
      ? and(tenantCondition, securityCondition)
      : securityCondition;

    const results = await this.db
      .select()
      .from(auditLogs)
      .where(condition!)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return results as AuditLog[];
  }

  /**
   * Count events in time range
   */
  async countInRange(startDate: Date, endDate: Date): Promise<number> {
    const tenantCondition = this.getTenantCondition();
    const dateCondition = and(
      gte(auditLogs.createdAt, startDate),
      lte(auditLogs.createdAt, endDate)
    );

    const condition = tenantCondition
      ? and(tenantCondition, dateCondition)
      : dateCondition;

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(condition!);

    return result[0]?.count ?? 0;
  }
}
