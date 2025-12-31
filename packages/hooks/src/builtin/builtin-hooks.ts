/**
 * Built-in Hooks
 *
 * Core security and validation hooks that are registered by default.
 * These hooks provide essential security functionality.
 */

import type { HookRegistration, HookResult, BaseHookPayload } from '../hooks/hook-types.js';
import type {
  PreFileWritePayload,
  PreFileReadPayload,
  SecurityScanPayload,
} from '../hooks/hook-types.js';
import type { SecretDetection, OWASPVulnerability } from '../guardrails/types.js';
import {
  detectSecrets,
  detectOWASPVulnerabilities,
} from '../guardrails/code-guardrails.js';

/**
 * Dangerous file patterns that should be protected
 */
const DANGEROUS_FILE_PATTERNS = [
  // System files
  /^\/etc\//,
  /^\/root\//,
  /^\/var\/log\//,
  /^C:\\Windows\\/i,
  /^C:\\Program Files/i,
  /^C:\\Users\\[^\\]+\\AppData/i,

  // Sensitive configuration
  /\.env$/i,
  /\.env\.\w+$/i,
  /credentials\.json$/i,
  /secrets\.yaml$/i,
  /secrets\.yml$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,

  // Version control
  /\.git\//,
  /\.gitconfig$/,

  // SSH
  /\.ssh\//,
  /id_rsa$/,
  /id_ed25519$/,
  /authorized_keys$/,
  /known_hosts$/,

  // AWS
  /\.aws\/credentials$/,
  /\.aws\/config$/,

  // Kubernetes
  /\.kube\/config$/,

  // Docker
  /docker\.sock$/,

  // Database
  /\.sqlite$/i,
  /\.db$/i,
];

/**
 * Allowed file write locations (whitelist approach)
 */
const ALLOWED_WRITE_PREFIXES = [
  '/tmp/',
  '/home/',
  '/app/',
  '/workspace/',
  '/project/',
  'C:\\Users\\',
  'C:\\Development\\',
  'C:\\Projects\\',
];

/**
 * Create dangerous file protection hook
 */
export function createDangerousFileProtectionHook(): HookRegistration {
  return {
    id: 'builtin:dangerous-file-protection',
    point: 'pre_file_write',
    priority: 0, // Highest priority - runs first
    enabled: true,
    description: 'Blocks writes to dangerous or sensitive file paths',
    source: 'builtin',
    handler: async (
      payload: BaseHookPayload
    ): Promise<HookResult> => {
      const filePayload = payload as PreFileWritePayload;
      const filePath = filePayload.filePath;

      // Check against dangerous patterns
      for (const pattern of DANGEROUS_FILE_PATTERNS) {
        if (pattern.test(filePath)) {
          return {
            action: 'block',
            reason: `Writing to sensitive file path is not allowed: ${filePath}`,
          };
        }
      }

      // Check if path starts with allowed prefix
      const isAllowed = ALLOWED_WRITE_PREFIXES.some((prefix) =>
        filePath.toLowerCase().startsWith(prefix.toLowerCase())
      );

      if (!isAllowed) {
        return {
          action: 'block',
          reason: `File path is not in an allowed directory: ${filePath}`,
          warnings: ['File writes are restricted to specific directories for security'],
        };
      }

      return { action: 'continue' };
    },
  };
}

/**
 * Create sensitive file read hook
 */
export function createSensitiveFileReadHook(): HookRegistration {
  return {
    id: 'builtin:sensitive-file-read',
    point: 'pre_file_read',
    priority: 0,
    enabled: true,
    description: 'Warns or blocks reads of sensitive files',
    source: 'builtin',
    handler: async (
      payload: BaseHookPayload
    ): Promise<HookResult> => {
      const filePayload = payload as PreFileReadPayload;
      const filePath = filePayload.filePath;

      // Check for highly sensitive files that should never be read
      const blockPatterns = [
        /\.ssh\/id_/,
        /\.aws\/credentials$/,
        /\.kube\/config$/,
        /\.pem$/i,
        /\.key$/i,
      ];

      for (const pattern of blockPatterns) {
        if (pattern.test(filePath)) {
          return {
            action: 'block',
            reason: `Reading highly sensitive file is not allowed: ${filePath}`,
          };
        }
      }

      // Warn for potentially sensitive files
      const warnPatterns = [
        /\.env/i,
        /credentials/i,
        /secrets/i,
        /config\.json$/i,
        /settings\.json$/i,
      ];

      const warnings: string[] = [];
      for (const pattern of warnPatterns) {
        if (pattern.test(filePath)) {
          warnings.push(`Reading potentially sensitive file: ${filePath}`);
          break;
        }
      }

      return {
        action: 'continue',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  };
}

/**
 * Create secret detection hook for file writes
 */
export function createSecretDetectionHook(): HookRegistration {
  return {
    id: 'builtin:secret-detection',
    point: 'pre_file_write',
    priority: 1, // Run after path validation
    enabled: true,
    description: 'Detects and blocks secrets in file content',
    source: 'builtin',
    handler: async (
      payload: BaseHookPayload
    ): Promise<HookResult> => {
      const filePayload = payload as PreFileWritePayload;
      const content = filePayload.content;

      // Detect secrets in content
      const secrets = detectSecrets(content);

      // Filter high-confidence secrets
      const highConfidence = secrets.filter((s: SecretDetection) => s.confidence === 'high');

      if (highConfidence.length > 0) {
        const types = [...new Set(highConfidence.map((s: SecretDetection) => s.type))];
        return {
          action: 'block',
          reason: `Detected ${highConfidence.length} secret(s) in file content: ${types.join(', ')}`,
        };
      }

      // Medium confidence - warn but allow
      const mediumConfidence = secrets.filter((s: SecretDetection) => s.confidence === 'medium');
      if (mediumConfidence.length > 0) {
        const types = [...new Set(mediumConfidence.map((s: SecretDetection) => s.type))];
        return {
          action: 'continue',
          warnings: [`Potential secrets detected (medium confidence): ${types.join(', ')}`],
        };
      }

      return { action: 'continue' };
    },
  };
}

/**
 * Create OWASP vulnerability detection hook
 */
export function createOWASPDetectionHook(): HookRegistration {
  return {
    id: 'builtin:owasp-detection',
    point: 'pre_file_write',
    priority: 2,
    enabled: true,
    description: 'Detects OWASP vulnerabilities in code',
    source: 'builtin',
    handler: async (
      payload: BaseHookPayload
    ): Promise<HookResult> => {
      const filePayload = payload as PreFileWritePayload;
      const content = filePayload.content;
      const filePath = filePayload.filePath;

      // Determine language from file extension
      const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
      const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'php', 'java', 'go'];

      if (!codeExtensions.includes(ext)) {
        return { action: 'continue' };
      }

      // Detect vulnerabilities
      const vulnerabilities = detectOWASPVulnerabilities(content, ext);

      // Critical vulnerabilities block the write
      const critical = vulnerabilities.filter((v: OWASPVulnerability) => v.severity === 'critical');
      if (critical.length > 0) {
        const types = [...new Set(critical.map((v: OWASPVulnerability) => v.type))];
        return {
          action: 'block',
          reason: `Detected ${critical.length} critical vulnerability(ies): ${types.join(', ')}`,
        };
      }

      // High severity - block in strict mode, warn otherwise
      const high = vulnerabilities.filter((v: OWASPVulnerability) => v.severity === 'high');
      if (high.length > 0) {
        const types = [...new Set(high.map((v: OWASPVulnerability) => v.type))];
        return {
          action: 'block',
          reason: `Detected ${high.length} high-severity vulnerability(ies): ${types.join(', ')}`,
        };
      }

      // Medium - warn
      const medium = vulnerabilities.filter((v: OWASPVulnerability) => v.severity === 'medium');
      if (medium.length > 0) {
        const types = [...new Set(medium.map((v: OWASPVulnerability) => v.type))];
        return {
          action: 'continue',
          warnings: [`Potential vulnerabilities detected (medium severity): ${types.join(', ')}`],
        };
      }

      return { action: 'continue' };
    },
  };
}

/**
 * Create security scan hook
 */
export function createSecurityScanHook(): HookRegistration {
  return {
    id: 'builtin:security-scan',
    point: 'security_scan',
    priority: 0,
    enabled: true,
    description: 'Comprehensive security scan of content',
    source: 'builtin',
    handler: async (
      payload: BaseHookPayload
    ): Promise<HookResult> => {
      const scanPayload = payload as SecurityScanPayload;
      const content = scanPayload.content;
      const contentType = scanPayload.contentType;
      const language = scanPayload.language;

      const warnings: string[] = [];
      let shouldBlock = false;
      let blockReason = '';

      // Always check for secrets
      const secrets = detectSecrets(content);
      const highConfidenceSecrets = secrets.filter((s: SecretDetection) => s.confidence === 'high');

      if (highConfidenceSecrets.length > 0) {
        shouldBlock = true;
        const types = [...new Set(highConfidenceSecrets.map((s: SecretDetection) => s.type))];
        blockReason = `Detected secrets: ${types.join(', ')}`;
      }

      // Check for OWASP vulnerabilities in code
      if (contentType === 'code' && !shouldBlock) {
        const vulnerabilities = detectOWASPVulnerabilities(content, language);
        const critical = vulnerabilities.filter((v: OWASPVulnerability) => v.severity === 'critical');

        if (critical.length > 0) {
          shouldBlock = true;
          const types = [...new Set(critical.map((v: OWASPVulnerability) => v.type))];
          blockReason = `Detected critical vulnerabilities: ${types.join(', ')}`;
        }

        const high = vulnerabilities.filter((v: OWASPVulnerability) => v.severity === 'high');
        if (high.length > 0) {
          const types = [...new Set(high.map((v: OWASPVulnerability) => v.type))];
          warnings.push(`High-severity vulnerabilities: ${types.join(', ')}`);
        }
      }

      if (shouldBlock) {
        return {
          action: 'block',
          reason: blockReason,
          warnings,
        };
      }

      return {
        action: 'continue',
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  };
}

/**
 * Create error logging hook
 */
export function createErrorLoggingHook(): HookRegistration {
  return {
    id: 'builtin:error-logging',
    point: 'on_error',
    priority: 100, // Low priority - runs after other error handlers
    enabled: true,
    description: 'Logs errors for debugging and monitoring',
    source: 'builtin',
    handler: async (
      _payload: BaseHookPayload
    ): Promise<HookResult> => {
      // In a real implementation, this would log to a monitoring system
      // For now, we just pass through
      return { action: 'continue' };
    },
  };
}

/**
 * Get all builtin hooks
 */
export function getBuiltinHooks(): HookRegistration[] {
  return [
    createDangerousFileProtectionHook(),
    createSensitiveFileReadHook(),
    createSecretDetectionHook(),
    createOWASPDetectionHook(),
    createSecurityScanHook(),
    createErrorLoggingHook(),
  ];
}

/**
 * Register all builtin hooks with a hook manager
 */
export function registerBuiltinHooks(
  register: (hook: HookRegistration) => void
): void {
  const builtinHooks = getBuiltinHooks();
  for (const hook of builtinHooks) {
    register(hook);
  }
}
