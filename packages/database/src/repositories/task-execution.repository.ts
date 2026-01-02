/**
 * Task Execution Repository
 *
 * Repository for task execution operations with task-based tenant isolation.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  taskExecutions,
  tasks,
  type TaskExecution,
  type NewTaskExecution,
  type ExecutionOutput,
} from '../schema/index.js';

/**
 * Task execution repository with task-based tenant isolation
 */
export class TaskExecutionRepository {
  constructor(
    private readonly db: Database,
    private readonly tenantId?: string
  ) {}

  /**
   * Find execution by ID with tenant check via task
   */
  async findById(id: string): Promise<TaskExecution | undefined> {
    const results = await this.db
      .select()
      .from(taskExecutions)
      .innerJoin(tasks, eq(taskExecutions.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(taskExecutions.id, id), eq(tasks.tenantId, this.tenantId))
          : eq(taskExecutions.id, id)
      )
      .limit(1);

    return results[0]?.task_executions as TaskExecution | undefined;
  }

  /**
   * Find all executions for a task
   */
  async findByTaskId(taskId: string): Promise<TaskExecution[]> {
    const results = await this.db
      .select()
      .from(taskExecutions)
      .innerJoin(tasks, eq(taskExecutions.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(
              eq(taskExecutions.taskId, taskId),
              eq(tasks.tenantId, this.tenantId)
            )
          : eq(taskExecutions.taskId, taskId)
      )
      .orderBy(taskExecutions.createdAt);

    return results.map((r) => r.task_executions) as TaskExecution[];
  }

  /**
   * Find executions by status
   */
  async findByStatus(status: TaskExecution['status']): Promise<TaskExecution[]> {
    const results = await this.db
      .select()
      .from(taskExecutions)
      .innerJoin(tasks, eq(taskExecutions.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(
              eq(taskExecutions.status, status),
              eq(tasks.tenantId, this.tenantId)
            )
          : eq(taskExecutions.status, status)
      )
      .orderBy(desc(taskExecutions.createdAt));

    return results.map((r) => r.task_executions) as TaskExecution[];
  }

  /**
   * Find running executions
   */
  async findRunning(): Promise<TaskExecution[]> {
    return this.findByStatus('running');
  }

  /**
   * Create a new execution
   */
  async create(data: NewTaskExecution): Promise<TaskExecution> {
    const result = await this.db
      .insert(taskExecutions)
      .values(data)
      .returning();
    return result[0] as TaskExecution;
  }

  /**
   * Update an execution
   */
  async update(
    id: string,
    data: Partial<NewTaskExecution>
  ): Promise<TaskExecution | undefined> {
    // Verify tenant access first
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const result = await this.db
      .update(taskExecutions)
      .set(data)
      .where(eq(taskExecutions.id, id))
      .returning();

    return result[0] as TaskExecution | undefined;
  }

  /**
   * Start an execution
   */
  async start(id: string): Promise<TaskExecution | undefined> {
    return this.update(id, {
      status: 'running',
      startedAt: new Date(),
    });
  }

  /**
   * Complete an execution
   */
  async complete(
    id: string,
    output: ExecutionOutput,
    metrics?: {
      durationMs?: number;
      tokensUsed?: number;
    }
  ): Promise<TaskExecution | undefined> {
    const now = new Date();
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const durationMs =
      metrics?.durationMs ??
      (existing.startedAt
        ? now.getTime() - new Date(existing.startedAt).getTime()
        : undefined);

    return this.update(id, {
      status: 'completed',
      output,
      completedAt: now,
      durationMs,
      tokensUsed: metrics?.tokensUsed,
    });
  }

  /**
   * Fail an execution
   */
  async fail(
    id: string,
    error: string,
    errorCode?: string
  ): Promise<TaskExecution | undefined> {
    return this.update(id, {
      status: 'failed',
      error,
      errorCode,
      completedAt: new Date(),
    });
  }

  /**
   * Cancel an execution
   */
  async cancel(id: string): Promise<TaskExecution | undefined> {
    return this.update(id, {
      status: 'cancelled',
      completedAt: new Date(),
    });
  }

  /**
   * Delete an execution
   */
  async delete(id: string): Promise<boolean> {
    // Verify tenant access first
    const existing = await this.findById(id);
    if (!existing) return false;

    const result = await this.db
      .delete(taskExecutions)
      .where(eq(taskExecutions.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Find executions by agent type
   */
  async findByAgentType(
    agentType: TaskExecution['agentType']
  ): Promise<TaskExecution[]> {
    const results = await this.db
      .select()
      .from(taskExecutions)
      .innerJoin(tasks, eq(taskExecutions.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(
              eq(taskExecutions.agentType, agentType),
              eq(tasks.tenantId, this.tenantId)
            )
          : eq(taskExecutions.agentType, agentType)
      )
      .orderBy(desc(taskExecutions.createdAt));

    return results.map((r) => r.task_executions) as TaskExecution[];
  }

  /**
   * Get latest execution for a task
   */
  async findLatestByTaskId(taskId: string): Promise<TaskExecution | undefined> {
    const results = await this.db
      .select()
      .from(taskExecutions)
      .innerJoin(tasks, eq(taskExecutions.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(
              eq(taskExecutions.taskId, taskId),
              eq(tasks.tenantId, this.tenantId)
            )
          : eq(taskExecutions.taskId, taskId)
      )
      .orderBy(desc(taskExecutions.createdAt))
      .limit(1);

    return results[0]?.task_executions as TaskExecution | undefined;
  }

  /**
   * Get execution statistics
   */
  async getStats(): Promise<{
    total: number;
    running: number;
    completed: number;
    failed: number;
    avgDurationMs: number;
    totalTokens: number;
  }> {
    const results = await this.db
      .select({
        status: taskExecutions.status,
        count: sql<number>`count(*)::int`,
        avgDuration: sql<number>`avg(duration_ms)::int`,
        totalTokens: sql<number>`sum(tokens_used)::int`,
      })
      .from(taskExecutions)
      .innerJoin(tasks, eq(taskExecutions.taskId, tasks.id))
      .where(this.tenantId ? eq(tasks.tenantId, this.tenantId) : undefined)
      .groupBy(taskExecutions.status);

    const stats = {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0,
      avgDurationMs: 0,
      totalTokens: 0,
    };

    for (const row of results) {
      stats.total += row.count;
      if (row.status === 'running') stats.running = row.count;
      if (row.status === 'completed') {
        stats.completed = row.count;
        stats.avgDurationMs = row.avgDuration || 0;
      }
      if (row.status === 'failed') stats.failed = row.count;
      stats.totalTokens += row.totalTokens || 0;
    }

    return stats;
  }
}
