# Step 37: Agent Pool Scaling

> **Checkpoint:** CP5-MESSAGING
> **Step:** 37 of 64
> **Dependencies:** 34-NATS-JETSTREAM, 35-BULLMQ-JOBS, 36-WEBSOCKET-STREAMING
> **Estimated Effort:** High
> **Priority:** High

---

## Overview

Implement agent pool management for scaling to 15+ concurrent agents per tenant. Includes worker distribution, resource management, rate limiting, and graceful scaling based on workload.

---

## Objectives

1. Create agent worker pool with configurable concurrency
2. Implement resource-based scheduling (CPU, memory, tokens)
3. Add tenant-aware rate limiting and quotas
4. Enable horizontal scaling across worker nodes
5. Provide graceful shutdown and work redistribution

---

## Technical Requirements

### 37.1 Agent Pool Configuration

```typescript
// packages/agents/src/pool/pool.config.ts
import { z } from 'zod';

export const agentPoolConfigSchema = z.object({
  // Pool sizing
  MIN_WORKERS: z.coerce.number().default(2),
  MAX_WORKERS: z.coerce.number().default(15),
  DEFAULT_CONCURRENCY: z.coerce.number().default(5),

  // Per-tenant limits
  MAX_AGENTS_PER_TENANT: z.coerce.number().default(10),
  MAX_CONCURRENT_PER_TENANT: z.coerce.number().default(5),

  // Resource limits
  MAX_TOKENS_PER_MINUTE: z.coerce.number().default(100000),
  MAX_TOKENS_PER_AGENT: z.coerce.number().default(8000),
  AGENT_TIMEOUT_MS: z.coerce.number().default(300000), // 5 min

  // Scaling thresholds
  SCALE_UP_THRESHOLD: z.coerce.number().default(0.8),   // 80% queue utilization
  SCALE_DOWN_THRESHOLD: z.coerce.number().default(0.2), // 20% queue utilization
  SCALE_COOLDOWN_MS: z.coerce.number().default(60000),  // 1 min between scale events

  // Health check
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().default(30000),
  WORKER_HEARTBEAT_TIMEOUT_MS: z.coerce.number().default(60000),
});

export type AgentPoolConfig = z.infer<typeof agentPoolConfigSchema>;
```

### 37.2 Agent Pool Manager

```typescript
// packages/agents/src/pool/agent-pool-manager.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentPoolConfig, agentPoolConfigSchema } from './pool.config';
import { WorkerNode, WorkerStatus } from './worker-node';
import { AgentScheduler } from './agent-scheduler';
import { ResourceMonitor } from './resource-monitor';
import { QueueService } from '@aigentflow/messaging';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface PoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  runningAgents: number;
  queuedAgents: number;
  utilizationPercent: number;
}

interface TenantUsage {
  runningAgents: number;
  queuedAgents: number;
  tokensUsedThisMinute: number;
}

@Injectable()
export class AgentPoolManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentPoolManager.name);
  private readonly config: AgentPoolConfig;
  private workers: Map<string, WorkerNode> = new Map();
  private tenantUsage: Map<string, TenantUsage> = new Map();
  private lastScaleEvent: Date = new Date(0);
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly scheduler: AgentScheduler,
    private readonly resourceMonitor: ResourceMonitor,
    private readonly queueService: QueueService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.config = agentPoolConfigSchema.parse({
      MIN_WORKERS: configService.get('MIN_WORKERS'),
      MAX_WORKERS: configService.get('MAX_WORKERS'),
      DEFAULT_CONCURRENCY: configService.get('DEFAULT_CONCURRENCY'),
      MAX_AGENTS_PER_TENANT: configService.get('MAX_AGENTS_PER_TENANT'),
      MAX_CONCURRENT_PER_TENANT: configService.get('MAX_CONCURRENT_PER_TENANT'),
      MAX_TOKENS_PER_MINUTE: configService.get('MAX_TOKENS_PER_MINUTE'),
      MAX_TOKENS_PER_AGENT: configService.get('MAX_TOKENS_PER_AGENT'),
      AGENT_TIMEOUT_MS: configService.get('AGENT_TIMEOUT_MS'),
      SCALE_UP_THRESHOLD: configService.get('SCALE_UP_THRESHOLD'),
      SCALE_DOWN_THRESHOLD: configService.get('SCALE_DOWN_THRESHOLD'),
      SCALE_COOLDOWN_MS: configService.get('SCALE_COOLDOWN_MS'),
      HEALTH_CHECK_INTERVAL_MS: configService.get('HEALTH_CHECK_INTERVAL_MS'),
      WORKER_HEARTBEAT_TIMEOUT_MS: configService.get('WORKER_HEARTBEAT_TIMEOUT_MS'),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.initializePool();
    this.startHealthChecks();
    this.startMetricsCollection();
    this.logger.log('Agent pool initialized', {
      workers: this.workers.size,
      config: this.config,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Initialize the worker pool with minimum workers
   */
  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.config.MIN_WORKERS; i++) {
      await this.addWorker();
    }
  }

  /**
   * Add a new worker to the pool
   */
  async addWorker(): Promise<WorkerNode> {
    if (this.workers.size >= this.config.MAX_WORKERS) {
      throw new Error('Maximum worker count reached');
    }

    const worker = new WorkerNode({
      concurrency: this.config.DEFAULT_CONCURRENCY,
      timeout: this.config.AGENT_TIMEOUT_MS,
    });

    await worker.start();
    this.workers.set(worker.id, worker);

    // Subscribe worker to agent execution events
    worker.on('agent.started', (data) => {
      this.onAgentStarted(data.tenantId, data.agentId);
    });

    worker.on('agent.completed', (data) => {
      this.onAgentCompleted(data.tenantId, data.agentId, data.tokensUsed);
    });

    worker.on('agent.failed', (data) => {
      this.onAgentFailed(data.tenantId, data.agentId, data.error);
    });

    this.logger.log(`Added worker ${worker.id}`, { totalWorkers: this.workers.size });
    this.eventEmitter.emit('pool.worker.added', { workerId: worker.id });

    return worker;
  }

  /**
   * Remove a worker from the pool
   */
  async removeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    if (this.workers.size <= this.config.MIN_WORKERS) {
      throw new Error('Cannot reduce below minimum worker count');
    }

    await worker.drain(); // Wait for current work to complete
    await worker.stop();
    this.workers.delete(workerId);

    this.logger.log(`Removed worker ${workerId}`, { totalWorkers: this.workers.size });
    this.eventEmitter.emit('pool.worker.removed', { workerId });
  }

  /**
   * Schedule an agent for execution
   */
  async scheduleAgent(
    tenantId: string,
    agentId: string,
    agentType: string,
    input: Record<string, unknown>,
    options: { priority?: number; timeout?: number } = {},
  ): Promise<string> {
    // Check tenant limits
    await this.checkTenantLimits(tenantId);

    // Find best worker
    const worker = this.scheduler.selectWorker(
      Array.from(this.workers.values()),
      tenantId,
      options.priority,
    );

    if (!worker) {
      // Queue for later if no worker available
      const job = await this.queueService.addAgentJob(
        tenantId,
        'execute-agent',
        { agentId, agentType, input, options },
        { priority: options.priority },
      );

      this.updateTenantUsage(tenantId, (usage) => {
        usage.queuedAgents++;
      });

      return job.id!;
    }

    // Execute on selected worker
    const executionId = await worker.execute({
      agentId,
      agentType,
      tenantId,
      input,
      timeout: options.timeout || this.config.AGENT_TIMEOUT_MS,
    });

    return executionId;
  }

  /**
   * Check and enforce tenant limits
   */
  private async checkTenantLimits(tenantId: string): Promise<void> {
    const usage = this.getTenantUsage(tenantId);

    // Check concurrent agent limit
    if (usage.runningAgents >= this.config.MAX_CONCURRENT_PER_TENANT) {
      throw new AgentLimitError(
        `Tenant ${tenantId} has reached maximum concurrent agents (${this.config.MAX_CONCURRENT_PER_TENANT})`,
        'CONCURRENT_LIMIT',
      );
    }

    // Check token rate limit
    if (usage.tokensUsedThisMinute >= this.config.MAX_TOKENS_PER_MINUTE) {
      throw new AgentLimitError(
        `Tenant ${tenantId} has exceeded token rate limit`,
        'TOKEN_RATE_LIMIT',
      );
    }

    // Check total queued + running
    const totalAgents = usage.runningAgents + usage.queuedAgents;
    if (totalAgents >= this.config.MAX_AGENTS_PER_TENANT) {
      throw new AgentLimitError(
        `Tenant ${tenantId} has reached maximum agents (${this.config.MAX_AGENTS_PER_TENANT})`,
        'TOTAL_LIMIT',
      );
    }
  }

  /**
   * Auto-scale based on utilization
   */
  private async autoScale(): Promise<void> {
    const stats = this.getPoolStats();
    const now = new Date();

    // Check cooldown
    if (now.getTime() - this.lastScaleEvent.getTime() < this.config.SCALE_COOLDOWN_MS) {
      return;
    }

    // Scale up if utilization is high
    if (
      stats.utilizationPercent >= this.config.SCALE_UP_THRESHOLD * 100 &&
      this.workers.size < this.config.MAX_WORKERS
    ) {
      await this.addWorker();
      this.lastScaleEvent = now;
      this.logger.log('Scaled up pool', { reason: 'high utilization', stats });
      return;
    }

    // Scale down if utilization is low
    if (
      stats.utilizationPercent <= this.config.SCALE_DOWN_THRESHOLD * 100 &&
      this.workers.size > this.config.MIN_WORKERS
    ) {
      const idleWorker = this.findIdleWorker();
      if (idleWorker) {
        await this.removeWorker(idleWorker.id);
        this.lastScaleEvent = now;
        this.logger.log('Scaled down pool', { reason: 'low utilization', stats });
      }
    }
  }

  private findIdleWorker(): WorkerNode | undefined {
    for (const worker of this.workers.values()) {
      if (worker.getStatus() === WorkerStatus.IDLE) {
        return worker;
      }
    }
    return undefined;
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): PoolStats {
    let activeWorkers = 0;
    let runningAgents = 0;
    let queuedAgents = 0;

    for (const worker of this.workers.values()) {
      if (worker.getStatus() !== WorkerStatus.IDLE) {
        activeWorkers++;
      }
      runningAgents += worker.getRunningCount();
    }

    for (const usage of this.tenantUsage.values()) {
      queuedAgents += usage.queuedAgents;
    }

    const totalCapacity = this.workers.size * this.config.DEFAULT_CONCURRENCY;
    const utilizationPercent =
      totalCapacity > 0 ? (runningAgents / totalCapacity) * 100 : 0;

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      idleWorkers: this.workers.size - activeWorkers,
      runningAgents,
      queuedAgents,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    };
  }

  /**
   * Get tenant-specific usage
   */
  getTenantUsage(tenantId: string): TenantUsage {
    if (!this.tenantUsage.has(tenantId)) {
      this.tenantUsage.set(tenantId, {
        runningAgents: 0,
        queuedAgents: 0,
        tokensUsedThisMinute: 0,
      });
    }
    return this.tenantUsage.get(tenantId)!;
  }

  private updateTenantUsage(
    tenantId: string,
    updater: (usage: TenantUsage) => void,
  ): void {
    const usage = this.getTenantUsage(tenantId);
    updater(usage);
  }

  private onAgentStarted(tenantId: string, agentId: string): void {
    this.updateTenantUsage(tenantId, (usage) => {
      usage.runningAgents++;
      if (usage.queuedAgents > 0) {
        usage.queuedAgents--;
      }
    });

    this.eventEmitter.emit('pool.agent.started', { tenantId, agentId });
  }

  private onAgentCompleted(
    tenantId: string,
    agentId: string,
    tokensUsed: number,
  ): void {
    this.updateTenantUsage(tenantId, (usage) => {
      usage.runningAgents = Math.max(0, usage.runningAgents - 1);
      usage.tokensUsedThisMinute += tokensUsed;
    });

    this.eventEmitter.emit('pool.agent.completed', { tenantId, agentId, tokensUsed });
  }

  private onAgentFailed(
    tenantId: string,
    agentId: string,
    error: Error,
  ): void {
    this.updateTenantUsage(tenantId, (usage) => {
      usage.runningAgents = Math.max(0, usage.runningAgents - 1);
    });

    this.eventEmitter.emit('pool.agent.failed', { tenantId, agentId, error });
  }

  /**
   * Health checks for workers
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const worker of this.workers.values()) {
        if (!worker.isHealthy()) {
          this.logger.warn(`Unhealthy worker detected: ${worker.id}`);

          // Replace unhealthy worker
          try {
            await this.removeWorker(worker.id);
            await this.addWorker();
          } catch (error) {
            this.logger.error(`Failed to replace unhealthy worker ${worker.id}`, error);
          }
        }
      }

      // Run auto-scaling check
      await this.autoScale();
    }, this.config.HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Reset token counters periodically
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      // Reset per-minute token counts
      for (const usage of this.tenantUsage.values()) {
        usage.tokensUsedThisMinute = 0;
      }

      // Emit metrics
      const stats = this.getPoolStats();
      this.eventEmitter.emit('pool.metrics', stats);
    }, 60000); // Every minute
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down agent pool...');

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Drain all workers
    await Promise.all(
      Array.from(this.workers.values()).map((worker) => worker.drain()),
    );

    // Stop all workers
    await Promise.all(
      Array.from(this.workers.values()).map((worker) => worker.stop()),
    );

    this.workers.clear();
    this.logger.log('Agent pool shut down');
  }
}

export class AgentLimitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AgentLimitError';
  }
}
```

### 37.3 Worker Node

```typescript
// packages/agents/src/pool/worker-node.ts
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AIProvider, getAIProvider } from '@aigentflow/core';

export enum WorkerStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  DRAINING = 'draining',
  STOPPED = 'stopped',
}

interface WorkerConfig {
  concurrency: number;
  timeout: number;
}

interface AgentExecution {
  agentId: string;
  agentType: string;
  tenantId: string;
  input: Record<string, unknown>;
  timeout: number;
}

interface RunningExecution {
  id: string;
  agentId: string;
  tenantId: string;
  startedAt: Date;
  abortController: AbortController;
}

export class WorkerNode extends EventEmitter {
  readonly id: string;
  private status: WorkerStatus = WorkerStatus.STOPPED;
  private config: WorkerConfig;
  private runningExecutions: Map<string, RunningExecution> = new Map();
  private lastHeartbeat: Date = new Date();
  private aiProvider: AIProvider;

  constructor(config: WorkerConfig) {
    super();
    this.id = uuidv4();
    this.config = config;
    this.aiProvider = getAIProvider();
  }

  async start(): Promise<void> {
    this.status = WorkerStatus.IDLE;
    this.lastHeartbeat = new Date();
  }

  async stop(): Promise<void> {
    // Abort all running executions
    for (const execution of this.runningExecutions.values()) {
      execution.abortController.abort();
    }
    this.runningExecutions.clear();
    this.status = WorkerStatus.STOPPED;
  }

  async drain(): Promise<void> {
    this.status = WorkerStatus.DRAINING;

    // Wait for all executions to complete
    while (this.runningExecutions.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async execute(execution: AgentExecution): Promise<string> {
    if (this.status === WorkerStatus.STOPPED || this.status === WorkerStatus.DRAINING) {
      throw new Error('Worker is not accepting new executions');
    }

    if (this.runningExecutions.size >= this.config.concurrency) {
      throw new Error('Worker at maximum concurrency');
    }

    const executionId = uuidv4();
    const abortController = new AbortController();

    const runningExecution: RunningExecution = {
      id: executionId,
      agentId: execution.agentId,
      tenantId: execution.tenantId,
      startedAt: new Date(),
      abortController,
    };

    this.runningExecutions.set(executionId, runningExecution);
    this.status = WorkerStatus.RUNNING;

    // Emit started event
    this.emit('agent.started', {
      executionId,
      agentId: execution.agentId,
      tenantId: execution.tenantId,
    });

    // Execute agent asynchronously
    this.executeAgent(executionId, execution, abortController.signal).catch(
      (error) => {
        this.emit('agent.failed', {
          executionId,
          agentId: execution.agentId,
          tenantId: execution.tenantId,
          error,
        });
      },
    );

    return executionId;
  }

  private async executeAgent(
    executionId: string,
    execution: AgentExecution,
    signal: AbortSignal,
  ): Promise<void> {
    const timeoutId = setTimeout(() => {
      const runningExec = this.runningExecutions.get(executionId);
      if (runningExec) {
        runningExec.abortController.abort();
      }
    }, execution.timeout);

    try {
      // Use AI provider to execute agent
      const result = await this.aiProvider.spawnSubagent(
        execution.agentType,
        JSON.stringify(execution.input),
        {
          context: {
            tenantId: execution.tenantId,
            agentId: execution.agentId,
          },
        },
      );

      if (signal.aborted) {
        throw new Error('Execution aborted');
      }

      // Calculate token usage (estimate based on response length)
      const tokensUsed = Math.ceil(
        (result.content?.length || 0) / 4 + (JSON.stringify(execution.input).length / 4),
      );

      this.emit('agent.completed', {
        executionId,
        agentId: execution.agentId,
        tenantId: execution.tenantId,
        result,
        tokensUsed,
      });
    } catch (error) {
      this.emit('agent.failed', {
        executionId,
        agentId: execution.agentId,
        tenantId: execution.tenantId,
        error,
      });
    } finally {
      clearTimeout(timeoutId);
      this.runningExecutions.delete(executionId);

      if (this.runningExecutions.size === 0 && this.status !== WorkerStatus.DRAINING) {
        this.status = WorkerStatus.IDLE;
      }

      this.lastHeartbeat = new Date();
    }
  }

  getStatus(): WorkerStatus {
    return this.status;
  }

  getRunningCount(): number {
    return this.runningExecutions.size;
  }

  getCapacity(): number {
    return this.config.concurrency - this.runningExecutions.size;
  }

  isHealthy(): boolean {
    const now = new Date();
    const heartbeatAge = now.getTime() - this.lastHeartbeat.getTime();

    // Worker is unhealthy if heartbeat is too old
    if (heartbeatAge > 60000) {
      return false;
    }

    // Worker is unhealthy if stopped unexpectedly
    if (this.status === WorkerStatus.STOPPED && this.runningExecutions.size > 0) {
      return false;
    }

    return true;
  }

  getRunningExecutions(): RunningExecution[] {
    return Array.from(this.runningExecutions.values());
  }
}
```

### 37.4 Agent Scheduler

```typescript
// packages/agents/src/pool/agent-scheduler.ts
import { Injectable } from '@nestjs/common';
import { WorkerNode, WorkerStatus } from './worker-node';

export enum SchedulingStrategy {
  LEAST_LOADED = 'least_loaded',
  ROUND_ROBIN = 'round_robin',
  TENANT_AFFINITY = 'tenant_affinity',
}

@Injectable()
export class AgentScheduler {
  private roundRobinIndex = 0;
  private tenantWorkerAffinity: Map<string, string> = new Map();

  /**
   * Select the best worker for a new agent execution
   */
  selectWorker(
    workers: WorkerNode[],
    tenantId: string,
    priority?: number,
  ): WorkerNode | null {
    const availableWorkers = workers.filter(
      (w) =>
        w.getStatus() !== WorkerStatus.STOPPED &&
        w.getStatus() !== WorkerStatus.DRAINING &&
        w.getCapacity() > 0,
    );

    if (availableWorkers.length === 0) {
      return null;
    }

    // High priority jobs use least-loaded strategy
    if (priority && priority <= 2) {
      return this.leastLoaded(availableWorkers);
    }

    // Try tenant affinity first
    const affinityWorker = this.tenantAffinitySelect(availableWorkers, tenantId);
    if (affinityWorker) {
      return affinityWorker;
    }

    // Fall back to least-loaded
    return this.leastLoaded(availableWorkers);
  }

  /**
   * Select worker with most available capacity
   */
  private leastLoaded(workers: WorkerNode[]): WorkerNode {
    return workers.reduce((best, current) =>
      current.getCapacity() > best.getCapacity() ? current : best,
    );
  }

  /**
   * Round-robin selection
   */
  private roundRobin(workers: WorkerNode[]): WorkerNode {
    this.roundRobinIndex = (this.roundRobinIndex + 1) % workers.length;
    return workers[this.roundRobinIndex];
  }

  /**
   * Try to keep a tenant's work on the same worker
   */
  private tenantAffinitySelect(
    workers: WorkerNode[],
    tenantId: string,
  ): WorkerNode | null {
    const affinityWorkerId = this.tenantWorkerAffinity.get(tenantId);

    if (affinityWorkerId) {
      const worker = workers.find((w) => w.id === affinityWorkerId);
      if (worker && worker.getCapacity() > 0) {
        return worker;
      }
    }

    // Assign new affinity
    const worker = this.leastLoaded(workers);
    this.tenantWorkerAffinity.set(tenantId, worker.id);
    return worker;
  }

  /**
   * Clear affinity when worker is removed
   */
  clearWorkerAffinity(workerId: string): void {
    for (const [tenantId, affinity] of this.tenantWorkerAffinity.entries()) {
      if (affinity === workerId) {
        this.tenantWorkerAffinity.delete(tenantId);
      }
    }
  }
}
```

### 37.5 Resource Monitor

```typescript
// packages/agents/src/pool/resource-monitor.ts
import { Injectable, Logger } from '@nestjs/common';
import * as os from 'os';

export interface ResourceUsage {
  cpuPercent: number;
  memoryPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  loadAverage: number[];
}

export interface ResourceLimits {
  maxCpuPercent: number;
  maxMemoryPercent: number;
  criticalThreshold: number;
}

@Injectable()
export class ResourceMonitor {
  private readonly logger = new Logger(ResourceMonitor.name);
  private lastCpuUsage: { idle: number; total: number } | null = null;

  private readonly limits: ResourceLimits = {
    maxCpuPercent: 80,
    maxMemoryPercent: 85,
    criticalThreshold: 95,
  };

  /**
   * Get current resource usage
   */
  getResourceUsage(): ResourceUsage {
    const memoryUsage = this.getMemoryUsage();
    const cpuPercent = this.getCpuPercent();
    const loadAverage = os.loadavg();

    return {
      cpuPercent,
      memoryPercent: memoryUsage.percent,
      memoryUsedMB: memoryUsage.usedMB,
      memoryTotalMB: memoryUsage.totalMB,
      loadAverage,
    };
  }

  private getMemoryUsage(): {
    percent: number;
    usedMB: number;
    totalMB: number;
  } {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      percent: Math.round((usedMemory / totalMemory) * 100),
      usedMB: Math.round(usedMemory / (1024 * 1024)),
      totalMB: Math.round(totalMemory / (1024 * 1024)),
    };
  }

  private getCpuPercent(): number {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }

    if (this.lastCpuUsage) {
      const idleDiff = idle - this.lastCpuUsage.idle;
      const totalDiff = total - this.lastCpuUsage.total;
      const percent = 100 - Math.round((idleDiff / totalDiff) * 100);

      this.lastCpuUsage = { idle, total };
      return Math.max(0, Math.min(100, percent));
    }

    this.lastCpuUsage = { idle, total };
    return 0;
  }

  /**
   * Check if resources are critically low
   */
  isCritical(): boolean {
    const usage = this.getResourceUsage();
    return (
      usage.cpuPercent >= this.limits.criticalThreshold ||
      usage.memoryPercent >= this.limits.criticalThreshold
    );
  }

  /**
   * Check if resources are under pressure
   */
  isUnderPressure(): boolean {
    const usage = this.getResourceUsage();
    return (
      usage.cpuPercent >= this.limits.maxCpuPercent ||
      usage.memoryPercent >= this.limits.maxMemoryPercent
    );
  }

  /**
   * Check if there's capacity for new work
   */
  hasCapacity(): boolean {
    return !this.isUnderPressure();
  }

  /**
   * Get recommended concurrency based on resources
   */
  getRecommendedConcurrency(baseConcurrency: number): number {
    const usage = this.getResourceUsage();

    if (this.isCritical()) {
      // Reduce to minimum
      return Math.max(1, Math.floor(baseConcurrency * 0.25));
    }

    if (this.isUnderPressure()) {
      // Reduce moderately
      return Math.max(1, Math.floor(baseConcurrency * 0.5));
    }

    // Check load average
    const cpuCount = os.cpus().length;
    const loadRatio = usage.loadAverage[0] / cpuCount;

    if (loadRatio > 1.5) {
      return Math.max(1, Math.floor(baseConcurrency * 0.75));
    }

    return baseConcurrency;
  }
}
```

### 37.6 Pool Controller (API Endpoints)

```typescript
// apps/api/src/pool/pool.controller.ts
import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AgentPoolManager } from '@aigentflow/agents';

@Controller('admin/pool')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PoolController {
  constructor(private readonly poolManager: AgentPoolManager) {}

  @Get('stats')
  getStats() {
    return this.poolManager.getPoolStats();
  }

  @Get('workers')
  getWorkers() {
    return this.poolManager.getWorkerDetails();
  }

  @Get('tenants/:tenantId')
  getTenantUsage(@Param('tenantId') tenantId: string) {
    return this.poolManager.getTenantUsage(tenantId);
  }

  @Post('workers')
  @HttpCode(201)
  async addWorker() {
    const worker = await this.poolManager.addWorker();
    return { workerId: worker.id };
  }

  @Delete('workers/:workerId')
  @HttpCode(204)
  async removeWorker(@Param('workerId') workerId: string) {
    await this.poolManager.removeWorker(workerId);
  }
}
```

---

## Configuration

```env
# .env
# Pool sizing
MIN_WORKERS=2
MAX_WORKERS=15
DEFAULT_CONCURRENCY=5

# Tenant limits
MAX_AGENTS_PER_TENANT=10
MAX_CONCURRENT_PER_TENANT=5
MAX_TOKENS_PER_MINUTE=100000
MAX_TOKENS_PER_AGENT=8000

# Timeouts
AGENT_TIMEOUT_MS=300000

# Scaling
SCALE_UP_THRESHOLD=0.8
SCALE_DOWN_THRESHOLD=0.2
SCALE_COOLDOWN_MS=60000
```

---

## Testing

```typescript
// packages/agents/src/pool/__tests__/agent-pool-manager.spec.ts
import { Test } from '@nestjs/testing';
import { AgentPoolManager } from '../agent-pool-manager';
import { AgentScheduler } from '../agent-scheduler';
import { ResourceMonitor } from '../resource-monitor';

describe('AgentPoolManager', () => {
  let poolManager: AgentPoolManager;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentPoolManager,
        AgentScheduler,
        ResourceMonitor,
        // ... mock dependencies
      ],
    }).compile();

    poolManager = module.get<AgentPoolManager>(AgentPoolManager);
  });

  describe('scheduleAgent', () => {
    it('should schedule agent on available worker', async () => {
      // Test implementation
    });

    it('should enforce tenant concurrent limits', async () => {
      // Test that scheduling fails when tenant at limit
    });

    it('should queue when no workers available', async () => {
      // Test queuing behavior
    });
  });

  describe('autoScale', () => {
    it('should scale up when utilization is high', async () => {
      // Test scale up
    });

    it('should scale down when utilization is low', async () => {
      // Test scale down
    });

    it('should respect cooldown period', async () => {
      // Test cooldown
    });
  });
});
```

---

## Acceptance Criteria

- [ ] Worker pool with configurable min/max workers
- [ ] 15 concurrent agents per tenant supported
- [ ] Tenant-aware rate limiting working
- [ ] Auto-scaling based on utilization
- [ ] Graceful shutdown with work completion
- [ ] Health checks replacing unhealthy workers
- [ ] Admin API for pool management
- [ ] 90%+ test coverage

---

## Security Considerations

1. **Tenant Isolation**: Agents cannot access other tenants' data
2. **Resource Limits**: Enforce per-tenant quotas
3. **Rate Limiting**: Token and request rate limits
4. **Audit Logging**: Log all agent executions
5. **Timeout Enforcement**: Prevent runaway agents

---

## Performance Considerations

1. **Worker Affinity**: Keep tenant work on same worker for cache efficiency
2. **Batch Processing**: Queue low-priority work for batch execution
3. **Resource Awareness**: Reduce concurrency under system pressure
4. **Connection Pooling**: Reuse AI provider connections

---

## References

- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [BullMQ Rate Limiting](https://docs.bullmq.io/guide/rate-limiting)
- [Kubernetes HPA Patterns](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
