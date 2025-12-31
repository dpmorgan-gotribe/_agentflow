/**
 * Checkpoint Triggers
 *
 * Automatic checkpoint creation based on workflow events.
 */

import type { CheckpointTrigger, TriggerConfig } from './types.js';
import { CheckpointManager } from './manager.js';

/**
 * Default trigger configuration
 */
export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  onStateTransition: true,
  onAgentComplete: true,
  onUserApproval: true,
  onError: true,
  beforeDestructive: true,
  destructiveOperations: [
    'git_push',
    'git_force_push',
    'file_delete',
    'database_migrate',
    'deploy',
    'publish',
  ],
};

/**
 * Checkpoint Trigger Manager
 *
 * Automatically creates checkpoints based on workflow events.
 */
export class CheckpointTriggerManager {
  private readonly checkpointManager: CheckpointManager;
  private readonly config: TriggerConfig;
  private enabled: boolean = true;

  constructor(
    checkpointManager: CheckpointManager,
    config: Partial<TriggerConfig> = {}
  ) {
    this.checkpointManager = checkpointManager;
    this.config = { ...DEFAULT_TRIGGER_CONFIG, ...config };
  }

  /**
   * Enable or disable all triggers
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if triggers are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Handle state transition event
   */
  async onStateTransition(
    fromState: string,
    toState: string,
    trigger: string
  ): Promise<void> {
    if (!this.enabled || !this.config.onStateTransition) {
      return;
    }

    await this.createCheckpoint(
      'state_transition',
      `State transition: ${fromState} → ${toState} (${trigger})`
    );
  }

  /**
   * Handle agent completion event
   */
  async onAgentComplete(
    agentId: string,
    success: boolean,
    _result?: unknown
  ): Promise<void> {
    if (!this.enabled || !this.config.onAgentComplete) {
      return;
    }

    const status = success ? 'completed' : 'failed';
    await this.createCheckpoint(
      'agent_complete',
      `Agent ${agentId} ${status}`
    );
  }

  /**
   * Handle user approval event
   */
  async onUserApproval(
    approved: boolean,
    itemType: string,
    itemId: string
  ): Promise<void> {
    if (!this.enabled || !this.config.onUserApproval) {
      return;
    }

    const action = approved ? 'approved' : 'rejected';
    await this.createCheckpoint(
      'user_approval',
      `User ${action} ${itemType}: ${itemId}`
    );
  }

  /**
   * Handle error event
   */
  async onError(error: Error, context: string): Promise<void> {
    if (!this.enabled || !this.config.onError) {
      return;
    }

    await this.createCheckpoint(
      'error_occurred',
      `Error in ${context}: ${error.message}`
    );
  }

  /**
   * Handle destructive operation (returns true to proceed, false to block)
   */
  async beforeDestructiveOperation(
    operation: string,
    target: string
  ): Promise<boolean> {
    if (!this.enabled || !this.config.beforeDestructive) {
      return true;
    }

    if (this.config.destructiveOperations.includes(operation)) {
      await this.createCheckpoint(
        'before_destructive',
        `Before ${operation}: ${target}`
      );
      return true;
    }

    return true;
  }

  /**
   * Create manual checkpoint
   */
  async createManualCheckpoint(reason: string): Promise<void> {
    await this.createCheckpoint('manual', reason);
  }

  /**
   * Create checkpoint with error handling
   */
  private async createCheckpoint(
    trigger: CheckpointTrigger,
    reason: string
  ): Promise<void> {
    try {
      await this.checkpointManager.createCheckpoint(trigger, reason);
    } catch {
      // Silent failure - checkpoint failures should not stop workflow
      // In production, this would log to a monitoring system
    }
  }

  /**
   * Get trigger configuration
   */
  getConfig(): TriggerConfig {
    return { ...this.config };
  }

  /**
   * Update trigger configuration
   */
  updateConfig(updates: Partial<TriggerConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Add destructive operation to tracking list
   */
  addDestructiveOperation(operation: string): void {
    if (!this.config.destructiveOperations.includes(operation)) {
      this.config.destructiveOperations.push(operation);
    }
  }

  /**
   * Remove destructive operation from tracking list
   */
  removeDestructiveOperation(operation: string): void {
    const index = this.config.destructiveOperations.indexOf(operation);
    if (index !== -1) {
      this.config.destructiveOperations.splice(index, 1);
    }
  }
}
