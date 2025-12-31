/**
 * Task Validation Schemas
 *
 * Zod schemas for task DTOs with security validation.
 */

import { z } from 'zod';

/**
 * Safe string pattern - prevents injection attacks
 */
const safeStringPattern = /^[^<>{}]*$/;

/**
 * Maximum prompt length
 */
const MAX_PROMPT_LENGTH = 50000;

/**
 * Create task request schema
 */
export const createTaskSchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  prompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(
      MAX_PROMPT_LENGTH,
      `Prompt cannot exceed ${MAX_PROMPT_LENGTH} characters`
    )
    .regex(safeStringPattern, 'Prompt contains invalid characters'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  metadata: z
    .record(
      z.string().regex(/^[a-z_][a-z0-9_]*$/i, 'Invalid metadata key'),
      z.string().max(1000).regex(safeStringPattern, 'Invalid metadata value')
    )
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Approve task request schema
 */
export const approveTaskSchema = z.object({
  approved: z.boolean(),
  feedback: z
    .string()
    .max(5000)
    .regex(safeStringPattern, 'Feedback contains invalid characters')
    .optional(),
});

export type ApproveTaskInput = z.infer<typeof approveTaskSchema>;

/**
 * Task status enum
 */
export const TaskStatus = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  EXECUTING: 'executing',
  AWAITING_APPROVAL: 'awaiting_approval',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ABORTED: 'aborted',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

/**
 * Task response schema
 */
export const taskResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  tenantId: z.string().uuid(),
  prompt: z.string(),
  status: z.enum([
    'pending',
    'analyzing',
    'executing',
    'awaiting_approval',
    'completed',
    'failed',
    'aborted',
  ]),
  analysis: z.record(z.unknown()).optional(),
  currentAgent: z.string().optional(),
  completedAgents: z.array(z.string()).optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type TaskResponse = z.infer<typeof taskResponseSchema>;

/**
 * Artifact type enum
 */
export const ArtifactType = {
  MOCKUP: 'mockup',
  STYLESHEET: 'stylesheet',
  FLOW: 'flow',
  SOURCE_FILE: 'source_file',
  TEST_FILE: 'test_file',
  CONFIG: 'config',
  DOCUMENTATION: 'documentation',
} as const;

export type ArtifactType = (typeof ArtifactType)[keyof typeof ArtifactType];

/**
 * Artifact response schema
 */
export const artifactResponseSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  type: z.enum([
    'mockup',
    'stylesheet',
    'flow',
    'source_file',
    'test_file',
    'config',
    'documentation',
  ]),
  name: z.string(),
  path: z.string(),
  content: z.string().optional(),
  createdAt: z.string(),
});

export type ArtifactResponse = z.infer<typeof artifactResponseSchema>;
