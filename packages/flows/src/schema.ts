/**
 * User Flow Schema
 *
 * Defines the structure for user flow definitions,
 * states, transitions, and approval metadata.
 *
 * Security features:
 * - Max length constraints on all string fields
 * - Regex validation for IDs (alphanumeric + hyphens)
 * - Bounded arrays to prevent payload abuse
 * - Strict enum types for state transitions
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** Maximum length for flow/step IDs */
export const MAX_ID_LENGTH = 100;

/** Maximum length for names */
export const MAX_NAME_LENGTH = 200;

/** Maximum length for descriptions */
export const MAX_DESCRIPTION_LENGTH = 2000;

/** Maximum length for comments */
export const MAX_COMMENT_LENGTH = 5000;

/** Maximum steps per flow */
export const MAX_STEPS_PER_FLOW = 100;

/** Maximum transitions per flow */
export const MAX_TRANSITIONS_PER_FLOW = 200;

/** Maximum flows per collection */
export const MAX_FLOWS_PER_COLLECTION = 50;

/** Maximum actors per flow */
export const MAX_ACTORS_PER_FLOW = 20;

/** Regex for valid IDs (lowercase alphanumeric with hyphens) */
export const SAFE_ID_REGEX = /^[a-z][a-z0-9-]*$/;

/** Regex for safe content (no control characters) */
export const SAFE_CONTENT_REGEX = /^[^\x00-\x08\x0B\x0C\x0E-\x1F]*$/;

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Validated ID schema with security constraints
 */
export const FlowIdSchema = z
  .string()
  .min(1, 'ID is required')
  .max(MAX_ID_LENGTH, `ID must be at most ${MAX_ID_LENGTH} characters`)
  .regex(SAFE_ID_REGEX, 'ID must start with letter and contain only lowercase alphanumeric and hyphens');

/**
 * Name schema with length limits
 */
export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`)
  .refine((val) => SAFE_CONTENT_REGEX.test(val), 'Name contains invalid characters');

/**
 * Description schema with length limits
 */
export const DescriptionSchema = z
  .string()
  .max(MAX_DESCRIPTION_LENGTH, `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`)
  .refine((val) => SAFE_CONTENT_REGEX.test(val), 'Description contains invalid characters');

/**
 * Comment schema with length limits
 */
export const CommentSchema = z
  .string()
  .max(MAX_COMMENT_LENGTH, `Comment must be at most ${MAX_COMMENT_LENGTH} characters`)
  .refine((val) => SAFE_CONTENT_REGEX.test(val), 'Comment contains invalid characters');

// ============================================================================
// Flow Step Types
// ============================================================================

/**
 * Flow step types
 */
export const FlowStepTypeSchema = z.enum([
  'start', // Entry point
  'end', // Exit point
  'action', // User action
  'decision', // Branching point
  'process', // System process
  'input', // User input
  'display', // Information display
  'wait', // Waiting state
  'error', // Error handling
  'external', // External service call
]);

export type FlowStepType = z.infer<typeof FlowStepTypeSchema>;

// ============================================================================
// Transition Condition
// ============================================================================

/**
 * Transition condition types
 */
export const ConditionTypeSchema = z.enum([
  'success',
  'failure',
  'timeout',
  'cancel',
  'custom',
]);

export type ConditionType = z.infer<typeof ConditionTypeSchema>;

/**
 * Transition condition
 */
export const TransitionConditionSchema = z.object({
  type: ConditionTypeSchema,
  expression: z.string().max(500).optional(),
  label: NameSchema,
});

export type TransitionCondition = z.infer<typeof TransitionConditionSchema>;

// ============================================================================
// Flow Transition
// ============================================================================

/**
 * Flow transition (edge)
 */
export const FlowTransitionSchema = z.object({
  id: FlowIdSchema,
  from: FlowIdSchema,
  to: FlowIdSchema,
  condition: TransitionConditionSchema.optional(),
  label: NameSchema.optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export type FlowTransition = z.infer<typeof FlowTransitionSchema>;

// ============================================================================
// User Action
// ============================================================================

/**
 * User action types
 */
export const UserActionTypeSchema = z.enum([
  'click',
  'input',
  'submit',
  'navigate',
  'drag',
  'select',
  'hover',
]);

export type UserActionType = z.infer<typeof UserActionTypeSchema>;

/**
 * User action within a step
 */
export const UserActionSchema = z.object({
  type: UserActionTypeSchema,
  target: NameSchema,
  description: DescriptionSchema,
  required: z.boolean().default(true),
});

export type UserAction = z.infer<typeof UserActionSchema>;

// ============================================================================
// System Behavior
// ============================================================================

/**
 * System behavior types
 */
export const SystemBehaviorTypeSchema = z.enum([
  'api_call',
  'validation',
  'computation',
  'storage',
  'notification',
]);

export type SystemBehaviorType = z.infer<typeof SystemBehaviorTypeSchema>;

/**
 * System behavior within a step
 */
export const SystemBehaviorSchema = z.object({
  type: SystemBehaviorTypeSchema,
  description: DescriptionSchema,
  async: z.boolean().default(false),
  timeout: z.number().int().min(0).max(300000).optional(), // Max 5 minutes
});

export type SystemBehavior = z.infer<typeof SystemBehaviorSchema>;

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Error handling configuration
 */
export const ErrorHandlingSchema = z.object({
  retryable: z.boolean(),
  fallback: FlowIdSchema.optional(),
  message: DescriptionSchema,
  maxRetries: z.number().int().min(0).max(10).optional(),
});

export type ErrorHandling = z.infer<typeof ErrorHandlingSchema>;

// ============================================================================
// Flow Step
// ============================================================================

/**
 * Flow step (node)
 */
export const FlowStepSchema = z.object({
  id: FlowIdSchema,
  type: FlowStepTypeSchema,
  name: NameSchema,
  description: DescriptionSchema,
  mockupRef: FlowIdSchema.optional(), // Reference to mockup page/component
  userActions: z.array(UserActionSchema).max(20).optional(),
  systemBehaviors: z.array(SystemBehaviorSchema).max(20).optional(),
  validations: z.array(z.string().max(500)).max(20).optional(),
  errorHandling: ErrorHandlingSchema.optional(),
  timeout: z.number().int().min(0).max(300000).optional(), // For wait steps
  metadata: z.record(z.string().max(100), z.unknown()).optional(),
});

export type FlowStep = z.infer<typeof FlowStepSchema>;

// ============================================================================
// Actor
// ============================================================================

/**
 * Actor types
 */
export const ActorTypeSchema = z.enum(['user', 'system', 'external']);

export type ActorType = z.infer<typeof ActorTypeSchema>;

/**
 * Flow actor
 */
export const ActorSchema = z.object({
  id: FlowIdSchema,
  name: NameSchema,
  type: ActorTypeSchema,
});

export type Actor = z.infer<typeof ActorSchema>;

// ============================================================================
// Approval Status
// ============================================================================

/**
 * Approval status
 */
export const ApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'revision_requested',
]);

export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

/**
 * Step comment
 */
export const StepCommentSchema = z.object({
  stepId: FlowIdSchema.optional(),
  author: NameSchema,
  content: CommentSchema,
  timestamp: z.string().datetime(),
});

export type StepComment = z.infer<typeof StepCommentSchema>;

/**
 * Approval metadata
 */
export const ApprovalMetadataSchema = z.object({
  status: ApprovalStatusSchema,
  reviewedBy: NameSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  comments: z.array(StepCommentSchema).max(100).optional(),
  revisionCount: z.number().int().min(0).max(100).default(0),
});

export type ApprovalMetadata = z.infer<typeof ApprovalMetadataSchema>;

// ============================================================================
// User Flow
// ============================================================================

/**
 * Complete user flow definition
 */
export const UserFlowSchema = z.object({
  id: FlowIdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  // Entry and exit
  startStep: FlowIdSchema,
  endSteps: z.array(FlowIdSchema).min(1).max(20),

  // Flow content
  steps: z.array(FlowStepSchema).min(1).max(MAX_STEPS_PER_FLOW),
  transitions: z.array(FlowTransitionSchema).max(MAX_TRANSITIONS_PER_FLOW),

  // Actors
  actors: z.array(ActorSchema).min(1).max(MAX_ACTORS_PER_FLOW),

  // Requirements traceability
  requirements: z.array(z.string().max(200)).max(50).optional(),

  // Approval status
  approval: ApprovalMetadataSchema,

  // Tags for organization
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export type UserFlow = z.infer<typeof UserFlowSchema>;

// ============================================================================
// Flow Collection
// ============================================================================

/**
 * Flow collection (all flows for a feature)
 */
export const FlowCollectionSchema = z.object({
  featureId: FlowIdSchema,
  featureName: NameSchema,
  flows: z.array(UserFlowSchema).max(MAX_FLOWS_PER_COLLECTION),
  generatedAt: z.string().datetime(),
  generatedBy: NameSchema,
});

export type FlowCollection = z.infer<typeof FlowCollectionSchema>;

// ============================================================================
// Approval Decision
// ============================================================================

/**
 * Decision types
 */
export const DecisionTypeSchema = z.enum([
  'approve',
  'reject',
  'request_revision',
]);

export type DecisionType = z.infer<typeof DecisionTypeSchema>;

/**
 * Step-level comment in decision
 */
export const DecisionStepCommentSchema = z.object({
  stepId: FlowIdSchema,
  comment: CommentSchema,
});

export type DecisionStepComment = z.infer<typeof DecisionStepCommentSchema>;

/**
 * Approval decision
 */
export const ApprovalDecisionSchema = z.object({
  flowId: FlowIdSchema,
  decision: DecisionTypeSchema,
  reviewer: NameSchema,
  timestamp: z.string().datetime(),
  comments: CommentSchema.optional(),
  stepComments: z.array(DecisionStepCommentSchema).max(50).optional(),
});

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate a user flow
 */
export function validateUserFlow(
  data: unknown
): z.SafeParseReturnType<unknown, UserFlow> {
  return UserFlowSchema.safeParse(data);
}

/**
 * Validate a flow collection
 */
export function validateFlowCollection(
  data: unknown
): z.SafeParseReturnType<unknown, FlowCollection> {
  return FlowCollectionSchema.safeParse(data);
}

/**
 * Validate an approval decision
 */
export function validateApprovalDecision(
  data: unknown
): z.SafeParseReturnType<unknown, ApprovalDecision> {
  return ApprovalDecisionSchema.safeParse(data);
}

/**
 * Check if a string is a valid flow ID
 */
export function isValidFlowId(id: string): boolean {
  return FlowIdSchema.safeParse(id).success;
}

/**
 * Normalize a string to a valid flow ID
 */
export function normalizeToFlowId(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, MAX_ID_LENGTH);
}
