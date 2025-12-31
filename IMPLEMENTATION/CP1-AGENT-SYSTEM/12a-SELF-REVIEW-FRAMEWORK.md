# Step 12a: Self-Review Framework

> **Checkpoint:** CP1 - Agent System
> **Previous Step:** 12-AGENT-FRAMEWORK.md
> **Next Step:** 13-ORCHESTRATOR-GRAPH.md
> **Architecture Reference:** `.meta/plans/SELF-REVIEW-ARCHITECTURE-PROPOSAL.md`

---

## Overview

The **Self-Review Framework** ensures every agent validates its output against the original task requirements before marking work as complete. This implements an iterative improvement loop:

1. **Produce** - Agent generates initial output
2. **Review** - Agent validates output against task/requirements
3. **Identify Gaps** - Detect missing, incorrect, or incomplete elements
4. **Address** - Fix identified gaps
5. **Re-validate** - Loop until quality threshold met or max iterations

This framework integrates with the Self-Learning system (CP7) to capture review patterns and improve future agent performance.

---

## Key Principles

1. **Every agent reviews its own work** - No output is "complete" without self-validation
2. **Requirements traceability** - Every requirement from the task must map to output
3. **Iterative improvement** - Gaps are addressed, not just reported
4. **Learning integration** - Review patterns feed into self-evolution
5. **Configurable thresholds** - Quality requirements can be tuned per agent/task

---

## Deliverables

1. `packages/agents/src/review/self-review-loop.ts` - Core review loop implementation
2. `packages/agents/src/review/schemas.ts` - Review result schemas
3. `packages/agents/src/review/gap-detector.ts` - Gap identification utilities
4. `packages/agents/src/review/requirement-extractor.ts` - Extract requirements from tasks
5. `packages/agents/src/review/quality-scorer.ts` - Calculate quality metrics
6. `packages/agents/src/review/criteria/` - Agent-specific review criteria
7. `packages/agents/src/base-agent.ts` - Updated with review hooks

---

## 1. Core Schemas

### 1.1 Self-Review Result Schema

```typescript
// packages/agents/src/review/schemas.ts

import { z } from 'zod';

/**
 * Gap severity levels
 */
export const GapSeveritySchema = z.enum([
  'critical',  // Blocks completion, must fix
  'major',     // Significant issue, should fix
  'minor',     // Small issue, nice to fix
]);

export type GapSeverity = z.infer<typeof GapSeveritySchema>;

/**
 * Gap categories
 */
export const GapCategorySchema = z.enum([
  'missing',     // Required element not present
  'incorrect',   // Element present but wrong
  'incomplete',  // Element present but partial
  'quality',     // Element present but low quality
]);

export type GapCategory = z.infer<typeof GapCategorySchema>;

/**
 * Identified gap in agent output
 */
export const GapSchema = z.object({
  id: z.string(),
  severity: GapSeveritySchema,
  category: GapCategorySchema,
  description: z.string(),
  affectedRequirement: z.string().optional(),
  affectedArtifact: z.string().optional(),
  suggestedFix: z.string(),
  estimatedEffort: z.enum(['trivial', 'small', 'medium', 'large']),
  autoFixable: z.boolean().default(true),
});

export type Gap = z.infer<typeof GapSchema>;

/**
 * Requirement coverage tracking
 */
export const RequirementCoverageSchema = z.object({
  requirement: z.string(),
  source: z.enum(['explicit', 'implicit', 'inferred']),
  covered: z.boolean(),
  coverageDetails: z.string(),
  evidenceLocation: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;

/**
 * Review decision
 */
export const ReviewDecisionSchema = z.enum([
  'approved',    // Quality threshold met, no gaps
  'needs_work',  // Gaps found, will address
  'escalate',    // Cannot auto-fix, needs human
]);

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

/**
 * Complete self-review result
 */
export const SelfReviewResultSchema = z.object({
  // Identification
  reviewId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  iteration: z.number(),

  // Scores (0.0 - 1.0)
  qualityScore: z.number().min(0).max(1),
  completenessScore: z.number().min(0).max(1),
  correctnessScore: z.number().min(0).max(1),
  overallScore: z.number().min(0).max(1),

  // Requirements analysis
  taskRequirements: z.array(z.string()),
  requirementsCovered: z.array(RequirementCoverageSchema),

  // Gap analysis
  gaps: z.array(GapSchema),
  criticalGapCount: z.number(),
  majorGapCount: z.number(),
  minorGapCount: z.number(),

  // Decision
  decision: ReviewDecisionSchema,
  reasoning: z.string(),

  // Metadata
  reviewDurationMs: z.number(),
  tokensUsed: z.number().optional(),
  timestamp: z.string(),
});

export type SelfReviewResult = z.infer<typeof SelfReviewResultSchema>;

/**
 * Review configuration
 */
export const SelfReviewConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxIterations: z.number().min(1).max(10).default(3),
  qualityThreshold: z.number().min(0).max(1).default(0.8),
  completenessThreshold: z.number().min(0).max(1).default(0.9),

  // Escalation rules
  escalateOnCriticalGaps: z.boolean().default(true),
  escalateAfterIterations: z.number().default(2),
  maxCriticalGapsBeforeEscalate: z.number().default(1),

  // Performance
  timeoutPerIterationMs: z.number().default(60000),
  cacheReviewResults: z.boolean().default(true),

  // Learning
  captureForLearning: z.boolean().default(true),
  learningThresholdGaps: z.number().default(3),
});

export type SelfReviewConfig = z.infer<typeof SelfReviewConfigSchema>;
```

---

## 2. Review Criteria Interface

### 2.1 Base Review Criteria

```typescript
// packages/agents/src/review/criteria/base-criteria.ts

import { AgentOutput, AgentRequest } from '../../types';
import { Gap, GapSeverity, GapCategory } from '../schemas';

/**
 * Result of a criterion validation
 */
export interface CriterionResult {
  passed: boolean;
  score: number;  // 0.0 - 1.0
  details: string;
  suggestedFix?: string;
  estimatedEffort?: 'trivial' | 'small' | 'medium' | 'large';
}

/**
 * Single review criterion
 */
export interface ReviewCriterion {
  id: string;
  name: string;
  description: string;
  severity: GapSeverity;
  category: GapCategory;

  /**
   * Validate the criterion against agent output
   */
  validate(
    output: AgentOutput,
    request: AgentRequest,
    context: ReviewContext
  ): Promise<CriterionResult>;
}

/**
 * Context available during review
 */
export interface ReviewContext {
  previousOutputs: AgentOutput[];
  previousReviews: SelfReviewResult[];
  projectConfig?: Record<string, unknown>;
  designTokens?: Record<string, unknown>;
  acceptanceCriteria?: string[];
}

/**
 * Collection of criteria for an agent type
 */
export interface AgentReviewCriteria {
  agentId: string;
  criteria: ReviewCriterion[];

  /**
   * Extract requirements from the task
   */
  extractRequirements(request: AgentRequest): Promise<string[]>;

  /**
   * Check if a specific requirement is covered
   */
  checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    context: ReviewContext
  ): Promise<RequirementCoverage>;
}

/**
 * Base implementation of review criteria
 */
export abstract class BaseAgentReviewCriteria implements AgentReviewCriteria {
  abstract agentId: string;
  abstract criteria: ReviewCriterion[];

  /**
   * Default requirement extraction using LLM
   */
  async extractRequirements(request: AgentRequest): Promise<string[]> {
    // Extract explicit requirements from task description
    const explicit = this.extractExplicitRequirements(request);

    // Infer implicit requirements based on task type
    const implicit = this.inferImplicitRequirements(request);

    // Get requirements from acceptance criteria if present
    const fromCriteria = request.context.task.acceptanceCriteria || [];

    return [...new Set([...explicit, ...implicit, ...fromCriteria])];
  }

  protected extractExplicitRequirements(request: AgentRequest): string[] {
    const prompt = request.context.task.description || request.context.task.prompt;
    const requirements: string[] = [];

    // Extract bullet points
    const bulletMatches = prompt.match(/[-*•]\s*(.+)/g);
    if (bulletMatches) {
      requirements.push(...bulletMatches.map(m => m.replace(/^[-*•]\s*/, '')));
    }

    // Extract numbered items
    const numberedMatches = prompt.match(/\d+[.)]\s*(.+)/g);
    if (numberedMatches) {
      requirements.push(...numberedMatches.map(m => m.replace(/^\d+[.)]\s*/, '')));
    }

    // Extract "should", "must", "need" statements
    const modalMatches = prompt.match(/(?:should|must|need to|needs to|require)\s+(.+?)(?:\.|$)/gi);
    if (modalMatches) {
      requirements.push(...modalMatches);
    }

    return requirements;
  }

  protected inferImplicitRequirements(request: AgentRequest): string[] {
    // Override in agent-specific implementations
    return [];
  }

  abstract checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    context: ReviewContext
  ): Promise<RequirementCoverage>;
}
```

---

## 3. Self-Review Loop Implementation

### 3.1 Core Review Loop

```typescript
// packages/agents/src/review/self-review-loop.ts

import { v4 as uuidv4 } from 'uuid';
import { AgentOutput, AgentRequest, Artifact } from '../types';
import {
  SelfReviewResult,
  SelfReviewConfig,
  Gap,
  RequirementCoverage,
  ReviewDecision,
} from './schemas';
import { AgentReviewCriteria, ReviewContext, CriterionResult } from './criteria/base-criteria';
import { logger } from '../../utils/logger';

/**
 * Self-Review Loop
 *
 * Orchestrates the validate -> gap detect -> fix -> re-validate cycle
 */
export class SelfReviewLoop {
  private config: SelfReviewConfig;
  private criteria: AgentReviewCriteria;
  private currentIteration: number = 0;

  constructor(
    criteria: AgentReviewCriteria,
    config: Partial<SelfReviewConfig> = {}
  ) {
    this.criteria = criteria;
    this.config = {
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
      ...config,
    };
  }

  /**
   * Execute the self-review loop
   */
  async execute(
    request: AgentRequest,
    produceOutput: () => Promise<AgentOutput>,
    addressGaps: (output: AgentOutput, gaps: Gap[]) => Promise<AgentOutput>
  ): Promise<{ output: AgentOutput; reviews: SelfReviewResult[] }> {
    if (!this.config.enabled) {
      const output = await produceOutput();
      return { output, reviews: [] };
    }

    const reviews: SelfReviewResult[] = [];
    let output = await produceOutput();
    this.currentIteration = 0;

    while (this.currentIteration < this.config.maxIterations) {
      // Perform self-review
      const review = await this.performReview(request, output);
      reviews.push(review);

      logger.info(`Self-review iteration ${this.currentIteration + 1}`, {
        agentId: this.criteria.agentId,
        qualityScore: review.qualityScore,
        gapCount: review.gaps.length,
        decision: review.decision,
      });

      // Check if complete
      if (review.decision === 'approved') {
        output.selfReviewResult = review;
        output.qualityScore = review.overallScore;
        return { output, reviews };
      }

      // Check if should escalate
      if (this.shouldEscalate(review)) {
        output.selfReviewResult = review;
        output.routingHints = {
          ...output.routingHints,
          needsApproval: true,
          notes: `Self-review escalation: ${review.reasoning}`,
        };
        return { output, reviews };
      }

      // Address gaps and continue
      output = await addressGaps(output, review.gaps);
      this.currentIteration++;
    }

    // Max iterations reached
    const finalReview = reviews[reviews.length - 1];
    output.selfReviewResult = finalReview;
    output.routingHints = {
      ...output.routingHints,
      needsApproval: true,
      notes: `Max review iterations (${this.config.maxIterations}) reached. Final score: ${finalReview.overallScore}`,
    };

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
    const reviewId = uuidv4();

    // Build review context
    const context: ReviewContext = {
      previousOutputs: request.context.previousOutputs || [],
      previousReviews: [],
      projectConfig: request.context.items.find(i => i.type === 'project_config')?.content,
      acceptanceCriteria: request.context.task.acceptanceCriteria,
    };

    // Extract requirements
    const requirements = await this.criteria.extractRequirements(request);

    // Validate each criterion
    const gaps: Gap[] = [];
    let totalCriteriaScore = 0;

    for (const criterion of this.criteria.criteria) {
      const result = await criterion.validate(output, request, context);
      totalCriteriaScore += result.score;

      if (!result.passed) {
        gaps.push({
          id: uuidv4(),
          severity: criterion.severity,
          category: criterion.category,
          description: `${criterion.name}: ${result.details}`,
          suggestedFix: result.suggestedFix || criterion.description,
          estimatedEffort: result.estimatedEffort || 'medium',
          autoFixable: true,
        });
      }
    }

    // Check requirement coverage
    const requirementsCovered: RequirementCoverage[] = [];
    for (const req of requirements) {
      const coverage = await this.criteria.checkRequirementCovered(req, output, context);
      requirementsCovered.push(coverage);

      if (!coverage.covered) {
        gaps.push({
          id: uuidv4(),
          severity: 'major',
          category: 'missing',
          description: `Requirement not addressed: ${req}`,
          affectedRequirement: req,
          suggestedFix: `Add implementation for: ${req}`,
          estimatedEffort: 'medium',
          autoFixable: true,
        });
      }
    }

    // Calculate scores
    const criteriaScore = this.criteria.criteria.length > 0
      ? totalCriteriaScore / this.criteria.criteria.length
      : 1;

    const completenessScore = requirements.length > 0
      ? requirementsCovered.filter(r => r.covered).length / requirements.length
      : 1;

    const correctnessScore = gaps.length > 0
      ? 1 - (gaps.filter(g => g.category === 'incorrect').length / Math.max(gaps.length, 1))
      : 1;

    const qualityScore = (criteriaScore * 0.4) + (completenessScore * 0.4) + (correctnessScore * 0.2);

    // Determine decision
    const decision = this.determineDecision(qualityScore, completenessScore, gaps);

    return {
      reviewId,
      taskId: request.context.task.id,
      agentId: this.criteria.agentId,
      iteration: this.currentIteration + 1,

      qualityScore,
      completenessScore,
      correctnessScore,
      overallScore: qualityScore,

      taskRequirements: requirements,
      requirementsCovered,

      gaps,
      criticalGapCount: gaps.filter(g => g.severity === 'critical').length,
      majorGapCount: gaps.filter(g => g.severity === 'major').length,
      minorGapCount: gaps.filter(g => g.severity === 'minor').length,

      decision,
      reasoning: this.generateReasoning(qualityScore, completenessScore, gaps, decision),

      reviewDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Determine review decision
   */
  private determineDecision(
    qualityScore: number,
    completenessScore: number,
    gaps: Gap[]
  ): ReviewDecision {
    const criticalGaps = gaps.filter(g => g.severity === 'critical');
    const majorGaps = gaps.filter(g => g.severity === 'major');

    // Escalate if too many critical gaps
    if (criticalGaps.length > this.config.maxCriticalGapsBeforeEscalate) {
      return 'escalate';
    }

    // Escalate if quality too low after multiple iterations
    if (this.currentIteration >= this.config.escalateAfterIterations &&
        qualityScore < this.config.qualityThreshold * 0.7) {
      return 'escalate';
    }

    // Approve if thresholds met and no critical/major gaps
    if (qualityScore >= this.config.qualityThreshold &&
        completenessScore >= this.config.completenessThreshold &&
        criticalGaps.length === 0 &&
        majorGaps.length === 0) {
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

    if (this.config.escalateOnCriticalGaps &&
        review.criticalGapCount > this.config.maxCriticalGapsBeforeEscalate) {
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
      const gapSummary = [
        gaps.filter(g => g.severity === 'critical').length + ' critical',
        gaps.filter(g => g.severity === 'major').length + ' major',
        gaps.filter(g => g.severity === 'minor').length + ' minor',
      ].filter(s => !s.startsWith('0')).join(', ');
      parts.push(`Gaps: ${gapSummary}`);
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
}
```

---

## 4. Gap Addressing Utilities

### 4.1 Gap Addressing Helper

```typescript
// packages/agents/src/review/gap-addresser.ts

import { AgentOutput, Artifact } from '../types';
import { Gap } from './schemas';
import { AIProvider } from '../../ai/provider';

/**
 * Build a prompt to address specific gaps
 */
export function buildGapAddressingPrompt(
  originalTask: string,
  currentOutput: AgentOutput,
  gaps: Gap[]
): string {
  const gapDescriptions = gaps.map((gap, i) => {
    return `${i + 1}. [${gap.severity.toUpperCase()}] ${gap.description}
   Suggested fix: ${gap.suggestedFix}
   Effort: ${gap.estimatedEffort}`;
  }).join('\n\n');

  return `You previously produced output for this task, but self-review identified gaps that need to be addressed.

ORIGINAL TASK:
${originalTask}

CURRENT OUTPUT SUMMARY:
${summarizeOutput(currentOutput)}

GAPS TO ADDRESS:
${gapDescriptions}

Please provide ONLY the improvements needed to address these gaps. For each gap:
1. Acknowledge the issue
2. Provide the corrected/additional content
3. Explain how the fix addresses the gap

Focus on the gaps - do not regenerate content that was already correct.`;
}

/**
 * Merge improvements into existing output
 */
export function mergeImprovements(
  currentOutput: AgentOutput,
  improvements: AgentOutput
): AgentOutput {
  return {
    ...currentOutput,
    result: mergeResults(currentOutput.result, improvements.result),
    artifacts: mergeArtifacts(currentOutput.artifacts, improvements.artifacts),
    // Keep the latest routing hints
    routingHints: improvements.routingHints || currentOutput.routingHints,
  };
}

function mergeResults(current: unknown, improvements: unknown): unknown {
  if (!improvements) return current;
  if (!current) return improvements;

  if (typeof current === 'object' && typeof improvements === 'object') {
    return { ...current as object, ...improvements as object };
  }

  return improvements;
}

function mergeArtifacts(current: Artifact[], improvements: Artifact[]): Artifact[] {
  if (!improvements || improvements.length === 0) return current;

  const merged = [...current];

  for (const improvement of improvements) {
    const existingIndex = merged.findIndex(a => a.path === improvement.path);
    if (existingIndex >= 0) {
      // Replace existing artifact
      merged[existingIndex] = improvement;
    } else {
      // Add new artifact
      merged.push(improvement);
    }
  }

  return merged;
}

function summarizeOutput(output: AgentOutput): string {
  const parts: string[] = [];

  if (output.artifacts && output.artifacts.length > 0) {
    parts.push(`Artifacts: ${output.artifacts.map(a => `${a.type}:${a.path}`).join(', ')}`);
  }

  if (output.result) {
    const resultStr = JSON.stringify(output.result, null, 2);
    if (resultStr.length > 500) {
      parts.push(`Result: ${resultStr.substring(0, 500)}...`);
    } else {
      parts.push(`Result: ${resultStr}`);
    }
  }

  return parts.join('\n');
}
```

---

## 5. Agent-Specific Review Criteria

### 5.1 UI Designer Criteria

```typescript
// packages/agents/src/review/criteria/ui-designer-criteria.ts

import { BaseAgentReviewCriteria, ReviewCriterion, ReviewContext, CriterionResult } from './base-criteria';
import { AgentOutput, AgentRequest } from '../../types';
import { RequirementCoverage } from '../schemas';

export class UIDesignerReviewCriteria extends BaseAgentReviewCriteria {
  agentId = 'ui_designer';

  criteria: ReviewCriterion[] = [
    {
      id: 'all_screens_created',
      name: 'All Screens Created',
      description: 'All requested screens have corresponding mockups',
      severity: 'critical',
      category: 'missing',
      async validate(output, request, context): Promise<CriterionResult> {
        const mockups = output.artifacts?.filter(a => a.type === 'mockup') || [];
        const requestedScreens = extractScreensFromTask(request);

        const missingScreens = requestedScreens.filter(screen =>
          !mockups.some(m => matchesScreen(m.path, screen))
        );

        return {
          passed: missingScreens.length === 0,
          score: 1 - (missingScreens.length / Math.max(requestedScreens.length, 1)),
          details: missingScreens.length > 0
            ? `Missing screens: ${missingScreens.join(', ')}`
            : 'All screens created',
          suggestedFix: missingScreens.length > 0
            ? `Create mockups for: ${missingScreens.join(', ')}`
            : undefined,
          estimatedEffort: missingScreens.length > 2 ? 'large' : 'medium',
        };
      },
    },
    {
      id: 'design_tokens_applied',
      name: 'Design Tokens Applied',
      description: 'Design tokens are consistently applied to all components',
      severity: 'major',
      category: 'quality',
      async validate(output, request, context): Promise<CriterionResult> {
        const stylesheets = output.artifacts?.filter(a => a.type === 'stylesheet') || [];

        if (stylesheets.length === 0) {
          return {
            passed: false,
            score: 0,
            details: 'No stylesheet found',
            suggestedFix: 'Create a stylesheet with design tokens',
            estimatedEffort: 'medium',
          };
        }

        // Check for CSS variable usage
        const tokenUsage = stylesheets.every(s =>
          s.content?.includes('var(--') || s.content?.includes('$')
        );

        return {
          passed: tokenUsage,
          score: tokenUsage ? 1 : 0.5,
          details: tokenUsage
            ? 'Design tokens properly applied'
            : 'Hardcoded values found instead of design tokens',
          suggestedFix: !tokenUsage
            ? 'Replace hardcoded colors, fonts, and spacing with design tokens'
            : undefined,
          estimatedEffort: 'small',
        };
      },
    },
    {
      id: 'accessibility_attributes',
      name: 'Accessibility Attributes',
      description: 'ARIA labels and roles present on interactive elements',
      severity: 'major',
      category: 'quality',
      async validate(output, request, context): Promise<CriterionResult> {
        const mockups = output.artifacts?.filter(a => a.type === 'mockup') || [];
        let totalInteractive = 0;
        let withAccessibility = 0;

        for (const mockup of mockups) {
          const content = mockup.content || '';
          // Count buttons, inputs, links
          const interactiveElements = (content.match(/<(button|input|a|select|textarea)/gi) || []).length;
          const ariaAttributes = (content.match(/aria-|role=/gi) || []).length;
          const labels = (content.match(/<label/gi) || []).length;

          totalInteractive += interactiveElements;
          withAccessibility += Math.min(interactiveElements, ariaAttributes + labels);
        }

        const score = totalInteractive > 0 ? withAccessibility / totalInteractive : 1;

        return {
          passed: score >= 0.8,
          score,
          details: score >= 0.8
            ? 'Accessibility attributes present'
            : `${Math.round((1 - score) * 100)}% of interactive elements missing accessibility attributes`,
          suggestedFix: score < 0.8
            ? 'Add aria-label, role, and label elements to interactive components'
            : undefined,
          estimatedEffort: 'small',
        };
      },
    },
    {
      id: 'responsive_design',
      name: 'Responsive Design',
      description: 'Mobile and desktop layouts considered',
      severity: 'major',
      category: 'incomplete',
      async validate(output, request, context): Promise<CriterionResult> {
        const stylesheets = output.artifacts?.filter(a => a.type === 'stylesheet') || [];

        const hasMediaQueries = stylesheets.some(s =>
          s.content?.includes('@media') ||
          s.content?.includes('min-width') ||
          s.content?.includes('max-width')
        );

        const hasFlexOrGrid = stylesheets.some(s =>
          s.content?.includes('flex') ||
          s.content?.includes('grid')
        );

        const score = (hasMediaQueries ? 0.6 : 0) + (hasFlexOrGrid ? 0.4 : 0);

        return {
          passed: score >= 0.6,
          score,
          details: hasMediaQueries
            ? 'Responsive breakpoints defined'
            : 'No responsive breakpoints found',
          suggestedFix: !hasMediaQueries
            ? 'Add media queries for mobile (< 768px) and tablet (< 1024px) breakpoints'
            : undefined,
          estimatedEffort: 'medium',
        };
      },
    },
  ];

  async checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    context: ReviewContext
  ): Promise<RequirementCoverage> {
    const mockups = output.artifacts?.filter(a => a.type === 'mockup') || [];
    const stylesheets = output.artifacts?.filter(a => a.type === 'stylesheet') || [];
    const allContent = [...mockups, ...stylesheets].map(a => a.content || '').join(' ');

    // Simple keyword matching (can be enhanced with embeddings)
    const keywords = requirement.toLowerCase().split(/\s+/);
    const matchCount = keywords.filter(kw =>
      allContent.toLowerCase().includes(kw)
    ).length;

    const confidence = matchCount / keywords.length;
    const covered = confidence >= 0.5;

    return {
      requirement,
      source: 'explicit',
      covered,
      coverageDetails: covered
        ? `Found in design artifacts (${(confidence * 100).toFixed(0)}% keyword match)`
        : `Requirement keywords not found in designs`,
      confidence,
    };
  }

  protected inferImplicitRequirements(request: AgentRequest): string[] {
    const implicit: string[] = [];

    // UI-specific implicit requirements
    if (request.context.task.description?.toLowerCase().includes('form')) {
      implicit.push('Form validation states (error, success)');
      implicit.push('Form submission feedback');
    }

    if (request.context.task.description?.toLowerCase().includes('login')) {
      implicit.push('Password visibility toggle');
      implicit.push('Forgot password link');
      implicit.push('Error message display');
    }

    if (request.context.task.description?.toLowerCase().includes('dashboard')) {
      implicit.push('Navigation menu');
      implicit.push('User profile area');
      implicit.push('Loading states');
    }

    return implicit;
  }
}

// Helper functions
function extractScreensFromTask(request: AgentRequest): string[] {
  const description = request.context.task.description || '';
  const screens: string[] = [];

  // Look for explicit screen mentions
  const screenPatterns = [
    /(\w+)\s+(?:page|screen|view)/gi,
    /(?:page|screen|view)\s+for\s+(\w+)/gi,
    /create\s+(?:a\s+)?(\w+)/gi,
  ];

  for (const pattern of screenPatterns) {
    const matches = description.matchAll(pattern);
    for (const match of matches) {
      screens.push(match[1].toLowerCase());
    }
  }

  return [...new Set(screens)];
}

function matchesScreen(artifactPath: string, screenName: string): boolean {
  const normalizedPath = artifactPath.toLowerCase();
  const normalizedScreen = screenName.toLowerCase();
  return normalizedPath.includes(normalizedScreen);
}
```

### 5.2 Project Manager Criteria

```typescript
// packages/agents/src/review/criteria/project-manager-criteria.ts

import { BaseAgentReviewCriteria, ReviewCriterion, ReviewContext, CriterionResult } from './base-criteria';
import { AgentOutput, AgentRequest } from '../../types';
import { RequirementCoverage } from '../schemas';

export class ProjectManagerReviewCriteria extends BaseAgentReviewCriteria {
  agentId = 'project_manager';

  criteria: ReviewCriterion[] = [
    {
      id: 'tasks_have_acceptance_criteria',
      name: 'Acceptance Criteria Present',
      description: 'Every task has defined acceptance criteria',
      severity: 'critical',
      category: 'incomplete',
      async validate(output, request, context): Promise<CriterionResult> {
        const result = output.result as any;
        const tasks = flattenTasks(result?.epics || []);

        const withCriteria = tasks.filter(t =>
          t.acceptanceCriteria && t.acceptanceCriteria.length > 0
        ).length;

        const score = tasks.length > 0 ? withCriteria / tasks.length : 1;

        return {
          passed: score >= 0.9,
          score,
          details: score >= 0.9
            ? 'All tasks have acceptance criteria'
            : `${tasks.length - withCriteria} tasks missing acceptance criteria`,
          suggestedFix: score < 0.9
            ? 'Add specific, testable acceptance criteria to each task'
            : undefined,
          estimatedEffort: 'medium',
        };
      },
    },
    {
      id: 'dependencies_valid',
      name: 'Valid Dependencies',
      description: 'All task dependencies exist and form no cycles',
      severity: 'critical',
      category: 'incorrect',
      async validate(output, request, context): Promise<CriterionResult> {
        const result = output.result as any;
        const tasks = flattenTasks(result?.epics || []);
        const taskIds = new Set(tasks.map(t => t.id));

        // Check all dependencies exist
        const invalidDeps: string[] = [];
        for (const task of tasks) {
          for (const dep of task.dependencies || []) {
            if (!taskIds.has(dep)) {
              invalidDeps.push(`${task.id} -> ${dep}`);
            }
          }
        }

        // Check for cycles (simple DFS)
        const hasCycle = detectCycle(tasks);

        const passed = invalidDeps.length === 0 && !hasCycle;

        return {
          passed,
          score: passed ? 1 : 0,
          details: !passed
            ? invalidDeps.length > 0
              ? `Invalid dependencies: ${invalidDeps.join(', ')}`
              : 'Circular dependency detected'
            : 'All dependencies valid',
          suggestedFix: !passed
            ? 'Fix dependency references and remove circular dependencies'
            : undefined,
          estimatedEffort: 'medium',
        };
      },
    },
    {
      id: 'balanced_complexity',
      name: 'Balanced Complexity',
      description: 'No tasks with "epic" complexity (should be broken down)',
      severity: 'major',
      category: 'incomplete',
      async validate(output, request, context): Promise<CriterionResult> {
        const result = output.result as any;
        const tasks = flattenTasks(result?.epics || []);

        const epicComplexity = tasks.filter(t => t.complexity === 'epic');

        return {
          passed: epicComplexity.length === 0,
          score: 1 - (epicComplexity.length / Math.max(tasks.length, 1)),
          details: epicComplexity.length > 0
            ? `${epicComplexity.length} tasks have "epic" complexity and should be broken down`
            : 'All tasks appropriately sized',
          suggestedFix: epicComplexity.length > 0
            ? `Break down these tasks into smaller units: ${epicComplexity.map(t => t.title).join(', ')}`
            : undefined,
          estimatedEffort: 'large',
        };
      },
    },
    {
      id: 'agents_assigned',
      name: 'Agents Assigned',
      description: 'All tasks have appropriate agents assigned',
      severity: 'major',
      category: 'incomplete',
      async validate(output, request, context): Promise<CriterionResult> {
        const result = output.result as any;
        const tasks = flattenTasks(result?.epics || []);

        const withAgents = tasks.filter(t =>
          t.assignedAgents && t.assignedAgents.length > 0
        ).length;

        const score = tasks.length > 0 ? withAgents / tasks.length : 1;

        return {
          passed: score >= 0.95,
          score,
          details: score >= 0.95
            ? 'All tasks have agents assigned'
            : `${tasks.length - withAgents} tasks missing agent assignment`,
          suggestedFix: score < 0.95
            ? 'Assign appropriate agents based on task type'
            : undefined,
          estimatedEffort: 'small',
        };
      },
    },
  ];

  async checkRequirementCovered(
    requirement: string,
    output: AgentOutput,
    context: ReviewContext
  ): Promise<RequirementCoverage> {
    const result = output.result as any;
    const tasks = flattenTasks(result?.epics || []);
    const features = result?.epics?.flatMap((e: any) => e.features) || [];

    // Check if requirement maps to any task or feature
    const reqLower = requirement.toLowerCase();

    const matchingTask = tasks.find(t =>
      t.title.toLowerCase().includes(reqLower) ||
      t.description?.toLowerCase().includes(reqLower)
    );

    const matchingFeature = features.find((f: any) =>
      f.title.toLowerCase().includes(reqLower) ||
      f.userStory?.toLowerCase().includes(reqLower)
    );

    const covered = Boolean(matchingTask || matchingFeature);

    return {
      requirement,
      source: 'explicit',
      covered,
      coverageDetails: covered
        ? `Covered by: ${matchingTask?.title || matchingFeature?.title}`
        : 'No task or feature addresses this requirement',
      evidenceLocation: matchingTask?.id || matchingFeature?.id,
      confidence: covered ? 0.8 : 0.2,
    };
  }
}

// Helper functions
function flattenTasks(epics: any[]): any[] {
  return epics.flatMap(e =>
    (e.features || []).flatMap((f: any) => f.tasks || [])
  );
}

function detectCycle(tasks: any[]): boolean {
  const graph = new Map<string, string[]>();
  for (const task of tasks) {
    graph.set(task.id, task.dependencies || []);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(taskId: string): boolean {
    visited.add(taskId);
    recursionStack.add(taskId);

    for (const dep of graph.get(taskId) || []) {
      if (!visited.has(dep)) {
        if (dfs(dep)) return true;
      } else if (recursionStack.has(dep)) {
        return true;
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      if (dfs(task.id)) return true;
    }
  }

  return false;
}
```

---

## 6. BaseAgent Integration

### 6.1 Updated BaseAgent Execute Method

```typescript
// packages/agents/src/base-agent.ts (additions)

import { SelfReviewLoop } from './review/self-review-loop';
import { SelfReviewResult, SelfReviewConfig } from './review/schemas';
import { AgentReviewCriteria } from './review/criteria/base-criteria';
import { buildGapAddressingPrompt, mergeImprovements } from './review/gap-addresser';

abstract class BaseAgent {
  // ... existing code ...

  /**
   * Get review criteria for this agent type (override in subclasses)
   */
  protected abstract getReviewCriteria(): AgentReviewCriteria;

  /**
   * Get self-review configuration
   */
  protected getSelfReviewConfig(): Partial<SelfReviewConfig> {
    return {
      enabled: true,
      maxIterations: 3,
      qualityThreshold: 0.8,
    };
  }

  /**
   * Execute with self-review loop
   */
  async execute(request: AgentRequest): Promise<AgentOutput> {
    const reviewCriteria = this.getReviewCriteria();
    const reviewConfig = this.getSelfReviewConfig();

    const reviewLoop = new SelfReviewLoop(reviewCriteria, reviewConfig);

    const { output, reviews } = await reviewLoop.execute(
      request,
      // Production function
      () => this.produce(request),
      // Gap addressing function
      (currentOutput, gaps) => this.addressGaps(request, currentOutput, gaps)
    );

    // Capture for learning if enabled
    if (reviewConfig.captureForLearning && reviews.length > 0) {
      await this.captureReviewLearning(request, output, reviews);
    }

    return output;
  }

  /**
   * Produce initial output (the original execute logic)
   */
  protected abstract produce(request: AgentRequest): Promise<AgentOutput>;

  /**
   * Address gaps identified in review
   */
  protected async addressGaps(
    request: AgentRequest,
    currentOutput: AgentOutput,
    gaps: Gap[]
  ): Promise<AgentOutput> {
    const prompt = buildGapAddressingPrompt(
      request.context.task.description || '',
      currentOutput,
      gaps
    );

    // Call LLM to generate improvements
    const improvements = await this.callLLMForImprovements(prompt);

    // Merge improvements into current output
    return mergeImprovements(currentOutput, improvements);
  }

  /**
   * Capture review patterns for learning
   */
  protected async captureReviewLearning(
    request: AgentRequest,
    finalOutput: AgentOutput,
    reviews: SelfReviewResult[]
  ): Promise<void> {
    // Will be implemented in lesson extraction integration
    // For now, just log
    const firstReview = reviews[0];
    const lastReview = reviews[reviews.length - 1];

    if (firstReview && lastReview) {
      logger.info('Self-review learning capture', {
        agentId: this.metadata.id,
        taskId: request.context.task.id,
        iterations: reviews.length,
        initialScore: firstReview.qualityScore,
        finalScore: lastReview.qualityScore,
        improvement: lastReview.qualityScore - firstReview.qualityScore,
        gapsAddressed: firstReview.gaps.length - lastReview.gaps.length,
      });
    }
  }
}
```

---

## 7. Learning Integration

### 7.1 Review-Based Lesson Structure

```typescript
// packages/agents/src/review/learning-integration.ts

import { SelfReviewResult, Gap } from './schemas';
import { LessonInput } from '../../persistence/lessons-store';

/**
 * Convert review results into a lesson for learning
 */
export function createLessonFromReview(
  agentId: string,
  taskDescription: string,
  reviews: SelfReviewResult[]
): LessonInput | null {
  if (reviews.length < 2) {
    return null; // Nothing to learn from single iteration
  }

  const firstReview = reviews[0];
  const lastReview = reviews[reviews.length - 1];
  const improvement = lastReview.qualityScore - firstReview.qualityScore;

  // Only create lesson if there was meaningful learning
  if (improvement < 0.1 && lastReview.gaps.length === 0) {
    return null;
  }

  // Identify common gap patterns
  const gapPatterns = analyzeGapPatterns(reviews);
  const successfulFixes = analyzeSuccessfulFixes(reviews);

  return {
    category: 'pattern',
    title: `${agentId} self-review pattern: ${summarizeGaps(gapPatterns)}`,
    summary: generateLearningSummary(agentId, reviews, gapPatterns),
    details: JSON.stringify({
      agentId,
      taskType: inferTaskType(taskDescription),
      iterations: reviews.length,
      initialScore: firstReview.qualityScore,
      finalScore: lastReview.qualityScore,
      gapPatterns,
      successfulFixes,
    }),
    tags: [
      `agent:${agentId}`,
      'self-review',
      ...gapPatterns.map(p => `gap:${p.category}`),
    ],
    sourceAgent: agentId,
    confidence: improvement > 0.2 ? 0.9 : 0.7,
  };
}

interface GapPattern {
  category: string;
  severity: string;
  frequency: number;
  examples: string[];
}

function analyzeGapPatterns(reviews: SelfReviewResult[]): GapPattern[] {
  const patterns = new Map<string, GapPattern>();

  for (const review of reviews) {
    for (const gap of review.gaps) {
      const key = `${gap.category}-${gap.severity}`;
      const existing = patterns.get(key) || {
        category: gap.category,
        severity: gap.severity,
        frequency: 0,
        examples: [],
      };
      existing.frequency++;
      if (existing.examples.length < 3) {
        existing.examples.push(gap.description);
      }
      patterns.set(key, existing);
    }
  }

  return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
}

function analyzeSuccessfulFixes(reviews: SelfReviewResult[]): string[] {
  const fixes: string[] = [];

  for (let i = 1; i < reviews.length; i++) {
    const prevGaps = new Set(reviews[i - 1].gaps.map(g => g.id));
    const currGapIds = new Set(reviews[i].gaps.map(g => g.id));

    // Find gaps that were present before but not now
    const resolvedGaps = reviews[i - 1].gaps.filter(g => !currGapIds.has(g.id));

    for (const resolved of resolvedGaps) {
      fixes.push(`Fixed ${resolved.category}: ${resolved.description} via ${resolved.suggestedFix}`);
    }
  }

  return fixes;
}

function summarizeGaps(patterns: GapPattern[]): string {
  if (patterns.length === 0) return 'no gaps';
  return patterns.slice(0, 2).map(p => p.category).join(', ');
}

function generateLearningSummary(
  agentId: string,
  reviews: SelfReviewResult[],
  patterns: GapPattern[]
): string {
  const first = reviews[0];
  const last = reviews[reviews.length - 1];

  return `Agent ${agentId} improved from ${(first.qualityScore * 100).toFixed(0)}% to ${(last.qualityScore * 100).toFixed(0)}% quality over ${reviews.length} iterations. Common gaps: ${patterns.map(p => `${p.category} (${p.frequency}x)`).join(', ')}.`;
}

function inferTaskType(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('design') || lower.includes('mockup')) return 'design';
  if (lower.includes('api') || lower.includes('endpoint')) return 'backend';
  if (lower.includes('component') || lower.includes('ui')) return 'frontend';
  if (lower.includes('test')) return 'testing';
  return 'general';
}
```

---

## Validation Checklist

```
[ ] Self-Review Framework (Step 12a)
  [ ] SelfReviewLoop class implemented
  [ ] SelfReviewResult schema defined
  [ ] Gap schema with severity/category
  [ ] RequirementCoverage tracking works
  [ ] Quality scoring calculates correctly
  [ ] Decision logic (approved/needs_work/escalate) works
  [ ] Max iterations enforced
  [ ] Escalation triggers on critical gaps
  [ ] Gap addressing prompt generation works
  [ ] Improvement merging works
  [ ] Learning capture integration works

[ ] Review Criteria
  [ ] BaseAgentReviewCriteria interface defined
  [ ] UI Designer criteria implemented
  [ ] Project Manager criteria implemented
  [ ] Requirement extraction works
  [ ] Requirement coverage checking works

[ ] BaseAgent Integration
  [ ] execute() uses SelfReviewLoop
  [ ] getReviewCriteria() abstract method added
  [ ] getSelfReviewConfig() method added
  [ ] addressGaps() method works
  [ ] Learning capture called after review

[ ] Tests
  [ ] SelfReviewLoop unit tests pass
  [ ] Each criterion validator tested
  [ ] Gap addressing tested
  [ ] Integration tests pass
```

---

## Next Step

Proceed to **13-ORCHESTRATOR-GRAPH.md** to update orchestrator with review escalation handling.
