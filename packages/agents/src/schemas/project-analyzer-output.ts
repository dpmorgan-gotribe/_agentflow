/**
 * Project Analyzer Output Schema
 *
 * Defines schemas for codebase analysis, tech stack detection,
 * pattern recognition, and quality assessment.
 *
 * SECURITY:
 * - Path validation to prevent traversal attacks
 * - Confidence bounds validation
 * - String length limits to prevent payload abuse
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema } from '../types.js';

/**
 * Path validation regex - prevents traversal attacks
 */
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-./\\]+$/;

/**
 * Detected programming language
 */
export const DetectedLanguageSchema = z.object({
  name: z.string().min(1).max(100),
  percentage: z.number().min(0).max(100),
  files: z.number().int().min(0),
  lines: z.number().int().min(0),
  primary: z.boolean(),
});

export type DetectedLanguage = z.infer<typeof DetectedLanguageSchema>;

/**
 * Framework type categories
 */
export const FrameworkTypeSchema = z.enum([
  'frontend',
  'backend',
  'fullstack',
  'testing',
  'build',
  'utility',
]);

export type FrameworkType = z.infer<typeof FrameworkTypeSchema>;

/**
 * Detected framework with confidence scoring
 */
export const DetectedFrameworkSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.string().max(50).optional(),
  type: FrameworkTypeSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(1).max(500)),
});

export type DetectedFramework = z.infer<typeof DetectedFrameworkSchema>;

/**
 * Directory importance levels
 */
export const ImportanceSchema = z.enum(['critical', 'high', 'medium', 'low']);

export type Importance = z.infer<typeof ImportanceSchema>;

/**
 * Directory analysis result
 */
export const DirectoryAnalysisSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => SAFE_PATH_REGEX.test(p), {
      message: 'Invalid path characters detected',
    }),
  purpose: z.string().min(1).max(500),
  fileCount: z.number().int().min(0),
  patterns: z.array(z.string().min(1).max(100)),
  technologies: z.array(z.string().min(1).max(100)),
  importance: ImportanceSchema,
});

export type DirectoryAnalysis = z.infer<typeof DirectoryAnalysisSchema>;

/**
 * Pattern categories for detection
 */
export const PatternCategorySchema = z.enum([
  'architecture',
  'design',
  'testing',
  'state',
  'api',
  'data',
]);

export type PatternCategory = z.infer<typeof PatternCategorySchema>;

/**
 * Detected coding/architecture pattern
 */
export const DetectedPatternSchema = z.object({
  name: z.string().min(1).max(200),
  category: PatternCategorySchema,
  description: z.string().min(1).max(2000),
  locations: z.array(
    z
      .string()
      .min(1)
      .max(500)
      .refine((p) => SAFE_PATH_REGEX.test(p), {
        message: 'Invalid path characters detected',
      })
  ),
  confidence: z.number().min(0).max(1),
});

export type DetectedPattern = z.infer<typeof DetectedPatternSchema>;

/**
 * Code quality issue type
 */
export const IssueTypeSchema = z.enum(['warning', 'error', 'suggestion']);

export type IssueType = z.infer<typeof IssueTypeSchema>;

/**
 * Code quality issue
 */
export const CodeQualityIssueSchema = z.object({
  type: IssueTypeSchema,
  message: z.string().min(1).max(1000),
  location: z.string().max(500).optional(),
});

export type CodeQualityIssue = z.infer<typeof CodeQualityIssueSchema>;

/**
 * Code quality assessment
 */
export const CodeQualitySchema = z.object({
  hasTests: z.boolean(),
  testCoverage: z.string().max(50).optional(),
  hasLinting: z.boolean(),
  hasTypeChecking: z.boolean(),
  hasDocumentation: z.boolean(),
  hasCI: z.boolean(),
  hasSecurity: z.boolean(),
  issues: z.array(CodeQualityIssueSchema),
});

export type CodeQuality = z.infer<typeof CodeQualitySchema>;

/**
 * Compliance indicators for security/privacy analysis
 */
export const ComplianceIndicatorsSchema = z.object({
  handlesPersonalData: z.boolean(),
  hasAuthentication: z.boolean(),
  hasAuthorization: z.boolean(),
  hasAuditLogging: z.boolean(),
  hasEncryption: z.boolean(),
  hasSensitiveData: z.boolean(),
  locations: z.record(z.string(), z.array(z.string().max(500))),
});

export type ComplianceIndicators = z.infer<typeof ComplianceIndicatorsSchema>;

/**
 * Entry point type
 */
export const EntryPointTypeSchema = z.enum([
  'application',
  'library',
  'cli',
  'api',
  'worker',
]);

export type EntryPointType = z.infer<typeof EntryPointTypeSchema>;

/**
 * Application entry point
 */
export const EntryPointSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => SAFE_PATH_REGEX.test(p), {
      message: 'Invalid path characters detected',
    }),
  type: EntryPointTypeSchema,
  description: z.string().min(1).max(500),
});

export type EntryPoint = z.infer<typeof EntryPointSchema>;

/**
 * Outdated dependency severity
 */
export const OutdatedSeveritySchema = z.enum(['major', 'minor', 'patch']);

export type OutdatedSeverity = z.infer<typeof OutdatedSeveritySchema>;

/**
 * Outdated dependency info
 */
export const OutdatedDependencySchema = z.object({
  name: z.string().min(1).max(200),
  current: z.string().min(1).max(50),
  latest: z.string().min(1).max(50),
  type: OutdatedSeveritySchema,
});

export type OutdatedDependency = z.infer<typeof OutdatedDependencySchema>;

/**
 * Vulnerability severity levels
 */
export const VulnerabilitySeveritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export type VulnerabilitySeverity = z.infer<typeof VulnerabilitySeveritySchema>;

/**
 * Dependency vulnerability
 */
export const DependencyVulnerabilitySchema = z.object({
  name: z.string().min(1).max(200),
  severity: VulnerabilitySeveritySchema,
  description: z.string().min(1).max(2000),
});

export type DependencyVulnerability = z.infer<
  typeof DependencyVulnerabilitySchema
>;

/**
 * Dependency analysis summary
 */
export const DependencyAnalysisSchema = z.object({
  total: z.number().int().min(0),
  production: z.number().int().min(0),
  development: z.number().int().min(0),
  outdated: z.array(OutdatedDependencySchema),
  vulnerabilities: z.array(DependencyVulnerabilitySchema),
});

export type DependencyAnalysis = z.infer<typeof DependencyAnalysisSchema>;

/**
 * Recommendation categories
 */
export const RecommendationCategorySchema = z.enum([
  'architecture',
  'security',
  'testing',
  'performance',
  'maintainability',
  'documentation',
]);

export type RecommendationCategory = z.infer<
  typeof RecommendationCategorySchema
>;

/**
 * Recommendation priority
 */
export const RecommendationPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

export type RecommendationPriority = z.infer<
  typeof RecommendationPrioritySchema
>;

/**
 * Analysis recommendation
 */
export const AnalysisRecommendationSchema = z.object({
  category: RecommendationCategorySchema,
  priority: RecommendationPrioritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  effort: z.string().min(1).max(100),
});

export type AnalysisRecommendation = z.infer<
  typeof AnalysisRecommendationSchema
>;

/**
 * Project type classification
 */
export const ProjectTypeSchema = z.enum([
  'web-app',
  'api',
  'library',
  'cli',
  'monorepo',
  'mobile',
  'desktop',
  'unknown',
]);

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

/**
 * Tech stack summary
 */
export const TechStackSummarySchema = z.object({
  languages: z.array(DetectedLanguageSchema),
  frameworks: z.array(DetectedFrameworkSchema),
  databases: z.array(z.string().min(1).max(100)),
  infrastructure: z.array(z.string().min(1).max(100)),
});

export type TechStackSummary = z.infer<typeof TechStackSummarySchema>;

/**
 * Project structure analysis
 */
export const ProjectStructureSchema = z.object({
  rootDirectories: z.array(DirectoryAnalysisSchema),
  entryPoints: z.array(EntryPointSchema),
  configFiles: z.array(z.string().min(1).max(200)),
  totalFiles: z.number().int().min(0),
  totalLines: z.number().int().min(0),
});

export type ProjectStructure = z.infer<typeof ProjectStructureSchema>;

/**
 * Architecture summary
 */
export const ArchitectureSummarySchema = z.object({
  pattern: z.string().min(1).max(200),
  apiStyle: z.string().max(200).optional(),
  stateManagement: z.string().max(200).optional(),
  dataFlow: z.string().min(1).max(500),
});

export type ArchitectureSummary = z.infer<typeof ArchitectureSummarySchema>;

/**
 * Generated context files
 */
export const GeneratedContextSchema = z.object({
  claudeMd: z.string().max(50000),
  architectureYaml: z.string().max(50000),
});

export type GeneratedContext = z.infer<typeof GeneratedContextSchema>;

/**
 * Project analyzer routing hints
 * Uses LenientAgentTypeArraySchema to handle common Claude name variations
 */
export const ProjectAnalyzerRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: z.boolean(),
  hasFailures: z.boolean(),
  isComplete: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export type ProjectAnalyzerRoutingHints = z.infer<
  typeof ProjectAnalyzerRoutingHintsSchema
>;

/**
 * Complete Project Analyzer output
 */
export const ProjectAnalyzerOutputSchema = z.object({
  projectName: z.string().min(1).max(200),
  projectType: ProjectTypeSchema,

  techStack: TechStackSummarySchema,
  structure: ProjectStructureSchema,
  architecture: ArchitectureSummarySchema,

  patterns: z.array(DetectedPatternSchema),
  codeQuality: CodeQualitySchema,
  complianceIndicators: ComplianceIndicatorsSchema,
  dependencies: DependencyAnalysisSchema,

  recommendations: z.array(AnalysisRecommendationSchema),
  generatedContext: GeneratedContextSchema,

  routingHints: ProjectAnalyzerRoutingHintsSchema,
});

export type ProjectAnalyzerOutput = z.infer<typeof ProjectAnalyzerOutputSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a detected language entry
 */
export function createDetectedLanguage(
  name: string,
  percentage: number,
  files: number,
  lines: number,
  primary = false
): DetectedLanguage {
  return {
    name,
    percentage: Math.max(0, Math.min(100, percentage)),
    files: Math.max(0, files),
    lines: Math.max(0, lines),
    primary,
  };
}

/**
 * Create a detected framework entry
 */
export function createDetectedFramework(
  name: string,
  type: FrameworkType,
  confidence: number,
  evidence: string[] = [],
  version?: string
): DetectedFramework {
  return {
    name,
    type,
    confidence: Math.max(0, Math.min(1, confidence)),
    evidence,
    version,
  };
}

/**
 * Create an empty code quality assessment
 */
export function createEmptyCodeQuality(): CodeQuality {
  return {
    hasTests: false,
    hasLinting: false,
    hasTypeChecking: false,
    hasDocumentation: false,
    hasCI: false,
    hasSecurity: false,
    issues: [],
  };
}

/**
 * Create empty compliance indicators
 */
export function createEmptyComplianceIndicators(): ComplianceIndicators {
  return {
    handlesPersonalData: false,
    hasAuthentication: false,
    hasAuthorization: false,
    hasAuditLogging: false,
    hasEncryption: false,
    hasSensitiveData: false,
    locations: {},
  };
}

/**
 * Create a recommendation
 */
export function createRecommendation(
  category: RecommendationCategory,
  priority: RecommendationPriority,
  title: string,
  description: string,
  effort: string
): AnalysisRecommendation {
  return {
    category,
    priority,
    title,
    description,
    effort,
  };
}

/**
 * Calculate primary language from language list
 */
export function calculatePrimaryLanguage(
  languages: DetectedLanguage[]
): DetectedLanguage[] {
  if (languages.length === 0) return languages;

  // Find max percentage
  let maxPercentage = 0;
  let primaryName = '';

  for (const lang of languages) {
    if (lang.percentage > maxPercentage) {
      maxPercentage = lang.percentage;
      primaryName = lang.name;
    }
  }

  // Update primary flag
  return languages.map((lang) => ({
    ...lang,
    primary: lang.name === primaryName,
  }));
}

/**
 * Count total issues by type
 */
export function countIssuesByType(
  issues: CodeQualityIssue[]
): Record<IssueType, number> {
  const counts: Record<IssueType, number> = {
    warning: 0,
    error: 0,
    suggestion: 0,
  };

  for (const issue of issues) {
    counts[issue.type]++;
  }

  return counts;
}

/**
 * Get high-priority recommendations
 */
export function getHighPriorityRecommendations(
  recommendations: AnalysisRecommendation[]
): AnalysisRecommendation[] {
  return recommendations.filter(
    (r) => r.priority === 'critical' || r.priority === 'high'
  );
}

/**
 * Validate path for security (no traversal)
 */
export function isValidPath(path: string): boolean {
  // Check for path traversal attempts
  if (path.includes('..')) return false;
  if (path.startsWith('/')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false; // Windows absolute path

  return SAFE_PATH_REGEX.test(path);
}
