/**
 * Compliance Agent Output Schema
 *
 * Defines schemas for compliance scanning, violation tracking,
 * security assessment, and compliance reporting.
 *
 * Two-tier model:
 * - Platform compliance (mandatory, always active)
 * - Project compliance (GDPR, SOC2, HIPAA, PCI-DSS, etc.)
 *
 * SECURITY:
 * - Path validation for file locations
 * - String length limits
 * - Severity bounds validation
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema } from '../types.js';

/**
 * Path validation regex - prevents traversal attacks
 */
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-./\\:]+$/;

// ============================================================================
// Compliance Framework Types
// ============================================================================

/**
 * Compliance framework types
 */
export const ComplianceFrameworkSchema = z.enum([
  'platform', // Built-in platform compliance (mandatory)
  'gdpr', // General Data Protection Regulation
  'soc2', // Service Organization Control 2
  'hipaa', // Health Insurance Portability and Accountability Act
  'pci-dss', // Payment Card Industry Data Security Standard
  'iso27001', // Information Security Management
  'ccpa', // California Consumer Privacy Act
  'custom', // User-defined rules
]);

export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;

/**
 * Violation severity levels
 */
export const ViolationSeveritySchema = z.enum([
  'critical', // Must be fixed immediately, blocks deployment
  'high', // Should be fixed before release
  'medium', // Should be addressed soon
  'low', // Nice to fix
  'info', // Informational only
]);

export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

// ============================================================================
// Violation Types
// ============================================================================

/**
 * Code location for a violation
 */
export const ViolationLocationSchema = z.object({
  file: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => SAFE_PATH_REGEX.test(p), {
      message: 'Invalid path characters detected',
    }),
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
  code: z.string().max(500).optional(), // Snippet of offending code
});

export type ViolationLocation = z.infer<typeof ViolationLocationSchema>;

/**
 * Compliance violation
 */
export const ViolationSchema = z.object({
  id: z.string().min(1).max(100),
  framework: ComplianceFrameworkSchema,
  rule: z.string().min(1).max(100),
  severity: ViolationSeveritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  location: ViolationLocationSchema.optional(),
  remediation: z.string().min(1).max(2000),
  references: z.array(z.string().url().or(z.string().max(500))),
  autoFixable: z.boolean(),
  fixCode: z.string().max(5000).optional(),
});

export type Violation = z.infer<typeof ViolationSchema>;

// ============================================================================
// Check Results
// ============================================================================

/**
 * Result of a compliance check
 */
export const CheckResultSchema = z.object({
  rule: z.string().min(1).max(100),
  framework: ComplianceFrameworkSchema,
  passed: z.boolean(),
  message: z.string().min(1).max(1000),
  details: z.string().max(2000).optional(),
});

export type CheckResult = z.infer<typeof CheckResultSchema>;

// ============================================================================
// Data Handling Assessment
// ============================================================================

/**
 * Data sensitivity levels
 */
export const DataSensitivitySchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
]);

export type DataSensitivity = z.infer<typeof DataSensitivitySchema>;

/**
 * Data type classification
 */
export const DataTypeClassificationSchema = z.object({
  type: z.string().min(1).max(200),
  sensitivity: DataSensitivitySchema,
  locations: z.array(z.string().max(500)),
  protection: z.array(z.string().max(200)),
});

export type DataTypeClassification = z.infer<typeof DataTypeClassificationSchema>;

/**
 * Data flow definition
 */
export const DataFlowSchema = z.object({
  from: z.string().min(1).max(200),
  to: z.string().min(1).max(200),
  dataType: z.string().min(1).max(200),
  encrypted: z.boolean(),
  logged: z.boolean(),
});

export type DataFlow = z.infer<typeof DataFlowSchema>;

/**
 * Data retention policy
 */
export const RetentionPolicySchema = z.object({
  dataType: z.string().min(1).max(200),
  period: z.string().min(1).max(100),
  implemented: z.boolean(),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

/**
 * Complete data handling assessment
 */
export const DataHandlingSchema = z.object({
  dataTypes: z.array(DataTypeClassificationSchema),
  dataFlows: z.array(DataFlowSchema),
  retentionPolicies: z.array(RetentionPolicySchema),
});

export type DataHandling = z.infer<typeof DataHandlingSchema>;

// ============================================================================
// Security Assessment
// ============================================================================

/**
 * Authentication assessment
 */
export const AuthenticationAssessmentSchema = z.object({
  implemented: z.boolean(),
  methods: z.array(z.string().min(1).max(100)),
  mfaAvailable: z.boolean(),
  sessionManagement: z.boolean(),
});

export type AuthenticationAssessment = z.infer<typeof AuthenticationAssessmentSchema>;

/**
 * Authorization assessment
 */
export const AuthorizationAssessmentSchema = z.object({
  implemented: z.boolean(),
  model: z.string().min(1).max(100), // RBAC, ABAC, etc.
  granularity: z.string().min(1).max(200),
});

export type AuthorizationAssessment = z.infer<typeof AuthorizationAssessmentSchema>;

/**
 * Encryption assessment
 */
export const EncryptionAssessmentSchema = z.object({
  atRest: z.boolean(),
  inTransit: z.boolean(),
  algorithms: z.array(z.string().min(1).max(100)),
});

export type EncryptionAssessment = z.infer<typeof EncryptionAssessmentSchema>;

/**
 * Secret management assessment
 */
export const SecretManagementAssessmentSchema = z.object({
  noHardcodedSecrets: z.boolean(),
  secretsManager: z.string().max(100).optional(),
  rotation: z.boolean(),
});

export type SecretManagementAssessment = z.infer<typeof SecretManagementAssessmentSchema>;

/**
 * Complete security assessment
 */
export const SecurityAssessmentSchema = z.object({
  authentication: AuthenticationAssessmentSchema,
  authorization: AuthorizationAssessmentSchema,
  encryption: EncryptionAssessmentSchema,
  secretManagement: SecretManagementAssessmentSchema,
});

export type SecurityAssessment = z.infer<typeof SecurityAssessmentSchema>;

// ============================================================================
// Recommendations and Scores
// ============================================================================

/**
 * Implementation effort levels
 */
export const EffortLevelSchema = z.enum(['minimal', 'moderate', 'significant']);

export type EffortLevel = z.infer<typeof EffortLevelSchema>;

/**
 * Compliance recommendation
 */
export const ComplianceRecommendationSchema = z.object({
  framework: ComplianceFrameworkSchema,
  priority: ViolationSeveritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  implementation: z.array(z.string().min(1).max(500)),
  effort: EffortLevelSchema,
});

export type ComplianceRecommendation = z.infer<typeof ComplianceRecommendationSchema>;

/**
 * Compliance score for a framework
 */
export const ComplianceScoreSchema = z.object({
  framework: ComplianceFrameworkSchema,
  score: z.number().min(0).max(100),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  notApplicable: z.number().int().min(0),
});

export type ComplianceScore = z.infer<typeof ComplianceScoreSchema>;

// ============================================================================
// Scan Types and Summary
// ============================================================================

/**
 * Scan types
 */
export const ScanTypeSchema = z.enum([
  'full', // Complete codebase scan
  'incremental', // Only changed files
  'targeted', // Specific files/rules
]);

export type ScanType = z.infer<typeof ScanTypeSchema>;

/**
 * Overall compliance status
 */
export const ComplianceStatusSchema = z.enum([
  'compliant',
  'non-compliant',
  'needs-attention',
]);

export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

/**
 * Compliance summary
 */
export const ComplianceSummarySchema = z.object({
  overallStatus: ComplianceStatusSchema,
  criticalViolations: z.number().int().min(0),
  highViolations: z.number().int().min(0),
  totalViolations: z.number().int().min(0),
  averageScore: z.number().min(0).max(100),
});

export type ComplianceSummary = z.infer<typeof ComplianceSummarySchema>;

// ============================================================================
// Routing Hints
// ============================================================================

/**
 * Compliance routing hints
 * Uses LenientAgentTypeArraySchema to handle common Claude name variations
 */
export const ComplianceRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: z.boolean(),
  hasFailures: z.boolean(),
  isComplete: z.boolean(),
  blockingViolations: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export type ComplianceRoutingHints = z.infer<typeof ComplianceRoutingHintsSchema>;

// ============================================================================
// Complete Output
// ============================================================================

/**
 * Complete Compliance Agent output
 */
export const ComplianceOutputSchema = z.object({
  scanType: ScanTypeSchema,
  timestamp: z.string().min(1).max(50),

  // Active compliance frameworks
  activeFrameworks: z.array(ComplianceFrameworkSchema),

  // Violations found
  violations: z.array(ViolationSchema),

  // Check results
  checkResults: z.array(CheckResultSchema),

  // Scores by framework
  scores: z.array(ComplianceScoreSchema),

  // Data handling assessment (optional)
  dataHandling: DataHandlingSchema.optional(),

  // Security assessment (optional)
  security: SecurityAssessmentSchema.optional(),

  // Recommendations
  recommendations: z.array(ComplianceRecommendationSchema),

  // Summary
  summary: ComplianceSummarySchema,

  // Routing hints
  routingHints: ComplianceRoutingHintsSchema,
});

export type ComplianceOutput = z.infer<typeof ComplianceOutputSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a violation
 */
export function createViolation(
  id: string,
  framework: ComplianceFramework,
  rule: string,
  severity: ViolationSeverity,
  title: string,
  description: string,
  remediation: string
): Violation {
  return {
    id,
    framework,
    rule,
    severity,
    title,
    description,
    remediation,
    references: [],
    autoFixable: false,
  };
}

/**
 * Create a check result
 */
export function createCheckResult(
  rule: string,
  framework: ComplianceFramework,
  passed: boolean,
  message: string
): CheckResult {
  return {
    rule,
    framework,
    passed,
    message,
  };
}

/**
 * Create a compliance score
 */
export function createComplianceScore(
  framework: ComplianceFramework,
  passed: number,
  failed: number,
  notApplicable = 0
): ComplianceScore {
  const total = passed + failed;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  return {
    framework,
    score,
    passed,
    failed,
    notApplicable,
  };
}

/**
 * Create empty security assessment
 */
export function createEmptySecurityAssessment(): SecurityAssessment {
  return {
    authentication: {
      implemented: false,
      methods: [],
      mfaAvailable: false,
      sessionManagement: false,
    },
    authorization: {
      implemented: false,
      model: 'none',
      granularity: 'none',
    },
    encryption: {
      atRest: false,
      inTransit: false,
      algorithms: [],
    },
    secretManagement: {
      noHardcodedSecrets: true,
      rotation: false,
    },
  };
}

/**
 * Create empty data handling assessment
 */
export function createEmptyDataHandling(): DataHandling {
  return {
    dataTypes: [],
    dataFlows: [],
    retentionPolicies: [],
  };
}

/**
 * Calculate compliance summary from violations and scores
 */
export function calculateComplianceSummary(
  violations: Violation[],
  scores: ComplianceScore[]
): ComplianceSummary {
  const criticalViolations = violations.filter(
    (v) => v.severity === 'critical'
  ).length;
  const highViolations = violations.filter((v) => v.severity === 'high').length;
  const totalViolations = violations.length;

  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((acc, s) => acc + s.score, 0) / scores.length)
      : 100;

  let overallStatus: ComplianceStatus = 'compliant';
  if (criticalViolations > 0) {
    overallStatus = 'non-compliant';
  } else if (highViolations > 0 || averageScore < 80) {
    overallStatus = 'needs-attention';
  }

  return {
    overallStatus,
    criticalViolations,
    highViolations,
    totalViolations,
    averageScore,
  };
}

/**
 * Count violations by severity
 */
export function countViolationsBySeverity(
  violations: Violation[]
): Record<ViolationSeverity, number> {
  const counts: Record<ViolationSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const v of violations) {
    counts[v.severity]++;
  }

  return counts;
}

/**
 * Count violations by framework
 */
export function countViolationsByFramework(
  violations: Violation[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const v of violations) {
    counts[v.framework] = (counts[v.framework] || 0) + 1;
  }

  return counts;
}

/**
 * Get blocking violations (critical severity)
 */
export function getBlockingViolations(violations: Violation[]): Violation[] {
  return violations.filter((v) => v.severity === 'critical');
}

/**
 * Filter violations by framework
 */
export function filterViolationsByFramework(
  violations: Violation[],
  framework: ComplianceFramework
): Violation[] {
  return violations.filter((v) => v.framework === framework);
}

/**
 * Check if all frameworks are compliant (no critical violations)
 */
export function isFullyCompliant(violations: Violation[]): boolean {
  return !violations.some((v) => v.severity === 'critical');
}
