/**
 * Task Repository
 *
 * Repository for task operations with state management and complex queries.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
import type { Database } from '../client.js';
import {
  tasks,
  taskExecutions,
  artifacts,
  type Task,
  type NewTask,
  type TaskExecution,
  type Artifact,
  type TaskError,
} from '../schema/index.js';

/**
 * Task with related entities
 */
export interface TaskWithRelations {
  task: Task;
  executions: TaskExecution[];
  artifacts: Artifact[];
}

/**
 * Task repository with state management
 */
export class TaskRepository extends BaseRepository<
  typeof tasks,
  NewTask,
  Task
> {
  constructor(db: Database, tenantId?: string) {
    super(db, tasks, tenantId);
  }

  /**
   * Find tasks by state
   */
  async findByState(state: Task['status']): Promise<Task[]> {
    const condition = this.withTenantFilter(eq(tasks.status, state));

    const query = this.db.select().from(tasks);
    const results = condition
      ? await (query.where(condition) as typeof query).orderBy(
          desc(tasks.createdAt)
        )
      : await query.orderBy(desc(tasks.createdAt));

    return results as Task[];
  }

  /**
   * Find tasks by project
   */
  async findByProject(
    projectId: string,
    options?: { limit?: number; state?: Task['status'] }
  ): Promise<Task[]> {
    const conditions = [eq(tasks.projectId, projectId)];

    if (options?.state) {
      conditions.push(eq(tasks.status, options.state));
    }

    const condition = this.withTenantFilter(and(...conditions));

    let query = this.db.select().from(tasks);

    if (condition) {
      query = query.where(condition) as typeof query;
    }

    query = query.orderBy(desc(tasks.createdAt)) as typeof query;

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    return query as Promise<Task[]>;
  }

  /**
   * Update task state with optional extras
   */
  async updateState(
    id: string,
    state: Task['status'],
    extra?: {
      error?: TaskError;
      currentAgent?: string | null;
      completedAgents?: string[];
      agentQueue?: string[];
    }
  ): Promise<Task | undefined> {
    const now = new Date();

    const updateData: Partial<NewTask> = {
      status: state,
      updatedAt: now,
      ...extra,
    };

    // Set completedAt for terminal states
    if (state === 'completed' || state === 'failed' || state === 'aborted') {
      updateData.completedAt = now;
    }

    // Set startedAt when task begins
    if (state === 'analyzing') {
      updateData.startedAt = now;
    }

    return this.update(id, updateData);
  }

  /**
   * Add agent to completed list
   */
  async addCompletedAgent(id: string, agentType: string): Promise<Task | undefined> {
    const task = await this.findById(id);
    if (!task) {
      return undefined;
    }

    const completedAgents = [...(task.completedAgents || []), agentType];

    return this.update(id, { completedAgents });
  }

  /**
   * Pop next agent from queue
   */
  async popAgentFromQueue(id: string): Promise<{
    task: Task;
    nextAgent: string | null;
  } | undefined> {
    const task = await this.findById(id);
    if (!task) {
      return undefined;
    }

    const queue = [...(task.agentQueue || [])];
    const nextAgent = queue.shift() || null;

    const updated = await this.update(id, {
      agentQueue: queue,
      currentAgent: nextAgent,
    });

    return updated ? { task: updated, nextAgent } : undefined;
  }

  /**
   * Increment retry count
   */
  async incrementRetryCount(id: string): Promise<Task | undefined> {
    const task = await this.findById(id);
    if (!task) {
      return undefined;
    }

    return this.update(id, {
      retryCount: (task.retryCount || 0) + 1,
    });
  }

  /**
   * Get task with all related executions and artifacts
   */
  async getWithRelations(id: string): Promise<TaskWithRelations | null> {
    const task = await this.findById(id);
    if (!task) {
      return null;
    }

    const [executions, taskArtifacts] = await Promise.all([
      this.db
        .select()
        .from(taskExecutions)
        .where(eq(taskExecutions.taskId, id))
        .orderBy(taskExecutions.createdAt),
      this.db
        .select()
        .from(artifacts)
        .where(eq(artifacts.taskId, id))
        .orderBy(artifacts.createdAt),
    ]);

    return {
      task,
      executions: executions as TaskExecution[],
      artifacts: taskArtifacts as Artifact[],
    };
  }

  /**
   * Get recent tasks by project
   */
  async getRecentByProject(projectId: string, limit: number = 10): Promise<Task[]> {
    return this.findByProject(projectId, { limit });
  }

  /**
   * Find pending tasks (ready for processing)
   */
  async findPending(limit: number = 10): Promise<Task[]> {
    const condition = this.withTenantFilter(eq(tasks.status, 'pending'));

    const query = this.db.select().from(tasks);
    const results = condition
      ? await (query.where(condition) as typeof query)
          .orderBy(tasks.createdAt)
          .limit(limit)
      : await query.orderBy(tasks.createdAt).limit(limit);

    return results as Task[];
  }

  /**
   * Find tasks awaiting approval
   */
  async findAwaitingApproval(): Promise<Task[]> {
    return this.findByState('awaiting_approval');
  }

  /**
   * Get task statistics by state
   */
  async getStatsByState(): Promise<Record<string, number>> {
    const tenantCondition = this.getTenantCondition();

    const query = this.db
      .select({
        status: tasks.status,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks);

    const results = tenantCondition
      ? await (query.where(tenantCondition) as typeof query).groupBy(tasks.status)
      : await query.groupBy(tasks.status);

    const stats: Record<string, number> = {};
    for (const row of results) {
      stats[row.status] = row.count;
    }

    return stats;
  }
}
