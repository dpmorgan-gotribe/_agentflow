# Step 35: BullMQ Background Jobs

> **Checkpoint:** CP5-MESSAGING
> **Step:** 35 of 64
> **Dependencies:** 34-NATS-JETSTREAM, 04-NESTJS-API
> **Estimated Effort:** Medium
> **Priority:** High

---

## Overview

Implement BullMQ for reliable background job processing. BullMQ provides Redis-backed queues with retries, priorities, delays, and rate limiting - ideal for agent execution, long-running tasks, and scheduled operations.

---

## Objectives

1. Set up Redis for BullMQ backend
2. Create NestJS module for queue management
3. Define job queues for different workload types
4. Implement job processors with retry logic
5. Add job monitoring and flow control

---

## Technical Requirements

### 35.1 Redis Configuration

```yaml
# docker-compose.redis.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

volumes:
  redis_data:
```

### 35.2 BullMQ Module

```typescript
// packages/messaging/src/bullmq/bullmq.module.ts
import { Module, Global, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({})
export class BullMQModule {
  static forRoot(): DynamicModule {
    return {
      module: BullMQModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
            connection: {
              host: config.get<string>('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
              password: config.get<string>('REDIS_PASSWORD'),
              db: config.get<number>('REDIS_DB', 0),
            },
            defaultJobOptions: {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 1000,
              },
              removeOnComplete: {
                age: 24 * 60 * 60, // Keep completed jobs for 24 hours
                count: 1000, // Keep last 1000 completed jobs
              },
              removeOnFail: {
                age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
              },
            },
          }),
          inject: [ConfigService],
        }),
        // Register all queues
        BullModule.registerQueue(
          { name: QUEUE_NAMES.AGENT_EXECUTION },
          { name: QUEUE_NAMES.WORKFLOW_ORCHESTRATION },
          { name: QUEUE_NAMES.BACKGROUND_TASKS },
          { name: QUEUE_NAMES.SCHEDULED_JOBS },
          { name: QUEUE_NAMES.NOTIFICATIONS },
        ),
      ],
      providers: [QueueService],
      exports: [BullModule, QueueService],
    };
  }
}
```

### 35.3 Queue Constants

```typescript
// packages/messaging/src/bullmq/queue.constants.ts

export const QUEUE_NAMES = {
  // High-priority agent execution
  AGENT_EXECUTION: 'agent-execution',

  // Workflow orchestration tasks
  WORKFLOW_ORCHESTRATION: 'workflow-orchestration',

  // General background tasks
  BACKGROUND_TASKS: 'background-tasks',

  // Scheduled/cron jobs
  SCHEDULED_JOBS: 'scheduled-jobs',

  // Notifications (email, webhooks)
  NOTIFICATIONS: 'notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Job priorities (lower = higher priority)
export const JOB_PRIORITIES = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
  BACKGROUND: 5,
} as const;

// Job types per queue
export const JOB_TYPES = {
  AGENT_EXECUTION: {
    EXECUTE_AGENT: 'execute-agent',
    SPAWN_SUBAGENT: 'spawn-subagent',
    RESUME_AGENT: 'resume-agent',
  },
  WORKFLOW_ORCHESTRATION: {
    START_WORKFLOW: 'start-workflow',
    EXECUTE_STEP: 'execute-step',
    COMPLETE_WORKFLOW: 'complete-workflow',
    ROLLBACK_WORKFLOW: 'rollback-workflow',
  },
  BACKGROUND_TASKS: {
    GENERATE_REPORT: 'generate-report',
    CLEANUP_OLD_DATA: 'cleanup-old-data',
    SYNC_EXTERNAL: 'sync-external',
    INDEX_CONTENT: 'index-content',
  },
  SCHEDULED_JOBS: {
    DAILY_CLEANUP: 'daily-cleanup',
    HEALTH_CHECK: 'health-check',
    METRICS_AGGREGATE: 'metrics-aggregate',
    RETENTION_ENFORCE: 'retention-enforce',
  },
  NOTIFICATIONS: {
    SEND_EMAIL: 'send-email',
    SEND_WEBHOOK: 'send-webhook',
    SEND_SLACK: 'send-slack',
  },
} as const;
```

### 35.4 Queue Service

```typescript
// packages/messaging/src/bullmq/queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import { QUEUE_NAMES, JOB_PRIORITIES, QueueName } from './queue.constants';
import { v4 as uuidv4 } from 'uuid';

export interface JobData<T = unknown> {
  id: string;
  tenantId: string;
  correlationId?: string;
  type: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

export interface AddJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  repeat?: {
    pattern?: string; // Cron pattern
    every?: number; // Milliseconds
    limit?: number;
  };
  jobId?: string;
  deduplicationId?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Map<QueueName, Queue> = new Map();

  constructor(
    @InjectQueue(QUEUE_NAMES.AGENT_EXECUTION)
    private readonly agentQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WORKFLOW_ORCHESTRATION)
    private readonly workflowQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BACKGROUND_TASKS)
    private readonly backgroundQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SCHEDULED_JOBS)
    private readonly scheduledQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationQueue: Queue,
  ) {
    this.queues.set(QUEUE_NAMES.AGENT_EXECUTION, agentQueue);
    this.queues.set(QUEUE_NAMES.WORKFLOW_ORCHESTRATION, workflowQueue);
    this.queues.set(QUEUE_NAMES.BACKGROUND_TASKS, backgroundQueue);
    this.queues.set(QUEUE_NAMES.SCHEDULED_JOBS, scheduledQueue);
    this.queues.set(QUEUE_NAMES.NOTIFICATIONS, notificationQueue);
  }

  /**
   * Add job to queue
   */
  async addJob<T>(
    queueName: QueueName,
    jobType: string,
    tenantId: string,
    payload: T,
    options: AddJobOptions = {},
  ): Promise<Job<JobData<T>>> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobData: JobData<T> = {
      id: options.jobId || uuidv4(),
      tenantId,
      correlationId: uuidv4(),
      type: jobType,
      payload,
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'api',
      },
    };

    const jobOptions: JobsOptions = {
      priority: options.priority ?? JOB_PRIORITIES.NORMAL,
      delay: options.delay,
      attempts: options.attempts,
      backoff: options.backoff,
      repeat: options.repeat,
      jobId: options.deduplicationId || jobData.id,
    };

    const job = await queue.add(jobType, jobData, jobOptions);
    this.logger.debug(`Added job ${job.id} to ${queueName}`, { jobType, tenantId });

    return job;
  }

  /**
   * Add agent execution job
   */
  async addAgentJob<T>(
    tenantId: string,
    jobType: string,
    payload: T,
    options: AddJobOptions = {},
  ): Promise<Job<JobData<T>>> {
    return this.addJob(
      QUEUE_NAMES.AGENT_EXECUTION,
      jobType,
      tenantId,
      payload,
      {
        priority: JOB_PRIORITIES.HIGH,
        ...options,
      },
    );
  }

  /**
   * Add workflow job
   */
  async addWorkflowJob<T>(
    tenantId: string,
    jobType: string,
    payload: T,
    options: AddJobOptions = {},
  ): Promise<Job<JobData<T>>> {
    return this.addJob(
      QUEUE_NAMES.WORKFLOW_ORCHESTRATION,
      jobType,
      tenantId,
      payload,
      options,
    );
  }

  /**
   * Add background task
   */
  async addBackgroundTask<T>(
    tenantId: string,
    jobType: string,
    payload: T,
    options: AddJobOptions = {},
  ): Promise<Job<JobData<T>>> {
    return this.addJob(
      QUEUE_NAMES.BACKGROUND_TASKS,
      jobType,
      tenantId,
      payload,
      {
        priority: JOB_PRIORITIES.LOW,
        ...options,
      },
    );
  }

  /**
   * Add scheduled job with cron pattern
   */
  async addScheduledJob<T>(
    tenantId: string,
    jobType: string,
    payload: T,
    cronPattern: string,
    options: Omit<AddJobOptions, 'repeat'> = {},
  ): Promise<Job<JobData<T>>> {
    return this.addJob(
      QUEUE_NAMES.SCHEDULED_JOBS,
      jobType,
      tenantId,
      payload,
      {
        ...options,
        repeat: {
          pattern: cronPattern,
        },
      },
    );
  }

  /**
   * Add notification job
   */
  async addNotification<T>(
    tenantId: string,
    jobType: string,
    payload: T,
    options: AddJobOptions = {},
  ): Promise<Job<JobData<T>>> {
    return this.addJob(
      QUEUE_NAMES.NOTIFICATIONS,
      jobType,
      tenantId,
      payload,
      {
        priority: JOB_PRIORITIES.NORMAL,
        attempts: 5, // More retries for notifications
        ...options,
      },
    );
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: QueueName, jobId: string): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    return queue.getJob(jobId);
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.pause();
    this.logger.log(`Paused queue ${queueName}`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.resume();
    this.logger.log(`Resumed queue ${queueName}`);
  }

  /**
   * Remove repeatable job
   */
  async removeRepeatableJob(
    queueName: QueueName,
    jobName: string,
    pattern: string,
  ): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    return queue.removeRepeatableByKey(`${jobName}:::${pattern}`);
  }
}
```

### 35.5 Agent Execution Processor

```typescript
// packages/messaging/src/processors/agent-execution.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_TYPES } from '../bullmq/queue.constants';
import { JobData } from '../bullmq/queue.service';
import { EventPublisherService } from '../publishers/event-publisher.service';

interface ExecuteAgentPayload {
  agentId: string;
  agentType: string;
  input: Record<string, unknown>;
  options?: {
    timeout?: number;
    maxTokens?: number;
  };
}

interface SpawnSubagentPayload {
  parentAgentId: string;
  role: string;
  task: string;
  context?: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.AGENT_EXECUTION, {
  concurrency: 5, // Process 5 agent jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs per duration
    duration: 1000, // Per second
  },
})
export class AgentExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentExecutionProcessor.name);

  constructor(private readonly eventPublisher: EventPublisherService) {
    super();
  }

  async process(job: Job<JobData<unknown>>): Promise<unknown> {
    const { type, payload, tenantId, correlationId } = job.data;

    this.logger.log(`Processing ${type} job ${job.id}`, { tenantId });

    try {
      // Publish started event
      await this.eventPublisher.publishAgentEvent(
        tenantId,
        {
          type: 'agent.started',
          agentId: (payload as ExecuteAgentPayload).agentId || job.id!,
          agentType: type,
          payload: { jobId: job.id },
        },
        correlationId,
      );

      let result: unknown;

      switch (type) {
        case JOB_TYPES.AGENT_EXECUTION.EXECUTE_AGENT:
          result = await this.executeAgent(payload as ExecuteAgentPayload);
          break;

        case JOB_TYPES.AGENT_EXECUTION.SPAWN_SUBAGENT:
          result = await this.spawnSubagent(payload as SpawnSubagentPayload);
          break;

        case JOB_TYPES.AGENT_EXECUTION.RESUME_AGENT:
          result = await this.resumeAgent(payload as ExecuteAgentPayload);
          break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // Publish completed event
      await this.eventPublisher.publishAgentEvent(
        tenantId,
        {
          type: 'agent.completed',
          agentId: (payload as ExecuteAgentPayload).agentId || job.id!,
          agentType: type,
          payload: { jobId: job.id, result },
        },
        correlationId,
      );

      return result;
    } catch (error) {
      // Publish failed event
      await this.eventPublisher.publishAgentEvent(
        tenantId,
        {
          type: 'agent.failed',
          agentId: (payload as ExecuteAgentPayload).agentId || job.id!,
          agentType: type,
          payload: {
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        correlationId,
      );

      throw error;
    }
  }

  private async executeAgent(payload: ExecuteAgentPayload): Promise<unknown> {
    // TODO: Integrate with AIProvider from Step 04f
    this.logger.log(`Executing agent ${payload.agentId}`, {
      agentType: payload.agentType,
    });

    // Placeholder - actual implementation in CP1-AGENT-SYSTEM
    return {
      status: 'completed',
      agentId: payload.agentId,
      output: {},
    };
  }

  private async spawnSubagent(payload: SpawnSubagentPayload): Promise<unknown> {
    this.logger.log(`Spawning subagent for ${payload.role}`, {
      parentAgentId: payload.parentAgentId,
    });

    // Placeholder - actual implementation in CP1-AGENT-SYSTEM
    return {
      status: 'spawned',
      role: payload.role,
    };
  }

  private async resumeAgent(payload: ExecuteAgentPayload): Promise<unknown> {
    this.logger.log(`Resuming agent ${payload.agentId}`);

    // Placeholder - actual implementation in CP1-AGENT-SYSTEM
    return {
      status: 'resumed',
      agentId: payload.agentId,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<JobData<unknown>>) {
    this.logger.log(`Job ${job.id} completed`, { type: job.data.type });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<JobData<unknown>>, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, {
      type: job.data.type,
      attempts: job.attemptsMade,
    });
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job<JobData<unknown>>, progress: number | object) {
    this.logger.debug(`Job ${job.id} progress: ${JSON.stringify(progress)}`);
  }
}
```

### 35.6 Workflow Processor

```typescript
// packages/messaging/src/processors/workflow.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_TYPES } from '../bullmq/queue.constants';
import { JobData } from '../bullmq/queue.service';
import { EventPublisherService } from '../publishers/event-publisher.service';

interface StartWorkflowPayload {
  workflowId: string;
  workflowType: string;
  input: Record<string, unknown>;
}

interface ExecuteStepPayload {
  workflowId: string;
  stepId: string;
  stepType: string;
  input: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.WORKFLOW_ORCHESTRATION, {
  concurrency: 10,
})
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(private readonly eventPublisher: EventPublisherService) {
    super();
  }

  async process(job: Job<JobData<unknown>>): Promise<unknown> {
    const { type, payload, tenantId, correlationId } = job.data;

    this.logger.log(`Processing workflow ${type} job ${job.id}`);

    try {
      // Publish workflow event
      await this.eventPublisher.publishWorkflowEvent(
        tenantId,
        {
          type: type.includes('step') ? 'workflow.step.started' : 'workflow.started',
          workflowId: (payload as StartWorkflowPayload).workflowId,
          stepId: (payload as ExecuteStepPayload).stepId,
          payload: { jobId: job.id },
        },
        correlationId,
      );

      let result: unknown;

      switch (type) {
        case JOB_TYPES.WORKFLOW_ORCHESTRATION.START_WORKFLOW:
          result = await this.startWorkflow(payload as StartWorkflowPayload);
          break;

        case JOB_TYPES.WORKFLOW_ORCHESTRATION.EXECUTE_STEP:
          result = await this.executeStep(payload as ExecuteStepPayload);
          break;

        case JOB_TYPES.WORKFLOW_ORCHESTRATION.COMPLETE_WORKFLOW:
          result = await this.completeWorkflow(payload as StartWorkflowPayload);
          break;

        case JOB_TYPES.WORKFLOW_ORCHESTRATION.ROLLBACK_WORKFLOW:
          result = await this.rollbackWorkflow(payload as StartWorkflowPayload);
          break;

        default:
          throw new Error(`Unknown workflow job type: ${type}`);
      }

      // Publish completion event
      await this.eventPublisher.publishWorkflowEvent(
        tenantId,
        {
          type: type.includes('step') ? 'workflow.step.completed' : 'workflow.completed',
          workflowId: (payload as StartWorkflowPayload).workflowId,
          stepId: (payload as ExecuteStepPayload).stepId,
          payload: { jobId: job.id, result },
        },
        correlationId,
      );

      return result;
    } catch (error) {
      await this.eventPublisher.publishWorkflowEvent(
        tenantId,
        {
          type: 'workflow.failed',
          workflowId: (payload as StartWorkflowPayload).workflowId,
          payload: {
            jobId: job.id,
            error: error instanceof Error ? error.message : String(error),
          },
        },
        correlationId,
      );

      throw error;
    }
  }

  private async startWorkflow(payload: StartWorkflowPayload): Promise<unknown> {
    this.logger.log(`Starting workflow ${payload.workflowId}`);
    // Placeholder - integrates with LangGraph in CP0
    return { status: 'started', workflowId: payload.workflowId };
  }

  private async executeStep(payload: ExecuteStepPayload): Promise<unknown> {
    this.logger.log(`Executing step ${payload.stepId} in workflow ${payload.workflowId}`);
    return { status: 'completed', stepId: payload.stepId };
  }

  private async completeWorkflow(payload: StartWorkflowPayload): Promise<unknown> {
    this.logger.log(`Completing workflow ${payload.workflowId}`);
    return { status: 'completed', workflowId: payload.workflowId };
  }

  private async rollbackWorkflow(payload: StartWorkflowPayload): Promise<unknown> {
    this.logger.log(`Rolling back workflow ${payload.workflowId}`);
    return { status: 'rolled_back', workflowId: payload.workflowId };
  }
}
```

### 35.7 Scheduled Jobs Processor

```typescript
// packages/messaging/src/processors/scheduled.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_TYPES } from '../bullmq/queue.constants';
import { JobData } from '../bullmq/queue.service';

@Processor(QUEUE_NAMES.SCHEDULED_JOBS, {
  concurrency: 2, // Lower concurrency for maintenance jobs
})
export class ScheduledJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledJobsProcessor.name);

  async process(job: Job<JobData<unknown>>): Promise<unknown> {
    const { type, tenantId } = job.data;

    this.logger.log(`Running scheduled job ${type}`);

    switch (type) {
      case JOB_TYPES.SCHEDULED_JOBS.DAILY_CLEANUP:
        return this.dailyCleanup(tenantId);

      case JOB_TYPES.SCHEDULED_JOBS.HEALTH_CHECK:
        return this.healthCheck();

      case JOB_TYPES.SCHEDULED_JOBS.METRICS_AGGREGATE:
        return this.aggregateMetrics(tenantId);

      case JOB_TYPES.SCHEDULED_JOBS.RETENTION_ENFORCE:
        return this.enforceRetention(tenantId);

      default:
        throw new Error(`Unknown scheduled job type: ${type}`);
    }
  }

  private async dailyCleanup(tenantId: string): Promise<unknown> {
    this.logger.log(`Running daily cleanup for tenant ${tenantId}`);
    // Clean up old data, expired sessions, etc.
    return { status: 'cleaned', tenantId };
  }

  private async healthCheck(): Promise<unknown> {
    this.logger.log('Running system health check');
    // Check all service health
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  private async aggregateMetrics(tenantId: string): Promise<unknown> {
    this.logger.log(`Aggregating metrics for tenant ${tenantId}`);
    // Aggregate usage metrics
    return { status: 'aggregated', tenantId };
  }

  private async enforceRetention(tenantId: string): Promise<unknown> {
    this.logger.log(`Enforcing data retention for tenant ${tenantId}`);
    // Delete data past retention period
    return { status: 'enforced', tenantId };
  }
}
```

### 35.8 Job Scheduler Service

```typescript
// packages/messaging/src/bullmq/job-scheduler.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JOB_TYPES } from './queue.constants';

@Injectable()
export class JobSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(private readonly queueService: QueueService) {}

  async onModuleInit(): Promise<void> {
    await this.setupScheduledJobs();
  }

  private async setupScheduledJobs(): Promise<void> {
    // Daily cleanup at 2 AM
    await this.queueService.addScheduledJob(
      'system', // System tenant
      JOB_TYPES.SCHEDULED_JOBS.DAILY_CLEANUP,
      {},
      '0 2 * * *', // Cron: 2 AM daily
      { deduplicationId: 'daily-cleanup' },
    );
    this.logger.log('Scheduled daily cleanup job');

    // Health check every 5 minutes
    await this.queueService.addScheduledJob(
      'system',
      JOB_TYPES.SCHEDULED_JOBS.HEALTH_CHECK,
      {},
      '*/5 * * * *', // Every 5 minutes
      { deduplicationId: 'health-check' },
    );
    this.logger.log('Scheduled health check job');

    // Metrics aggregation every hour
    await this.queueService.addScheduledJob(
      'system',
      JOB_TYPES.SCHEDULED_JOBS.METRICS_AGGREGATE,
      {},
      '0 * * * *', // Every hour
      { deduplicationId: 'metrics-aggregate' },
    );
    this.logger.log('Scheduled metrics aggregation job');

    // Retention enforcement at 3 AM
    await this.queueService.addScheduledJob(
      'system',
      JOB_TYPES.SCHEDULED_JOBS.RETENTION_ENFORCE,
      {},
      '0 3 * * *', // 3 AM daily
      { deduplicationId: 'retention-enforce' },
    );
    this.logger.log('Scheduled retention enforcement job');
  }
}
```

---

## Configuration

```env
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

```typescript
// packages/shared/src/config/redis.config.ts
import { z } from 'zod';

export const redisConfigSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
});

export type RedisConfig = z.infer<typeof redisConfigSchema>;
```

---

## Testing

```typescript
// packages/messaging/src/bullmq/__tests__/queue.service.spec.ts
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueService } from '../queue.service';
import { QUEUE_NAMES } from '../queue.constants';
import { Queue } from 'bullmq';

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
      getJob: jest.fn(),
      getWaitingCount: jest.fn().mockResolvedValue(5),
      getActiveCount: jest.fn().mockResolvedValue(2),
      getCompletedCount: jest.fn().mockResolvedValue(100),
      getFailedCount: jest.fn().mockResolvedValue(3),
      getDelayedCount: jest.fn().mockResolvedValue(1),
      pause: jest.fn(),
      resume: jest.fn(),
    } as unknown as jest.Mocked<Queue>;

    const module = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getQueueToken(QUEUE_NAMES.AGENT_EXECUTION), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_NAMES.WORKFLOW_ORCHESTRATION), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_NAMES.BACKGROUND_TASKS), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_NAMES.SCHEDULED_JOBS), useValue: mockQueue },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  describe('addJob', () => {
    it('should add job to queue with correct data', async () => {
      const result = await service.addAgentJob(
        'tenant-1',
        'execute-agent',
        { agentId: 'agent-1' },
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-agent',
        expect.objectContaining({
          tenantId: 'tenant-1',
          type: 'execute-agent',
          payload: { agentId: 'agent-1' },
        }),
        expect.any(Object),
      );
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await service.getQueueMetrics(QUEUE_NAMES.AGENT_EXECUTION);

      expect(metrics).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });
    });
  });
});
```

---

## Acceptance Criteria

- [ ] Redis running in Docker with persistence
- [ ] BullMQ module integrated with NestJS
- [ ] 5 queues created for different workloads
- [ ] Job processors handling agent execution
- [ ] Scheduled jobs running on cron patterns
- [ ] Job retry logic with exponential backoff
- [ ] Queue metrics exposed for monitoring
- [ ] 90%+ test coverage

---

## Security Considerations

1. **Redis Auth**: Use password authentication in production
2. **TLS**: Enable Redis TLS for encrypted connections
3. **Tenant Isolation**: All jobs include tenantId for RLS
4. **Job Validation**: Validate job payloads with Zod
5. **Rate Limiting**: Use BullMQ limiter to prevent abuse

---

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS BullMQ Module](https://docs.nestjs.com/techniques/queues)
- [Redis Documentation](https://redis.io/docs/)
