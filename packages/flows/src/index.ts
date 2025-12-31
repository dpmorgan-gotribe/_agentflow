/**
 * @aigentflow/flows
 *
 * User flow definitions, diagram rendering, and approval gates.
 *
 * Features:
 * - Comprehensive flow schema with Zod validation
 * - Flow structure validation (cycles, reachability, type constraints)
 * - Mermaid diagram rendering (flowchart, state, sequence)
 * - Approval gate with timeout handling
 *
 * Security:
 * - Max length constraints on all strings
 * - Regex validation for IDs
 * - XSS prevention in diagram output
 * - Reviewer authorization
 *
 * @packageDocumentation
 */

// Version
export const FLOWS_VERSION = '1.0.0';

// ============================================================================
// Schema Exports
// ============================================================================

export {
  // Constants
  MAX_ID_LENGTH,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_COMMENT_LENGTH,
  MAX_STEPS_PER_FLOW,
  MAX_TRANSITIONS_PER_FLOW,
  MAX_FLOWS_PER_COLLECTION,
  MAX_ACTORS_PER_FLOW,
  SAFE_ID_REGEX,
  SAFE_CONTENT_REGEX,
  // Base schemas
  FlowIdSchema,
  NameSchema,
  DescriptionSchema,
  CommentSchema,
  // Step types
  FlowStepTypeSchema,
  type FlowStepType,
  // Condition
  ConditionTypeSchema,
  type ConditionType,
  TransitionConditionSchema,
  type TransitionCondition,
  // Transition
  FlowTransitionSchema,
  type FlowTransition,
  // User action
  UserActionTypeSchema,
  type UserActionType,
  UserActionSchema,
  type UserAction,
  // System behavior
  SystemBehaviorTypeSchema,
  type SystemBehaviorType,
  SystemBehaviorSchema,
  type SystemBehavior,
  // Error handling
  ErrorHandlingSchema,
  type ErrorHandling,
  // Flow step
  FlowStepSchema,
  type FlowStep,
  // Actor
  ActorTypeSchema,
  type ActorType,
  ActorSchema,
  type Actor,
  // Approval
  ApprovalStatusSchema,
  type ApprovalStatus,
  StepCommentSchema,
  type StepComment,
  ApprovalMetadataSchema,
  type ApprovalMetadata,
  // User flow
  UserFlowSchema,
  type UserFlow,
  // Collection
  FlowCollectionSchema,
  type FlowCollection,
  // Decision
  DecisionTypeSchema,
  type DecisionType,
  DecisionStepCommentSchema,
  type DecisionStepComment,
  ApprovalDecisionSchema,
  type ApprovalDecision,
  // Validation helpers
  validateUserFlow,
  validateFlowCollection,
  validateApprovalDecision,
  isValidFlowId,
  normalizeToFlowId,
} from './schema.js';

// ============================================================================
// Validation Exports
// ============================================================================

export {
  // Types
  type ValidationError,
  type ValidationResult,
  type CycleInfo,
  // Validator class
  FlowValidator,
  // Helper functions
  validateFlow,
  isValidFlow,
  getReachableSteps,
  getStepsReaching,
  getCriticalPath,
  countStepsByType,
  getFlowStats,
} from './validation.js';

// ============================================================================
// Diagram Renderer Exports
// ============================================================================

export {
  // Types
  type DiagramDirection,
  type MermaidTheme,
  type DiagramStyle,
  type DiagramType,
  // Renderer class
  DiagramRenderer,
  // Factory and convenience functions
  createDiagramRenderer,
  renderFlowchart,
  renderStateDiagram,
  renderSequenceDiagram,
  generateFlowHtmlPage,
} from './diagram-renderer.js';

// ============================================================================
// Approval Gate Exports
// ============================================================================

export {
  // Types
  type ApprovalRequest,
  type ApprovalGateEventType,
  type ApprovalGateEvent,
  type ApprovalGateListener,
  type ApprovalStateStore,
  // In-memory store
  InMemoryApprovalStore,
  // Gate class
  ApprovalGate,
  // Factory functions
  createApprovalGate,
  formatApprovalRequestForCli,
} from './approval-gate.js';
