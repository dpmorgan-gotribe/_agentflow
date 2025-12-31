/**
 * Checkpoint Manager
 *
 * Creates and manages workflow checkpoints with secret redaction
 * and integrity validation.
 */

import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type {
  Checkpoint,
  CheckpointTrigger,
  CheckpointConfig,
  AgentStateSnapshot,
  WorkflowStateSnapshot,
  ContextSnapshot,
  FileSystemSnapshot,
  CheckpointChecksums,
  RecoveryInfo,
} from './types.js';
import { CheckpointSchema, SECRET_PATTERNS } from './types.js';
import { FileCheckpointStore } from './store/file-store.js';
import { CheckpointDisabledError, CheckpointIntegrityError } from './errors.js';

/**
 * Default checkpoint configuration
 */
export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  enabled: true,
  maxCheckpoints: 50,
  compressionType: 'gzip',
  autoCheckpointInterval: 300000, // 5 minutes
  checkpointOnStateTransition: true,
  checkpointOnAgentComplete: true,
  checkpointBeforeDestructive: true,
  retentionDays: 30,
};

/**
 * Interface for state graph provider
 */
export interface StateGraphProvider {
  getState(): {
    current: string;
    previous?: string;
    pendingTransitions?: string[];
  };
  getHistory(): Array<{
    state: string;
    enteredAt: Date;
    exitedAt?: Date;
    trigger: string;
  }>;
}

/**
 * Interface for agent state provider
 */
export interface AgentStateProvider {
  getId(): string;
  getState(): {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startedAt?: Date;
    completedAt?: Date;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: Error;
    attempts: number;
    tokenUsage?: { input: number; output: number };
  };
}

/**
 * Interface for agent registry
 */
export interface AgentRegistry {
  getAllAgents(): AgentStateProvider[];
}

/**
 * Interface for context provider
 */
export interface ContextProvider {
  getFullContext(): {
    projectId: string;
    taskDescription: string;
    workBreakdown?: Record<string, unknown>;
    artifacts: Array<{
      id: string;
      type: string;
      path: string;
      content?: string;
    }>;
    lessons?: string[];
    decisions?: Array<{
      id: string;
      decision: string;
      rationale: string;
      madeAt: Date;
    }>;
  };
}

/**
 * Checkpoint Manager implementation
 */
export class CheckpointManager {
  private readonly config: CheckpointConfig;
  private readonly store: FileCheckpointStore;
  private readonly stateGraphProvider?: StateGraphProvider;
  private readonly agentRegistry?: AgentRegistry;
  private readonly contextProvider?: ContextProvider;
  private intervalTimer?: ReturnType<typeof setInterval>;
  private currentSessionId: string;

  constructor(
    store: FileCheckpointStore,
    config: Partial<CheckpointConfig> = {},
    options?: {
      stateGraphProvider?: StateGraphProvider;
      agentRegistry?: AgentRegistry;
      contextProvider?: ContextProvider;
    }
  ) {
    this.config = { ...DEFAULT_CHECKPOINT_CONFIG, ...config };
    this.store = store;
    this.stateGraphProvider = options?.stateGraphProvider;
    this.agentRegistry = options?.agentRegistry;
    this.contextProvider = options?.contextProvider;
    this.currentSessionId = randomUUID();
  }

  /**
   * Initialize checkpoint manager
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.store.initialize();

    // Start auto-checkpoint interval if configured
    if (this.config.autoCheckpointInterval > 0) {
      this.intervalTimer = setInterval(
        () => {
          this.createCheckpoint('time_interval', 'Periodic checkpoint').catch(() => {
            // Silent failure - don't crash on auto-checkpoint failure
          });
        },
        this.config.autoCheckpointInterval
      );
    }

    // Cleanup old checkpoints
    await this.cleanupExpiredCheckpoints();
  }

  /**
   * Shutdown checkpoint manager
   */
  async shutdown(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }

    if (this.config.enabled) {
      await this.createCheckpoint('manual', 'Shutdown checkpoint');
    }
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    trigger: CheckpointTrigger,
    reason: string
  ): Promise<Checkpoint> {
    if (!this.config.enabled) {
      throw new CheckpointDisabledError();
    }

    const checkpointId = randomUUID();
    const createdAt = new Date().toISOString();

    // Capture all snapshots
    const [workflow, agents, context, fileSystem] = await Promise.all([
      this.captureWorkflowState(),
      this.captureAgentStates(),
      this.captureContext(),
      this.captureFileSystem(),
    ]);

    // Calculate checksums
    const checksums = this.calculateChecksums(workflow, agents, context, fileSystem);

    // Determine recovery capability
    const recovery = this.analyzeRecoveryCapability(workflow, agents);

    const checkpoint: Checkpoint = {
      id: checkpointId,
      version: '1.0.0',
      createdAt,
      trigger,
      triggerReason: reason,
      status: 'valid',
      workflow,
      agents,
      context,
      fileSystem,
      metadata: {
        orchestratorVersion: '1.0.0',
        checkpointSize: 0, // Set by store after serialization
        compressionType: this.config.compressionType,
        checksums,
      },
      recovery,
    };

    // Validate checkpoint before saving
    CheckpointSchema.parse(checkpoint);

    // Store checkpoint
    await this.store.save(checkpoint);

    // Enforce max checkpoints limit
    await this.enforceCheckpointLimit();

    return checkpoint;
  }

  /**
   * Capture workflow state
   */
  private async captureWorkflowState(): Promise<WorkflowStateSnapshot> {
    if (!this.stateGraphProvider) {
      return {
        currentState: 'UNKNOWN',
        previousState: undefined,
        stateHistory: [],
        pendingTransitions: [],
      };
    }

    const state = this.stateGraphProvider.getState();
    const history = this.stateGraphProvider.getHistory();

    return {
      currentState: state.current,
      previousState: state.previous,
      stateHistory: history.map((h) => ({
        state: h.state,
        enteredAt: h.enteredAt.toISOString(),
        exitedAt: h.exitedAt?.toISOString(),
        trigger: h.trigger,
      })),
      pendingTransitions: state.pendingTransitions ?? [],
    };
  }

  /**
   * Capture agent states with secret redaction
   */
  private async captureAgentStates(): Promise<AgentStateSnapshot[]> {
    if (!this.agentRegistry) {
      return [];
    }

    const agents = this.agentRegistry.getAllAgents();
    const snapshots: AgentStateSnapshot[] = [];

    for (const agent of agents) {
      const state = agent.getState();

      // Redact secrets from output
      const redactedOutput = state.output
        ? this.redactSecrets(state.output)
        : undefined;

      snapshots.push({
        agentId: agent.getId(),
        status: state.status,
        startedAt: state.startedAt?.toISOString(),
        completedAt: state.completedAt?.toISOString(),
        input: state.input,
        output: redactedOutput,
        error: state.error?.message,
        attempts: state.attempts,
        tokenUsage: state.tokenUsage,
      });
    }

    return snapshots;
  }

  /**
   * Capture context with secret redaction
   */
  private async captureContext(): Promise<ContextSnapshot> {
    if (!this.contextProvider) {
      return {
        projectId: 'unknown',
        sessionId: this.currentSessionId,
        taskDescription: '',
        workBreakdown: undefined,
        artifacts: [],
        lessons: [],
        decisions: [],
      };
    }

    const context = this.contextProvider.getFullContext();

    // Redact secrets from work breakdown
    const redactedWorkBreakdown = context.workBreakdown
      ? this.redactSecrets(context.workBreakdown)
      : undefined;

    return {
      projectId: context.projectId,
      sessionId: this.currentSessionId,
      taskDescription: context.taskDescription,
      workBreakdown: redactedWorkBreakdown,
      artifacts: context.artifacts.map((a) => ({
        id: a.id,
        type: a.type,
        path: a.path,
        checksum: this.calculateChecksum(a.content ?? ''),
      })),
      lessons: context.lessons ?? [],
      decisions: (context.decisions ?? []).map((d) => ({
        id: d.id,
        decision: d.decision,
        rationale: d.rationale,
        madeAt: d.madeAt.toISOString(),
      })),
    };
  }

  /**
   * Capture file system state
   */
  private async captureFileSystem(): Promise<FileSystemSnapshot> {
    // Basic implementation - can be extended with git integration
    return {
      modifiedFiles: [],
      createdFiles: [],
      deletedFiles: [],
      gitStatus: undefined,
    };
  }

  /**
   * Redact secrets from data
   */
  private redactSecrets<T extends Record<string, unknown>>(data: T): T {
    const json = JSON.stringify(data);
    let redacted = json;

    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }

    return JSON.parse(redacted) as T;
  }

  /**
   * Calculate checksums for all sections
   */
  private calculateChecksums(
    workflow: WorkflowStateSnapshot,
    agents: AgentStateSnapshot[],
    context: ContextSnapshot,
    fileSystem: FileSystemSnapshot
  ): CheckpointChecksums {
    const workflowChecksum = this.calculateChecksum(workflow);
    const agentsChecksum = this.calculateChecksum(agents);
    const contextChecksum = this.calculateChecksum(context);
    const fileSystemChecksum = this.calculateChecksum(fileSystem);

    const overall = this.calculateChecksum({
      workflow: workflowChecksum,
      agents: agentsChecksum,
      context: contextChecksum,
      fileSystem: fileSystemChecksum,
    });

    return {
      workflow: workflowChecksum,
      agents: agentsChecksum,
      context: contextChecksum,
      fileSystem: fileSystemChecksum,
      overall,
    };
  }

  /**
   * Calculate SHA256 checksum (truncated to 16 chars)
   */
  private calculateChecksum(data: unknown): string {
    const json = JSON.stringify(data);
    return createHash('sha256').update(json).digest('hex').substring(0, 16);
  }

  /**
   * Analyze recovery capability
   */
  private analyzeRecoveryCapability(
    workflow: WorkflowStateSnapshot,
    agents: AgentStateSnapshot[]
  ): RecoveryInfo {
    const blockers: string[] = [];
    let canResume = true;
    let resumeFromAgent: string | undefined;
    let resumeFromState: string | undefined;

    // Check for running agents
    const runningAgent = agents.find((a) => a.status === 'running');
    if (runningAgent) {
      blockers.push(`Agent ${runningAgent.agentId} was in progress`);
      resumeFromAgent = runningAgent.agentId;
    }

    // Check for failed agents without retry capability
    const failedAgents = agents.filter(
      (a) => a.status === 'failed' && a.attempts >= 3
    );
    if (failedAgents.length > 0) {
      blockers.push(`${failedAgents.length} agent(s) exceeded retry limit`);
      canResume = false;
    }

    // Check workflow state
    if (
      workflow.currentState === 'ERROR' ||
      workflow.currentState === 'ABORTED'
    ) {
      blockers.push(`Workflow in ${workflow.currentState} state`);
      canResume = false;
    }

    resumeFromState = workflow.currentState;

    return {
      canResume,
      resumeFromAgent,
      resumeFromState,
      blockers,
    };
  }

  /**
   * Enforce checkpoint limit
   */
  private async enforceCheckpointLimit(): Promise<void> {
    const checkpoints = await this.store.list();

    if (checkpoints.length > this.config.maxCheckpoints) {
      // Sort by creation date, oldest first
      const sorted = checkpoints.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Archive oldest checkpoints
      const toArchive = sorted.slice(
        0,
        checkpoints.length - this.config.maxCheckpoints
      );
      for (const checkpoint of toArchive) {
        await this.store.archive(checkpoint.id);
      }
    }
  }

  /**
   * Cleanup expired checkpoints
   */
  private async cleanupExpiredCheckpoints(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    await this.store.deleteOlderThan(cutoffDate);
  }

  /**
   * Get checkpoint by ID
   */
  async getCheckpoint(id: string): Promise<Checkpoint | null> {
    return this.store.get(id);
  }

  /**
   * List all checkpoints
   */
  async listCheckpoints(): Promise<Checkpoint[]> {
    return this.store.list();
  }

  /**
   * Get latest checkpoint
   */
  async getLatestCheckpoint(): Promise<Checkpoint | null> {
    const checkpoints = await this.store.list();
    if (checkpoints.length === 0) return null;

    const sorted = checkpoints.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return sorted[0] ?? null;
  }

  /**
   * Validate checkpoint integrity
   */
  async validateCheckpoint(id: string): Promise<boolean> {
    const checkpoint = await this.store.get(id);
    if (!checkpoint) return false;

    // Recalculate checksums
    const checksums = this.calculateChecksums(
      checkpoint.workflow,
      checkpoint.agents,
      checkpoint.context,
      checkpoint.fileSystem
    );

    // Compare with stored checksums
    const stored = checkpoint.metadata.checksums;
    const isValid =
      checksums.workflow === stored.workflow &&
      checksums.agents === stored.agents &&
      checksums.context === stored.context &&
      checksums.fileSystem === stored.fileSystem &&
      checksums.overall === stored.overall;

    if (!isValid) {
      throw new CheckpointIntegrityError(
        id,
        'Checkpoint integrity validation failed - checksums do not match'
      );
    }

    return true;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.currentSessionId;
  }
}
