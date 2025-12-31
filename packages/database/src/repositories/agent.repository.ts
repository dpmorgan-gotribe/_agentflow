/**
 * Agent Repository
 *
 * Repository for agent instance operations.
 */

import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
import type { Database } from '../client.js';
import {
  agents,
  type Agent,
  type NewAgent,
  type AgentMetrics,
} from '../schema/index.js';

/**
 * Agent availability info
 */
export interface AgentAvailability {
  role: Agent['role'];
  available: number;
  busy: number;
  total: number;
}

/**
 * Agent repository
 */
export class AgentRepository extends BaseRepository<
  typeof agents,
  NewAgent,
  Agent
> {
  constructor(db: Database, tenantId?: string) {
    super(db, agents, tenantId);
  }

  /**
   * Find agents by role
   */
  async findByRole(role: Agent['role']): Promise<Agent[]> {
    const condition = this.withTenantFilter(eq(agents.role, role));

    const query = this.db.select().from(agents);
    const results = condition
      ? await (query.where(condition) as typeof query).orderBy(
          desc(agents.createdAt)
        )
      : await query.orderBy(desc(agents.createdAt));

    return results as Agent[];
  }

  /**
   * Find agents by status
   */
  async findByStatus(status: Agent['status']): Promise<Agent[]> {
    const condition = this.withTenantFilter(eq(agents.status, status));

    const query = this.db.select().from(agents);
    const results = condition
      ? await (query.where(condition) as typeof query).orderBy(
          desc(agents.createdAt)
        )
      : await query.orderBy(desc(agents.createdAt));

    return results as Agent[];
  }

  /**
   * Find idle agents of a specific role
   */
  async findIdleByRole(role: Agent['role']): Promise<Agent[]> {
    const conditions = [eq(agents.role, role), eq(agents.status, 'idle')];
    const tenantCondition = this.getTenantCondition();

    if (tenantCondition) {
      conditions.push(tenantCondition as ReturnType<typeof eq>);
    }

    const results = await this.db
      .select()
      .from(agents)
      .where(and(...conditions))
      .orderBy(agents.createdAt);

    return results as Agent[];
  }

  /**
   * Find available pooled agent
   */
  async findAvailablePooledAgent(role: Agent['role']): Promise<Agent | undefined> {
    const conditions = [
      eq(agents.role, role),
      eq(agents.status, 'idle'),
      eq(agents.isPooled, true),
      isNull(agents.taskId),
    ];

    const tenantCondition = this.getTenantCondition();
    if (tenantCondition) {
      conditions.push(tenantCondition as ReturnType<typeof eq>);
    }

    const results = await this.db
      .select()
      .from(agents)
      .where(and(...conditions))
      .limit(1);

    return results[0] as Agent | undefined;
  }

  /**
   * Update agent status
   */
  async updateStatus(
    id: string,
    status: Agent['status'],
    extra?: { taskId?: string | null; error?: string }
  ): Promise<Agent | undefined> {
    return this.update(id, {
      status,
      taskId: extra?.taskId ?? undefined,
    });
  }

  /**
   * Assign agent to task
   */
  async assignToTask(id: string, taskId: string): Promise<Agent | undefined> {
    return this.update(id, {
      status: 'working',
      taskId,
    });
  }

  /**
   * Release agent from task
   */
  async releaseFromTask(id: string): Promise<Agent | undefined> {
    return this.update(id, {
      status: 'idle',
      taskId: null,
    });
  }

  /**
   * Update agent metrics
   */
  async updateMetrics(
    id: string,
    metricsUpdate: Partial<AgentMetrics>
  ): Promise<Agent | undefined> {
    const agent = await this.findById(id);
    if (!agent) {
      return undefined;
    }

    const currentMetrics = agent.metrics || {
      tasksCompleted: 0,
      tokensUsed: 0,
      averageLatencyMs: 0,
      successRate: 1.0,
    };

    const mergedMetrics: AgentMetrics = {
      tasksCompleted: metricsUpdate.tasksCompleted ?? currentMetrics.tasksCompleted,
      tokensUsed: metricsUpdate.tokensUsed ?? currentMetrics.tokensUsed,
      averageLatencyMs: metricsUpdate.averageLatencyMs ?? currentMetrics.averageLatencyMs,
      successRate: metricsUpdate.successRate ?? currentMetrics.successRate,
    };

    return this.update(id, { metrics: mergedMetrics });
  }

  /**
   * Increment task completion count
   */
  async incrementTasksCompleted(id: string): Promise<void> {
    const condition = this.withTenantFilter(eq(agents.id, id));
    if (!condition) {
      return;
    }

    await this.db
      .update(agents)
      .set({
        metrics: sql`jsonb_set(
          ${agents.metrics},
          '{tasksCompleted}',
          to_jsonb(COALESCE((${agents.metrics}->>'tasksCompleted')::int, 0) + 1)
        )`,
        updatedAt: new Date(),
      })
      .where(condition);
  }

  /**
   * Add tokens to usage
   */
  async addTokenUsage(id: string, tokens: number): Promise<void> {
    const condition = this.withTenantFilter(eq(agents.id, id));
    if (!condition) {
      return;
    }

    await this.db
      .update(agents)
      .set({
        metrics: sql`jsonb_set(
          ${agents.metrics},
          '{tokensUsed}',
          to_jsonb(COALESCE((${agents.metrics}->>'tokensUsed')::int, 0) + ${tokens})
        )`,
        tokensUsedSession: sql`${agents.tokensUsedSession} + ${tokens}`,
        updatedAt: new Date(),
      })
      .where(condition);
  }

  /**
   * Get agent availability by role
   */
  async getAvailabilityByRole(): Promise<AgentAvailability[]> {
    const tenantCondition = this.getTenantCondition();

    let query = this.db
      .select({
        role: agents.role,
        available: sql<number>`count(*) filter (where ${agents.status} = 'idle')::int`,
        busy: sql<number>`count(*) filter (where ${agents.status} = 'working')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(agents);

    if (tenantCondition) {
      query = query.where(tenantCondition) as typeof query;
    }

    const results = await query.groupBy(agents.role);

    return results as AgentAvailability[];
  }

  /**
   * Terminate agent
   */
  async terminate(id: string): Promise<Agent | undefined> {
    return this.update(id, {
      status: 'terminated',
      taskId: null,
      terminatedAt: new Date(),
    });
  }

  /**
   * Find agents assigned to a task
   */
  async findByTask(taskId: string): Promise<Agent[]> {
    const condition = this.withTenantFilter(eq(agents.taskId, taskId));

    const query = this.db.select().from(agents);
    const results = condition
      ? await (query.where(condition) as typeof query)
      : await query;

    return results as Agent[];
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    const condition = this.withTenantFilter(eq(agents.id, id));
    if (!condition) {
      return;
    }

    await this.db
      .update(agents)
      .set({
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(condition);
  }
}
