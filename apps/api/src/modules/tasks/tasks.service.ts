/**
 * Tasks Service
 *
 * Core orchestration service for task management.
 * Integrates with LangGraph for workflow execution.
 * Uses PostgreSQL when DATABASE_URL is configured, falls back to file storage.
 */

import { Injectable, Logger, OnModuleInit, OnApplicationShutdown, Inject, forwardRef, Optional } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

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
import { DATABASE_TOKEN } from '../database';
import {
  initStorage,
  loadTasks,
  loadAllArtifacts,
  loadAllEvents,
  saveTasks,
  saveArtifacts,
  saveEvents,
  type PersistedTask,
  type PersistedArtifact,
  type PersistedEvent,
} from './file-storage';
import {
  TaskRepository,
  ArtifactRepository,
  type Database,
  type Task as DbTask,
  type NewTask as DbNewTask,
  type Artifact as DbArtifact,
  type NewArtifact as DbNewArtifact,
} from '@aigentflow/database';

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
export class TasksService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TasksService.name);

  // In-memory storage (used when database is not available)
  private readonly tasks = new Map<string, StoredTask>();
  private readonly artifacts = new Map<string, StoredArtifact[]>();

  // SSE event streams (always in-memory for real-time updates)
  private readonly eventStreams = new Map<string, Subject<MessageEvent>>();
  private readonly eventHistory = new Map<string, EventHistoryEntry[]>();

  // File-persisted events (survives server restarts)
  private readonly persistedEvents = new Map<string, PersistedEvent[]>();

  // Keep event history for 5 minutes for replay
  private readonly EVENT_HISTORY_TTL_MS = 5 * 60 * 1000;

  // Database mode flag
  private readonly useDatabase: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WorkflowService))
    private readonly workflowService: WorkflowService,
    @Optional() @Inject(DATABASE_TOKEN) private readonly db: Database | null
  ) {
    this.useDatabase = this.db !== null;
  }

  /**
   * Cleanup on application shutdown
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`TasksService shutting down (signal: ${signal ?? 'unknown'})`);

    // Close all event streams
    for (const [taskId, subject] of this.eventStreams) {
      this.logger.debug(`Closing event stream for task: ${taskId}`);
      subject.complete();
    }
    this.eventStreams.clear();
    this.eventHistory.clear();

    // Persist any pending tasks (only in file mode - database persists immediately)
    if (!this.useDatabase) {
      try {
        await this.persistTasks();
        this.logger.log('Tasks persisted successfully');
      } catch (error) {
        this.logger.error('Failed to persist tasks on shutdown:', error);
      }
    }

    this.logger.log('TasksService shutdown complete');
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('TasksService initializing...');

    if (this.useDatabase) {
      this.logger.log('Using PostgreSQL database for task persistence');
    } else {
      // Initialize file storage and load persisted data only in file mode
      this.logger.log('Using file-based storage (DATABASE_URL not configured)');
      await initStorage();
      await this.loadPersistedData();
    }

    if (this.workflowService.isReady()) {
      this.logger.log('WorkflowService is ready');
    }

    this.logger.log('TasksService initialized');
  }

  /**
   * Load persisted tasks and artifacts from disk
   */
  private async loadPersistedData(): Promise<void> {
    try {
      // Load tasks
      const persistedTasks = await loadTasks();
      for (const [id, persisted] of persistedTasks) {
        this.tasks.set(id, {
          id: persisted.id,
          projectId: persisted.projectId,
          tenantId: persisted.tenantId,
          prompt: persisted.prompt,
          status: persisted.status as TaskStatus,
          priority: persisted.priority,
          analysis: persisted.analysis,
          currentAgent: persisted.currentAgent,
          completedAgents: persisted.completedAgents,
          error: persisted.error,
          metadata: persisted.metadata,
          createdAt: new Date(persisted.createdAt),
          updatedAt: new Date(persisted.updatedAt),
        });
      }

      // Load artifacts
      const persistedArtifacts = await loadAllArtifacts();
      for (const [taskId, artifacts] of persistedArtifacts) {
        this.artifacts.set(
          taskId,
          artifacts.map((a) => ({
            id: a.id,
            taskId: a.taskId,
            type: a.type as ArtifactType,
            name: a.name,
            path: a.path,
            content: a.content,
            createdAt: new Date(a.createdAt),
          }))
        );
      }

      // Load events
      const persistedEvents = await loadAllEvents();
      for (const [taskId, events] of persistedEvents) {
        this.persistedEvents.set(taskId, events);
      }

      this.logger.log(
        `Loaded ${this.tasks.size} tasks, ${this.artifacts.size} artifact groups, and ${this.persistedEvents.size} event groups from disk`
      );
    } catch (error) {
      this.logger.error('Failed to load persisted data:', error);
    }
  }

  /**
   * Persist all tasks to disk
   */
  private async persistTasks(): Promise<void> {
    const persisted = new Map<string, PersistedTask>();
    for (const [id, task] of this.tasks) {
      persisted.set(id, {
        id: task.id,
        projectId: task.projectId,
        tenantId: task.tenantId,
        prompt: task.prompt,
        status: task.status,
        priority: task.priority,
        analysis: task.analysis,
        currentAgent: task.currentAgent,
        completedAgents: task.completedAgents,
        error: task.error,
        metadata: task.metadata,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      });
    }
    await saveTasks(persisted);
  }

  /**
   * Persist artifacts for a task to disk
   */
  private async persistArtifacts(taskId: string): Promise<void> {
    const artifacts = this.artifacts.get(taskId) || [];
    const persisted: PersistedArtifact[] = artifacts.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      type: a.type,
      name: a.name,
      path: a.path,
      content: a.content,
      createdAt: a.createdAt.toISOString(),
    }));
    await saveArtifacts(taskId, persisted);
  }

  /**
   * Create and start a new task
   */
  async create(tenant: TenantContext, input: CreateTaskInput): Promise<TaskResponse> {
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

    let response: TaskResponse;

    if (this.useDatabase) {
      // Database mode: create task in PostgreSQL
      const repo = this.getTaskRepository(tenant.tenantId);
      const dbTask = await repo.create({
        id: taskId,
        tenantId: tenant.tenantId,
        projectId: validated.projectId,
        prompt: validated.prompt,
        type: 'feature', // Default type - could be inferred from analysis later
        status: 'pending',
        completedAgents: [],
        agentQueue: [],
      });
      response = this.mapDbTaskToResponse(dbTask);
    } else {
      // File mode: store in memory + persist to disk
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

      this.tasks.set(taskId, task);
      // Persist with error notification (can't use SSE yet since task just created)
      this.persistTasks().catch((err) => {
        this.logger.error(`Failed to persist task ${taskId}:`, err);
        // Note: SSE stream doesn't exist yet for this task, so we can't emit.
        // The task will still work in-memory but won't survive a restart.
      });
      response = this.mapToResponse(task);
    }

    this.logger.log(`Task created: ${taskId} for tenant: ${tenant.tenantId}`);

    // Start workflow execution in background
    this.executeWorkflow(tenant.tenantId, taskId).catch((error) => {
      this.logger.error(`Workflow execution failed for task ${taskId}:`, error);
      this.updateTaskStatus(taskId, TaskStatus.FAILED, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    return response;
  }

  /**
   * Get task by ID
   */
  async findOne(tenantId: string, taskId: string): Promise<TaskResponse> {
    if (this.useDatabase) {
      const repo = this.getTaskRepository(tenantId);
      const task = await repo.findById(taskId);

      if (!task) {
        throw new NotFoundError(`Task not found: ${taskId}`);
      }

      return this.mapDbTaskToResponse(task);
    }

    // File mode
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
  async getStatus(
    tenantId: string,
    taskId: string
  ): Promise<TaskResponse & {
    pendingApproval: boolean;
    checkpoint?: Record<string, unknown>;
  }> {
    const task = await this.findOne(tenantId, taskId);

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
    return new Observable((subscriber) => {
      // Verify task belongs to tenant (async in database mode)
      const verifyAndStream = async () => {
        try {
          if (this.useDatabase) {
            const repo = this.getTaskRepository(tenantId);
            const task = await repo.findById(taskId);
            if (!task) {
              subscriber.complete();
              return;
            }
          } else {
            const task = this.tasks.get(taskId);
            if (!task || task.tenantId !== tenantId) {
              subscriber.complete();
              return;
            }
          }

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

            // Return cleanup function
            return () => subscription.unsubscribe();
          } else {
            // No active stream, complete after replaying history
            subscriber.complete();
          }
        } catch (error) {
          subscriber.error(error);
        }
      };

      verifyAndStream();
    });
  }

  /**
   * Handle approval/rejection for pending checkpoint
   */
  async handleApproval(
    tenantId: string,
    taskId: string,
    input: ApproveTaskInput
  ): Promise<{ success: boolean }> {
    // Validate input
    const validationResult = approveTaskSchema.safeParse(input);
    if (!validationResult.success) {
      throw new ValidationError('Invalid approval input');
    }

    // Get task and verify status
    const taskResponse = await this.findOne(tenantId, taskId);

    if (taskResponse.status !== TaskStatus.AWAITING_APPROVAL) {
      throw new TaskStateError(
        taskId,
        taskResponse.status,
        TaskStatus.AWAITING_APPROVAL
      );
    }

    const validated = validationResult.data;

    if (validated.approved) {
      this.logger.log(`Task ${taskId} approved, resuming workflow`);
      this.updateTaskStatus(taskId, TaskStatus.AGENT_WORKING);
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
  async abort(tenantId: string, taskId: string): Promise<{ success: boolean }> {
    // Get task and verify tenant ownership
    const taskResponse = await this.findOne(tenantId, taskId);

    // Only allow aborting active tasks
    const abortableStatuses: TaskStatus[] = [
      TaskStatus.PENDING,
      TaskStatus.ANALYZING,
      TaskStatus.ORCHESTRATING,
      TaskStatus.AGENT_WORKING,
      TaskStatus.COMPLETING,
      TaskStatus.AWAITING_APPROVAL,
    ];

    if (!abortableStatuses.includes(taskResponse.status)) {
      throw new TaskStateError(taskId, taskResponse.status, 'an abortable state');
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
   * Abort all running tasks for a project
   *
   * Used when deleting a project to ensure all associated workflows are stopped.
   * Returns the count of tasks that were aborted.
   */
  async abortTasksForProject(projectId: string): Promise<number> {
    const abortableStatuses: TaskStatus[] = [
      TaskStatus.PENDING,
      TaskStatus.ANALYZING,
      TaskStatus.ORCHESTRATING,
      TaskStatus.AGENT_WORKING,
      TaskStatus.COMPLETING,
      TaskStatus.AWAITING_APPROVAL,
    ];

    let abortedCount = 0;

    if (this.useDatabase) {
      // Database mode: find all tasks for project
      const repo = new TaskRepository(this.db!);
      const projectTasks = await repo.findByProject(projectId);

      for (const task of projectTasks) {
        if (abortableStatuses.includes(task.status as TaskStatus)) {
          this.updateTaskStatus(task.id, TaskStatus.ABORTED);

          // Close event stream
          const subject = this.eventStreams.get(task.id);
          if (subject) {
            subject.complete();
            this.eventStreams.delete(task.id);
          }

          abortedCount++;
          this.logger.log(`Task ${task.id} aborted (project deletion)`);
        }
      }
    } else {
      // File mode: iterate in-memory tasks
      for (const task of this.tasks.values()) {
        if (task.projectId === projectId && abortableStatuses.includes(task.status)) {
          this.updateTaskStatus(task.id, TaskStatus.ABORTED);

          // Close event stream
          const subject = this.eventStreams.get(task.id);
          if (subject) {
            subject.complete();
            this.eventStreams.delete(task.id);
          }

          abortedCount++;
          this.logger.log(`Task ${task.id} aborted (project deletion)`);
        }
      }
    }

    this.logger.log(`Aborted ${abortedCount} tasks for project ${projectId}`);
    return abortedCount;
  }

  /**
   * List tasks for tenant
   */
  async findAll(tenantId: string, projectId?: string): Promise<TaskResponse[]> {
    if (this.useDatabase) {
      const repo = this.getTaskRepository(tenantId);
      let dbTasks: DbTask[];

      if (projectId) {
        dbTasks = await repo.findByProject(projectId);
      } else {
        dbTasks = await repo.findByState('pending');
        // Get all tasks by getting each state
        const states: DbTask['status'][] = ['analyzing', 'orchestrating', 'agent_working',
          'awaiting_approval', 'completing', 'completed', 'failed', 'aborted'];
        for (const state of states) {
          const stateTasks = await repo.findByState(state);
          dbTasks.push(...stateTasks);
        }
      }

      return dbTasks.map(t => this.mapDbTaskToResponse(t));
    }

    // File mode
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
  async getArtifacts(tenantId: string, taskId: string): Promise<ArtifactResponse[]> {
    if (this.useDatabase) {
      // Verify task belongs to tenant
      await this.findOne(tenantId, taskId);

      const repo = this.getArtifactRepository(tenantId);
      const dbArtifacts = await repo.findByTaskId(taskId);
      return dbArtifacts.map(a => this.mapDbArtifactToResponse(a));
    }

    // File mode: first verify task belongs to tenant
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
   * Get stored events for a task (for session restoration after page refresh)
   *
   * Returns events from:
   * 1. In-memory event history (if within TTL) - for active sessions
   * 2. File-persisted events - for restoration after server restart
   *
   * This allows the frontend to restore its state after a page refresh
   * or even after a server restart.
   */
  async getStoredEvents(tenantId: string, taskId: string): Promise<unknown[]> {
    // Verify task belongs to tenant
    await this.findOne(tenantId, taskId);

    const history = this.eventHistory.get(taskId) || [];
    const now = Date.now();

    // First, try in-memory history (within TTL)
    const memoryEvents = history
      .filter((entry) => now - entry.timestamp < this.EVENT_HISTORY_TTL_MS)
      .map((entry) => {
        try {
          return JSON.parse(entry.event.data as string);
        } catch {
          return { type: 'unknown', raw: entry.event.data };
        }
      });

    // If we have in-memory events, return them
    if (memoryEvents.length > 0) {
      return memoryEvents;
    }

    // Otherwise, fall back to file-persisted events (only in file mode)
    if (!this.useDatabase) {
      const persisted = this.persistedEvents.get(taskId) || [];
      return persisted.map((e) => e.data);
    }

    return [];
  }

  /**
   * Add an artifact to a task (called by workflow)
   */
  async addArtifact(
    taskId: string,
    artifact: {
      type: ArtifactType;
      name: string;
      path: string;
      content?: string;
    }
  ): Promise<ArtifactResponse> {
    const artifactId = crypto.randomUUID();
    let response: ArtifactResponse;

    if (this.useDatabase) {
      // Database mode
      const repo = new ArtifactRepository(this.db!);
      const dbArtifact = await repo.create({
        id: artifactId,
        taskId,
        type: this.mapApiArtifactTypeToDb(artifact.type),
        filename: artifact.name,
        path: artifact.path,
        content: artifact.content,
        contentSize: artifact.content?.length ?? 0,
        status: 'generated',
      });

      response = this.mapDbArtifactToResponse(dbArtifact);
    } else {
      // File mode
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new NotFoundError(`Task not found: ${taskId}`);
      }

      const stored: StoredArtifact = {
        id: artifactId,
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

      // Persist artifacts to disk with error notification
      this.persistArtifacts(taskId).catch((err) => {
        this.logger.error(`Failed to persist artifacts for task ${taskId}:`, err);
        this.emitPersistenceError(taskId, 'artifact', err);
      });

      response = {
        id: stored.id,
        taskId: stored.taskId,
        type: stored.type,
        name: stored.name,
        path: stored.path,
        content: stored.content,
        createdAt: stored.createdAt.toISOString(),
      };
    }

    this.logger.log(`Artifact added: ${artifactId} (${artifact.type}) to task ${taskId}`);

    // Emit event for artifact
    const eventSubject = this.eventStreams.get(taskId);
    if (eventSubject) {
      this.emitEvent(eventSubject, {
        type: 'artifact_created',
        taskId,
        artifact: {
          id: artifactId,
          type: artifact.type,
          name: artifact.name,
        },
      });
    }

    return response;
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

    // Get task info (for projectId and prompt)
    let projectId: string;
    let prompt: string;

    if (this.useDatabase) {
      const repo = this.getTaskRepository(tenantId);
      const dbTask = await repo.findById(taskId);
      if (!dbTask) {
        this.logger.error(`Task not found for workflow: ${taskId}`);
        return;
      }
      projectId = dbTask.projectId;
      prompt = dbTask.prompt;
    } else {
      const task = this.tasks.get(taskId);
      if (!task) {
        this.logger.error(`Task not found for workflow: ${taskId}`);
        return;
      }
      projectId = task.projectId;
      prompt = task.prompt;
    }

    try {
      // Update status to analyzing
      this.updateTaskStatus(taskId, TaskStatus.ANALYZING);
      this.emitEvent(eventSubject, { type: 'workflow_started', taskId });

      // Start workflow (async) - this creates the event stream synchronously at the start
      // Don't await yet - we subscribe to the stream first
      const resultPromise = this.workflowService.startWorkflow({
        tenantId,
        projectId,
        taskId,
        prompt,
      });

      // Subscribe to WorkflowService events (stream exists after startWorkflow call begins)
      // ReplaySubject buffers events, so we won't miss any even with slight timing differences
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
      } else {
        this.logger.warn(`Workflow stream not found for task ${taskId}`);
      }

      // Now await the workflow result
      const result = await resultPromise;

      // Check if aborted during execution
      const isAborted = await this.isTaskAborted(tenantId, taskId);
      if (isAborted) {
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
   * Check if a task has been aborted
   */
  private async isTaskAborted(tenantId: string, taskId: string): Promise<boolean> {
    if (this.useDatabase) {
      const repo = this.getTaskRepository(tenantId);
      const task = await repo.findById(taskId);
      return !task || task.status === 'aborted';
    }
    const task = this.tasks.get(taskId);
    return !task || task.status === TaskStatus.ABORTED;
  }

  /**
   * Check if a task has been aborted (internal, without tenant check)
   */
  private async isTaskAbortedInternal(taskId: string): Promise<boolean> {
    if (this.useDatabase) {
      // Use repository without tenant filter
      const repo = new TaskRepository(this.db!);
      const task = await repo.findById(taskId);
      return !task || task.status === 'aborted';
    }
    const task = this.tasks.get(taskId);
    return !task || task.status === TaskStatus.ABORTED;
  }

  /**
   * Extract readable event data from workflow stream event
   */
  private extractEventData(streamEvent: { type: string; data: unknown }): Record<string, unknown> {
    const data = streamEvent.data as Record<string, unknown>;

    // Use reasoning field if available for detailed messages
    const reasoning = data.reasoning as string | undefined;

    switch (streamEvent.type) {
      case 'workflow.analyzing':
        return {
          message: reasoning || 'Analyzing task requirements...',
          analysis: data.analysis,
          agentQueue: data.agentQueue,
        };

      case 'workflow.routing':
        return {
          message: reasoning || `Routing to agents: ${(data.agentQueue as string[] || []).join(', ')}`,
          agentQueue: data.agentQueue,
          currentAgent: data.currentAgent,
        };

      case 'workflow.agent_started':
        return {
          message: reasoning || `Starting agent: ${data.agentId}`,
          agent: data.agentId,
          agentId: data.agentId,
          currentAgent: data.agentId,
        };

      case 'workflow.agent_completed':
        return {
          message: reasoning || `Agent completed: ${data.agentId} (${data.success ? 'success' : 'failed'})`,
          agent: data.agentId,
          agentId: data.agentId,
          currentAgent: data.agentId,
          success: data.success,
          artifactCount: data.artifactCount,
          // Include sub-agent activity details for the UI
          activity: data.activity,
        };

      case 'workflow.approval_needed':
        return {
          message: reasoning || 'Awaiting user approval',
          approvalRequest: data.approvalRequest,
        };

      case 'workflow.completed':
        return {
          message: reasoning || `Workflow completed. Agents: ${(data.completedAgents as string[] || []).join(', ')}`,
          completedAgents: data.completedAgents,
          totalArtifacts: data.totalArtifacts,
        };

      case 'workflow.failed':
        return {
          message: reasoning || `Workflow failed: ${data.error}`,
          error: data.error,
          lastAgent: data.lastAgent,
        };

      case 'workflow.error':
        return {
          message: reasoning || `Error: ${data.error}`,
          error: data.error,
        };

      default:
        return { ...data, message: reasoning || JSON.stringify(data).slice(0, 200) };
    }
  }

  /**
   * Update task status
   *
   * Performs database/file updates asynchronously but notifies the client
   * via SSE if persistence fails. This ensures the client knows about
   * state inconsistencies rather than failing silently.
   */
  private updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    updates: Partial<StoredTask> = {}
  ): void {
    if (this.useDatabase) {
      // Database mode: async update with error notification
      const repo = new TaskRepository(this.db!);
      const dbStatus = this.mapApiStatusToDb(status);
      const extra: Parameters<TaskRepository['updateState']>[2] = {
        currentAgent: updates.currentAgent ?? null,
        completedAgents: updates.completedAgents,
      };
      if (updates.error) {
        extra.error = { code: 'WORKFLOW_ERROR', message: updates.error };
      }
      repo.updateState(taskId, dbStatus, extra).catch((err) => {
        this.logger.error(`Failed to update task status in database for ${taskId}:`, err);
        // Notify connected clients about the persistence failure
        this.emitPersistenceError(taskId, 'task_status', err);
      });
      return;
    }

    // File mode
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = status;
    task.updatedAt = new Date();
    Object.assign(task, updates);

    // Persist to disk with error notification
    this.persistTasks().catch((err) => {
      this.logger.error(`Failed to persist task status update for ${taskId}:`, err);
      this.emitPersistenceError(taskId, 'task_status', err);
    });
  }

  /**
   * Emit persistence error to SSE stream
   *
   * Notifies connected clients that a database/file operation failed.
   * This allows the UI to show a warning or trigger a refresh.
   */
  private emitPersistenceError(taskId: string, operation: string, error: unknown): void {
    const eventSubject = this.eventStreams.get(taskId);
    if (eventSubject) {
      this.emitEvent(eventSubject, {
        type: 'persistence_error',
        taskId,
        operation,
        error: error instanceof Error ? error.message : String(error),
        message: `Failed to persist ${operation}. State may be inconsistent. Consider refreshing.`,
      });
    }
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
    const timestamp = Date.now();
    if (taskId) {
      const history = this.eventHistory.get(taskId) || [];
      history.push({ event, timestamp });
      this.eventHistory.set(taskId, history);

      // Also persist to disk for session restoration (only in file mode)
      if (!this.useDatabase) {
        const persistedEvent: PersistedEvent = {
          type: data.type as string,
          taskId,
          timestamp,
          data,
        };
        const existing = this.persistedEvents.get(taskId) || [];
        existing.push(persistedEvent);
        this.persistedEvents.set(taskId, existing);

        // Async persist to disk (don't block)
        saveEvents(taskId, existing).catch((err) => {
          this.logger.error(`Failed to persist events for task ${taskId}:`, err);
        });
      }
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
   * Map database task to API response
   */
  private mapDbTaskToResponse(task: DbTask): TaskResponse {
    return {
      id: task.id,
      projectId: task.projectId,
      tenantId: task.tenantId,
      prompt: task.prompt,
      status: this.mapDbStatusToApi(task.status),
      analysis: task.analysis as unknown as Record<string, unknown> | undefined,
      currentAgent: task.currentAgent ?? undefined,
      completedAgents: task.completedAgents ?? [],
      error: task.error?.message,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  /**
   * Map database status to API status (1:1 mapping)
   */
  private mapDbStatusToApi(dbStatus: DbTask['status']): TaskStatus {
    const statusMap: Record<DbTask['status'], TaskStatus> = {
      pending: TaskStatus.PENDING,
      analyzing: TaskStatus.ANALYZING,
      orchestrating: TaskStatus.ORCHESTRATING,
      agent_working: TaskStatus.AGENT_WORKING,
      awaiting_approval: TaskStatus.AWAITING_APPROVAL,
      completing: TaskStatus.COMPLETING,
      completed: TaskStatus.COMPLETED,
      failed: TaskStatus.FAILED,
      aborted: TaskStatus.ABORTED,
    };
    return statusMap[dbStatus];
  }

  /**
   * Map API status to database status (1:1 mapping)
   */
  private mapApiStatusToDb(apiStatus: TaskStatus): DbTask['status'] {
    const statusMap: Record<TaskStatus, DbTask['status']> = {
      [TaskStatus.PENDING]: 'pending',
      [TaskStatus.ANALYZING]: 'analyzing',
      [TaskStatus.ORCHESTRATING]: 'orchestrating',
      [TaskStatus.AGENT_WORKING]: 'agent_working',
      [TaskStatus.AWAITING_APPROVAL]: 'awaiting_approval',
      [TaskStatus.COMPLETING]: 'completing',
      [TaskStatus.COMPLETED]: 'completed',
      [TaskStatus.FAILED]: 'failed',
      [TaskStatus.ABORTED]: 'aborted',
    };
    return statusMap[apiStatus];
  }

  /**
   * Map API artifact type to database artifact type (1:1 mapping)
   * Legacy aliases are resolved to their canonical forms.
   */
  private mapApiArtifactTypeToDb(apiType: ArtifactType): DbArtifact['type'] {
    // API types now match DB types directly
    // Legacy aliases (STYLESHEET, FLOW, CONFIG) resolve to their canonical values
    return apiType as DbArtifact['type'];
  }

  /**
   * Map database artifact to API response (1:1 mapping)
   */
  private mapDbArtifactToResponse(artifact: DbArtifact): ArtifactResponse {
    return {
      id: artifact.id,
      taskId: artifact.taskId,
      type: artifact.type as ArtifactType,
      name: artifact.filename,
      path: artifact.path,
      content: artifact.content ?? undefined,
      createdAt: artifact.createdAt.toISOString(),
    };
  }

  /**
   * Get TaskRepository for a tenant
   */
  private getTaskRepository(tenantId: string): TaskRepository {
    if (!this.db) {
      throw new Error('Database not configured');
    }
    return new TaskRepository(this.db, tenantId);
  }

  /**
   * Get ArtifactRepository for a tenant
   */
  private getArtifactRepository(tenantId: string): ArtifactRepository {
    if (!this.db) {
      throw new Error('Database not configured');
    }
    return new ArtifactRepository(this.db, tenantId);
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

      // Check if aborted (use internal method without tenant check)
      const isAborted = await this.isTaskAbortedInternal(taskId);
      if (isAborted) {
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
