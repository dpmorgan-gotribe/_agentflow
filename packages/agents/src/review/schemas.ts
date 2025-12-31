/**
 * Self-Review Schemas
 *
 * Zod schemas for the self-review framework.
 * Defines gap severity, categories, review results, and configuration.
 *
 * Security:
 * - All strings have max length limits to prevent payload abuse
 * - Scores are bounded 0-1
 * - Arrays have max item limits
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/** Maximum length for descriptions */
export const MAX_DESCRIPTION_LENGTH = 2000;

/** Maximum length for reasoning text */
export const MAX_REASONING_LENGTH = 5000;

/** Maximum number of gaps in a review */
export const MAX_GAPS = 100;

/** Maximum number of requirements */
export const MAX_REQUIREMENTS = 50;

// ============================================================================
// Gap Schemas
// ============================================================================

/**
 * Gap severity levels
 */
export const GapSeveritySchema = z.enum([
  'critical', // Blocks completion, must fix
  'major', // Significant issue, should fix
  'minor', // Small issue, nice to fix
]);

export type GapSeverity = z.infer<typeof GapSeveritySchema>;

/**
 * Gap categories
 */
export const GapCategorySchema = z.enum([
  'missing', // Required element not present
  'incorrect', // Element present but wrong
  'incomplete', // Element present but partial
  'quality', // Element present but low quality
]);

export type GapCategory = z.infer<typeof GapCategorySchema>;

/**
 * Effort estimation
 */
export const EffortEstimateSchema = z.enum(['trivial', 'small', 'medium', 'large']);

export type EffortEstimate = z.infer<typeof EffortEstimateSchema>;

/**
 * Identified gap in agent output
 */
export const GapSchema = z.object({
  id: z.string().uuid(),
  severity: GapSeveritySchema,
  category: GapCategorySchema,
  description: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
  affectedRequirement: z.string().max(500).optional(),
  affectedArtifact: z.string().max(500).optional(),
  suggestedFix: z.string().min(1).max(MAX_DESCRIPTION_LENGTH),
  estimatedEffort: EffortEstimateSchema,
  autoFixable: z.boolean().default(true),
});

export type Gap = z.infer<typeof GapSchema>;

// ============================================================================
// Requirement Coverage Schemas
// ============================================================================

/**
 * Source of the requirement
 */
export const RequirementSourceSchema = z.enum([
  'explicit', // Directly stated in task
  'implicit', // Implied by task context
  'inferred', // Inferred from domain
]);

export type RequirementSource = z.infer<typeof RequirementSourceSchema>;

/**
 * Requirement coverage tracking
 */
export const RequirementCoverageSchema = z.object({
  requirement: z.string().min(1).max(1000),
  source: RequirementSourceSchema,
  covered: z.boolean(),
  coverageDetails: z.string().max(MAX_DESCRIPTION_LENGTH),
  evidenceLocation: z.string().max(500).optional(),
  confidence: z.number().min(0).max(1),
});

export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;

// ============================================================================
// Review Decision Schemas
// ============================================================================

/**
 * Review decision outcomes
 */
export const ReviewDecisionSchema = z.enum([
  'approved', // Quality threshold met, no gaps
  'needs_work', // Gaps found, will address
  'escalate', // Cannot auto-fix, needs human
]);

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

// ============================================================================
// Complete Self-Review Result
// ============================================================================

/**
 * Complete self-review result
 */
export const SelfReviewResultSchema = z.object({
  // Identification
  reviewId: z.string().uuid(),
  taskId: z.string().uuid(),
  agentId: z.string().min(1).max(100),
  iteration: z.number().int().min(1).max(20),

  // Scores (0.0 - 1.0)
  qualityScore: z.number().min(0).max(1),
  completenessScore: z.number().min(0).max(1),
  correctnessScore: z.number().min(0).max(1),
  overallScore: z.number().min(0).max(1),

  // Requirements analysis
  taskRequirements: z.array(z.string().max(1000)).max(MAX_REQUIREMENTS),
  requirementsCovered: z.array(RequirementCoverageSchema).max(MAX_REQUIREMENTS),

  // Gap analysis
  gaps: z.array(GapSchema).max(MAX_GAPS),
  criticalGapCount: z.number().int().min(0),
  majorGapCount: z.number().int().min(0),
  minorGapCount: z.number().int().min(0),

  // Decision
  decision: ReviewDecisionSchema,
  reasoning: z.string().max(MAX_REASONING_LENGTH),

  // Metadata
  reviewDurationMs: z.number().int().min(0),
  tokensUsed: z.number().int().min(0).optional(),
  timestamp: z.string().datetime(),
});

export type SelfReviewResult = z.infer<typeof SelfReviewResultSchema>;

// ============================================================================
// Review Configuration
// ============================================================================

/**
 * Self-review configuration options
 */
export const SelfReviewConfigSchema = z.object({
  /** Enable self-review loop */
  enabled: z.boolean().default(true),

  /** Maximum review iterations before escalating */
  maxIterations: z.number().int().min(1).max(10).default(3),

  /** Quality score threshold (0-1) to approve */
  qualityThreshold: z.number().min(0).max(1).default(0.8),

  /** Completeness score threshold (0-1) to approve */
  completenessThreshold: z.number().min(0).max(1).default(0.9),

  // Escalation rules
  /** Escalate immediately on critical gaps */
  escalateOnCriticalGaps: z.boolean().default(true),

  /** Escalate if still failing after N iterations */
  escalateAfterIterations: z.number().int().min(1).max(10).default(2),

  /** Max critical gaps before automatic escalation */
  maxCriticalGapsBeforeEscalate: z.number().int().min(0).default(1),

  // Performance
  /** Timeout per iteration in ms */
  timeoutPerIterationMs: z.number().int().positive().default(60000),

  /** Cache review results */
  cacheReviewResults: z.boolean().default(true),

  // Learning integration
  /** Capture review patterns for learning */
  captureForLearning: z.boolean().default(true),

  /** Minimum gaps to trigger learning capture */
  learningThresholdGaps: z.number().int().min(0).default(3),
});

export type SelfReviewConfig = z.infer<typeof SelfReviewConfigSchema>;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default self-review configuration
 */
export const DEFAULT_SELF_REVIEW_CONFIG: SelfReviewConfig = {
  enabled: true,
  maxIterations: 3,
  qualityThreshold: 0.8,
  completenessThreshold: 0.9,
  escalateOnCriticalGaps: true,
  escalateAfterIterations: 2,
  maxCriticalGapsBeforeEscalate: 1,
  timeoutPerIterationMs: 60000,
  cacheReviewResults: true,
  captureForLearning: true,
  learningThresholdGaps: 3,
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Create a validated gap
 */
export function createGap(
  params: Omit<Gap, 'id'> & { id?: string }
): Gap {
  const gap = GapSchema.parse({
    id: params.id || crypto.randomUUID(),
    ...params,
  });
  return gap;
}

/**
 * Create a validated requirement coverage
 */
export function createRequirementCoverage(
  params: RequirementCoverage
): RequirementCoverage {
  return RequirementCoverageSchema.parse(params);
}

/**
 * Validate self-review result
 */
export function validateSelfReviewResult(result: unknown): SelfReviewResult {
  return SelfReviewResultSchema.parse(result);
}

/**
 * Validate self-review config
 */
export function validateSelfReviewConfig(config: unknown): SelfReviewConfig {
  return SelfReviewConfigSchema.parse(config);
}
