/**
 * Code Guardrails
 *
 * Security-focused guardrails for detecting secrets and OWASP vulnerabilities
 * in code content.
 */

import type {
  OutputGuardrail,
  GuardrailValidationResult,
  SecretDetection,
  OWASPVulnerability,
} from './types.js';

/**
 * Secret pattern definitions with confidence levels
 */
interface SecretPattern {
  name: string;
  pattern: RegExp;
  confidence: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Comprehensive secret patterns
 * Includes patterns identified in security analysis
 */
const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  {
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    confidence: 'high',
    description: 'AWS Access Key ID',
  },
  {
    name: 'AWS Secret Access Key',
    pattern: /\b([A-Za-z0-9/+=]{40})\b/g,
    confidence: 'medium',
    description: 'Potential AWS Secret Access Key',
  },

  // Anthropic (added per security analysis)
  {
    name: 'Anthropic API Key',
    pattern: /\b(sk-ant-[a-zA-Z0-9-_]{32,})\b/g,
    confidence: 'high',
    description: 'Anthropic API Key',
  },

  // OpenAI
  {
    name: 'OpenAI API Key',
    pattern: /\b(sk-[a-zA-Z0-9]{48,})\b/g,
    confidence: 'high',
    description: 'OpenAI API Key',
  },

  // GitHub
  {
    name: 'GitHub Token',
    pattern: /\b(ghp_[a-zA-Z0-9]{36})\b/g,
    confidence: 'high',
    description: 'GitHub Personal Access Token',
  },
  {
    name: 'GitHub OAuth Token',
    pattern: /\b(gho_[a-zA-Z0-9]{36})\b/g,
    confidence: 'high',
    description: 'GitHub OAuth Token',
  },
  {
    name: 'GitHub App Token',
    pattern: /\b(ghu_[a-zA-Z0-9]{36})\b/g,
    confidence: 'high',
    description: 'GitHub App User Token',
  },

  // Stripe
  {
    name: 'Stripe Secret Key',
    pattern: /\b(sk_live_[a-zA-Z0-9]{24,})\b/g,
    confidence: 'high',
    description: 'Stripe Live Secret Key',
  },
  {
    name: 'Stripe Test Key',
    pattern: /\b(sk_test_[a-zA-Z0-9]{24,})\b/g,
    confidence: 'high',
    description: 'Stripe Test Secret Key',
  },

  // Azure (added per security analysis)
  {
    name: 'Azure Storage Key',
    pattern: /\b([a-zA-Z0-9+/]{86}==)\b/g,
    confidence: 'medium',
    description: 'Potential Azure Storage Account Key',
  },
  {
    name: 'Azure Connection String',
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/gi,
    confidence: 'high',
    description: 'Azure Storage Connection String',
  },

  // GCP (added per security analysis)
  {
    name: 'GCP API Key',
    pattern: /\b(AIza[0-9A-Za-z-_]{35})\b/g,
    confidence: 'high',
    description: 'Google Cloud API Key',
  },
  {
    name: 'GCP Service Account',
    pattern: /"type":\s*"service_account"/g,
    confidence: 'high',
    description: 'GCP Service Account JSON',
  },

  // Database URLs
  {
    name: 'PostgreSQL URL',
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+\/\w+/gi,
    confidence: 'high',
    description: 'PostgreSQL Connection String with credentials',
  },
  {
    name: 'MongoDB URL',
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^/]+/gi,
    confidence: 'high',
    description: 'MongoDB Connection String with credentials',
  },
  {
    name: 'MySQL URL',
    pattern: /mysql:\/\/[^:]+:[^@]+@[^/]+\/\w+/gi,
    confidence: 'high',
    description: 'MySQL Connection String with credentials',
  },
  {
    name: 'Redis URL',
    pattern: /redis:\/\/[^:]*:[^@]+@[^/]+/gi,
    confidence: 'high',
    description: 'Redis Connection String with credentials',
  },

  // Private Keys
  {
    name: 'RSA Private Key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    confidence: 'high',
    description: 'RSA Private Key',
  },
  {
    name: 'EC Private Key',
    pattern: /-----BEGIN EC PRIVATE KEY-----/g,
    confidence: 'high',
    description: 'EC Private Key',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN PRIVATE KEY-----/g,
    confidence: 'high',
    description: 'Private Key',
  },
  {
    name: 'OpenSSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    confidence: 'high',
    description: 'OpenSSH Private Key',
  },
  {
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    confidence: 'high',
    description: 'PGP Private Key Block',
  },

  // Generic API Keys
  {
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey|api_secret|api_token)\s*[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    confidence: 'medium',
    description: 'Generic API Key pattern',
  },
  {
    name: 'Generic Secret',
    pattern: /(?:secret|password|passwd|pwd)\s*[=:]\s*['"]?([^'"=\s]{8,})['"]?/gi,
    confidence: 'low',
    description: 'Generic secret pattern',
  },

  // JWT
  {
    name: 'JWT Token',
    pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]+\b/g,
    confidence: 'high',
    description: 'JSON Web Token',
  },

  // Slack
  {
    name: 'Slack Token',
    pattern: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24})\b/g,
    confidence: 'high',
    description: 'Slack API Token',
  },
  {
    name: 'Slack Webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9]+\/B[a-zA-Z0-9]+\/[a-zA-Z0-9]+/g,
    confidence: 'high',
    description: 'Slack Webhook URL',
  },

  // Discord
  {
    name: 'Discord Token',
    pattern: /\b([MN][a-zA-Z0-9]{23,}\.[\w-]{6}\.[\w-]{27})\b/g,
    confidence: 'high',
    description: 'Discord Bot Token',
  },

  // Twilio
  {
    name: 'Twilio API Key',
    pattern: /\b(SK[a-f0-9]{32})\b/g,
    confidence: 'high',
    description: 'Twilio API Key',
  },

  // SendGrid
  {
    name: 'SendGrid API Key',
    pattern: /\b(SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43})\b/g,
    confidence: 'high',
    description: 'SendGrid API Key',
  },

  // Mailgun
  {
    name: 'Mailgun API Key',
    pattern: /\b(key-[a-f0-9]{32})\b/g,
    confidence: 'high',
    description: 'Mailgun API Key',
  },
];

/**
 * OWASP vulnerability patterns
 */
interface OWASPPattern {
  name: string;
  patterns: RegExp[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  category: string;
}

/**
 * Comprehensive OWASP vulnerability patterns
 * Enhanced with patterns from security analysis
 */
const OWASP_PATTERNS: OWASPPattern[] = [
  // SQL Injection
  {
    name: 'SQL Injection - String Concatenation',
    patterns: [
      /(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE).*\+.*(?:req\.|request\.|params\.|query\.|body\.)/gi,
      /`.*\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/gi,
      /['"].*\+.*['"].*(?:WHERE|AND|OR)/gi,
    ],
    severity: 'critical',
    description: 'Potential SQL injection via string concatenation',
    category: 'A03:2021-Injection',
  },
  {
    name: 'SQL Injection - exec/query without params',
    patterns: [
      /\.(?:exec|query|execute)\s*\(\s*['"`].*\+/gi,
      /\.(?:exec|query|execute)\s*\(\s*`.*\$\{/gi,
      /\.raw\s*\(\s*['"`].*\+/gi,
    ],
    severity: 'critical',
    description: 'Direct query execution without parameterization',
    category: 'A03:2021-Injection',
  },

  // XSS
  {
    name: 'XSS - innerHTML',
    patterns: [
      /\.innerHTML\s*=\s*(?!['"`])/g,
      /\.innerHTML\s*\+=\s*/g,
      /\.outerHTML\s*=\s*(?!['"`])/g,
    ],
    severity: 'high',
    description: 'Potential XSS via innerHTML assignment',
    category: 'A03:2021-Injection',
  },
  {
    name: 'XSS - document.write',
    patterns: [
      /document\.write\s*\(/g,
      /document\.writeln\s*\(/g,
    ],
    severity: 'high',
    description: 'Use of document.write can lead to XSS',
    category: 'A03:2021-Injection',
  },
  {
    name: 'XSS - eval',
    patterns: [
      /\beval\s*\(/g,
      /\bnew\s+Function\s*\(/g,
      /setTimeout\s*\(\s*['"`]/g,
      /setInterval\s*\(\s*['"`]/g,
    ],
    severity: 'critical',
    description: 'Use of eval or dynamic code execution',
    category: 'A03:2021-Injection',
  },
  {
    name: 'XSS - dangerouslySetInnerHTML',
    patterns: [
      /dangerouslySetInnerHTML\s*=\s*\{\s*\{/g,
    ],
    severity: 'high',
    description: 'React dangerouslySetInnerHTML usage',
    category: 'A03:2021-Injection',
  },

  // Command Injection (enhanced per security analysis)
  {
    name: 'Command Injection - exec',
    patterns: [
      /child_process.*exec\s*\([^)]*\+/g,
      /exec\s*\(\s*`.*\$\{/g,
      /execSync\s*\([^)]*\+/g,
      /spawn\s*\([^)]*\+/g,
      /spawnSync\s*\([^)]*\+/g,
    ],
    severity: 'critical',
    description: 'Potential command injection via exec/spawn',
    category: 'A03:2021-Injection',
  },
  {
    name: 'Command Injection - shell',
    patterns: [
      /shell:\s*true/g,
      /\$\(.*\)/g, // Shell command substitution
    ],
    severity: 'high',
    description: 'Shell execution enabled or command substitution',
    category: 'A03:2021-Injection',
  },

  // Path Traversal
  {
    name: 'Path Traversal',
    patterns: [
      /\.\.\/|\.\.\\|\.\.[/\\]/g,
      /path\.join\s*\([^)]*(?:req\.|request\.|params\.|query\.)/g,
      /readFile(?:Sync)?\s*\([^)]*\+/g,
      /writeFile(?:Sync)?\s*\([^)]*\+/g,
    ],
    severity: 'high',
    description: 'Potential path traversal vulnerability',
    category: 'A01:2021-Broken Access Control',
  },

  // Hardcoded Credentials
  {
    name: 'Hardcoded Password',
    patterns: [
      /password\s*[:=]\s*['"][^'"]{4,}['"]/gi,
      /passwd\s*[:=]\s*['"][^'"]{4,}['"]/gi,
      /pwd\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    ],
    severity: 'high',
    description: 'Hardcoded password detected',
    category: 'A07:2021-Identification and Authentication Failures',
  },

  // Insecure Crypto
  {
    name: 'Weak Cryptographic Algorithm',
    patterns: [
      /createHash\s*\(\s*['"]md5['"]\s*\)/gi,
      /createHash\s*\(\s*['"]sha1['"]\s*\)/gi,
      /createCipher\s*\(\s*['"]des['"]/gi,
      /createCipher\s*\(\s*['"]rc4['"]/gi,
    ],
    severity: 'medium',
    description: 'Use of weak cryptographic algorithm',
    category: 'A02:2021-Cryptographic Failures',
  },

  // Insecure Randomness
  {
    name: 'Insecure Randomness',
    patterns: [
      /Math\.random\s*\(\s*\)/g,
    ],
    severity: 'low',
    description: 'Math.random() is not cryptographically secure',
    category: 'A02:2021-Cryptographic Failures',
  },

  // SSRF
  {
    name: 'SSRF',
    patterns: [
      /fetch\s*\([^)]*(?:req\.|request\.|params\.|query\.)/g,
      /axios\s*\.\s*(?:get|post|put|delete)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/g,
      /http\.(?:get|request)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/g,
    ],
    severity: 'high',
    description: 'Potential SSRF via user-controlled URL',
    category: 'A10:2021-Server-Side Request Forgery',
  },

  // XXE
  {
    name: 'XXE',
    patterns: [
      /parseXML|DOMParser|XMLHttpRequest/g,
      /<!ENTITY/gi,
    ],
    severity: 'high',
    description: 'Potential XXE vulnerability in XML parsing',
    category: 'A05:2021-Security Misconfiguration',
  },

  // Prototype Pollution
  {
    name: 'Prototype Pollution',
    patterns: [
      /__proto__/g,
      /\[['"]constructor['"]\]/g,
      /Object\.assign\s*\(\s*\{\s*\}/g,
    ],
    severity: 'high',
    description: 'Potential prototype pollution',
    category: 'A03:2021-Injection',
  },

  // NoSQL Injection
  {
    name: 'NoSQL Injection',
    patterns: [
      /\$where\s*:/g,
      /\$regex\s*:/g,
      /\.find\s*\(\s*\{.*(?:req\.|request\.|params\.|query\.)/g,
    ],
    severity: 'high',
    description: 'Potential NoSQL injection',
    category: 'A03:2021-Injection',
  },

  // Open Redirect
  {
    name: 'Open Redirect',
    patterns: [
      /res\.redirect\s*\([^)]*(?:req\.|request\.|params\.|query\.)/g,
      /location\.href\s*=\s*(?:req\.|request\.|params\.|query\.)/g,
      /window\.location\s*=\s*(?:req\.|request\.|params\.|query\.)/g,
    ],
    severity: 'medium',
    description: 'Potential open redirect vulnerability',
    category: 'A01:2021-Broken Access Control',
  },

  // Insecure Deserialization
  {
    name: 'Insecure Deserialization',
    patterns: [
      /JSON\.parse\s*\([^)]*(?:req\.|request\.|body\.)/g,
      /unserialize\s*\(/g,
      /pickle\.loads\s*\(/g,
    ],
    severity: 'medium',
    description: 'Potential insecure deserialization',
    category: 'A08:2021-Software and Data Integrity Failures',
  },

  // Security Headers Missing
  {
    name: 'Missing Security Headers',
    patterns: [
      /Access-Control-Allow-Origin:\s*\*/gi,
      /X-Frame-Options.*ALLOWALL/gi,
    ],
    severity: 'medium',
    description: 'Insecure CORS or frame options configuration',
    category: 'A05:2021-Security Misconfiguration',
  },
];

/**
 * Mask a secret value for safe logging
 */
function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  const visibleChars = Math.min(4, Math.floor(value.length / 4));
  return value.slice(0, visibleChars) + '*'.repeat(value.length - visibleChars * 2) + value.slice(-visibleChars);
}

/**
 * Detect secrets in content
 */
export function detectSecrets(content: string): SecretDetection[] {
  const detections: SecretDetection[] = [];
  const lines = content.split('\n');

  for (const secretPattern of SECRET_PATTERNS) {
    // Reset regex lastIndex
    secretPattern.pattern.lastIndex = 0;

    let match;
    while ((match = secretPattern.pattern.exec(content)) !== null) {
      const secretValue = match[1] ?? match[0];

      // Find line number
      let lineNumber = 1;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line !== undefined) {
          charCount += line.length + 1; // +1 for newline
        }
        if (charCount >= match.index) {
          lineNumber = i + 1;
          break;
        }
      }

      detections.push({
        type: secretPattern.name,
        confidence: secretPattern.confidence,
        line: lineNumber,
        masked: maskSecret(secretValue),
      });
    }
  }

  return detections;
}

/**
 * Detect OWASP vulnerabilities in content
 */
export function detectOWASPVulnerabilities(
  content: string,
  _language?: string
): OWASPVulnerability[] {
  const vulnerabilities: OWASPVulnerability[] = [];
  const lines = content.split('\n');

  for (const owaspPattern of OWASP_PATTERNS) {
    for (const pattern of owaspPattern.patterns) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Find line number
        let lineNumber = 1;
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line !== undefined) {
            charCount += line.length + 1;
          }
          if (charCount >= match.index) {
            lineNumber = i + 1;
            break;
          }
        }

        vulnerabilities.push({
          type: `${owaspPattern.category}: ${owaspPattern.name}`,
          severity: owaspPattern.severity,
          line: lineNumber,
          description: owaspPattern.description,
        });
      }
    }
  }

  return vulnerabilities;
}

/**
 * Create secret detection guardrail
 */
export function createSecretDetectionGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:secret-detection',
    description: 'Detects and blocks secrets in code output',
    enabled: true,
    severity: 'error',
    outputTypes: ['code', 'text', 'file'],
    validate: async (
      output: string,
      _outputType: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const secrets = detectSecrets(output);

      // Filter by confidence
      const highConfidence = secrets.filter((s) => s.confidence === 'high');
      const mediumConfidence = secrets.filter((s) => s.confidence === 'medium');

      if (highConfidence.length > 0) {
        const types = [...new Set(highConfidence.map((s) => s.type))];
        return {
          valid: false,
          message: `Detected ${highConfidence.length} high-confidence secret(s): ${types.join(', ')}`,
        };
      }

      if (mediumConfidence.length > 2) {
        // Multiple medium-confidence matches are suspicious
        return {
          valid: false,
          message: `Detected ${mediumConfidence.length} potential secrets (medium confidence)`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create OWASP vulnerability detection guardrail
 */
export function createOWASPDetectionGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:owasp-detection',
    description: 'Detects OWASP Top 10 vulnerabilities in code',
    enabled: true,
    severity: 'error',
    outputTypes: ['code', 'file'],
    validate: async (
      output: string,
      _outputType: string,
      context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const language = context?.['language'] as string | undefined;
      const vulnerabilities = detectOWASPVulnerabilities(output, language);

      // Filter critical and high severity
      const critical = vulnerabilities.filter((v) => v.severity === 'critical');
      const high = vulnerabilities.filter((v) => v.severity === 'high');

      if (critical.length > 0) {
        const types = [...new Set(critical.map((v) => v.type))];
        return {
          valid: false,
          message: `Detected ${critical.length} critical vulnerability(ies): ${types.join(', ')}`,
        };
      }

      if (high.length > 0) {
        const types = [...new Set(high.map((v) => v.type))];
        return {
          valid: false,
          message: `Detected ${high.length} high-severity vulnerability(ies): ${types.join(', ')}`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Get all builtin code guardrails
 */
export function getBuiltinCodeGuardrails(): OutputGuardrail[] {
  return [
    createSecretDetectionGuardrail(),
    createOWASPDetectionGuardrail(),
  ];
}
