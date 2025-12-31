/**
 * Recovery Manager
 *
 * Handles state recovery and workflow replay from checkpoints.
 */

import type {
  Checkpoint,
  RecoveryOptions,
  RecoveryResult,
} from './types.js';
import { RecoveryOptionsSchema } from './types.js';
import { CheckpointManager } from './manager.js';
import {
  RecoveryError,
  CheckpointIntegrityError,
} from './errors.js';

/**
 * Interface for state graph that can be restored
 */
export interface RestorableStateGraph {
  reset(): Promise<void>;
  transitionTo(state: string, trigger: string): Promise<void>;
  recordHistory(entry: {
    state: string;
    enteredAt: Date;
    exitedAt?: Date;
    trigger: string;
  }): void;
  setReplayMode(enabled: boolean): void;
}

/**
 * Interface for agent that can be restored
 */
export interface RestorableAgent {
  restoreState(state: {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    attempts: number;
    tokenUsage?: { input: number; output: number };
  }): Promise<void>;
}

/**
 * Interface for restorable agent registry
 */
export interface RestorableAgentRegistry {
  getAgent(id: string): RestorableAgent | undefined;
}

/**
 * Interface for restorable context manager
 */
export interface RestorableContextManager {
  restore(context: {
    projectId: string;
    sessionId: string;
    taskDescription: string;
    workBreakdown?: Record<string, unknown>;
    lessons: string[];
    decisions: Array<{
      id: string;
      decision: string;
      rationale: string;
      madeAt: string;
    }>;
  }): Promise<void>;
}

/**
 * Recovery Manager implementation
 */
export class RecoveryManager {
  private readonly checkpointManager: CheckpointManager;
  private readonly stateGraph?: RestorableStateGraph;
  private readonly agentRegistry?: RestorableAgentRegistry;
  private readonly contextManager?: RestorableContextManager;

  constructor(
    checkpointManager: CheckpointManager,
    options?: {
      stateGraph?: RestorableStateGraph;
      agentRegistry?: RestorableAgentRegistry;
      contextManager?: RestorableContextManager;
    }
  ) {
    this.checkpointManager = checkpointManager;
    this.stateGraph = options?.stateGraph;
    this.agentRegistry = options?.agentRegistry;
    this.contextManager = options?.contextManager;
  }

  /**
   * Recover from a checkpoint
   */
  async recover(options: RecoveryOptions): Promise<RecoveryResult> {
    // Validate options
    const validated = RecoveryOptionsSchema.parse(options);
    const { checkpointId, skipFailedAgent, resetToState, replayMode, dryRun } = validated;

    const warnings: string[] = [];
    const errors: string[] = [];
    const skippedAgents: string[] = [];

    // Load checkpoint
    const checkpoint = await this.checkpointManager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      return {
        success: false,
        checkpoint: null,
        restoredState: '',
        skippedAgents: [],
        warnings: [],
        errors: [`Checkpoint ${checkpointId} not found`],
      };
    }

    // Validate checkpoint integrity
    try {
      await this.checkpointManager.validateCheckpoint(checkpointId);
    } catch (error) {
      if (error instanceof CheckpointIntegrityError) {
        return {
          success: false,
          checkpoint,
          restoredState: '',
          skippedAgents: [],
          warnings: [],
          errors: ['Checkpoint integrity validation failed'],
        };
      }
      throw error;
    }

    // Check if recovery is possible
    if (!checkpoint.recovery.canResume && !skipFailedAgent && !resetToState) {
      return {
        success: false,
        checkpoint,
        restoredState: '',
        skippedAgents: [],
        warnings: [],
        errors: [
          'Recovery not possible: ' + checkpoint.recovery.blockers.join(', '),
        ],
      };
    }

    // Dry run mode - no actual changes
    if (dryRun) {
      return {
        success: true,
        checkpoint,
        restoredState: resetToState ?? checkpoint.workflow.currentState,
        skippedAgents: [],
        warnings: ['Dry run - no changes made'],
        errors: [],
      };
    }

    try {
      // Determine target state
      const targetState = resetToState ?? checkpoint.workflow.currentState;

      // Restore workflow state
      if (this.stateGraph) {
        await this.restoreWorkflowState(checkpoint, targetState);
      } else {
        warnings.push('No state graph provider - workflow state not restored');
      }

      // Restore agent states
      if (this.agentRegistry) {
        const agentResult = await this.restoreAgentStates(
          checkpoint,
          skipFailedAgent ?? false
        );
        skippedAgents.push(...agentResult.skipped);
        warnings.push(...agentResult.warnings);
      } else {
        warnings.push('No agent registry - agent states not restored');
      }

      // Restore context
      if (this.contextManager) {
        await this.restoreContext(checkpoint);
      } else {
        warnings.push('No context manager - context not restored');
      }

      // Enable replay mode if requested
      if (replayMode && this.stateGraph) {
        this.stateGraph.setReplayMode(true);
        warnings.push('Replay mode enabled - step through with next()');
      }

      return {
        success: true,
        checkpoint,
        restoredState: targetState,
        skippedAgents,
        warnings,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        checkpoint,
        restoredState: '',
        skippedAgents,
        warnings,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Restore workflow state
   */
  private async restoreWorkflowState(
    checkpoint: Checkpoint,
    targetState: string
  ): Promise<void> {
    if (!this.stateGraph) {
      throw new RecoveryError(
        'No state graph provider available',
        checkpoint.id,
        'workflow'
      );
    }

    try {
      // Reset state machine
      await this.stateGraph.reset();

      // Transition to target state
      await this.stateGraph.transitionTo(targetState, 'recovery');

      // Restore state history for context
      for (const historyItem of checkpoint.workflow.stateHistory) {
        this.stateGraph.recordHistory({
          state: historyItem.state,
          enteredAt: new Date(historyItem.enteredAt),
          exitedAt: historyItem.exitedAt
            ? new Date(historyItem.exitedAt)
            : undefined,
          trigger: historyItem.trigger,
        });
      }
    } catch (error) {
      throw new RecoveryError(
        `Failed to restore workflow state: ${error instanceof Error ? error.message : 'Unknown error'}`,
        checkpoint.id,
        'workflow',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Restore agent states
   */
  private async restoreAgentStates(
    checkpoint: Checkpoint,
    skipFailed: boolean
  ): Promise<{ skipped: string[]; warnings: string[] }> {
    const skipped: string[] = [];
    const warnings: string[] = [];

    if (!this.agentRegistry) {
      return { skipped, warnings };
    }

    for (const agentState of checkpoint.agents) {
      const agent = this.agentRegistry.getAgent(agentState.agentId);
      if (!agent) {
        warnings.push(`Agent ${agentState.agentId} not found in registry`);
        continue;
      }

      // Skip failed agents if requested
      if (skipFailed && agentState.status === 'failed') {
        skipped.push(agentState.agentId);
        warnings.push(`Skipping failed agent: ${agentState.agentId}`);
        continue;
      }

      try {
        // Restore agent state (convert running to pending)
        await agent.restoreState({
          status: agentState.status === 'running' ? 'pending' : agentState.status,
          input: agentState.input,
          output: agentState.output,
          attempts: agentState.attempts,
          tokenUsage: agentState.tokenUsage,
        });
      } catch (error) {
        warnings.push(
          `Failed to restore agent ${agentState.agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return { skipped, warnings };
  }

  /**
   * Restore context
   */
  private async restoreContext(checkpoint: Checkpoint): Promise<void> {
    if (!this.contextManager) {
      return;
    }

    try {
      await this.contextManager.restore({
        projectId: checkpoint.context.projectId,
        sessionId: checkpoint.context.sessionId,
        taskDescription: checkpoint.context.taskDescription,
        workBreakdown: checkpoint.context.workBreakdown,
        lessons: checkpoint.context.lessons,
        decisions: checkpoint.context.decisions,
      });
    } catch (error) {
      throw new RecoveryError(
        `Failed to restore context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        checkpoint.id,
        'context',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get recovery status for a checkpoint
   */
  async getRecoveryStatus(checkpointId: string): Promise<{
    canRecover: boolean;
    blockers: string[];
    suggestions: string[];
  }> {
    const checkpoint = await this.checkpointManager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      return {
        canRecover: false,
        blockers: ['Checkpoint not found'],
        suggestions: [],
      };
    }

    const suggestions: string[] = [];

    if (!checkpoint.recovery.canResume) {
      if (
        checkpoint.recovery.blockers.some((b) =>
          b.includes('exceeded retry limit')
        )
      ) {
        suggestions.push('Use skipFailedAgent: true to skip failed agents');
      }
      if (
        checkpoint.recovery.blockers.some(
          (b) => b.includes('ERROR state') || b.includes('ABORTED state')
        )
      ) {
        suggestions.push('Use resetToState to rollback to a previous state');
      }
    }

    return {
      canRecover: checkpoint.recovery.canResume,
      blockers: checkpoint.recovery.blockers,
      suggestions,
    };
  }

  /**
   * List available recovery points
   */
  async listRecoveryPoints(): Promise<
    Array<{
      id: string;
      createdAt: string;
      trigger: string;
      state: string;
      canResume: boolean;
    }>
  > {
    const checkpoints = await this.checkpointManager.listCheckpoints();

    return checkpoints.map((cp) => ({
      id: cp.id,
      createdAt: cp.createdAt,
      trigger: cp.trigger,
      state: cp.workflow.currentState,
      canResume: cp.recovery.canResume,
    }));
  }

  /**
   * Attempt automatic recovery from crash
   */
  async attemptAutoRecovery(): Promise<RecoveryResult | null> {
    const latest = await this.checkpointManager.getLatestCheckpoint();
    if (!latest) {
      return null;
    }

    // Check if recovery is needed (workflow was interrupted)
    if (latest.workflow.currentState === 'COMPLETE') {
      return null;
    }

    return this.recover({
      checkpointId: latest.id,
      skipFailedAgent: false,
    });
  }
}
