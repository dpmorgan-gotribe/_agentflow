/**
 * Gap Addresser
 *
 * Utilities for addressing gaps identified during self-review.
 * Generates prompts for gap fixing and merges improvements.
 *
 * Security:
 * - Output content truncated to prevent excessive prompts
 * - No filesystem access
 */

import type { AgentOutput, Artifact } from '../types.js';
import type { Gap } from './schemas.js';

// ============================================================================
// Constants
// ============================================================================

/** Max length for output summary in prompts */
const MAX_OUTPUT_SUMMARY_LENGTH = 5000;

/** Max length for result JSON in summary */
const MAX_RESULT_JSON_LENGTH = 2000;

// ============================================================================
// Prompt Building
// ============================================================================

/**
 * Build a prompt for addressing identified gaps
 *
 * @param originalTask - Original task description
 * @param currentOutput - Current agent output with gaps
 * @param gaps - Gaps to address
 * @returns Prompt string for gap addressing
 */
export function buildGapAddressingPrompt(
  originalTask: string,
  currentOutput: AgentOutput,
  gaps: Gap[]
): string {
  const gapDescriptions = gaps
    .map((gap, i) => {
      const parts = [
        `${i + 1}. [${gap.severity.toUpperCase()}] ${gap.description}`,
        `   Suggested fix: ${gap.suggestedFix}`,
        `   Effort: ${gap.estimatedEffort}`,
      ];
      if (gap.affectedRequirement) {
        parts.push(`   Requirement: ${gap.affectedRequirement}`);
      }
      if (gap.affectedArtifact) {
        parts.push(`   Artifact: ${gap.affectedArtifact}`);
      }
      return parts.join('\n');
    })
    .join('\n\n');

  const outputSummary = summarizeOutput(currentOutput);

  return `You previously produced output for this task, but self-review identified gaps that need to be addressed.

ORIGINAL TASK:
${truncate(originalTask, 2000)}

CURRENT OUTPUT SUMMARY:
${outputSummary}

GAPS TO ADDRESS:
${gapDescriptions}

Please provide ONLY the improvements needed to address these gaps. For each gap:
1. Acknowledge the issue
2. Provide the corrected/additional content
3. Explain how the fix addresses the gap

Focus on the gaps - do not regenerate content that was already correct.

Respond with JSON containing the improvements:
\`\`\`json
{
  "improvements": [
    {
      "gapId": "<gap id>",
      "fixed": true,
      "description": "<what was fixed>",
      "content": "<new or updated content>"
    }
  ],
  "updatedArtifacts": [
    {
      "path": "<artifact path>",
      "content": "<updated content>",
      "type": "<artifact type>"
    }
  ]
}
\`\`\``;
}

/**
 * Summarize agent output for prompt injection
 */
function summarizeOutput(output: AgentOutput): string {
  const parts: string[] = [];

  // Summarize artifacts
  if (output.artifacts && output.artifacts.length > 0) {
    const artifactList = output.artifacts
      .map((a) => `${a.type}:${a.path}`)
      .slice(0, 10)
      .join(', ');
    parts.push(`Artifacts: ${artifactList}`);

    if (output.artifacts.length > 10) {
      parts.push(`... and ${output.artifacts.length - 10} more`);
    }
  }

  // Summarize result
  if (output.result) {
    try {
      const resultStr = JSON.stringify(output.result, null, 2);
      if (resultStr.length > MAX_RESULT_JSON_LENGTH) {
        parts.push(`Result: ${resultStr.substring(0, MAX_RESULT_JSON_LENGTH)}...`);
      } else {
        parts.push(`Result: ${resultStr}`);
      }
    } catch {
      parts.push(`Result: [Complex object]`);
    }
  }

  // Add routing hints summary
  if (output.routingHints) {
    const hints: string[] = [];
    if (output.routingHints.isComplete) hints.push('complete');
    if (output.routingHints.hasFailures) hints.push('has failures');
    if (output.routingHints.needsApproval) hints.push('needs approval');
    if (hints.length > 0) {
      parts.push(`Status: ${hints.join(', ')}`);
    }
  }

  const summary = parts.join('\n');
  return truncate(summary, MAX_OUTPUT_SUMMARY_LENGTH);
}

/**
 * Truncate string to max length with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Improvement Merging
// ============================================================================

/**
 * Improvement data from gap addressing
 */
export interface ImprovementData {
  improvements?: Array<{
    gapId: string;
    fixed: boolean;
    description: string;
    content?: string;
  }>;
  updatedArtifacts?: Array<{
    path: string;
    content: string;
    type: string;
  }>;
}

/**
 * Merge improvements into existing output
 *
 * @param currentOutput - Current agent output
 * @param improvements - New output with improvements
 * @returns Merged output
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
    routingHints: {
      ...currentOutput.routingHints,
      ...improvements.routingHints,
    },
    // Merge metrics (sum tokens, update duration)
    metrics: {
      ...currentOutput.metrics,
      tokensUsed:
        (currentOutput.metrics?.tokensUsed || 0) +
        (improvements.metrics?.tokensUsed || 0),
      llmCalls:
        (currentOutput.metrics?.llmCalls || 0) +
        (improvements.metrics?.llmCalls || 0),
    },
  };
}

/**
 * Merge result objects
 */
function mergeResults(current: unknown, improvements: unknown): unknown {
  if (!improvements) return current;
  if (!current) return improvements;

  // If both are objects, shallow merge
  if (
    typeof current === 'object' &&
    typeof improvements === 'object' &&
    current !== null &&
    improvements !== null &&
    !Array.isArray(current) &&
    !Array.isArray(improvements)
  ) {
    return { ...current, ...improvements };
  }

  // Otherwise, prefer improvements
  return improvements;
}

/**
 * Merge artifact arrays
 *
 * Updates existing artifacts by path, adds new ones
 */
function mergeArtifacts(
  current: Artifact[],
  improvements: Artifact[]
): Artifact[] {
  if (!improvements || improvements.length === 0) {
    return current || [];
  }

  const merged = [...(current || [])];

  for (const improvement of improvements) {
    const existingIndex = merged.findIndex((a) => a.path === improvement.path);
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

// ============================================================================
// Gap Analysis Utilities
// ============================================================================

/**
 * Filter gaps that can be auto-fixed
 */
export function getFixableGaps(gaps: Gap[]): Gap[] {
  return gaps.filter((g) => g.autoFixable);
}

/**
 * Get gaps by severity
 */
export function getGapsBySeverity(
  gaps: Gap[],
  severity: 'critical' | 'major' | 'minor'
): Gap[] {
  return gaps.filter((g) => g.severity === severity);
}

/**
 * Get gaps by category
 */
export function getGapsByCategory(
  gaps: Gap[],
  category: 'missing' | 'incorrect' | 'incomplete' | 'quality'
): Gap[] {
  return gaps.filter((g) => g.category === category);
}

/**
 * Prioritize gaps for fixing (critical first, then by effort)
 */
export function prioritizeGaps(gaps: Gap[]): Gap[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    major: 1,
    minor: 2,
  };

  const effortOrder: Record<string, number> = {
    trivial: 0,
    small: 1,
    medium: 2,
    large: 3,
  };

  return [...gaps].sort((a, b) => {
    // First by severity
    const sevDiff =
      (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    if (sevDiff !== 0) return sevDiff;

    // Then by effort (smaller first)
    return (
      (effortOrder[a.estimatedEffort] || 2) -
      (effortOrder[b.estimatedEffort] || 2)
    );
  });
}

/**
 * Estimate total effort to fix all gaps
 */
export function estimateTotalEffort(
  gaps: Gap[]
): 'trivial' | 'small' | 'medium' | 'large' | 'epic' {
  const effortScores: Record<string, number> = {
    trivial: 1,
    small: 2,
    medium: 4,
    large: 8,
  };

  const total = gaps.reduce(
    (sum, gap) => sum + (effortScores[gap.estimatedEffort] || 4),
    0
  );

  if (total <= 2) return 'trivial';
  if (total <= 6) return 'small';
  if (total <= 12) return 'medium';
  if (total <= 24) return 'large';
  return 'epic';
}
