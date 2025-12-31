/**
 * Base Review Criteria
 *
 * Abstract interface and base class for agent-specific review criteria.
 * Each agent type implements its own criteria to validate output quality.
 *
 * Security:
 * - All inputs validated before processing
 * - No direct filesystem access (agents provide data)
 */

import type { AgentOutput, AgentRequest, AgentContext } from '../../types.js';
import type {
  Gap,
  GapSeverity,
  GapCategory,
  RequirementCoverage,
  SelfReviewResult,
} from '../schemas.js';

// ============================================================================
// Criterion Result Interface
// ============================================================================

/**
 * Result of a single criterion validation
 */
export interface CriterionResult {
  /** Whether the criterion passed */
  passed: boolean;
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Human-readable details */
  details: string;
  /** Suggested fix if failed */
  suggestedFix?: string;
  /** Estimated effort to fix */
  estimatedEffort?: 'trivial' | 'small' | 'medium' | 'large';
}

// ============================================================================
// Review Criterion Interface
// ============================================================================

/**
 * Single review criterion definition
 */
export interface ReviewCriterion {
  /** Unique identifier for this criterion */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this criterion checks */
  description: string;
  /** How severe is it if this criterion fails */
  severity: GapSeverity;
  /** Category of gap this creates */
  category: GapCategory;

  /**
   * Validate the criterion against agent output
   *
   * @param output - The agent's output to validate
   * @param request - The original request
   * @param context - Review context with previous outputs/reviews
   * @returns Promise resolving to criterion result
   */
  validate(
    output: AgentOutput,
    request: AgentRequest,
    context: ReviewContext
  ): Promise<CriterionResult>;
}

// ============================================================================
// Review Context Interface
// ============================================================================

/**
 * Context available during review
 */
export interface ReviewContext {
  /** Previous outputs from this agent */
  previousOutputs: AgentOutput[];
  /** Previous reviews in this iteration cycle */
  previousReviews: SelfReviewResult[];
  /** Project configuration if available */
  projectConfig?: Record<string, unknown>;
  /** Design tokens if available */
  designTokens?: Record<string, unknown>;
  /** Explicit acceptance criteria */
  acceptanceCriteria?: string[];
}

// ============================================================================
// Agent Review Criteria Interface
// ============================================================================

/**
 * Collection of criteria for an agent type
 */
export interface AgentReviewCriteria {
  /** Agent identifier this criteria set belongs to */
  agentId: string;
  /** List of criteria to validate */
  criteria: ReviewCriterion[];

  /**
   * Extract requirements from the task
   *
   * @param request - The agent request containing task description
   * @returns Promise resolving to array of requirement strings
   */
  extractRequirements(request: AgentRequest): Promise<string[]>;

  /**
   * Check if a specific requirement is covered by the output
   *
   * @param requirement - The requirement to check
   * @param output - The agent's output
   * @param context - Review context
   * @returns Promise resolving to coverage details
   */
  checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    context: ReviewContext
  ): Promise<RequirementCoverage>;
}

// ============================================================================
// Base Implementation
// ============================================================================

/**
 * Base implementation of review criteria
 *
 * Provides default requirement extraction and coverage checking.
 * Subclasses should override for agent-specific behavior.
 */
export abstract class BaseAgentReviewCriteria implements AgentReviewCriteria {
  abstract agentId: string;
  abstract criteria: ReviewCriterion[];

  /**
   * Default requirement extraction from task
   *
   * Extracts requirements from:
   * - Bullet points
   * - Numbered items
   * - Modal statements (should, must, need)
   * - Acceptance criteria if present
   */
  async extractRequirements(request: AgentRequest): Promise<string[]> {
    // Get task description
    const task = request.context.task;
    const description = this.getTaskDescription(request);

    // Extract explicit requirements from task description
    const explicit = this.extractExplicitRequirements(description);

    // Infer implicit requirements based on task type
    const implicit = this.inferImplicitRequirements(request);

    // Get requirements from acceptance criteria if present
    const fromContext = this.extractFromContext(request.context);

    // Deduplicate and return
    const all = [...explicit, ...implicit, ...fromContext];
    return [...new Set(all)];
  }

  /**
   * Get task description from request
   */
  protected getTaskDescription(request: AgentRequest): string {
    const task = request.context.task;
    // Task analysis doesn't have description, get from context items
    const taskContext = request.context.items.find(
      (item) => item.type === 'current_task'
    );
    if (taskContext && typeof taskContext.content === 'object') {
      const content = taskContext.content as Record<string, unknown>;
      if (typeof content['description'] === 'string') {
        return content['description'];
      }
      if (typeof content['prompt'] === 'string') {
        return content['prompt'];
      }
    }
    return '';
  }

  /**
   * Extract explicit requirements from text
   */
  protected extractExplicitRequirements(text: string): string[] {
    if (!text) return [];

    const requirements: string[] = [];

    // Extract bullet points (-, *, •)
    const bulletMatches = text.match(/[-*•]\s*(.+)/g);
    if (bulletMatches) {
      for (const match of bulletMatches) {
        const cleaned = match.replace(/^[-*•]\s*/, '').trim();
        if (cleaned.length > 0 && cleaned.length < 500) {
          requirements.push(cleaned);
        }
      }
    }

    // Extract numbered items (1. or 1))
    const numberedMatches = text.match(/\d+[.)]\s*(.+)/g);
    if (numberedMatches) {
      for (const match of numberedMatches) {
        const cleaned = match.replace(/^\d+[.)]\s*/, '').trim();
        if (cleaned.length > 0 && cleaned.length < 500) {
          requirements.push(cleaned);
        }
      }
    }

    // Extract modal statements
    const modalRegex = /(?:should|must|need to|needs to|require[ds]?)\s+(.+?)(?:\.|$)/gi;
    let modalMatch;
    while ((modalMatch = modalRegex.exec(text)) !== null) {
      const requirement = modalMatch[0]?.trim();
      if (requirement && requirement.length > 0 && requirement.length < 500) {
        requirements.push(requirement);
      }
    }

    return requirements;
  }

  /**
   * Infer implicit requirements based on task type
   * Override in agent-specific implementations
   */
  protected inferImplicitRequirements(_request: AgentRequest): string[] {
    return [];
  }

  /**
   * Extract requirements from context items
   */
  protected extractFromContext(context: AgentContext): string[] {
    const requirements: string[] = [];

    // Look for acceptance criteria in context
    for (const item of context.items) {
      if (item.type === 'current_task' && typeof item.content === 'object') {
        const content = item.content as Record<string, unknown>;
        const criteria = content['acceptanceCriteria'];
        if (Array.isArray(criteria)) {
          for (const c of criteria) {
            if (typeof c === 'string' && c.length < 500) {
              requirements.push(c);
            }
          }
        }
      }
    }

    return requirements;
  }

  /**
   * Check requirement coverage - default implementation
   * Subclasses should override for more accurate checking
   */
  abstract checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    context: ReviewContext
  ): Promise<RequirementCoverage>;
}

// ============================================================================
// Criterion Factory Helpers
// ============================================================================

/**
 * Create a criterion result for a passed check
 */
export function criterionPassed(details: string, score = 1.0): CriterionResult {
  return {
    passed: true,
    score: Math.min(1, Math.max(0, score)),
    details,
  };
}

/**
 * Create a criterion result for a failed check
 */
export function criterionFailed(
  details: string,
  suggestedFix: string,
  score = 0,
  effort: 'trivial' | 'small' | 'medium' | 'large' = 'medium'
): CriterionResult {
  return {
    passed: false,
    score: Math.min(1, Math.max(0, score)),
    details,
    suggestedFix,
    estimatedEffort: effort,
  };
}

/**
 * Create a criterion result for a partial pass
 */
export function criterionPartial(
  details: string,
  score: number,
  suggestedFix?: string,
  effort?: 'trivial' | 'small' | 'medium' | 'large'
): CriterionResult {
  const passed = score >= 0.8;
  return {
    passed,
    score: Math.min(1, Math.max(0, score)),
    details,
    suggestedFix: passed ? undefined : suggestedFix,
    estimatedEffort: passed ? undefined : effort,
  };
}
