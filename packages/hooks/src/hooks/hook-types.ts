/**
 * Hook Types
 *
 * Defines all hook points and their payloads for the agent lifecycle.
 */

import { z } from 'zod';

/**
 * All available hook points in the agent lifecycle
 */
export type HookPoint =
  // Orchestrator lifecycle
  | 'pre_orchestrator'
  | 'post_orchestrator'

  // Agent lifecycle
  | 'pre_agent_select'
  | 'post_agent_select'
  | 'pre_agent_execute'
  | 'post_agent_execute'

  // File operations
  | 'pre_file_write'
  | 'post_file_write'
  | 'pre_file_read'

  // Git operations
  | 'pre_git_commit'
  | 'post_git_commit'
  | 'pre_git_merge'
  | 'post_git_merge'

  // Approval workflow
  | 'pre_approval_request'
  | 'post_approval_response'

  // Learning
  | 'post_lesson_extract'
  | 'pre_lesson_apply'

  // Security
  | 'security_scan'
  | 'compliance_check'

  // Error handling
  | 'on_error'
  | 'on_retry'
  | 'on_escalation';

/**
 * All hook points as array for validation
 */
export const HOOK_POINTS: HookPoint[] = [
  'pre_orchestrator',
  'post_orchestrator',
  'pre_agent_select',
  'post_agent_select',
  'pre_agent_execute',
  'post_agent_execute',
  'pre_file_write',
  'post_file_write',
  'pre_file_read',
  'pre_git_commit',
  'post_git_commit',
  'pre_git_merge',
  'post_git_merge',
  'pre_approval_request',
  'post_approval_response',
  'post_lesson_extract',
  'pre_lesson_apply',
  'security_scan',
  'compliance_check',
  'on_error',
  'on_retry',
  'on_escalation',
];

/**
 * Hook action types
 */
export type HookAction = 'continue' | 'modify' | 'block' | 'skip';

/**
 * Hook result - can modify, block, or pass through
 */
export interface HookResult<T = unknown> {
  action: HookAction;
  data?: T;
  reason?: string;
  warnings?: string[];
}

/**
 * Base hook payload - common fields for all hooks
 */
export interface BaseHookPayload {
  timestamp: Date;
  executionId: string;
  projectId: string;
  tenantId?: string;
}

/**
 * Pre-orchestrator payload
 */
export interface PreOrchestratorPayload extends BaseHookPayload {
  userInput: string;
  sessionContext: Record<string, unknown>;
}

/**
 * Post-orchestrator payload
 */
export interface PostOrchestratorPayload extends BaseHookPayload {
  result: unknown;
  agentsExecuted: string[];
  totalDuration: number;
  success: boolean;
}

/**
 * Pre-agent-select payload
 */
export interface PreAgentSelectPayload extends BaseHookPayload {
  task: Record<string, unknown>;
  suggestedAgents: string[];
  previousOutputs: unknown[];
}

/**
 * Post-agent-select payload
 */
export interface PostAgentSelectPayload extends BaseHookPayload {
  selectedAgent: string;
  reason?: string;
}

/**
 * Pre-agent-execute payload
 */
export interface PreAgentExecutePayload extends BaseHookPayload {
  agentType: string;
  context: Record<string, unknown>;
  task: Record<string, unknown>;
}

/**
 * Post-agent-execute payload
 */
export interface PostAgentExecutePayload extends BaseHookPayload {
  agentType: string;
  output: {
    success: boolean;
    artifacts: unknown[];
    [key: string]: unknown;
  };
  duration: number;
}

/**
 * Pre-file-write payload
 */
export interface PreFileWritePayload extends BaseHookPayload {
  filePath: string;
  content: string;
  agentType: string;
  operation: 'create' | 'update' | 'delete';
}

/**
 * Post-file-write payload
 */
export interface PostFileWritePayload extends BaseHookPayload {
  filePath: string;
  agentType: string;
  operation: 'create' | 'update' | 'delete';
  success: boolean;
}

/**
 * Pre-file-read payload
 */
export interface PreFileReadPayload extends BaseHookPayload {
  filePath: string;
  agentType: string;
}

/**
 * Pre-git-commit payload
 */
export interface PreGitCommitPayload extends BaseHookPayload {
  message: string;
  files: string[];
  branch: string;
  agentType: string;
}

/**
 * Post-git-commit payload
 */
export interface PostGitCommitPayload extends BaseHookPayload {
  commitHash: string;
  message: string;
  files: string[];
  branch: string;
  success: boolean;
}

/**
 * Security scan payload
 */
export interface SecurityScanPayload extends BaseHookPayload {
  content: string;
  contentType: 'code' | 'config' | 'data';
  filePath?: string;
  language?: string;
}

/**
 * Compliance check payload
 */
export interface ComplianceCheckPayload extends BaseHookPayload {
  action: string;
  data: unknown;
  requirements: string[];
}

/**
 * Error payload
 */
export interface ErrorPayload extends BaseHookPayload {
  error: Error;
  agentType?: string;
  context: Record<string, unknown>;
  recoverable: boolean;
}

/**
 * Hook handler function type
 */
export type HookHandler<P extends BaseHookPayload = BaseHookPayload> = (
  payload: P
) => Promise<HookResult>;

/**
 * Hook source type
 */
export type HookSource = 'builtin' | 'plugin' | 'user';

/**
 * Hook registration
 */
export interface HookRegistration {
  id: string;
  point: HookPoint;
  handler: HookHandler;
  priority: number;
  enabled: boolean;
  description: string;
  source: HookSource;
}

/**
 * Hook failure mode
 */
export type HookFailureMode = 'block' | 'warn' | 'ignore';

/**
 * Hook configuration
 */
export interface HookConfig {
  enabled: boolean;
  timeout: number;
  failureMode: HookFailureMode;
  maxRetries: number;
}

/**
 * Zod schema for hook registration validation
 */
export const hookRegistrationSchema = z.object({
  id: z.string().regex(/^[a-z0-9:\-_]+$/i, 'Hook ID must be alphanumeric with colons, dashes, or underscores'),
  point: z.enum(HOOK_POINTS as [HookPoint, ...HookPoint[]]),
  priority: z.number().int().nonnegative(),
  description: z.string().min(5).max(500),
  source: z.enum(['builtin', 'plugin', 'user']),
  enabled: z.boolean().optional().default(true),
});

/**
 * Zod schema for hook config validation
 */
export const hookConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().int().positive().default(5000),
  failureMode: z.enum(['block', 'warn', 'ignore']).default('block'),
  maxRetries: z.number().int().nonnegative().default(0),
});

/**
 * Zod schema for hook result validation
 */
export const hookResultSchema = z.object({
  action: z.enum(['continue', 'modify', 'block', 'skip']),
  data: z.unknown().optional(),
  reason: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

/**
 * Type alias for hook registration input (without handler, for validation)
 */
export type HookRegistrationInput = z.infer<typeof hookRegistrationSchema>;
