/**
 * Analyst Agent Output Schema
 *
 * Defines schemas for research reports, comparisons,
 * best practices, and recommendations.
 *
 * SECURITY:
 * - URL validation on sources
 * - Confidence bounds validation
 *
 * LENIENT: Uses lenient parsing utilities to handle Claude's output variations.
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema } from '../types.js';
import type { StyleResearchOutput } from './analyst-style-output.js';
import {
  lenientEnum,
  lenientArray,
  lenientConfidence,
  lenientBoolean,
  lenientUrl,
} from './lenient-utils.js';

/**
 * Source type values
 */
const SOURCE_TYPES = ['documentation', 'article', 'github', 'stackoverflow', 'book', 'video', 'other'] as const;

/**
 * Source type for research citations (lenient)
 */
export const SourceTypeSchema = lenientEnum(SOURCE_TYPES, 'other');

export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Credibility level values
 */
const CREDIBILITY_LEVELS = ['official', 'community', 'expert', 'unknown'] as const;

/**
 * Source credibility level (lenient)
 */
export const CredibilitySchema = lenientEnum(CREDIBILITY_LEVELS, 'unknown');

export type Credibility = z.infer<typeof CredibilitySchema>;

/**
 * Research source with citation (lenient)
 */
export const SourceSchema = z.object({
  title: z.string().max(500).default(''),
  url: lenientUrl.optional(),
  type: SourceTypeSchema,
  credibility: CredibilitySchema,
  date: z.string().max(50).optional(),
});

export type Source = z.infer<typeof SourceSchema>;

/**
 * Popularity level values
 */
const POPULARITY_LEVELS = ['high', 'medium', 'low', 'unknown'] as const;

/**
 * Popularity level for comparison (lenient)
 */
export const PopularitySchema = lenientEnum(POPULARITY_LEVELS, 'unknown');

export type Popularity = z.infer<typeof PopularitySchema>;

/**
 * Maintenance status values
 */
const MAINTENANCE_STATUSES = ['active', 'stable', 'declining', 'abandoned', 'unknown'] as const;

/**
 * Maintenance status (lenient)
 */
export const MaintenanceSchema = lenientEnum(MAINTENANCE_STATUSES, 'unknown');

export type Maintenance = z.infer<typeof MaintenanceSchema>;

/**
 * Learning curve values
 */
const LEARNING_CURVES = ['easy', 'moderate', 'steep'] as const;

/**
 * Learning curve difficulty (lenient)
 */
export const LearningCurveSchema = lenientEnum(LEARNING_CURVES, 'moderate');

export type LearningCurve = z.infer<typeof LearningCurveSchema>;

/**
 * Community size values
 */
const COMMUNITY_SIZES = ['large', 'medium', 'small', 'unknown'] as const;

/**
 * Community size (lenient)
 */
export const CommunitySizeSchema = lenientEnum(COMMUNITY_SIZES, 'unknown');

export type CommunitySize = z.infer<typeof CommunitySizeSchema>;

/**
 * Comparison option for technology/library evaluation (lenient)
 */
export const ComparisonOptionSchema = z.object({
  name: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  pros: lenientArray(z.string().max(500)),
  cons: lenientArray(z.string().max(500)),
  useCases: lenientArray(z.string().max(500)),
  popularity: PopularitySchema,
  maintenance: MaintenanceSchema,
  learningCurve: LearningCurveSchema,
  communitySize: CommunitySizeSchema,
  score: z.number().min(0).max(100).optional(),
});

export type ComparisonOption = z.infer<typeof ComparisonOptionSchema>;

/**
 * Comparison result (lenient)
 */
export const ComparisonSchema = z.object({
  options: lenientArray(ComparisonOptionSchema),
  winner: z.string().max(200).optional(),
  criteria: lenientArray(z.string().max(200)),
  matrix: z.record(z.string(), z.record(z.string(), z.number())).optional(),
});

export type Comparison = z.infer<typeof ComparisonSchema>;

/**
 * Best practice recommendation (lenient)
 */
export const BestPracticeSchema = z.object({
  title: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  rationale: z.string().max(2000).default(''),
  example: z.string().max(5000).optional(),
  caveats: lenientArray(z.string().max(500)),
  sources: lenientArray(SourceSchema),
});

export type BestPractice = z.infer<typeof BestPracticeSchema>;

/**
 * Research finding (lenient)
 */
export const FindingSchema = z.object({
  topic: z.string().max(200).default(''),
  summary: z.string().max(500).default(''),
  details: z.string().max(5000).default(''),
  evidence: lenientArray(z.string().max(1000)),
  confidence: lenientConfidence,
  sources: lenientArray(SourceSchema),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Alternative option in recommendation (lenient)
 */
export const AlternativeSchema = z.object({
  option: z.string().max(200).default(''),
  whenToUse: z.string().max(500).default(''),
});

export type Alternative = z.infer<typeof AlternativeSchema>;

/**
 * Implementation steps (lenient)
 */
export const ImplementationSchema = z.object({
  steps: lenientArray(z.string().max(500)),
  estimatedEffort: z.string().max(100).default(''),
  risks: lenientArray(z.string().max(500)),
});

export type Implementation = z.infer<typeof ImplementationSchema>;

/**
 * Recommendation with reasoning (lenient)
 */
export const RecommendationSchema = z.object({
  recommendation: z.string().max(2000).default(''),
  reasoning: z.string().max(5000).default(''),
  confidence: lenientConfidence,
  alternatives: lenientArray(AlternativeSchema),
  implementation: ImplementationSchema.optional(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Report type values
 */
const REPORT_TYPES = ['comparison', 'best_practices', 'investigation', 'recommendation', 'feasibility', 'style_research'] as const;

/**
 * Research report types (lenient)
 */
export const ReportTypeSchema = lenientEnum(REPORT_TYPES, 'investigation');

export type ReportType = z.infer<typeof ReportTypeSchema>;

/**
 * Analyst routing hints (extended from base)
 * Uses LenientAgentTypeArraySchema and lenientBoolean
 */
export const AnalystRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: lenientBoolean,
  hasFailures: lenientBoolean,
  isComplete: lenientBoolean,
  needsUserDecision: lenientBoolean,
  suggestedOption: z.string().max(200).optional(),
}).default({
  suggestNext: [],
  skipAgents: [],
  needsApproval: false,
  hasFailures: false,
  isComplete: false,
  needsUserDecision: false,
});

export type AnalystRoutingHints = z.infer<typeof AnalystRoutingHintsSchema>;

/**
 * Complete Analyst output (lenient)
 */
export const AnalystOutputSchema = z.object({
  reportType: ReportTypeSchema,
  question: z.string().max(1000).default(''),
  executiveSummary: z.string().max(2000).default(''),

  // For comparison reports
  comparison: ComparisonSchema.optional(),

  // For best practices reports
  bestPractices: lenientArray(BestPracticeSchema).optional(),

  // For investigation reports
  findings: lenientArray(FindingSchema).optional(),

  // For style research reports (design workflow)
  // Using z.custom to reference the type from analyst-style-output.ts
  styleResearch: z.custom<StyleResearchOutput>().optional(),

  // For all reports
  recommendation: RecommendationSchema.optional(),
  sources: lenientArray(SourceSchema),
  limitations: lenientArray(z.string().max(500)),
  furtherResearch: lenientArray(z.string().max(500)),

  routingHints: AnalystRoutingHintsSchema,
});

export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;

/**
 * Create a new source
 */
export function createSource(
  title: string,
  type: SourceType,
  credibility: Credibility,
  url?: string
): Source {
  return {
    title,
    type,
    credibility,
    url,
    date: new Date().toISOString().split('T')[0],
  };
}

/**
 * Create an empty recommendation
 */
export function createRecommendation(
  recommendation: string,
  reasoning: string,
  confidence: number
): Recommendation {
  return {
    recommendation,
    reasoning,
    confidence: Math.max(0, Math.min(1, confidence)),
    alternatives: [],
  };
}

/**
 * Create an empty comparison option
 */
export function createComparisonOption(
  name: string,
  description: string
): ComparisonOption {
  return {
    name,
    description,
    pros: [],
    cons: [],
    useCases: [],
    popularity: 'unknown',
    maintenance: 'unknown',
    learningCurve: 'moderate',
    communitySize: 'unknown',
  };
}

/**
 * Create an empty finding
 */
export function createFinding(
  topic: string,
  summary: string,
  details: string
): Finding {
  return {
    topic,
    summary,
    details,
    evidence: [],
    confidence: 0.5,
    sources: [],
  };
}

/**
 * Calculate average confidence from findings
 */
export function calculateAverageConfidence(findings: Finding[]): number {
  if (findings.length === 0) return 0;
  const sum = findings.reduce((acc, f) => acc + f.confidence, 0);
  return sum / findings.length;
}

/**
 * Count sources by credibility
 */
export function countSourcesByCredibility(
  sources: Source[]
): Record<Credibility, number> {
  const counts: Record<Credibility, number> = {
    official: 0,
    community: 0,
    expert: 0,
    unknown: 0,
  };

  for (const source of sources) {
    counts[source.credibility]++;
  }

  return counts;
}
