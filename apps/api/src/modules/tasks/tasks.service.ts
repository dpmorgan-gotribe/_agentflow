/**
 * Tasks Service
 *
 * Core orchestration service for task management.
 * Integrates with LangGraph for workflow execution.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

import {
  approveTaskSchema,
  createTaskSchema,
  TaskStatus,
  type ApproveTaskInput,
  type CreateTaskInput,
  type TaskResponse,
} from './tasks.schema';
import type { TenantContext } from '../../common/guards';
import { ConfigService } from '../../config';
import { NotFoundError, TaskStateError, ValidationError } from '../../errors';

/**
 * In-memory task storage (will be replaced with database in production)
 */
interface StoredTask {
  id: string;
  projectId: string;
  tenantId: string;
  prompt: string;
  status: TaskStatus;
  priority: string;
  analysis?: Record<string, unknown>;
  currentAgent?: string;
  completedAgents: string[];
  error?: string;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);
  private readonly tasks = new Map<string, StoredTask>();
  private readonly eventStreams = new Map<string, Subject<MessageEvent>>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.logger.log('TasksService initialized');
  }

  /**
   * Create and start a new task
   */
  create(tenant: TenantContext, input: CreateTaskInput): TaskResponse {
    // Validate input with Zod
    const validationResult = createTaskSchema.safeParse(input);
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new ValidationError(`Invalid task input: ${errors}`);
    }

    const validated = validationResult.data;
    const taskId = crypto.randomUUID();
    const now = new Date();

    const task: StoredTask = {
      id: taskId,
      projectId: validated.projectId,
      tenantId: tenant.tenantId,
      prompt: validated.prompt,
      status: TaskStatus.PENDING,
      priority: validated.priority ?? 'normal',
      completedAgents: [],
      metadata: validated.metadata,
      createdAt: now,
      updatedAt: now,
    };

    // Store task
    this.tasks.set(taskId, task);

    this.logger.log(`Task created: ${taskId} for tenant: ${tenant.tenantId}`);

    // Start workflow execution in background
    this.executeWorkflow(tenant.tenantId, taskId).catch((error) => {
      this.logger.error(`Workflow execution failed for task ${taskId}:`, error);
      this.updateTaskStatus(taskId, TaskStatus.FAILED, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    return this.mapToResponse(task);
  }

  /**
   * Get task by ID
   */
  findOne(tenantId: string, taskId: string): TaskResponse {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    // Enforce tenant isolation
    if (task.tenantId !== tenantId) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    return this.mapToResponse(task);
  }

  /**
   * Get task status with checkpoint info
   */
  getStatus(
    tenantId: string,
    taskId: string
  ): TaskResponse & {
    pendingApproval: boolean;
    checkpoint?: Record<string, unknown>;
  } {
    const task = this.findOne(tenantId, taskId);

    return {
      ...task,
      pendingApproval: task.status === TaskStatus.AWAITING_APPROVAL,
      checkpoint: undefined, // Will be populated from checkpointer in production
    };
  }

  /**
   * Stream task execution events
   */
  streamEvents(tenantId: string, taskId: string): Observable<MessageEvent> {
    // First verify task belongs to tenant
    const task = this.tasks.get(taskId);
    if (!task || task.tenantId !== tenantId) {
      // Return completed observable for non-existent or unauthorized tasks
      return new Observable((subscriber) => subscriber.complete());
    }

    const subject = this.eventStreams.get(taskId);
    if (!subject) {
      // Task not currently streaming, return completed observable
      return new Observable((subscriber) => subscriber.complete());
    }

    return subject.asObservable();
  }

  /**
   * Handle approval/rejection for pending checkpoint
   */
  handleApproval(
    tenantId: string,
    taskId: string,
    input: ApproveTaskInput
  ): { success: boolean } {
    // Validate input
    const validationResult = approveTaskSchema.safeParse(input);
    if (!validationResult.success) {
      throw new ValidationError('Invalid approval input');
    }

    const task = this.tasks.get(taskId);

    if (!task) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    if (task.tenantId !== tenantId) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    if (task.status !== TaskStatus.AWAITING_APPROVAL) {
      throw new TaskStateError(
        taskId,
        task.status,
        TaskStatus.AWAITING_APPROVAL
      );
    }

    const validated = validationResult.data;

    if (validated.approved) {
      this.logger.log(`Task ${taskId} approved, resuming workflow`);
      this.updateTaskStatus(taskId, TaskStatus.EXECUTING);
      // In production, this would resume the LangGraph workflow
    } else {
      this.logger.log(`Task ${taskId} rejected`);
      this.updateTaskStatus(taskId, TaskStatus.ABORTED, {
        error: validated.feedback ?? 'Rejected by user',
      });
    }

    return { success: true };
  }

  /**
   * Abort a running task
   */
  abort(tenantId: string, taskId: string): { success: boolean } {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    if (task.tenantId !== tenantId) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    // Only allow aborting active tasks
    const abortableStatuses: TaskStatus[] = [
      TaskStatus.PENDING,
      TaskStatus.ANALYZING,
      TaskStatus.EXECUTING,
      TaskStatus.AWAITING_APPROVAL,
    ];

    if (!abortableStatuses.includes(task.status)) {
      throw new TaskStateError(taskId, task.status, 'an abortable state');
    }

    this.updateTaskStatus(taskId, TaskStatus.ABORTED);

    // Close event stream
    const subject = this.eventStreams.get(taskId);
    if (subject) {
      subject.complete();
      this.eventStreams.delete(taskId);
    }

    this.logger.log(`Task ${taskId} aborted`);

    return { success: true };
  }

  /**
   * List tasks for tenant
   */
  findAll(tenantId: string, projectId?: string): TaskResponse[] {
    const tasks: TaskResponse[] = [];

    for (const task of this.tasks.values()) {
      if (task.tenantId !== tenantId) continue;
      if (projectId && task.projectId !== projectId) continue;
      tasks.push(this.mapToResponse(task));
    }

    // Sort by creation date, newest first
    return tasks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Execute workflow in background
   */
  private async executeWorkflow(
    tenantId: string,
    taskId: string
  ): Promise<void> {
    const eventSubject = new Subject<MessageEvent>();
    this.eventStreams.set(taskId, eventSubject);

    try {
      // Simulate workflow execution
      this.updateTaskStatus(taskId, TaskStatus.ANALYZING);
      this.emitEvent(eventSubject, { type: 'workflow_started', taskId });

      // Simulate analysis phase
      await this.sleep(1000);
      const task = this.tasks.get(taskId);
      if (!task || task.status === TaskStatus.ABORTED) {
        return;
      }

      this.updateTaskStatus(taskId, TaskStatus.EXECUTING, {
        analysis: { type: 'feature', complexity: 'medium' },
        currentAgent: 'architect',
      });
      this.emitEvent(eventSubject, { type: 'analysis_complete', taskId });

      // Simulate agent execution
      await this.sleep(2000);
      // Re-fetch task to check current status (may have changed during sleep)
      const currentTask = this.tasks.get(taskId);
      if (!currentTask || currentTask.status === TaskStatus.ABORTED) {
        return;
      }

      this.updateTaskStatus(taskId, TaskStatus.COMPLETED, {
        currentAgent: undefined,
        completedAgents: ['architect', 'backend', 'frontend'],
      });
      this.emitEvent(eventSubject, { type: 'workflow_completed', taskId });

      eventSubject.complete();
    } catch (error) {
      this.logger.error(`Workflow error for task ${taskId}:`, error);
      eventSubject.error(error);
    } finally {
      this.eventStreams.delete(taskId);
    }
  }

  /**
   * Update task status
   */
  private updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    updates: Partial<StoredTask> = {}
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;
    task.updatedAt = new Date();
    Object.assign(task, updates);
  }

  /**
   * Emit event to stream
   */
  private emitEvent(
    subject: Subject<MessageEvent>,
    data: Record<string, unknown>
  ): void {
    subject.next({
      data: JSON.stringify(data),
    } as MessageEvent);
  }

  /**
   * Map stored task to response
   */
  private mapToResponse(task: StoredTask): TaskResponse {
    return {
      id: task.id,
      projectId: task.projectId,
      tenantId: task.tenantId,
      prompt: task.prompt,
      status: task.status,
      analysis: task.analysis,
      currentAgent: task.currentAgent,
      completedAgents: task.completedAgents,
      error: task.error,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  /**
   * Sleep helper for simulation
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
