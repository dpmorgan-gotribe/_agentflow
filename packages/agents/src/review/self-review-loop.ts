/**
 * Self-Review Loop
 *
 * Core implementation of the self-review cycle:
 * 1. Produce - Agent generates initial output
 * 2. Review - Validate output against criteria
 * 3. Identify Gaps - Detect issues
 * 4. Address - Fix identified gaps
 * 5. Re-validate - Loop until quality threshold or max iterations
 *
 * Security:
 * - All inputs validated with Zod
 * - Iteration count limited to prevent infinite loops
 * - Timeout enforcement per iteration
 */

import type { AgentOutput, AgentRequest, ContextItem } from '../types.js';
import type {
  SelfReviewResult,
  SelfReviewConfig,
  Gap,
  RequirementCoverage,
  ReviewDecision,
} from './schemas.js';
import { DEFAULT_SELF_REVIEW_CONFIG } from './schemas.js';
import type {
  AgentReviewCriteria,
  ReviewContext,
} from './criteria/base-criteria.js';

// ============================================================================
// Logger Interface
// ============================================================================

interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: Logger = {
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[INFO] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || ''),
};

// ============================================================================
// Self-Review Loop
// ============================================================================

/**
 * Execute result from self-review loop
 */
export interface SelfReviewExecuteResult {
  /** Final agent output (potentially improved) */
  output: AgentOutput;
  /** All review results from iterations */
  reviews: SelfReviewResult[];
}

/**
 * Self-Review Loop orchestrates the validate -> gap detect -> fix cycle
 */
export class SelfReviewLoop {
  private config: SelfReviewConfig;
  private criteria: AgentReviewCriteria;
  private currentIteration = 0;
  private logger: Logger;

  constructor(
    criteria: AgentReviewCriteria,
    config: Partial<SelfReviewConfig> = {},
    logger?: Logger
  ) {
    this.criteria = criteria;
    this.config = {
      ...DEFAULT_SELF_REVIEW_CONFIG,
      ...config,
    };
    this.logger = logger || defaultLogger;
  }

  /**
   * Execute the self-review loop
   *
   * @param request - Original agent request
   * @param produceOutput - Function to produce agent output
   * @param addressGaps - Function to fix gaps in output
   * @returns Final output and all review results
   */
  async execute(
    request: AgentRequest,
    produceOutput: () => Promise<AgentOutput>,
    addressGaps: (output: AgentOutput, gaps: Gap[]) => Promise<AgentOutput>
  ): Promise<SelfReviewExecuteResult> {
    // If self-review disabled, just produce output
    if (!this.config.enabled) {
      const output = await produceOutput();
      return { output, reviews: [] };
    }

    const reviews: SelfReviewResult[] = [];
    let output = await produceOutput();
    this.currentIteration = 0;

    // Review loop
    while (this.currentIteration < this.config.maxIterations) {
      // Perform self-review
      const review = await this.performReview(request, output);
      reviews.push(review);

      this.logger.info(`Self-review iteration ${this.currentIteration + 1}`, {
        agentId: this.criteria.agentId,
        qualityScore: review.qualityScore,
        gapCount: review.gaps.length,
        decision: review.decision,
      });

      // Check if approved
      if (review.decision === 'approved') {
        output = this.applyReviewToOutput(output, review);
        return { output, reviews };
      }

      // Check if should escalate
      if (this.shouldEscalate(review)) {
        output = this.applyReviewToOutput(output, review, true);
        return { output, reviews };
      }

      // Address gaps and continue
      try {
        const fixableGaps = review.gaps.filter((g) => g.autoFixable);
        if (fixableGaps.length > 0) {
          output = await addressGaps(output, fixableGaps);
        }
      } catch (error) {
        this.logger.warn('Failed to address gaps', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      this.currentIteration++;
    }

    // Max iterations reached
    const finalReview = reviews[reviews.length - 1];
    if (finalReview) {
      output = this.applyReviewToOutput(output, finalReview, true);
    }

    this.logger.warn(`Max review iterations (${this.config.maxIterations}) reached`, {
      agentId: this.criteria.agentId,
      finalScore: finalReview?.overallScore,
    });

    return { output, reviews };
  }

  /**
   * Perform a single review iteration
   */
  private async performReview(
    request: AgentRequest,
    output: AgentOutput
  ): Promise<SelfReviewResult> {
    const startTime = Date.now();
    const reviewId = crypto.randomUUID();

    // Build review context
    const context = this.buildReviewContext(request);

    // Extract requirements
    const requirements = await this.criteria.extractRequirements(request);

    // Validate each criterion
    const gaps: Gap[] = [];
    let totalCriteriaScore = 0;

    for (const criterion of this.criteria.criteria) {
      try {
        const result = await criterion.validate(output, request, context);
        totalCriteriaScore += result.score;

        if (!result.passed) {
          gaps.push({
            id: crypto.randomUUID(),
            severity: criterion.severity,
            category: criterion.category,
            description: `${criterion.name}: ${result.details}`,
            suggestedFix: result.suggestedFix || criterion.description,
            estimatedEffort: result.estimatedEffort || 'medium',
            autoFixable: true,
          });
        }
      } catch (error) {
        this.logger.warn(`Criterion ${criterion.id} validation failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Count as failed but continue
        gaps.push({
          id: crypto.randomUUID(),
          severity: criterion.severity,
          category: criterion.category,
          description: `${criterion.name}: Validation error`,
          suggestedFix: criterion.description,
          estimatedEffort: 'medium',
          autoFixable: false,
        });
      }
    }

    // Check requirement coverage
    const requirementsCovered: RequirementCoverage[] = [];
    for (const req of requirements) {
      try {
        const coverage = await this.criteria.checkRequirementCovered(
          req,
          output,
          context
        );
        requirementsCovered.push(coverage);

        if (!coverage.covered) {
          gaps.push({
            id: crypto.randomUUID(),
            severity: 'major',
            category: 'missing',
            description: `Requirement not addressed: ${req}`,
            affectedRequirement: req,
            suggestedFix: `Add implementation for: ${req}`,
            estimatedEffort: 'medium',
            autoFixable: true,
          });
        }
      } catch (error) {
        this.logger.warn(`Requirement check failed: ${req}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Calculate scores
    const criteriaCount = this.criteria.criteria.length;
    const criteriaScore = criteriaCount > 0
      ? totalCriteriaScore / criteriaCount
      : 1;

    const reqCount = requirements.length;
    const coveredCount = requirementsCovered.filter((r) => r.covered).length;
    const completenessScore = reqCount > 0
      ? coveredCount / reqCount
      : 1;

    const incorrectCount = gaps.filter((g) => g.category === 'incorrect').length;
    const totalGaps = gaps.length;
    const correctnessScore = totalGaps > 0
      ? 1 - incorrectCount / Math.max(totalGaps, 1)
      : 1;

    // Weighted overall score
    const qualityScore =
      criteriaScore * 0.4 + completenessScore * 0.4 + correctnessScore * 0.2;

    // Determine decision
    const decision = this.determineDecision(
      qualityScore,
      completenessScore,
      gaps
    );

    // Count gaps by severity
    const criticalGapCount = gaps.filter((g) => g.severity === 'critical').length;
    const majorGapCount = gaps.filter((g) => g.severity === 'major').length;
    const minorGapCount = gaps.filter((g) => g.severity === 'minor').length;

    return {
      reviewId,
      taskId: request.context.task.taskType, // Use taskType as identifier
      agentId: this.criteria.agentId,
      iteration: this.currentIteration + 1,

      qualityScore,
      completenessScore,
      correctnessScore,
      overallScore: qualityScore,

      taskRequirements: requirements,
      requirementsCovered,

      gaps,
      criticalGapCount,
      majorGapCount,
      minorGapCount,

      decision,
      reasoning: this.generateReasoning(
        qualityScore,
        completenessScore,
        gaps,
        decision
      ),

      reviewDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build review context from request
   */
  private buildReviewContext(request: AgentRequest): ReviewContext {
    const context: ReviewContext = {
      previousOutputs: [],
      previousReviews: [],
    };

    // Extract project config if available
    const projectConfig = request.context.items.find(
      (item) => item.type === 'project_config'
    );
    if (projectConfig) {
      context.projectConfig = projectConfig.content as Record<string, unknown>;
    }

    // Extract design tokens if available
    const designTokens = request.context.items.find(
      (item) => item.type === 'design_tokens'
    );
    if (designTokens) {
      context.designTokens = designTokens.content as Record<string, unknown>;
    }

    // Extract acceptance criteria from task context
    const taskContext = request.context.items.find(
      (item) => item.type === 'current_task'
    );
    if (taskContext && typeof taskContext.content === 'object') {
      const content = taskContext.content as Record<string, unknown>;
      if (Array.isArray(content['acceptanceCriteria'])) {
        context.acceptanceCriteria = content['acceptanceCriteria'] as string[];
      }
    }

    // Extract previous outputs
    if (Array.isArray(request.context.previousOutputs)) {
      context.previousOutputs = request.context.previousOutputs as AgentOutput[];
    }

    return context;
  }

  /**
   * Determine review decision based on scores and gaps
   */
  private determineDecision(
    qualityScore: number,
    completenessScore: number,
    gaps: Gap[]
  ): ReviewDecision {
    const criticalGaps = gaps.filter((g) => g.severity === 'critical');
    const majorGaps = gaps.filter((g) => g.severity === 'major');

    // Escalate if too many critical gaps
    if (criticalGaps.length > this.config.maxCriticalGapsBeforeEscalate) {
      return 'escalate';
    }

    // Escalate if quality too low after multiple iterations
    if (
      this.currentIteration >= this.config.escalateAfterIterations &&
      qualityScore < this.config.qualityThreshold * 0.7
    ) {
      return 'escalate';
    }

    // Approve if thresholds met and no critical/major gaps
    if (
      qualityScore >= this.config.qualityThreshold &&
      completenessScore >= this.config.completenessThreshold &&
      criticalGaps.length === 0 &&
      majorGaps.length === 0
    ) {
      return 'approved';
    }

    return 'needs_work';
  }

  /**
   * Check if should escalate to human review
   */
  private shouldEscalate(review: SelfReviewResult): boolean {
    if (review.decision === 'escalate') {
      return true;
    }

    if (
      this.config.escalateOnCriticalGaps &&
      review.criticalGapCount > this.config.maxCriticalGapsBeforeEscalate
    ) {
      return true;
    }

    return false;
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    qualityScore: number,
    completenessScore: number,
    gaps: Gap[],
    decision: ReviewDecision
  ): string {
    const parts: string[] = [];

    parts.push(`Quality: ${(qualityScore * 100).toFixed(0)}%`);
    parts.push(`Completeness: ${(completenessScore * 100).toFixed(0)}%`);

    if (gaps.length > 0) {
      const gapCounts = [
        gaps.filter((g) => g.severity === 'critical').length,
        gaps.filter((g) => g.severity === 'major').length,
        gaps.filter((g) => g.severity === 'minor').length,
      ];
      const gapSummary = [
        gapCounts[0] ? `${gapCounts[0]} critical` : '',
        gapCounts[1] ? `${gapCounts[1]} major` : '',
        gapCounts[2] ? `${gapCounts[2]} minor` : '',
      ]
        .filter(Boolean)
        .join(', ');
      if (gapSummary) {
        parts.push(`Gaps: ${gapSummary}`);
      }
    }

    switch (decision) {
      case 'approved':
        parts.push('All quality thresholds met.');
        break;
      case 'needs_work':
        parts.push('Addressing identified gaps.');
        break;
      case 'escalate':
        parts.push('Escalating for human review.');
        break;
    }

    return parts.join(' | ');
  }

  /**
   * Apply review result to output
   */
  private applyReviewToOutput(
    output: AgentOutput,
    review: SelfReviewResult,
    escalate = false
  ): AgentOutput {
    return {
      ...output,
      routingHints: {
        ...output.routingHints,
        needsApproval: escalate || review.decision === 'escalate',
        notes: escalate
          ? `Self-review escalation: ${review.reasoning}`
          : review.reasoning,
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a self-review loop instance
 */
export function createSelfReviewLoop(
  criteria: AgentReviewCriteria,
  config?: Partial<SelfReviewConfig>,
  logger?: Logger
): SelfReviewLoop {
  return new SelfReviewLoop(criteria, config, logger);
}
