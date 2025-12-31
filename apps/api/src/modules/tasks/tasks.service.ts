/**
 * Tasks Service
 *
 * Core orchestration service for task management.
 * Integrates with LangGraph for workflow execution.
 */

import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  approveTaskSchema,
  createTaskSchema,
  TaskStatus,
  ArtifactType,
  type ApproveTaskInput,
  type CreateTaskInput,
  type TaskResponse,
  type ArtifactResponse,
} from './tasks.schema';
import type { TenantContext } from '../../common/guards';
import { ConfigService } from '../../config';
import { NotFoundError, TaskStateError, ValidationError } from '../../errors';
import { WorkflowService } from '../workflow';

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

/**
 * In-memory artifact storage
 */
interface StoredArtifact {
  id: string;
  taskId: string;
  type: ArtifactType;
  name: string;
  path: string;
  content?: string;
  createdAt: Date;
}

/**
 * Event history entry for replay
 */
interface EventHistoryEntry {
  event: MessageEvent;
  timestamp: number;
}

@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);
  private readonly tasks = new Map<string, StoredTask>();
  private readonly artifacts = new Map<string, StoredArtifact[]>();
  private readonly eventStreams = new Map<string, Subject<MessageEvent>>();
  private readonly eventHistory = new Map<string, EventHistoryEntry[]>();

  // Keep event history for 5 minutes for replay
  private readonly EVENT_HISTORY_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService
  ) {}

  onModuleInit(): void {
    this.logger.log('TasksService initialized');
    if (this.workflowService.isReady()) {
      this.logger.log('WorkflowService is ready');
    }
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

    return new Observable((subscriber) => {
      // Replay historical events first
      const history = this.eventHistory.get(taskId) || [];
      const now = Date.now();
      for (const entry of history) {
        // Only replay events within TTL
        if (now - entry.timestamp < this.EVENT_HISTORY_TTL_MS) {
          subscriber.next(entry.event);
        }
      }

      // Subscribe to live events if stream is still active
      const subject = this.eventStreams.get(taskId);
      if (subject) {
        const subscription = subject.subscribe({
          next: (event) => subscriber.next(event),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });

        return () => subscription.unsubscribe();
      } else {
        // No active stream, complete after replaying history
        subscriber.complete();
        return () => {};
      }
    });
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
      // Resume the LangGraph workflow
      this.resumeWorkflowAfterApproval(taskId, true, validated.feedback).catch(
        (error) => {
          this.logger.error(`Failed to resume workflow: ${error.message}`);
        }
      );
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
   * Get artifacts for a task
   */
  getArtifacts(tenantId: string, taskId: string): ArtifactResponse[] {
    // First verify task belongs to tenant
    const task = this.tasks.get(taskId);
    if (!task || task.tenantId !== tenantId) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    const artifacts = this.artifacts.get(taskId) || [];
    return artifacts.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      type: a.type,
      name: a.name,
      path: a.path,
      content: a.content,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /**
   * Add an artifact to a task (called by workflow)
   */
  addArtifact(
    taskId: string,
    artifact: {
      type: ArtifactType;
      name: string;
      path: string;
      content?: string;
    }
  ): ArtifactResponse {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new NotFoundError(`Task not found: ${taskId}`);
    }

    const stored: StoredArtifact = {
      id: crypto.randomUUID(),
      taskId,
      type: artifact.type,
      name: artifact.name,
      path: artifact.path,
      content: artifact.content,
      createdAt: new Date(),
    };

    const existing = this.artifacts.get(taskId) || [];
    existing.push(stored);
    this.artifacts.set(taskId, existing);

    this.logger.log(`Artifact added: ${stored.id} (${artifact.type}) to task ${taskId}`);

    // Emit event for artifact
    const eventSubject = this.eventStreams.get(taskId);
    if (eventSubject) {
      this.emitEvent(eventSubject, {
        type: 'artifact_created',
        taskId,
        artifact: {
          id: stored.id,
          type: stored.type,
          name: stored.name,
        },
      });
    }

    return {
      id: stored.id,
      taskId: stored.taskId,
      type: stored.type,
      name: stored.name,
      path: stored.path,
      content: stored.content,
      createdAt: stored.createdAt.toISOString(),
    };
  }

  /**
   * Execute workflow using LangGraph orchestrator
   */
  private async executeWorkflow(
    tenantId: string,
    taskId: string
  ): Promise<void> {
    const eventSubject = new Subject<MessageEvent>();
    this.eventStreams.set(taskId, eventSubject);

    const task = this.tasks.get(taskId);
    if (!task) {
      this.logger.error(`Task not found for workflow: ${taskId}`);
      return;
    }

    try {
      // Update status to analyzing
      this.updateTaskStatus(taskId, TaskStatus.ANALYZING);
      this.emitEvent(eventSubject, { type: 'workflow_started', taskId });

      // Subscribe to WorkflowService events and forward to our SSE stream
      const workflowStream = this.workflowService.getEventStream(taskId);
      if (workflowStream) {
        workflowStream.subscribe({
          next: (streamEvent) => {
            // Forward workflow events to SSE with more details
            this.emitEvent(eventSubject, {
              type: streamEvent.type,
              taskId,
              timestamp: streamEvent.timestamp,
              ...this.extractEventData(streamEvent),
            });
          },
          error: (err) => {
            this.logger.error(`Workflow stream error: ${err}`);
          },
          complete: () => {
            this.logger.debug(`Workflow stream completed for task ${taskId}`);
          },
        });
      }

      // Execute the real LangGraph workflow
      const result = await this.workflowService.startWorkflow({
        tenantId,
        projectId: task.projectId,
        taskId,
        prompt: task.prompt,
      });

      // Check if aborted during execution
      const currentTask = this.tasks.get(taskId);
      if (!currentTask || currentTask.status === TaskStatus.ABORTED) {
        return;
      }

      // Update task based on workflow result
      if (result.status === 'awaiting_approval' && result.pendingApproval) {
        this.updateTaskStatus(taskId, TaskStatus.AWAITING_APPROVAL, {
          currentAgent: result.completedAgents[result.completedAgents.length - 1],
          completedAgents: result.completedAgents,
        });
        this.emitEvent(eventSubject, {
          type: 'approval_required',
          taskId,
          request: result.pendingApproval,
        });
        // Don't complete the stream - wait for approval
        return;
      }

      if (result.status === 'completed') {
        this.updateTaskStatus(taskId, TaskStatus.COMPLETED, {
          currentAgent: undefined,
          completedAgents: result.completedAgents,
        });
        this.emitEvent(eventSubject, { type: 'workflow_completed', taskId });
      } else if (result.status === 'failed') {
        this.updateTaskStatus(taskId, TaskStatus.FAILED, {
          error: result.error,
          currentAgent: undefined,
        });
        this.emitEvent(eventSubject, { type: 'workflow_failed', taskId, error: result.error });
      }

      eventSubject.complete();
    } catch (error) {
      this.logger.error(`Workflow error for task ${taskId}:`, error);
      this.updateTaskStatus(taskId, TaskStatus.FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
      this.emitEvent(eventSubject, {
        type: 'workflow_failed',
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      eventSubject.error(error);
    } finally {
      this.eventStreams.delete(taskId);
    }
  }

  /**
   * Extract readable event data from workflow stream event
   */
  private extractEventData(streamEvent: { type: string; data: unknown }): Record<string, unknown> {
    const data = streamEvent.data as Record<string, unknown>;

    switch (streamEvent.type) {
      case 'workflow.analyzing':
        return { message: 'Analyzing task requirements...' };

      case 'workflow.routing':
        return {
          message: `Routing to agents: ${(data.agentQueue as string[] || []).join(', ')}`,
          agentQueue: data.agentQueue,
          currentAgent: data.currentAgent,
        };

      case 'workflow.agent_started':
        return {
          message: `Starting agent: ${data.agentId}`,
          agent: data.agentId,
        };

      case 'workflow.agent_completed':
        return {
          message: `Agent completed: ${data.agentId} (${data.success ? 'success' : 'failed'})`,
          agent: data.agentId,
          success: data.success,
          artifactCount: data.artifactCount,
        };

      case 'workflow.approval_needed':
        return {
          message: 'Awaiting user approval',
          approvalRequest: data.approvalRequest,
        };

      case 'workflow.completed':
        return {
          message: `Workflow completed. Agents: ${(data.completedAgents as string[] || []).join(', ')}`,
          completedAgents: data.completedAgents,
          totalArtifacts: data.totalArtifacts,
        };

      case 'workflow.failed':
        return {
          message: `Workflow failed: ${data.error}`,
          error: data.error,
          lastAgent: data.lastAgent,
        };

      case 'workflow.error':
        return {
          message: `Error: ${data.error}`,
          error: data.error,
        };

      default:
        return data;
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
    const event = {
      data: JSON.stringify(data),
    } as MessageEvent;

    // Emit to live subscribers
    subject.next(event);

    // Store in history for replay
    const taskId = data.taskId as string;
    if (taskId) {
      const history = this.eventHistory.get(taskId) || [];
      history.push({ event, timestamp: Date.now() });
      this.eventHistory.set(taskId, history);
    }
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
   * Resume workflow after approval decision
   */
  private async resumeWorkflowAfterApproval(
    taskId: string,
    approved: boolean,
    feedback?: string
  ): Promise<void> {
    const eventSubject = this.eventStreams.get(taskId) || new Subject<MessageEvent>();
    if (!this.eventStreams.has(taskId)) {
      this.eventStreams.set(taskId, eventSubject);
    }

    try {
      const result = await this.workflowService.resumeWithApproval(
        taskId,
        approved,
        feedback
      );

      // Check if aborted
      const currentTask = this.tasks.get(taskId);
      if (!currentTask || currentTask.status === TaskStatus.ABORTED) {
        return;
      }

      // Update task based on result
      if (result.status === 'awaiting_approval' && result.pendingApproval) {
        this.updateTaskStatus(taskId, TaskStatus.AWAITING_APPROVAL, {
          currentAgent: result.completedAgents[result.completedAgents.length - 1],
          completedAgents: result.completedAgents,
        });
        this.emitEvent(eventSubject, {
          type: 'approval_required',
          taskId,
          request: result.pendingApproval,
        });
      } else if (result.status === 'completed') {
        this.updateTaskStatus(taskId, TaskStatus.COMPLETED, {
          currentAgent: undefined,
          completedAgents: result.completedAgents,
        });
        this.emitEvent(eventSubject, { type: 'workflow_completed', taskId });
        eventSubject.complete();
        this.eventStreams.delete(taskId);
      } else if (result.status === 'failed') {
        this.updateTaskStatus(taskId, TaskStatus.FAILED, {
          error: result.error,
          currentAgent: undefined,
        });
        this.emitEvent(eventSubject, { type: 'workflow_failed', taskId, error: result.error });
        eventSubject.complete();
        this.eventStreams.delete(taskId);
      }
    } catch (error) {
      this.logger.error(`Resume workflow failed for task ${taskId}:`, error);
      this.updateTaskStatus(taskId, TaskStatus.FAILED, {
        error: error instanceof Error ? error.message : String(error),
      });
      eventSubject.complete();
      this.eventStreams.delete(taskId);
    }
  }
}
