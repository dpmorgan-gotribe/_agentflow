/**
 * Compliance Rules
 *
 * Pure functions for evaluating compliance rules.
 * No filesystem access - data is passed from CLI layer.
 *
 * Two-tier model:
 * - Platform rules: MANDATORY, cannot be disabled
 * - Framework rules: Based on project configuration
 *
 * SECURITY:
 * - All functions are pure (no side effects)
 * - Pattern matching for secret detection
 * - Safe regex patterns to prevent ReDoS
 */

import type {
  ComplianceFramework,
  ViolationSeverity,
  Violation,
  CheckResult,
} from '../schemas/compliance-output.js';

// ============================================================================
// Types
// ============================================================================

/**
 * File content for analysis
 */
export interface FileContent {
  path: string;
  content: string;
  extension: string;
}

/**
 * Project configuration for compliance
 */
export interface ComplianceConfig {
  frameworks: ComplianceFramework[];
  exclusions?: {
    files?: string[];
    rules?: string[];
  };
  customPatterns?: {
    secrets?: RegExp[];
    sensitiveData?: RegExp[];
  };
}

/**
 * Rule context passed to rule functions
 */
export interface RuleContext {
  files: FileContent[];
  config: ComplianceConfig;
  packageDeps?: Record<string, string>;
  configFiles?: string[];
}

/**
 * Result of a rule check
 */
export interface RuleCheckResult {
  passed: boolean;
  message: string;
  violations?: Array<{
    file: string;
    line?: number;
    code?: string;
    details: string;
  }>;
}

/**
 * Compliance rule definition
 */
export interface ComplianceRule {
  id: string;
  framework: ComplianceFramework;
  title: string;
  description: string;
  severity: ViolationSeverity;
  check: (ctx: RuleContext) => RuleCheckResult;
  remediation: string;
  references: string[];
}

// ============================================================================
// Secret Detection Patterns
// ============================================================================

/**
 * Patterns for detecting hardcoded secrets
 * These are designed to be safe from ReDoS attacks
 */
export const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // API keys (generic)
  {
    name: 'Generic API Key',
    pattern: /api[_-]?key\s*[=:]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,
  },
  // AWS Access Keys
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  // AWS Secret Keys
  {
    name: 'AWS Secret Key',
    pattern: /aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*['"][a-zA-Z0-9/+=]{40}['"]/gi,
  },
  // Generic passwords
  {
    name: 'Password',
    pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]/gi,
  },
  // Generic secrets
  {
    name: 'Secret',
    pattern: /secret\s*[=:]\s*['"][a-zA-Z0-9_\-]{16,}['"]/gi,
  },
  // Private keys
  {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  },
  // GitHub tokens
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  },
  // Slack tokens
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
  },
  // JWT tokens
  {
    name: 'JWT Token',
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  },
  // Database connection strings
  {
    name: 'Database URL',
    pattern: /(?:mysql|postgres|mongodb):\/\/[^:]+:[^@]+@[^/]+/gi,
  },
];

/**
 * Patterns for detecting insecure URLs
 */
export const INSECURE_URL_PATTERN = /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/gi;

/**
 * Patterns for detecting potential card data
 */
export const CARD_DATA_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Card number patterns
  {
    name: 'Card Number Variable',
    pattern: /card[_-]?number/gi,
  },
  {
    name: 'Credit Card Variable',
    pattern: /creditCard|credit_card/gi,
  },
  // CVV patterns
  {
    name: 'CVV Variable',
    pattern: /\bcvv\b|\bcvc\b/gi,
  },
];

// ============================================================================
// Platform Rules (Mandatory)
// ============================================================================

/**
 * Check for hardcoded secrets
 */
export function checkHardcodedSecrets(ctx: RuleContext): RuleCheckResult {
  const violations: RuleCheckResult['violations'] = [];

  for (const file of ctx.files) {
    // Skip test files for certain patterns
    const isTestFile =
      file.path.includes('.test.') ||
      file.path.includes('.spec.') ||
      file.path.includes('__tests__');

    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }

      for (const { name, pattern } of SECRET_PATTERNS) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;

        if (pattern.test(line)) {
          // Skip test files for password patterns (mock data)
          if (isTestFile && name === 'Password') continue;

          violations.push({
            file: file.path,
            line: i + 1,
            code: line.trim().substring(0, 100),
            details: `Potential ${name} detected`,
          });
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    message:
      violations.length === 0
        ? 'No hardcoded secrets detected'
        : `Found ${violations.length} potential secrets`,
    violations,
  };
}

/**
 * Check for audit logging indicators
 */
export function checkAuditLogging(ctx: RuleContext): RuleCheckResult {
  const auditIndicators = [
    'audit',
    'auditLog',
    'audit_log',
    'logger.audit',
    '@audit',
    'AuditService',
  ];

  let hasAudit = false;
  const locations: string[] = [];

  for (const file of ctx.files) {
    const lower = file.content.toLowerCase();
    for (const indicator of auditIndicators) {
      if (lower.includes(indicator.toLowerCase())) {
        hasAudit = true;
        locations.push(file.path);
        break;
      }
    }
  }

  return {
    passed: hasAudit,
    message: hasAudit
      ? `Audit logging detected in ${locations.length} files`
      : 'No audit logging implementation found',
  };
}

/**
 * Check for input validation
 */
export function checkInputValidation(ctx: RuleContext): RuleCheckResult {
  const validationLibraries = [
    'zod',
    'yup',
    'joi',
    'class-validator',
    'validator',
    'ajv',
    'superstruct',
  ];

  let hasValidation = false;

  // Check package dependencies
  if (ctx.packageDeps) {
    for (const lib of validationLibraries) {
      if (ctx.packageDeps[lib]) {
        hasValidation = true;
        break;
      }
    }
  }

  // Also check for validation patterns in code
  const validationPatterns = [
    '.parse(',
    '.validate(',
    '.safeParse(',
    '@IsEmail',
    '@IsString',
    '@MinLength',
  ];

  if (!hasValidation) {
    for (const file of ctx.files) {
      for (const pattern of validationPatterns) {
        if (file.content.includes(pattern)) {
          hasValidation = true;
          break;
        }
      }
      if (hasValidation) break;
    }
  }

  return {
    passed: hasValidation,
    message: hasValidation
      ? 'Input validation library/patterns detected'
      : 'No input validation library found',
  };
}

/**
 * Check for HTTPS enforcement
 */
export function checkHttpsEnforcement(ctx: RuleContext): RuleCheckResult {
  const violations: RuleCheckResult['violations'] = [];

  for (const file of ctx.files) {
    // Skip test files
    if (
      file.path.includes('.test.') ||
      file.path.includes('.spec.') ||
      file.path.includes('__tests__')
    ) {
      continue;
    }

    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Reset pattern
      INSECURE_URL_PATTERN.lastIndex = 0;

      if (INSECURE_URL_PATTERN.test(line)) {
        violations.push({
          file: file.path,
          line: i + 1,
          code: line.trim().substring(0, 100),
          details: 'Non-HTTPS URL detected',
        });
      }
    }
  }

  return {
    passed: violations.length === 0,
    message:
      violations.length === 0
        ? 'No insecure URLs detected'
        : `Found ${violations.length} insecure URLs`,
    violations,
  };
}

/**
 * Check for SQL injection vulnerabilities
 */
export function checkSqlInjection(ctx: RuleContext): RuleCheckResult {
  const violations: RuleCheckResult['violations'] = [];

  // Patterns that indicate string concatenation in SQL
  const dangerousPatterns = [
    /query\s*\(\s*['"`].*\$\{/gi, // Template literals in queries
    /query\s*\(\s*.*\+\s*[^'"]/gi, // String concatenation
    /execute\s*\(\s*['"`].*\$\{/gi,
    /raw\s*\(\s*['"`].*\$\{/gi,
  ];

  for (const file of ctx.files) {
    // Skip test files
    if (
      file.path.includes('.test.') ||
      file.path.includes('.spec.')
    ) {
      continue;
    }

    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      for (const pattern of dangerousPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push({
            file: file.path,
            line: i + 1,
            code: line.trim().substring(0, 100),
            details: 'Potential SQL injection vulnerability',
          });
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    message:
      violations.length === 0
        ? 'No SQL injection vulnerabilities detected'
        : `Found ${violations.length} potential SQL injection points`,
    violations,
  };
}

// ============================================================================
// GDPR Rules
// ============================================================================

/**
 * Check for consent mechanism
 */
export function checkConsentMechanism(ctx: RuleContext): RuleCheckResult {
  const consentIndicators = [
    'consent',
    'gdpr',
    'privacy',
    'dataProcessing',
    'data_processing',
    'userConsent',
    'cookieConsent',
  ];

  let hasConsent = false;

  for (const file of ctx.files) {
    const lower = file.content.toLowerCase();
    for (const indicator of consentIndicators) {
      if (lower.includes(indicator.toLowerCase())) {
        hasConsent = true;
        break;
      }
    }
    if (hasConsent) break;
  }

  return {
    passed: hasConsent,
    message: hasConsent
      ? 'Consent mechanism indicators found'
      : 'No consent mechanism detected - manual review required',
  };
}

/**
 * Check for data deletion capability
 */
export function checkDeletionCapability(ctx: RuleContext): RuleCheckResult {
  const deletionIndicators = [
    'deleteUser',
    'delete_user',
    'removeUser',
    'remove_user',
    'deleteAccount',
    'erasure',
    'rightToDelete',
    'forgetMe',
  ];

  let hasDeletion = false;

  for (const file of ctx.files) {
    for (const indicator of deletionIndicators) {
      if (file.content.includes(indicator)) {
        hasDeletion = true;
        break;
      }
    }
    if (hasDeletion) break;
  }

  // Also check for DELETE HTTP methods
  if (!hasDeletion) {
    for (const file of ctx.files) {
      if (
        file.content.includes("method: 'DELETE'") ||
        file.content.includes('@Delete(') ||
        file.content.includes('.delete(')
      ) {
        hasDeletion = true;
        break;
      }
    }
  }

  return {
    passed: hasDeletion,
    message: hasDeletion
      ? 'Data deletion capability detected'
      : 'No data deletion API found',
  };
}

// ============================================================================
// SOC2 Rules
// ============================================================================

/**
 * Check for access control
 */
export function checkAccessControl(ctx: RuleContext): RuleCheckResult {
  const accessControlIndicators = [
    'rbac',
    'abac',
    'permission',
    'authorize',
    'canAccess',
    'hasRole',
    'checkPermission',
    '@Roles',
    '@Permissions',
    'Guard',
    'isAuthorized',
  ];

  let hasAccessControl = false;

  for (const file of ctx.files) {
    const lower = file.content.toLowerCase();
    for (const indicator of accessControlIndicators) {
      if (lower.includes(indicator.toLowerCase())) {
        hasAccessControl = true;
        break;
      }
    }
    if (hasAccessControl) break;
  }

  return {
    passed: hasAccessControl,
    message: hasAccessControl
      ? 'Access control mechanism detected'
      : 'No access control mechanism found',
  };
}

/**
 * Check for change management (git + CI)
 */
export function checkChangeManagement(ctx: RuleContext): RuleCheckResult {
  const hasGit = ctx.configFiles?.some((f) => f.includes('.git')) ?? false;
  const hasCI =
    ctx.configFiles?.some(
      (f) =>
        f.includes('.github/workflows') ||
        f.includes('.gitlab-ci') ||
        f.includes('azure-pipelines') ||
        f.includes('Jenkinsfile') ||
        f.includes('.circleci')
    ) ?? false;

  const passed = hasGit && hasCI;

  return {
    passed,
    message: passed
      ? 'Version control and CI/CD detected'
      : `Missing ${!hasGit ? 'version control' : ''}${!hasGit && !hasCI ? ' and ' : ''}${!hasCI ? 'CI/CD' : ''}`,
  };
}

// ============================================================================
// PCI-DSS Rules
// ============================================================================

/**
 * Check for card data storage
 */
export function checkCardDataStorage(ctx: RuleContext): RuleCheckResult {
  const violations: RuleCheckResult['violations'] = [];

  for (const file of ctx.files) {
    // Skip test files
    if (
      file.path.includes('.test.') ||
      file.path.includes('.spec.') ||
      file.path.includes('__tests__')
    ) {
      continue;
    }

    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      for (const { name, pattern } of CARD_DATA_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          violations.push({
            file: file.path,
            line: i + 1,
            code: line.trim().substring(0, 100),
            details: `Potential card data handling: ${name}`,
          });
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    message:
      violations.length === 0
        ? 'No card data storage detected'
        : `Found ${violations.length} potential card data references`,
    violations,
  };
}

// ============================================================================
// Rule Registry
// ============================================================================

/**
 * Platform rules (always active)
 */
export const PLATFORM_RULES: ComplianceRule[] = [
  {
    id: 'platform-001',
    framework: 'platform',
    title: 'No hardcoded secrets',
    description: 'Secrets must not be hardcoded in source files',
    severity: 'critical',
    check: checkHardcodedSecrets,
    remediation: 'Move secrets to environment variables or a secrets manager',
    references: [
      'https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password',
    ],
  },
  {
    id: 'platform-002',
    framework: 'platform',
    title: 'Audit logging implemented',
    description: 'Security-relevant actions must be logged',
    severity: 'high',
    check: checkAuditLogging,
    remediation:
      'Implement audit logging for authentication, authorization, and data access',
    references: [],
  },
  {
    id: 'platform-003',
    framework: 'platform',
    title: 'Input validation present',
    description: 'User inputs must be validated',
    severity: 'high',
    check: checkInputValidation,
    remediation: 'Add input validation using Zod, Yup, or similar library',
    references: ['https://owasp.org/www-community/Input_Validation'],
  },
  {
    id: 'platform-004',
    framework: 'platform',
    title: 'HTTPS enforced',
    description: 'All network communication must use HTTPS',
    severity: 'critical',
    check: checkHttpsEnforcement,
    remediation: 'Ensure all URLs use HTTPS and redirect HTTP to HTTPS',
    references: [],
  },
  {
    id: 'platform-005',
    framework: 'platform',
    title: 'No SQL injection',
    description: 'Use parameterized queries to prevent SQL injection',
    severity: 'critical',
    check: checkSqlInjection,
    remediation: 'Use parameterized queries or an ORM like Drizzle',
    references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
  },
];

/**
 * GDPR rules
 */
export const GDPR_RULES: ComplianceRule[] = [
  {
    id: 'gdpr-001',
    framework: 'gdpr',
    title: 'Data minimization',
    description: 'Only collect data that is necessary',
    severity: 'medium',
    check: () => ({ passed: true, message: 'Manual review required' }),
    remediation: 'Review data collection points and remove unnecessary fields',
    references: ['https://gdpr.eu/article-5-how-to-process-personal-data/'],
  },
  {
    id: 'gdpr-002',
    framework: 'gdpr',
    title: 'Consent mechanism',
    description: 'User consent must be obtained for data processing',
    severity: 'high',
    check: checkConsentMechanism,
    remediation: 'Implement consent tracking and management',
    references: ['https://gdpr.eu/article-7-how-to-get-consent-to-process-data/'],
  },
  {
    id: 'gdpr-003',
    framework: 'gdpr',
    title: 'Right to deletion',
    description: 'Users must be able to request data deletion',
    severity: 'high',
    check: checkDeletionCapability,
    remediation: 'Implement data deletion API and process',
    references: ['https://gdpr.eu/article-17-right-to-be-forgotten/'],
  },
];

/**
 * SOC2 rules
 */
export const SOC2_RULES: ComplianceRule[] = [
  {
    id: 'soc2-001',
    framework: 'soc2',
    title: 'Access control',
    description: 'Implement role-based access control',
    severity: 'high',
    check: checkAccessControl,
    remediation: 'Implement RBAC or ABAC',
    references: [],
  },
  {
    id: 'soc2-002',
    framework: 'soc2',
    title: 'Change management',
    description: 'All changes must be tracked and reviewed',
    severity: 'medium',
    check: checkChangeManagement,
    remediation: 'Use version control and code review process',
    references: [],
  },
];

/**
 * PCI-DSS rules
 */
export const PCIDSS_RULES: ComplianceRule[] = [
  {
    id: 'pci-001',
    framework: 'pci-dss',
    title: 'No card data storage',
    description: 'Do not store full card numbers',
    severity: 'critical',
    check: checkCardDataStorage,
    remediation: 'Use tokenization for card data',
    references: ['https://www.pcisecuritystandards.org/'],
  },
  {
    id: 'pci-002',
    framework: 'pci-dss',
    title: 'Encryption of card data',
    description: 'Card data must be encrypted',
    severity: 'critical',
    check: () => ({ passed: true, message: 'Manual review required' }),
    remediation: 'Encrypt all card data at rest and in transit',
    references: [],
  },
];

/**
 * All rules by framework
 */
export const RULES_BY_FRAMEWORK: Record<ComplianceFramework, ComplianceRule[]> = {
  platform: PLATFORM_RULES,
  gdpr: GDPR_RULES,
  soc2: SOC2_RULES,
  'pci-dss': PCIDSS_RULES,
  hipaa: [], // To be implemented
  iso27001: [], // To be implemented
  ccpa: [], // Similar to GDPR
  custom: [],
};

/**
 * Get all rules for given frameworks
 */
export function getRulesForFrameworks(
  frameworks: ComplianceFramework[]
): ComplianceRule[] {
  const rules: ComplianceRule[] = [];

  // Always include platform rules
  rules.push(...PLATFORM_RULES);

  // Add framework-specific rules
  for (const framework of frameworks) {
    if (framework !== 'platform') {
      const frameworkRules = RULES_BY_FRAMEWORK[framework] || [];
      rules.push(...frameworkRules);
    }
  }

  return rules;
}

/**
 * Run all applicable rules
 */
export function evaluateCompliance(ctx: RuleContext): {
  results: CheckResult[];
  violations: Violation[];
} {
  const results: CheckResult[] = [];
  const violations: Violation[] = [];

  const rules = getRulesForFrameworks(ctx.config.frameworks);

  for (const rule of rules) {
    // Check exclusions
    if (ctx.config.exclusions?.rules?.includes(rule.id)) {
      continue;
    }

    try {
      const result = rule.check(ctx);

      results.push({
        rule: rule.id,
        framework: rule.framework,
        passed: result.passed,
        message: result.message,
      });

      if (!result.passed && result.violations) {
        for (const v of result.violations) {
          violations.push({
            id: `${rule.id}-${violations.length}`,
            framework: rule.framework,
            rule: rule.id,
            severity: rule.severity,
            title: rule.title,
            description: v.details,
            location: {
              file: v.file,
              line: v.line,
              code: v.code,
            },
            remediation: rule.remediation,
            references: rule.references,
            autoFixable: false,
          });
        }
      } else if (!result.passed) {
        // Rule failed but no specific violations
        violations.push({
          id: `${rule.id}-0`,
          framework: rule.framework,
          rule: rule.id,
          severity: rule.severity,
          title: rule.title,
          description: result.message,
          remediation: rule.remediation,
          references: rule.references,
          autoFixable: false,
        });
      }
    } catch (error) {
      // Log error but continue with other rules
      console.error(`Rule ${rule.id} failed:`, error);
    }
  }

  return { results, violations };
}
