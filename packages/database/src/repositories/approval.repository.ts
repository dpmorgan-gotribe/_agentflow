/**
 * Approval Repository
 *
 * Repository for approval workflow operations with task-based tenant isolation.
 */

import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  approvals,
  tasks,
  type Approval,
  type NewApproval,
  type ApprovalResponse,
} from '../schema/index.js';

/**
 * Approval repository with task-based tenant isolation
 */
export class ApprovalRepository {
  constructor(
    private readonly db: Database,
    private readonly tenantId?: string
  ) {}

  /**
   * Find approval by ID with tenant check via task
   */
  async findById(id: string): Promise<Approval | undefined> {
    const results = await this.db
      .select()
      .from(approvals)
      .innerJoin(tasks, eq(approvals.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(approvals.id, id), eq(tasks.tenantId, this.tenantId))
          : eq(approvals.id, id)
      )
      .limit(1);

    return results[0]?.approvals as Approval | undefined;
  }

  /**
   * Find all approvals for a task
   */
  async findByTaskId(taskId: string): Promise<Approval[]> {
    const results = await this.db
      .select()
      .from(approvals)
      .innerJoin(tasks, eq(approvals.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(approvals.taskId, taskId), eq(tasks.tenantId, this.tenantId))
          : eq(approvals.taskId, taskId)
      )
      .orderBy(desc(approvals.createdAt));

    return results.map((r) => r.approvals) as Approval[];
  }

  /**
   * Find pending approvals
   */
  async findPending(): Promise<Approval[]> {
    const results = await this.db
      .select()
      .from(approvals)
      .innerJoin(tasks, eq(approvals.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(
              eq(approvals.decision, 'pending'),
              eq(tasks.tenantId, this.tenantId)
            )
          : eq(approvals.decision, 'pending')
      )
      .orderBy(desc(approvals.createdAt));

    return results.map((r) => r.approvals) as Approval[];
  }

  /**
   * Find approvals by type
   */
  async findByType(type: Approval['type']): Promise<Approval[]> {
    const results = await this.db
      .select()
      .from(approvals)
      .innerJoin(tasks, eq(approvals.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(approvals.type, type), eq(tasks.tenantId, this.tenantId))
          : eq(approvals.type, type)
      )
      .orderBy(desc(approvals.createdAt));

    return results.map((r) => r.approvals) as Approval[];
  }

  /**
   * Create a new approval request
   */
  async create(data: NewApproval): Promise<Approval> {
    const result = await this.db.insert(approvals).values(data).returning();
    return result[0] as Approval;
  }

  /**
   * Update an approval
   */
  async update(
    id: string,
    data: Partial<NewApproval>
  ): Promise<Approval | undefined> {
    // Verify tenant access first
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const result = await this.db
      .update(approvals)
      .set(data)
      .where(eq(approvals.id, id))
      .returning();

    return result[0] as Approval | undefined;
  }

  /**
   * Record an approval decision
   */
  async decide(
    id: string,
    decision: 'approved' | 'rejected' | 'deferred',
    userId: string,
    response?: ApprovalResponse,
    reason?: string
  ): Promise<Approval | undefined> {
    return this.update(id, {
      decision,
      decidedById: userId,
      decidedAt: new Date(),
      response,
      reason,
    });
  }

  /**
   * Approve a request
   */
  async approve(
    id: string,
    userId: string,
    response?: ApprovalResponse,
    reason?: string
  ): Promise<Approval | undefined> {
    return this.decide(id, 'approved', userId, response, reason);
  }

  /**
   * Reject a request
   */
  async reject(
    id: string,
    userId: string,
    response?: ApprovalResponse,
    reason?: string
  ): Promise<Approval | undefined> {
    return this.decide(id, 'rejected', userId, response, reason);
  }

  /**
   * Defer a request
   */
  async defer(
    id: string,
    userId: string,
    reason?: string
  ): Promise<Approval | undefined> {
    return this.decide(id, 'deferred', userId, undefined, reason);
  }

  /**
   * Delete an approval
   */
  async delete(id: string): Promise<boolean> {
    // Verify tenant access first
    const existing = await this.findById(id);
    if (!existing) return false;

    const result = await this.db
      .delete(approvals)
      .where(eq(approvals.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Find expired pending approvals
   */
  async findExpired(): Promise<Approval[]> {
    const now = new Date();
    const results = await this.db
      .select()
      .from(approvals)
      .innerJoin(tasks, eq(approvals.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(
              eq(approvals.decision, 'pending'),
              eq(tasks.tenantId, this.tenantId)
            )
          : eq(approvals.decision, 'pending')
      )
      .orderBy(desc(approvals.createdAt));

    // Filter for expired in memory (expiresAt < now)
    return results
      .map((r) => r.approvals)
      .filter((a) => a.expiresAt && new Date(a.expiresAt) < now) as Approval[];
  }

  /**
   * Get pending approval for task by type
   */
  async findPendingByTaskAndType(
    taskId: string,
    type: Approval['type']
  ): Promise<Approval | undefined> {
    const results = await this.db
      .select()
      .from(approvals)
      .innerJoin(tasks, eq(approvals.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(
              eq(approvals.taskId, taskId),
              eq(approvals.type, type),
              eq(approvals.decision, 'pending'),
              eq(tasks.tenantId, this.tenantId)
            )
          : and(
              eq(approvals.taskId, taskId),
              eq(approvals.type, type),
              eq(approvals.decision, 'pending')
            )
      )
      .limit(1);

    return results[0]?.approvals as Approval | undefined;
  }
}
