/**
 * Checkpoint & Recovery Types
 *
 * Type definitions and Zod schemas for the checkpoint system.
 */

import { z } from 'zod';

/**
 * Checkpoint trigger types
 */
export const CheckpointTriggerSchema = z.enum([
  'state_transition',
  'agent_complete',
  'user_approval',
  'error_occurred',
  'manual',
  'time_interval',
  'before_destructive',
]);

export type CheckpointTrigger = z.infer<typeof CheckpointTriggerSchema>;

/**
 * Checkpoint status
 */
export const CheckpointStatusSchema = z.enum([
  'creating',
  'valid',
  'corrupted',
  'expired',
  'archived',
]);

export type CheckpointStatus = z.infer<typeof CheckpointStatusSchema>;

/**
 * Agent status for checkpoints
 */
export const AgentStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);

export type AgentStatus = z.infer<typeof AgentStatusSchema>;

/**
 * Agent execution state snapshot
 */
export const AgentStateSnapshotSchema = z.object({
  agentId: z.string().min(1),
  status: AgentStatusSchema,
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  attempts: z.number().int().min(0),
  tokenUsage: z.object({
    input: z.number().int().min(0),
    output: z.number().int().min(0),
  }).optional(),
});

export type AgentStateSnapshot = z.infer<typeof AgentStateSnapshotSchema>;

/**
 * State history entry
 */
export const StateHistoryEntrySchema = z.object({
  state: z.string().min(1),
  enteredAt: z.string().datetime(),
  exitedAt: z.string().datetime().optional(),
  trigger: z.string().min(1),
});

export type StateHistoryEntry = z.infer<typeof StateHistoryEntrySchema>;

/**
 * Workflow state snapshot
 */
export const WorkflowStateSnapshotSchema = z.object({
  currentState: z.string().min(1),
  previousState: z.string().optional(),
  stateHistory: z.array(StateHistoryEntrySchema),
  pendingTransitions: z.array(z.string()),
});

export type WorkflowStateSnapshot = z.infer<typeof WorkflowStateSnapshotSchema>;

/**
 * Artifact reference
 */
export const ArtifactRefSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  path: z.string().min(1),
  checksum: z.string().min(1),
});

export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

/**
 * Decision record
 */
export const DecisionRecordSchema = z.object({
  id: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.string(),
  madeAt: z.string().datetime(),
});

export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

/**
 * Context snapshot
 */
export const ContextSnapshotSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  taskDescription: z.string(),
  workBreakdown: z.record(z.unknown()).optional(),
  artifacts: z.array(ArtifactRefSchema),
  lessons: z.array(z.string()),
  decisions: z.array(DecisionRecordSchema),
});

export type ContextSnapshot = z.infer<typeof ContextSnapshotSchema>;

/**
 * Modified file info
 */
export const ModifiedFileSchema = z.object({
  path: z.string().min(1),
  checksum: z.string().min(1),
  size: z.number().int().min(0),
  modifiedAt: z.string().datetime(),
});

export type ModifiedFile = z.infer<typeof ModifiedFileSchema>;

/**
 * Git status info
 */
export const GitStatusSchema = z.object({
  branch: z.string().min(1),
  commitHash: z.string().min(1),
  isDirty: z.boolean(),
  stagedFiles: z.array(z.string()),
  unstagedFiles: z.array(z.string()),
});

export type GitStatus = z.infer<typeof GitStatusSchema>;

/**
 * File system snapshot
 */
export const FileSystemSnapshotSchema = z.object({
  modifiedFiles: z.array(ModifiedFileSchema),
  createdFiles: z.array(z.string()),
  deletedFiles: z.array(z.string()),
  gitStatus: GitStatusSchema.optional(),
});

export type FileSystemSnapshot = z.infer<typeof FileSystemSnapshotSchema>;

/**
 * Checkpoint checksums
 */
export const CheckpointChecksumsSchema = z.object({
  workflow: z.string().min(1),
  agents: z.string().min(1),
  context: z.string().min(1),
  fileSystem: z.string().min(1),
  overall: z.string().min(1),
});

export type CheckpointChecksums = z.infer<typeof CheckpointChecksumsSchema>;

/**
 * Checkpoint metadata
 */
export const CheckpointMetadataSchema = z.object({
  orchestratorVersion: z.string().min(1),
  checkpointSize: z.number().int().min(0),
  compressionType: z.enum(['none', 'gzip', 'lz4']),
  checksums: CheckpointChecksumsSchema,
});

export type CheckpointMetadata = z.infer<typeof CheckpointMetadataSchema>;

/**
 * Recovery info
 */
export const RecoveryInfoSchema = z.object({
  canResume: z.boolean(),
  resumeFromAgent: z.string().optional(),
  resumeFromState: z.string().optional(),
  blockers: z.array(z.string()),
});

export type RecoveryInfo = z.infer<typeof RecoveryInfoSchema>;

/**
 * Complete checkpoint
 */
export const CheckpointSchema = z.object({
  // Identity
  id: z.string().uuid(),
  version: z.string().min(1),
  createdAt: z.string().datetime(),

  // Trigger info
  trigger: CheckpointTriggerSchema,
  triggerReason: z.string(),

  // Status
  status: CheckpointStatusSchema,

  // Snapshots
  workflow: WorkflowStateSnapshotSchema,
  agents: z.array(AgentStateSnapshotSchema),
  context: ContextSnapshotSchema,
  fileSystem: FileSystemSnapshotSchema,

  // Metadata
  metadata: CheckpointMetadataSchema,

  // Recovery info
  recovery: RecoveryInfoSchema,
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;

/**
 * Recovery options
 */
export const RecoveryOptionsSchema = z.object({
  checkpointId: z.string().uuid(),
  skipFailedAgent: z.boolean().optional(),
  resetToState: z.string().max(100).optional(),
  replayMode: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export type RecoveryOptions = z.infer<typeof RecoveryOptionsSchema>;

/**
 * Recovery result
 */
export interface RecoveryResult {
  success: boolean;
  checkpoint: Checkpoint | null;
  restoredState: string;
  skippedAgents: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  /** Enable checkpoint system */
  enabled: boolean;
  /** Maximum number of checkpoints to keep */
  maxCheckpoints: number;
  /** Compression type for storage */
  compressionType: 'none' | 'gzip' | 'lz4';
  /** Auto-checkpoint interval in ms (0 = disabled) */
  autoCheckpointInterval: number;
  /** Create checkpoint on state transition */
  checkpointOnStateTransition: boolean;
  /** Create checkpoint on agent completion */
  checkpointOnAgentComplete: boolean;
  /** Create checkpoint before destructive operations */
  checkpointBeforeDestructive: boolean;
  /** Days to retain checkpoints */
  retentionDays: number;
}

/**
 * Checkpoint store configuration
 */
export interface CheckpointStoreConfig {
  /** Base directory for checkpoint storage */
  basePath: string;
  /** Enable compression */
  compression: boolean;
  /** Enable index for faster lookups */
  indexEnabled: boolean;
  /** Maximum checkpoint size in bytes */
  maxCheckpointSize: number;
  /** Maximum decompressed size in bytes */
  maxDecompressedSize: number;
}

/**
 * Checkpoint index entry
 */
export interface CheckpointIndexEntry {
  id: string;
  createdAt: string;
  trigger: string;
  status: string;
  state: string;
  canResume: boolean;
  size: number;
  path: string;
}

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  onStateTransition: boolean;
  onAgentComplete: boolean;
  onUserApproval: boolean;
  onError: boolean;
  beforeDestructive: boolean;
  destructiveOperations: string[];
}

/**
 * Checkpoint store statistics
 */
export interface CheckpointStoreStats {
  count: number;
  totalSize: number;
  oldestCheckpoint: string | null;
  newestCheckpoint: string | null;
}

/**
 * Secret patterns for redaction
 */
export const SECRET_PATTERNS = [
  // API Keys
  /\b(sk|pk)[-_][a-zA-Z0-9]{20,}\b/g,
  // AWS
  /\bAKIA[0-9A-Z]{16}\b/g,
  /aws[-_]?secret[-_]?access[-_]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  // GitHub
  /\bgh[ps]_[a-zA-Z0-9]{36,}\b/g,
  /github[-_]?token\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  // Generic patterns
  /\bpassword\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\bapi[-_]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\bsecret[-_]?key\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  /\baccess[-_]?token\s*[=:]\s*["']?[^"'\s]+["']?/gi,
  // Database URLs with credentials
  /\b(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/gi,
];

/**
 * Limits for security
 */
export const CHECKPOINT_LIMITS = {
  maxCheckpointSize: 100 * 1024 * 1024, // 100MB
  maxDecompressedSize: 500 * 1024 * 1024, // 500MB
  maxCompressionRatio: 1000,
  maxDepth: 50,
};
