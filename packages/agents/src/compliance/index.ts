/**
 * Compliance Module
 *
 * Pure functions for evaluating compliance rules.
 * No filesystem access - data is passed from CLI layer.
 */

export {
  // Types
  type FileContent,
  type ComplianceConfig,
  type RuleContext,
  type RuleCheckResult,
  type ComplianceRule,
  // Secret patterns
  SECRET_PATTERNS,
  INSECURE_URL_PATTERN,
  CARD_DATA_PATTERNS,
  // Rule check functions
  checkHardcodedSecrets,
  checkAuditLogging,
  checkInputValidation,
  checkHttpsEnforcement,
  checkSqlInjection,
  checkConsentMechanism,
  checkDeletionCapability,
  checkAccessControl,
  checkChangeManagement,
  checkCardDataStorage,
  // Rule registries
  PLATFORM_RULES,
  GDPR_RULES,
  SOC2_RULES,
  PCIDSS_RULES,
  RULES_BY_FRAMEWORK,
  // Functions
  getRulesForFrameworks,
  evaluateCompliance,
} from './compliance-rules.js';
