/**
 * @aigentflow/checkpoint
 *
 * Checkpoint and Recovery System for Aigentflow
 *
 * Provides fault tolerance, state persistence, pause/resume capabilities,
 * and crash recovery for orchestration workflows.
 *
 * @example
 * ```typescript
 * import {
 *   CheckpointManager,
 *   RecoveryManager,
 *   CheckpointTriggerManager,
 *   FileCheckpointStore,
 * } from '@aigentflow/checkpoint';
 *
 * // Initialize store and manager
 * const store = new FileCheckpointStore({ basePath: '.checkpoints' });
 * await store.initialize();
 *
 * const checkpointManager = new CheckpointManager(store);
 * await checkpointManager.initialize();
 *
 * // Create checkpoint
 * const checkpoint = await checkpointManager.createCheckpoint(
 *   'manual',
 *   'User-triggered checkpoint'
 * );
 *
 * // Recover from checkpoint
 * const recoveryManager = new RecoveryManager(checkpointManager);
 * const result = await recoveryManager.recover({
 *   checkpointId: checkpoint.id,
 * });
 * ```
 */

// Types and schemas
export {
  // Checkpoint types
  type Checkpoint,
  type CheckpointTrigger,
  type CheckpointStatus,
  type CheckpointConfig,
  type CheckpointMetadata,
  type CheckpointChecksums,
  // Snapshot types
  type AgentStateSnapshot,
  type WorkflowStateSnapshot,
  type ContextSnapshot,
  type FileSystemSnapshot,
  type GitStatus,
  // Recovery types
  type RecoveryInfo,
  type RecoveryOptions,
  type RecoveryResult,
  // Trigger types
  type TriggerConfig,
  // Store types
  type CheckpointStoreConfig,
  type CheckpointIndexEntry,
  type CheckpointStoreStats,
  // Schemas
  CheckpointSchema,
  CheckpointTriggerSchema,
  CheckpointStatusSchema,
  AgentStateSnapshotSchema,
  WorkflowStateSnapshotSchema,
  ContextSnapshotSchema,
  FileSystemSnapshotSchema,
  RecoveryOptionsSchema,
  // Constants
  SECRET_PATTERNS,
  CHECKPOINT_LIMITS,
} from './types.js';

// Errors
export {
  CheckpointError,
  CheckpointIntegrityError,
  CheckpointNotFoundError,
  CheckpointCorruptionError,
  RecoveryError,
  RecoveryBlockedError,
  CheckpointStoreError,
  CheckpointPathError,
  CheckpointSizeError,
  CompressionError,
  CheckpointDisabledError,
} from './errors.js';

// Store
export {
  FileCheckpointStore,
  DEFAULT_STORE_CONFIG,
} from './store/index.js';

// Manager
export {
  CheckpointManager,
  DEFAULT_CHECKPOINT_CONFIG,
  type StateGraphProvider,
  type AgentStateProvider,
  type AgentRegistry,
  type ContextProvider,
} from './manager.js';

// Recovery
export {
  RecoveryManager,
  type RestorableStateGraph,
  type RestorableAgent,
  type RestorableAgentRegistry,
  type RestorableContextManager,
} from './recovery.js';

// Triggers
export {
  CheckpointTriggerManager,
  DEFAULT_TRIGGER_CONFIG,
} from './triggers.js';
