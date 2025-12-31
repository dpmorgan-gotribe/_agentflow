/**
 * @aigentflow/agents - Self-Review Module
 *
 * Self-review framework for agent output validation and iterative improvement.
 *
 * Features:
 * - Self-review loop: produce -> review -> fix gaps -> re-validate
 * - Gap detection with severity and category classification
 * - Requirement coverage tracking
 * - Quality scoring (0-1 scale)
 * - Learning integration for pattern capture
 * - Agent-specific review criteria (UI Designer, Project Manager, etc.)
 *
 * Security:
 * - All schemas validated with Zod
 * - Iteration limits to prevent infinite loops
 * - String length limits on all fields
 * - No direct filesystem access
 *
 * @packageDocumentation
 */

// ============================================================================
// Version
// ============================================================================

export const SELF_REVIEW_VERSION = '1.0.0';

// ============================================================================
// Schema Exports
// ============================================================================

export {
  // Constants
  MAX_DESCRIPTION_LENGTH,
  MAX_REASONING_LENGTH,
  MAX_GAPS,
  MAX_REQUIREMENTS,
  // Gap schemas
  GapSeveritySchema,
  type GapSeverity,
  GapCategorySchema,
  type GapCategory,
  EffortEstimateSchema,
  type EffortEstimate,
  GapSchema,
  type Gap,
  // Requirement coverage
  RequirementSourceSchema,
  type RequirementSource,
  RequirementCoverageSchema,
  type RequirementCoverage,
  // Review decision
  ReviewDecisionSchema,
  type ReviewDecision,
  // Review result
  SelfReviewResultSchema,
  type SelfReviewResult,
  // Configuration
  SelfReviewConfigSchema,
  type SelfReviewConfig,
  DEFAULT_SELF_REVIEW_CONFIG,
  // Validation helpers
  createGap,
  createRequirementCoverage,
  validateSelfReviewResult,
  validateSelfReviewConfig,
} from './schemas.js';

// ============================================================================
// Self-Review Loop Exports
// ============================================================================

export {
  type SelfReviewExecuteResult,
  SelfReviewLoop,
  createSelfReviewLoop,
} from './self-review-loop.js';

// ============================================================================
// Gap Addresser Exports
// ============================================================================

export {
  type ImprovementData,
  buildGapAddressingPrompt,
  mergeImprovements,
  getFixableGaps,
  getGapsBySeverity,
  getGapsByCategory,
  prioritizeGaps,
  estimateTotalEffort,
} from './gap-addresser.js';

// ============================================================================
// Criteria Exports
// ============================================================================

export {
  // Base criteria
  type CriterionResult,
  type ReviewCriterion,
  type ReviewContext,
  type AgentReviewCriteria,
  BaseAgentReviewCriteria,
  criterionPassed,
  criterionFailed,
  criterionPartial,
  // UI Designer
  UIDesignerReviewCriteria,
  createUIDesignerCriteria,
  // Project Manager
  ProjectManagerReviewCriteria,
  createProjectManagerCriteria,
} from './criteria/index.js';

// ============================================================================
// Learning Integration Exports
// ============================================================================

export {
  type LessonInput,
  type GapPattern,
  type ReviewMetrics,
  createLessonFromReview,
  analyzeGapPatterns,
  analyzeSuccessfulFixes,
  findCommonMissedRequirements,
  calculateReviewMetrics,
} from './learning-integration.js';
