/**
 * CLI Types
 *
 * Shared types for the Aigentflow CLI.
 */

import { z } from 'zod';

/**
 * Execution modes for the CLI
 */
export const ExecutionModes = {
  LOCAL: 'local',
  REMOTE: 'remote',
} as const;

export type ExecutionMode = (typeof ExecutionModes)[keyof typeof ExecutionModes];

export const ExecutionModeSchema = z.enum(['local', 'remote']);

/**
 * Output formats for CLI responses
 */
export const OutputFormats = {
  PRETTY: 'pretty',
  JSON: 'json',
} as const;

export type OutputFormat = (typeof OutputFormats)[keyof typeof OutputFormats];

export const OutputFormatSchema = z.enum(['pretty', 'json']);

/**
 * Task states from the API
 * Matches database task_status enum for 1:1 mapping.
 */
export const TaskStates = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  ORCHESTRATING: 'orchestrating',
  AGENT_WORKING: 'agent_working',
  AWAITING_APPROVAL: 'awaiting_approval',
  COMPLETING: 'completing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABORTED: 'aborted',
} as const;

export type TaskState = (typeof TaskStates)[keyof typeof TaskStates];

export const TaskStateSchema = z.enum([
  'pending',
  'analyzing',
  'orchestrating',
  'agent_working',
  'awaiting_approval',
  'completing',
  'completed',
  'failed',
  'aborted',
]);

/**
 * Agent event types for SSE streaming
 */
export const AgentEventTypes = {
  AGENT_START: 'agent_start',
  AGENT_MESSAGE: 'agent_message',
  AGENT_COMPLETE: 'agent_complete',
  TASK_COMPLETE: 'task_complete',
  APPROVAL_REQUIRED: 'approval_required',
  ERROR: 'error',
} as const;

export type AgentEventType =
  (typeof AgentEventTypes)[keyof typeof AgentEventTypes];

export const AgentEventTypeSchema = z.enum([
  'agent_start',
  'agent_message',
  'agent_complete',
  'task_complete',
  'approval_required',
  'error',
]);

/**
 * Agent event from SSE stream
 */
export const AgentEventSchema = z.object({
  type: AgentEventTypeSchema,
  agentId: z.string().optional(),
  message: z.string().max(100000).optional(),
  artifacts: z
    .array(
      z.object({
        type: z.string(),
        path: z.string(),
      })
    )
    .optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;

/**
 * Task artifact
 */
export const ArtifactSchema = z.object({
  type: z.string(),
  path: z.string(),
  content: z.string().optional(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

/**
 * Pending approval details
 */
export const PendingApprovalSchema = z.object({
  reason: z.string(),
  artifacts: z.array(ArtifactSchema).optional(),
});

export type PendingApproval = z.infer<typeof PendingApprovalSchema>;

/**
 * Task status from API
 */
export const TaskStatusSchema = z.object({
  id: z.string(),
  state: TaskStateSchema,
  prompt: z.string(),
  currentAgent: z.string().optional(),
  artifacts: z.array(ArtifactSchema).optional(),
  pendingApproval: PendingApprovalSchema.optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Create task input
 */
export const CreateTaskInputSchema = z.object({
  prompt: z.string().min(1).max(100000),
  projectPath: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

/**
 * Approval decision
 */
export const ApprovalDecisionSchema = z.object({
  approved: z.boolean(),
  message: z.string().optional(),
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

/**
 * Project types for initialization
 */
export const ProjectTypes = {
  WEB: 'web',
  API: 'api',
  FULLSTACK: 'fullstack',
  LIBRARY: 'library',
} as const;

export type ProjectType = (typeof ProjectTypes)[keyof typeof ProjectTypes];

export const ProjectTypeSchema = z.enum(['web', 'api', 'fullstack', 'library']);

/**
 * Project configuration (stored in .aigentflow.json)
 */
export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  type: ProjectTypeSchema.optional(),
  agents: z.array(z.string()).optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
