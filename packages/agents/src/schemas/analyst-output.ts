/**
 * Analyst Agent Output Schema
 *
 * Defines schemas for research reports, comparisons,
 * best practices, and recommendations.
 *
 * SECURITY:
 * - URL validation on sources
 * - Confidence bounds validation
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema } from '../types.js';
import type { StyleResearchOutput } from './analyst-style-output.js';

/**
 * Source type for research citations
 */
export const SourceTypeSchema = z.enum([
  'documentation',
  'article',
  'github',
  'stackoverflow',
  'book',
  'video',
  'other',
]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Source credibility level
 */
export const CredibilitySchema = z.enum(['official', 'community', 'expert', 'unknown']);

export type Credibility = z.infer<typeof CredibilitySchema>;

/**
 * Research source with citation
 */
export const SourceSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url().optional(),
  type: SourceTypeSchema,
  credibility: CredibilitySchema,
  date: z.string().max(50).optional(),
});

export type Source = z.infer<typeof SourceSchema>;

/**
 * Popularity level for comparison
 */
export const PopularitySchema = z.enum(['high', 'medium', 'low', 'unknown']);

export type Popularity = z.infer<typeof PopularitySchema>;

/**
 * Maintenance status
 */
export const MaintenanceSchema = z.enum([
  'active',
  'stable',
  'declining',
  'abandoned',
  'unknown',
]);

export type Maintenance = z.infer<typeof MaintenanceSchema>;

/**
 * Learning curve difficulty
 */
export const LearningCurveSchema = z.enum(['easy', 'moderate', 'steep']);

export type LearningCurve = z.infer<typeof LearningCurveSchema>;

/**
 * Community size
 */
export const CommunitySizeSchema = z.enum(['large', 'medium', 'small', 'unknown']);

export type CommunitySize = z.infer<typeof CommunitySizeSchema>;

/**
 * Comparison option for technology/library evaluation
 */
export const ComparisonOptionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  pros: z.array(z.string().min(1).max(500)),
  cons: z.array(z.string().min(1).max(500)),
  useCases: z.array(z.string().min(1).max(500)),
  popularity: PopularitySchema,
  maintenance: MaintenanceSchema,
  learningCurve: LearningCurveSchema,
  communitySize: CommunitySizeSchema,
  score: z.number().min(0).max(100).optional(),
});

export type ComparisonOption = z.infer<typeof ComparisonOptionSchema>;

/**
 * Comparison result
 */
export const ComparisonSchema = z.object({
  options: z.array(ComparisonOptionSchema),
  winner: z.string().max(200).optional(),
  criteria: z.array(z.string().min(1).max(200)),
  matrix: z.record(z.string(), z.record(z.string(), z.number())).optional(),
});

export type Comparison = z.infer<typeof ComparisonSchema>;

/**
 * Best practice recommendation
 */
export const BestPracticeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(2000),
  example: z.string().max(5000).optional(),
  caveats: z.array(z.string().min(1).max(500)),
  sources: z.array(SourceSchema),
});

export type BestPractice = z.infer<typeof BestPracticeSchema>;

/**
 * Research finding
 */
export const FindingSchema = z.object({
  topic: z.string().min(1).max(200),
  summary: z.string().min(1).max(500),
  details: z.string().min(1).max(5000),
  evidence: z.array(z.string().min(1).max(1000)),
  confidence: z.number().min(0).max(1),
  sources: z.array(SourceSchema),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Alternative option in recommendation
 */
export const AlternativeSchema = z.object({
  option: z.string().min(1).max(200),
  whenToUse: z.string().min(1).max(500),
});

export type Alternative = z.infer<typeof AlternativeSchema>;

/**
 * Implementation steps
 */
export const ImplementationSchema = z.object({
  steps: z.array(z.string().min(1).max(500)),
  estimatedEffort: z.string().min(1).max(100),
  risks: z.array(z.string().min(1).max(500)),
});

export type Implementation = z.infer<typeof ImplementationSchema>;

/**
 * Recommendation with reasoning
 */
export const RecommendationSchema = z.object({
  recommendation: z.string().min(1).max(2000),
  reasoning: z.string().min(1).max(5000),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(AlternativeSchema),
  implementation: ImplementationSchema.optional(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Research report types
 */
export const ReportTypeSchema = z.enum([
  'comparison',
  'best_practices',
  'investigation',
  'recommendation',
  'feasibility',
  'style_research',
]);

export type ReportType = z.infer<typeof ReportTypeSchema>;

/**
 * Analyst routing hints (extended from base)
 * Uses LenientAgentTypeArraySchema to handle common Claude name variations
 */
export const AnalystRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: z.boolean(),
  hasFailures: z.boolean(),
  isComplete: z.boolean(),
  needsUserDecision: z.boolean(),
  suggestedOption: z.string().max(200).optional(),
});

export type AnalystRoutingHints = z.infer<typeof AnalystRoutingHintsSchema>;

/**
 * Complete Analyst output
 */
export const AnalystOutputSchema = z.object({
  reportType: ReportTypeSchema,
  question: z.string().min(1).max(1000),
  executiveSummary: z.string().min(1).max(2000),

  // For comparison reports
  comparison: ComparisonSchema.optional(),

  // For best practices reports
  bestPractices: z.array(BestPracticeSchema).optional(),

  // For investigation reports
  findings: z.array(FindingSchema).optional(),

  // For style research reports (design workflow)
  // Using z.custom to reference the type from analyst-style-output.ts
  styleResearch: z.custom<StyleResearchOutput>().optional(),

  // For all reports
  recommendation: RecommendationSchema,
  sources: z.array(SourceSchema),
  limitations: z.array(z.string().min(1).max(500)),
  furtherResearch: z.array(z.string().min(1).max(500)),

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
