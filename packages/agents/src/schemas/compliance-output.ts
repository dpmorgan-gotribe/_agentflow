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
 *
 * LENIENT: Uses lenient parsing utilities to handle Claude's output variations.
 */

import { z } from 'zod';
import { LenientAgentTypeArraySchema } from '../types.js';
import {
  lenientEnum,
  lenientArray,
  lenientBoolean,
  lenientPath,
  lenientUrl,
} from './lenient-utils.js';

/**
 * Path validation regex - prevents traversal attacks
 * (kept for helper functions)
 */
const SAFE_PATH_REGEX = /^[a-zA-Z0-9_\-./\\:]+$/;

// ============================================================================
// Compliance Framework Types
// ============================================================================

/**
 * Compliance framework values
 */
const COMPLIANCE_FRAMEWORKS = ['platform', 'gdpr', 'soc2', 'hipaa', 'pci-dss', 'iso27001', 'ccpa', 'custom'] as const;

/**
 * Compliance framework types (lenient)
 */
export const ComplianceFrameworkSchema = lenientEnum(COMPLIANCE_FRAMEWORKS, 'platform');

export type ComplianceFramework = z.infer<typeof ComplianceFrameworkSchema>;

/**
 * Violation severity values
 */
const VIOLATION_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

/**
 * Violation severity levels (lenient)
 */
export const ViolationSeveritySchema = lenientEnum(VIOLATION_SEVERITIES, 'medium');

export type ViolationSeverity = z.infer<typeof ViolationSeveritySchema>;

// ============================================================================
// Violation Types
// ============================================================================

/**
 * Code location for a violation (lenient)
 */
export const ViolationLocationSchema = z.object({
  file: lenientPath(500),
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
  code: z.string().max(500).optional(), // Snippet of offending code
});

export type ViolationLocation = z.infer<typeof ViolationLocationSchema>;

/**
 * Compliance violation (lenient)
 */
export const ViolationSchema = z.object({
  id: z.string().max(100).default(''),
  framework: ComplianceFrameworkSchema,
  rule: z.string().max(100).default(''),
  severity: ViolationSeveritySchema,
  title: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  location: ViolationLocationSchema.optional(),
  remediation: z.string().max(2000).default(''),
  references: lenientArray(z.union([lenientUrl, z.string().max(500)])),
  autoFixable: lenientBoolean,
  fixCode: z.string().max(5000).optional(),
});

export type Violation = z.infer<typeof ViolationSchema>;

// ============================================================================
// Check Results
// ============================================================================

/**
 * Result of a compliance check (lenient)
 */
export const CheckResultSchema = z.object({
  rule: z.string().max(100).default(''),
  framework: ComplianceFrameworkSchema,
  passed: lenientBoolean,
  message: z.string().max(1000).default(''),
  details: z.string().max(2000).optional(),
});

export type CheckResult = z.infer<typeof CheckResultSchema>;

// ============================================================================
// Data Handling Assessment
// ============================================================================

/**
 * Data sensitivity values
 */
const DATA_SENSITIVITIES = ['public', 'internal', 'confidential', 'restricted'] as const;

/**
 * Data sensitivity levels (lenient)
 */
export const DataSensitivitySchema = lenientEnum(DATA_SENSITIVITIES, 'internal');

export type DataSensitivity = z.infer<typeof DataSensitivitySchema>;

/**
 * Data type classification (lenient)
 */
export const DataTypeClassificationSchema = z.object({
  type: z.string().max(200).default(''),
  sensitivity: DataSensitivitySchema,
  locations: lenientArray(z.string().max(500)),
  protection: lenientArray(z.string().max(200)),
});

export type DataTypeClassification = z.infer<typeof DataTypeClassificationSchema>;

/**
 * Data flow definition (lenient)
 */
export const DataFlowSchema = z.object({
  from: z.string().max(200).default(''),
  to: z.string().max(200).default(''),
  dataType: z.string().max(200).default(''),
  encrypted: lenientBoolean,
  logged: lenientBoolean,
});

export type DataFlow = z.infer<typeof DataFlowSchema>;

/**
 * Data retention policy (lenient)
 */
export const RetentionPolicySchema = z.object({
  dataType: z.string().max(200).default(''),
  period: z.string().max(100).default(''),
  implemented: lenientBoolean,
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

/**
 * Complete data handling assessment (lenient)
 */
export const DataHandlingSchema = z.object({
  dataTypes: lenientArray(DataTypeClassificationSchema),
  dataFlows: lenientArray(DataFlowSchema),
  retentionPolicies: lenientArray(RetentionPolicySchema),
});

export type DataHandling = z.infer<typeof DataHandlingSchema>;

// ============================================================================
// Security Assessment
// ============================================================================

/**
 * Authentication assessment (lenient)
 */
export const AuthenticationAssessmentSchema = z.object({
  implemented: lenientBoolean,
  methods: lenientArray(z.string().max(100)),
  mfaAvailable: lenientBoolean,
  sessionManagement: lenientBoolean,
});

export type AuthenticationAssessment = z.infer<typeof AuthenticationAssessmentSchema>;

/**
 * Authorization assessment (lenient)
 */
export const AuthorizationAssessmentSchema = z.object({
  implemented: lenientBoolean,
  model: z.string().max(100).default('none'), // RBAC, ABAC, etc.
  granularity: z.string().max(200).default(''),
});

export type AuthorizationAssessment = z.infer<typeof AuthorizationAssessmentSchema>;

/**
 * Encryption assessment (lenient)
 */
export const EncryptionAssessmentSchema = z.object({
  atRest: lenientBoolean,
  inTransit: lenientBoolean,
  algorithms: lenientArray(z.string().max(100)),
});

export type EncryptionAssessment = z.infer<typeof EncryptionAssessmentSchema>;

/**
 * Secret management assessment (lenient)
 */
export const SecretManagementAssessmentSchema = z.object({
  noHardcodedSecrets: lenientBoolean,
  secretsManager: z.string().max(100).optional(),
  rotation: lenientBoolean,
});

export type SecretManagementAssessment = z.infer<typeof SecretManagementAssessmentSchema>;

/**
 * Complete security assessment (lenient)
 */
export const SecurityAssessmentSchema = z.object({
  authentication: AuthenticationAssessmentSchema.optional(),
  authorization: AuthorizationAssessmentSchema.optional(),
  encryption: EncryptionAssessmentSchema.optional(),
  secretManagement: SecretManagementAssessmentSchema.optional(),
});

export type SecurityAssessment = z.infer<typeof SecurityAssessmentSchema>;

// ============================================================================
// Recommendations and Scores
// ============================================================================

/**
 * Effort level values
 */
const EFFORT_LEVELS = ['minimal', 'moderate', 'significant'] as const;

/**
 * Implementation effort levels (lenient)
 */
export const EffortLevelSchema = lenientEnum(EFFORT_LEVELS, 'moderate');

export type EffortLevel = z.infer<typeof EffortLevelSchema>;

/**
 * Compliance recommendation (lenient)
 */
export const ComplianceRecommendationSchema = z.object({
  framework: ComplianceFrameworkSchema,
  priority: ViolationSeveritySchema,
  title: z.string().max(200).default(''),
  description: z.string().max(2000).default(''),
  implementation: lenientArray(z.string().max(500)),
  effort: EffortLevelSchema,
});

export type ComplianceRecommendation = z.infer<typeof ComplianceRecommendationSchema>;

/**
 * Compliance score for a framework (lenient)
 */
export const ComplianceScoreSchema = z.object({
  framework: ComplianceFrameworkSchema,
  score: z.number().min(0).max(100).catch(0),
  passed: z.number().int().min(0).catch(0),
  failed: z.number().int().min(0).catch(0),
  notApplicable: z.number().int().min(0).catch(0),
});

export type ComplianceScore = z.infer<typeof ComplianceScoreSchema>;

// ============================================================================
// Scan Types and Summary
// ============================================================================

/**
 * Scan type values
 */
const SCAN_TYPES = ['full', 'incremental', 'targeted'] as const;

/**
 * Scan types (lenient)
 */
export const ScanTypeSchema = lenientEnum(SCAN_TYPES, 'full');

export type ScanType = z.infer<typeof ScanTypeSchema>;

/**
 * Compliance status values
 */
const COMPLIANCE_STATUSES = ['compliant', 'non-compliant', 'needs-attention'] as const;

/**
 * Overall compliance status (lenient)
 */
export const ComplianceStatusSchema = lenientEnum(COMPLIANCE_STATUSES, 'needs-attention');

export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

/**
 * Compliance summary (lenient)
 */
export const ComplianceSummarySchema = z.object({
  overallStatus: ComplianceStatusSchema,
  criticalViolations: z.number().int().min(0).catch(0),
  highViolations: z.number().int().min(0).catch(0),
  totalViolations: z.number().int().min(0).catch(0),
  averageScore: z.number().min(0).max(100).catch(0),
});

export type ComplianceSummary = z.infer<typeof ComplianceSummarySchema>;

// ============================================================================
// Routing Hints
// ============================================================================

/**
 * Compliance routing hints (lenient)
 * Uses LenientAgentTypeArraySchema and lenientBoolean
 */
export const ComplianceRoutingHintsSchema = z.object({
  suggestNext: LenientAgentTypeArraySchema,
  skipAgents: LenientAgentTypeArraySchema,
  needsApproval: lenientBoolean,
  hasFailures: lenientBoolean,
  isComplete: lenientBoolean,
  blockingViolations: lenientBoolean,
  notes: z.string().max(1000).optional(),
}).default({
  suggestNext: [],
  skipAgents: [],
  needsApproval: false,
  hasFailures: false,
  isComplete: false,
  blockingViolations: false,
});

export type ComplianceRoutingHints = z.infer<typeof ComplianceRoutingHintsSchema>;

// ============================================================================
// Complete Output
// ============================================================================

/**
 * Complete Compliance Agent output (lenient)
 */
export const ComplianceOutputSchema = z.object({
  scanType: ScanTypeSchema,
  timestamp: z.string().max(50).default(''),

  // Active compliance frameworks
  activeFrameworks: lenientArray(ComplianceFrameworkSchema),

  // Violations found
  violations: lenientArray(ViolationSchema),

  // Check results
  checkResults: lenientArray(CheckResultSchema),

  // Scores by framework
  scores: lenientArray(ComplianceScoreSchema),

  // Data handling assessment (optional)
  dataHandling: DataHandlingSchema.optional(),

  // Security assessment (optional)
  security: SecurityAssessmentSchema.optional(),

  // Recommendations
  recommendations: lenientArray(ComplianceRecommendationSchema),

  // Summary
  summary: ComplianceSummarySchema.optional(),

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
