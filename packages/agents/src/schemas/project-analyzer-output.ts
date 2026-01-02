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
 *
 * LENIENT: Uses lenient parsing utilities to handle Claude's output variations.
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema } from '../types.js';
import {
  lenientEnum,
  lenientArray,
  lenientConfidence,
  lenientBoolean,
  lenientPath,
} from './lenient-utils.js';

/**
 * Path validation regex - prevents traversal attacks
 * (kept for isValidPath helper function)
 */
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-./\\]+$/;

/**
 * Detected programming language (lenient)
 */
export const DetectedLanguageSchema = z.object({
  name: z.string().max(100).default(''),
  percentage: z.number().min(0).max(100).catch(0),
  files: z.number().int().min(0).catch(0),
  lines: z.number().int().min(0).catch(0),
  primary: lenientBoolean,
});

export type DetectedLanguage = z.infer<typeof DetectedLanguageSchema>;

/**
 * Framework type values
 */
const FRAMEWORK_TYPES = ['frontend', 'backend', 'fullstack', 'testing', 'build', 'utility'] as const;

/**
 * Framework type categories (lenient)
 */
export const FrameworkTypeSchema = lenientEnum(FRAMEWORK_TYPES, 'utility');

export type FrameworkType = z.infer<typeof FrameworkTypeSchema>;

/**
 * Detected framework with confidence scoring (lenient)
 */
export const DetectedFrameworkSchema = z.object({
  name: z.string().max(200).default(''),
  version: z.string().max(50).optional(),
  type: FrameworkTypeSchema,
  confidence: lenientConfidence,
  evidence: lenientArray(z.string().max(500)),
});

export type DetectedFramework = z.infer<typeof DetectedFrameworkSchema>;

/**
 * Importance level values
 */
const IMPORTANCE_LEVELS = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Directory importance levels (lenient)
 */
export const ImportanceSchema = lenientEnum(IMPORTANCE_LEVELS, 'medium');

export type Importance = z.infer<typeof ImportanceSchema>;

/**
 * Directory analysis result (lenient)
 */
export const DirectoryAnalysisSchema = z.object({
  path: lenientPath(500),
  purpose: z.string().max(500).default(''),
  fileCount: z.number().int().min(0).catch(0),
  patterns: lenientArray(z.string().max(100)),
  technologies: lenientArray(z.string().max(100)),
  importance: ImportanceSchema,
});

export type DirectoryAnalysis = z.infer<typeof DirectoryAnalysisSchema>;

/**
 * Pattern category values
 */
const PATTERN_CATEGORIES = ['architecture', 'design', 'testing', 'state', 'api', 'data'] as const;

/**
 * Pattern categories for detection (lenient)
 */
export const PatternCategorySchema = lenientEnum(PATTERN_CATEGORIES, 'design');

export type PatternCategory = z.infer<typeof PatternCategorySchema>;

/**
 * Detected coding/architecture pattern (lenient)
 */
export const DetectedPatternSchema = z.object({
  name: z.string().max(200).default(''),
  category: PatternCategorySchema,
  description: z.string().max(2000).default(''),
  locations: lenientArray(lenientPath(500)),
  confidence: lenientConfidence,
});

export type DetectedPattern = z.infer<typeof DetectedPatternSchema>;

/**
 * Issue type values
 */
const ISSUE_TYPES = ['warning', 'error', 'suggestion'] as const;

/**
 * Code quality issue type (lenient)
 */
export const IssueTypeSchema = lenientEnum(ISSUE_TYPES, 'warning');

export type IssueType = z.infer<typeof IssueTypeSchema>;

/**
 * Code quality issue (lenient)
 */
export const CodeQualityIssueSchema = z.object({
  type: IssueTypeSchema,
  message: z.string().max(1000).default(''),
  location: z.string().max(500).optional(),
});

export type CodeQualityIssue = z.infer<typeof CodeQualityIssueSchema>;

/**
 * Code quality assessment (lenient)
 */
export const CodeQualitySchema = z.object({
  hasTests: lenientBoolean,
  testCoverage: z.string().max(50).optional(),
  hasLinting: lenientBoolean,
  hasTypeChecking: lenientBoolean,
  hasDocumentation: lenientBoolean,
  hasCI: lenientBoolean,
  hasSecurity: lenientBoolean,
  issues: lenientArray(CodeQualityIssueSchema),
});

export type CodeQuality = z.infer<typeof CodeQualitySchema>;

/**
 * Compliance indicators for security/privacy analysis (lenient)
 */
export const ComplianceIndicatorsSchema = z.object({
  handlesPersonalData: lenientBoolean,
  hasAuthentication: lenientBoolean,
  hasAuthorization: lenientBoolean,
  hasAuditLogging: lenientBoolean,
  hasEncryption: lenientBoolean,
  hasSensitiveData: lenientBoolean,
  locations: z.record(z.string(), lenientArray(z.string().max(500))).default({}),
});

export type ComplianceIndicators = z.infer<typeof ComplianceIndicatorsSchema>;

/**
 * Entry point type values
 */
const ENTRY_POINT_TYPES = ['application', 'library', 'cli', 'api', 'worker'] as const;

/**
 * Entry point type (lenient)
 */
export const EntryPointTypeSchema = lenientEnum(ENTRY_POINT_TYPES, 'application');

export type EntryPointType = z.infer<typeof EntryPointTypeSchema>;

/**
 * Application entry point (lenient)
 */
export const EntryPointSchema = z.object({
  path: lenientPath(500),
  type: EntryPointTypeSchema,
  description: z.string().max(500).default(''),
});

export type EntryPoint = z.infer<typeof EntryPointSchema>;

/**
 * Outdated severity values
 */
const OUTDATED_SEVERITIES = ['major', 'minor', 'patch'] as const;

/**
 * Outdated dependency severity (lenient)
 */
export const OutdatedSeveritySchema = lenientEnum(OUTDATED_SEVERITIES, 'minor');

export type OutdatedSeverity = z.infer<typeof OutdatedSeveritySchema>;

/**
 * Outdated dependency info (lenient)
 */
export const OutdatedDependencySchema = z.object({
  name: z.string().max(200).default(''),
  current: z.string().max(50).default(''),
  latest: z.string().max(50).default(''),
  type: OutdatedSeveritySchema,
});

export type OutdatedDependency = z.infer<typeof OutdatedDependencySchema>;

/**
 * Vulnerability severity values
 */
const VULNERABILITY_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/**
 * Vulnerability severity levels (lenient)
 */
export const VulnerabilitySeveritySchema = lenientEnum(VULNERABILITY_SEVERITIES, 'medium');

export type VulnerabilitySeverity = z.infer<typeof VulnerabilitySeveritySchema>;

/**
 * Dependency vulnerability (lenient)
 */
export const DependencyVulnerabilitySchema = z.object({
  name: z.string().max(200).default(''),
  severity: VulnerabilitySeveritySchema,
  description: z.string().max(2000).default(''),
});

export type DependencyVulnerability = z.infer<
  typeof DependencyVulnerabilitySchema
>;

/**
 * Dependency analysis summary (lenient)
 */
export const DependencyAnalysisSchema = z.object({
  total: z.number().int().min(0).catch(0),
  production: z.number().int().min(0).catch(0),
  development: z.number().int().min(0).catch(0),
  outdated: lenientArray(OutdatedDependencySchema),
  vulnerabilities: lenientArray(DependencyVulnerabilitySchema),
});

export type DependencyAnalysis = z.infer<typeof DependencyAnalysisSchema>;

/**
 * Recommendation category values
 */
const RECOMMENDATION_CATEGORIES = ['architecture', 'security', 'testing', 'performance', 'maintainability', 'documentation'] as const;

/**
 * Recommendation categories (lenient)
 */
export const RecommendationCategorySchema = lenientEnum(RECOMMENDATION_CATEGORIES, 'architecture');

export type RecommendationCategory = z.infer<
  typeof RecommendationCategorySchema
>;

/**
 * Recommendation priority values
 */
const RECOMMENDATION_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Recommendation priority (lenient)
 */
export const RecommendationPrioritySchema = lenientEnum(RECOMMENDATION_PRIORITIES, 'medium');

export type RecommendationPriority = z.infer<
  typeof RecommendationPrioritySchema
>;

/**
 * Analysis recommendation (lenient)
 */
export const AnalysisRecommendationSchema = z.object({
  category: RecommendationCategorySchema,
  priority: RecommendationPrioritySchema,
  title: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  effort: z.string().max(100).default(''),
});

export type AnalysisRecommendation = z.infer<
  typeof AnalysisRecommendationSchema
>;

/**
 * Project type values
 */
const PROJECT_TYPES = ['web-app', 'api', 'library', 'cli', 'monorepo', 'mobile', 'desktop', 'unknown'] as const;

/**
 * Project type classification (lenient)
 */
export const ProjectTypeSchema = lenientEnum(PROJECT_TYPES, 'unknown');

export type ProjectType = z.infer<typeof ProjectTypeSchema>;

/**
 * Tech stack summary (lenient)
 */
export const TechStackSummarySchema = z.object({
  languages: lenientArray(DetectedLanguageSchema),
  frameworks: lenientArray(DetectedFrameworkSchema),
  databases: lenientArray(z.string().max(100)),
  infrastructure: lenientArray(z.string().max(100)),
});

export type TechStackSummary = z.infer<typeof TechStackSummarySchema>;

/**
 * Project structure analysis (lenient)
 */
export const ProjectStructureSchema = z.object({
  rootDirectories: lenientArray(DirectoryAnalysisSchema),
  entryPoints: lenientArray(EntryPointSchema),
  configFiles: lenientArray(z.string().max(200)),
  totalFiles: z.number().int().min(0).catch(0),
  totalLines: z.number().int().min(0).catch(0),
});

export type ProjectStructure = z.infer<typeof ProjectStructureSchema>;

/**
 * Architecture summary (lenient)
 */
export const ArchitectureSummarySchema = z.object({
  pattern: z.string().max(200).default(''),
  apiStyle: z.string().max(200).optional(),
  stateManagement: z.string().max(200).optional(),
  dataFlow: z.string().max(500).default(''),
});

export type ArchitectureSummary = z.infer<typeof ArchitectureSummarySchema>;

/**
 * Generated context files (lenient)
 */
export const GeneratedContextSchema = z.object({
  claudeMd: z.string().max(50000).default(''),
  architectureYaml: z.string().max(50000).default(''),
});

export type GeneratedContext = z.infer<typeof GeneratedContextSchema>;

/**
 * Project analyzer routing hints (lenient)
 * Uses LenientAgentTypeArraySchema and lenientBoolean
 */
export const ProjectAnalyzerRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: lenientBoolean,
  hasFailures: lenientBoolean,
  isComplete: lenientBoolean,
  notes: z.string().max(1000).optional(),
}).default({
  suggestNext: [],
  skipAgents: [],
  needsApproval: false,
  hasFailures: false,
  isComplete: false,
});

export type ProjectAnalyzerRoutingHints = z.infer<
  typeof ProjectAnalyzerRoutingHintsSchema
>;

/**
 * Complete Project Analyzer output (lenient)
 */
export const ProjectAnalyzerOutputSchema = z.object({
  projectName: z.string().max(200).default(''),
  projectType: ProjectTypeSchema,

  techStack: TechStackSummarySchema.optional(),
  structure: ProjectStructureSchema.optional(),
  architecture: ArchitectureSummarySchema.optional(),

  patterns: lenientArray(DetectedPatternSchema),
  codeQuality: CodeQualitySchema.optional(),
  complianceIndicators: ComplianceIndicatorsSchema.optional(),
  dependencies: DependencyAnalysisSchema.optional(),

  recommendations: lenientArray(AnalysisRecommendationSchema),
  generatedContext: GeneratedContextSchema.optional(),

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
