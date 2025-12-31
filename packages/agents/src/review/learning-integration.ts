/**
 * Learning Integration
 *
 * Converts self-review results into lessons for the learning system.
 * Identifies patterns from reviews and suggests improvements.
 *
 * Security:
 * - No direct filesystem access
 * - All data structures validated
 */

import type { SelfReviewResult, Gap } from './schemas.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Lesson input structure for the lessons store
 */
export interface LessonInput {
  /** Lesson category */
  category: 'pattern' | 'bug_fix' | 'architecture' | 'security' | 'performance';
  /** Short lesson title */
  title: string;
  /** Summary of the lesson */
  summary: string;
  /** Detailed lesson information (JSON string) */
  details: string;
  /** Searchable tags */
  tags: string[];
  /** Agent that generated this lesson */
  sourceAgent: string;
  /** Confidence in this lesson (0-1) */
  confidence: number;
}

/**
 * Pattern identified from gap analysis
 */
export interface GapPattern {
  /** Gap category */
  category: string;
  /** Gap severity */
  severity: string;
  /** How many times this pattern occurred */
  frequency: number;
  /** Example descriptions */
  examples: string[];
}

// ============================================================================
// Lesson Creation
// ============================================================================

/**
 * Create a lesson from review results
 *
 * Only creates lessons when meaningful learning occurred:
 * - Multiple iterations
 * - Significant improvement
 * - Identifiable gap patterns
 *
 * @param agentId - Agent that was reviewed
 * @param taskDescription - Original task description
 * @param reviews - All review iterations
 * @returns Lesson input or null if nothing to learn
 */
export function createLessonFromReview(
  agentId: string,
  taskDescription: string,
  reviews: SelfReviewResult[]
): LessonInput | null {
  // Need at least 2 iterations to learn
  if (reviews.length < 2) {
    return null;
  }

  const firstReview = reviews[0];
  const lastReview = reviews[reviews.length - 1];

  if (!firstReview || !lastReview) {
    return null;
  }

  const improvement = lastReview.qualityScore - firstReview.qualityScore;

  // Only create lesson if there was meaningful learning
  if (improvement < 0.1 && lastReview.gaps.length === 0) {
    return null;
  }

  // Identify common gap patterns
  const gapPatterns = analyzeGapPatterns(reviews);
  const successfulFixes = analyzeSuccessfulFixes(reviews);

  // Skip if no patterns found
  if (gapPatterns.length === 0 && successfulFixes.length === 0) {
    return null;
  }

  const taskType = inferTaskType(taskDescription);

  return {
    category: 'pattern',
    title: `${agentId} self-review pattern: ${summarizeGaps(gapPatterns)}`,
    summary: generateLearningSummary(agentId, reviews, gapPatterns),
    details: JSON.stringify({
      agentId,
      taskType,
      iterations: reviews.length,
      initialScore: firstReview.qualityScore,
      finalScore: lastReview.qualityScore,
      improvement,
      gapPatterns,
      successfulFixes,
      commonRequirementsMissed: findCommonMissedRequirements(reviews),
    }),
    tags: [
      `agent:${agentId}`,
      'self-review',
      `task-type:${taskType}`,
      ...gapPatterns.map((p) => `gap:${p.category}`),
      ...gapPatterns.map((p) => `severity:${p.severity}`),
    ],
    sourceAgent: agentId,
    confidence: improvement > 0.2 ? 0.9 : 0.7,
  };
}

// ============================================================================
// Gap Pattern Analysis
// ============================================================================

/**
 * Analyze gap patterns across all reviews
 */
export function analyzeGapPatterns(reviews: SelfReviewResult[]): GapPattern[] {
  const patterns = new Map<string, GapPattern>();

  for (const review of reviews) {
    for (const gap of review.gaps) {
      const key = `${gap.category}-${gap.severity}`;
      const existing = patterns.get(key);

      if (existing) {
        existing.frequency++;
        if (existing.examples.length < 3) {
          existing.examples.push(truncate(gap.description, 200));
        }
      } else {
        patterns.set(key, {
          category: gap.category,
          severity: gap.severity,
          frequency: 1,
          examples: [truncate(gap.description, 200)],
        });
      }
    }
  }

  // Sort by frequency (most common first)
  return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
}

/**
 * Analyze which fixes were successful
 */
export function analyzeSuccessfulFixes(reviews: SelfReviewResult[]): string[] {
  const fixes: string[] = [];

  for (let i = 1; i < reviews.length; i++) {
    const prevReview = reviews[i - 1];
    const currReview = reviews[i];

    if (!prevReview || !currReview) continue;

    const prevGapIds = new Set(prevReview.gaps.map((g) => g.id));
    const currGapIds = new Set(currReview.gaps.map((g) => g.id));

    // Find gaps that were present before but not now
    const resolvedGaps = prevReview.gaps.filter((g) => !currGapIds.has(g.id));

    for (const resolved of resolvedGaps) {
      fixes.push(
        `Fixed ${resolved.category}: ${truncate(resolved.description, 100)} via ${truncate(resolved.suggestedFix, 100)}`
      );
    }
  }

  return fixes;
}

/**
 * Find requirements that were commonly missed
 */
export function findCommonMissedRequirements(
  reviews: SelfReviewResult[]
): string[] {
  const missedCount = new Map<string, number>();

  for (const review of reviews) {
    for (const coverage of review.requirementsCovered) {
      if (!coverage.covered) {
        const count = missedCount.get(coverage.requirement) || 0;
        missedCount.set(coverage.requirement, count + 1);
      }
    }
  }

  // Return requirements missed in multiple reviews
  return Array.from(missedCount.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([req, _]) => req);
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Summarize gap patterns for title
 */
function summarizeGaps(patterns: GapPattern[]): string {
  if (patterns.length === 0) return 'no gaps';

  return patterns
    .slice(0, 2)
    .map((p) => p.category)
    .join(', ');
}

/**
 * Generate human-readable learning summary
 */
function generateLearningSummary(
  agentId: string,
  reviews: SelfReviewResult[],
  patterns: GapPattern[]
): string {
  const first = reviews[0];
  const last = reviews[reviews.length - 1];

  if (!first || !last) {
    return `Agent ${agentId} completed ${reviews.length} review iterations.`;
  }

  const improvement = last.qualityScore - first.qualityScore;
  const direction = improvement >= 0 ? 'improved' : 'declined';

  const patternSummary =
    patterns.length > 0
      ? ` Common gaps: ${patterns.map((p) => `${p.category} (${p.frequency}x)`).join(', ')}.`
      : '';

  return `Agent ${agentId} ${direction} from ${Math.round(first.qualityScore * 100)}% to ${Math.round(last.qualityScore * 100)}% quality over ${reviews.length} iterations.${patternSummary}`;
}

// ============================================================================
// Task Type Inference
// ============================================================================

/**
 * Infer task type from description
 */
function inferTaskType(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('design') || lower.includes('mockup') || lower.includes('ui')) {
    return 'design';
  }
  if (lower.includes('api') || lower.includes('endpoint') || lower.includes('backend')) {
    return 'backend';
  }
  if (lower.includes('component') || lower.includes('frontend') || lower.includes('page')) {
    return 'frontend';
  }
  if (lower.includes('test') || lower.includes('spec')) {
    return 'testing';
  }
  if (lower.includes('database') || lower.includes('schema') || lower.includes('migration')) {
    return 'database';
  }
  if (lower.includes('deploy') || lower.includes('ci') || lower.includes('pipeline')) {
    return 'devops';
  }
  if (lower.includes('security') || lower.includes('auth')) {
    return 'security';
  }

  return 'general';
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Review Metrics
// ============================================================================

/**
 * Calculate aggregate metrics from reviews
 */
export interface ReviewMetrics {
  /** Total iterations */
  totalIterations: number;
  /** Average quality score */
  averageQuality: number;
  /** Quality improvement from first to last */
  qualityImprovement: number;
  /** Total gaps identified */
  totalGaps: number;
  /** Gaps fixed */
  gapsFixed: number;
  /** Final decision */
  finalDecision: string;
  /** Most common gap category */
  mostCommonGapCategory: string | null;
}

/**
 * Calculate metrics from review results
 */
export function calculateReviewMetrics(
  reviews: SelfReviewResult[]
): ReviewMetrics {
  if (reviews.length === 0) {
    return {
      totalIterations: 0,
      averageQuality: 0,
      qualityImprovement: 0,
      totalGaps: 0,
      gapsFixed: 0,
      finalDecision: 'none',
      mostCommonGapCategory: null,
    };
  }

  const first = reviews[0]!;
  const last = reviews[reviews.length - 1]!;

  // Calculate average quality
  const totalQuality = reviews.reduce((sum, r) => sum + r.qualityScore, 0);
  const averageQuality = totalQuality / reviews.length;

  // Count gaps
  const totalGaps = reviews.reduce((sum, r) => sum + r.gaps.length, 0);

  // Count gaps fixed (gaps in earlier reviews not in later ones)
  let gapsFixed = 0;
  for (let i = 1; i < reviews.length; i++) {
    const prev = reviews[i - 1]!;
    const curr = reviews[i]!;
    const currGapIds = new Set(curr.gaps.map((g) => g.id));
    gapsFixed += prev.gaps.filter((g) => !currGapIds.has(g.id)).length;
  }

  // Find most common gap category
  const categoryCount = new Map<string, number>();
  for (const review of reviews) {
    for (const gap of review.gaps) {
      const count = categoryCount.get(gap.category) || 0;
      categoryCount.set(gap.category, count + 1);
    }
  }

  let mostCommonGapCategory: string | null = null;
  let maxCount = 0;
  for (const [category, count] of categoryCount) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonGapCategory = category;
    }
  }

  return {
    totalIterations: reviews.length,
    averageQuality,
    qualityImprovement: last.qualityScore - first.qualityScore,
    totalGaps,
    gapsFixed,
    finalDecision: last.decision,
    mostCommonGapCategory,
  };
}
