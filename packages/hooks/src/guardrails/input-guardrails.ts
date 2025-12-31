/**
 * Input Guardrails
 *
 * Guardrails for validating user inputs before processing.
 * Includes prompt injection detection, PII detection, and malicious content filtering.
 */

import type { InputGuardrail, GuardrailValidationResult } from './types.js';

/**
 * Prompt injection patterns
 */
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction overrides
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /forget\s+(all\s+)?previous\s+instructions?/gi,
  /disregard\s+(all\s+)?previous\s+instructions?/gi,
  /override\s+(?:all\s+)?(?:previous\s+)?instructions?/gi,

  // Role manipulation
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|another)/gi,
  /pretend\s+(?:you(?:'re|\s+are)\s+)?(?:to\s+be\s+)?(?:a\s+)?/gi,
  /act\s+as\s+(?:if\s+you\s+are\s+)?(?:a\s+)?/gi,
  /roleplay\s+as/gi,

  // System prompt extraction
  /what\s+(?:is|are)\s+your\s+(?:system\s+)?(?:prompt|instructions?)/gi,
  /show\s+(?:me\s+)?your\s+(?:system\s+)?(?:prompt|instructions?)/gi,
  /reveal\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?)/gi,
  /print\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?)/gi,

  // Jailbreak attempts
  /\bDAN\b.*(?:mode|prompt)/gi,
  /jailbreak/gi,
  /bypass\s+(?:safety|filters?|restrictions?)/gi,
  /\[\s*(?:SYSTEM|ADMIN)\s*\]/gi,

  // Code execution attempts via prompt
  /```(?:system|admin|root)/gi,
  /<\|(?:im_start|system)\|>/gi,

  // Delimiter manipulation
  /###\s*(?:SYSTEM|INSTRUCTION)/gi,
  /\*\*\*\s*(?:OVERRIDE|IGNORE)/gi,
];

/**
 * PII patterns with types
 */
interface PIIPattern {
  name: string;
  pattern: RegExp;
  sensitivity: 'high' | 'medium' | 'low';
}

const PII_PATTERNS: PIIPattern[] = [
  // SSN
  {
    name: 'Social Security Number',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    sensitivity: 'high',
  },
  {
    name: 'Social Security Number (no dashes)',
    pattern: /\b\d{9}\b/g,
    sensitivity: 'medium',
  },

  // Credit Cards
  {
    name: 'Credit Card (Visa)',
    pattern: /\b4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    sensitivity: 'high',
  },
  {
    name: 'Credit Card (Mastercard)',
    pattern: /\b5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    sensitivity: 'high',
  },
  {
    name: 'Credit Card (Amex)',
    pattern: /\b3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5}\b/g,
    sensitivity: 'high',
  },

  // Phone Numbers
  {
    name: 'US Phone Number',
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    sensitivity: 'medium',
  },
  {
    name: 'International Phone',
    pattern: /\b\+\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
    sensitivity: 'medium',
  },

  // Email
  {
    name: 'Email Address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    sensitivity: 'medium',
  },

  // Addresses
  {
    name: 'Street Address',
    pattern: /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Circle|Cir)\b/gi,
    sensitivity: 'medium',
  },

  // Government IDs
  {
    name: 'Passport Number',
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    sensitivity: 'high',
  },
  {
    name: 'Drivers License',
    pattern: /\b[A-Z]{1,2}\d{5,8}\b/g,
    sensitivity: 'medium',
  },

  // Financial
  {
    name: 'Bank Account',
    pattern: /\b\d{8,17}\b/g,
    sensitivity: 'low',
  },
  {
    name: 'Routing Number',
    pattern: /\b\d{9}\b/g,
    sensitivity: 'low',
  },

  // Date of Birth
  {
    name: 'Date of Birth',
    pattern: /\b(?:DOB|birth(?:day|date)?)[:\s]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
    sensitivity: 'medium',
  },
];

/**
 * Malicious content patterns
 */
const MALICIOUS_PATTERNS = [
  // Explicit harm instructions
  /how\s+to\s+(?:make|create|build)\s+(?:a\s+)?(?:bomb|explosive|weapon)/gi,
  /(?:instructions?|steps?)\s+(?:for|to)\s+(?:harm|kill|attack)/gi,

  // Hacking instructions
  /how\s+to\s+(?:hack|exploit|break\s+into)/gi,
  /(?:bypass|disable)\s+(?:security|authentication|firewall)/gi,

  // Malware creation
  /(?:write|create|make)\s+(?:a\s+)?(?:virus|malware|ransomware|trojan|keylogger)/gi,
  /(?:code|script)\s+(?:for|to)\s+(?:steal|exfiltrate|harvest)/gi,

  // Social engineering
  /(?:phishing|spear-?phishing)\s+(?:email|page|site)/gi,
  /(?:impersonate|pretend\s+to\s+be)\s+(?:a\s+)?(?:bank|government|official)/gi,

  // Illegal activities
  /(?:forge|counterfeit)\s+(?:documents?|money|currency)/gi,
  /(?:launder|clean)\s+(?:money|funds)/gi,
];

/**
 * Create prompt injection detection guardrail
 */
export function createPromptInjectionGuardrail(): InputGuardrail {
  return {
    id: 'builtin:prompt-injection',
    description: 'Detects and blocks prompt injection attempts',
    enabled: true,
    severity: 'error',
    validate: async (
      input: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const matches: string[] = [];

      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(input)) {
          matches.push(pattern.source.slice(0, 30) + '...');
        }
      }

      if (matches.length > 0) {
        return {
          valid: false,
          message: `Detected potential prompt injection attempt (${matches.length} pattern match${matches.length > 1 ? 'es' : ''})`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create PII detection guardrail
 */
export function createPIIDetectionGuardrail(options?: {
  blockHighSensitivity?: boolean;
  warnMediumSensitivity?: boolean;
}): InputGuardrail {
  const blockHigh = options?.blockHighSensitivity ?? true;
  const warnMedium = options?.warnMediumSensitivity ?? true;

  return {
    id: 'builtin:pii-detection',
    description: 'Detects personally identifiable information in input',
    enabled: true,
    severity: blockHigh ? 'error' : 'warning',
    validate: async (
      input: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const detections: { type: string; sensitivity: string }[] = [];

      for (const piiPattern of PII_PATTERNS) {
        piiPattern.pattern.lastIndex = 0;
        if (piiPattern.pattern.test(input)) {
          detections.push({
            type: piiPattern.name,
            sensitivity: piiPattern.sensitivity,
          });
        }
      }

      const highSensitivity = detections.filter((d) => d.sensitivity === 'high');
      const mediumSensitivity = detections.filter((d) => d.sensitivity === 'medium');

      if (blockHigh && highSensitivity.length > 0) {
        const types = highSensitivity.map((d) => d.type);
        return {
          valid: false,
          message: `Detected high-sensitivity PII: ${types.join(', ')}`,
        };
      }

      if (warnMedium && mediumSensitivity.length > 0) {
        const types = mediumSensitivity.map((d) => d.type);
        return {
          valid: true,
          message: `Warning: Detected PII in input: ${types.join(', ')}`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create malicious content detection guardrail
 */
export function createMaliciousContentGuardrail(): InputGuardrail {
  return {
    id: 'builtin:malicious-content',
    description: 'Detects and blocks malicious content requests',
    enabled: true,
    severity: 'error',
    validate: async (
      input: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      for (const pattern of MALICIOUS_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(input)) {
          return {
            valid: false,
            message: 'Detected request for potentially harmful or malicious content',
          };
        }
      }

      return { valid: true };
    },
  };
}

/**
 * Create input length guardrail
 */
export function createInputLengthGuardrail(maxLength: number = 100000): InputGuardrail {
  return {
    id: 'builtin:input-length',
    description: `Limits input length to ${maxLength} characters`,
    enabled: true,
    severity: 'error',
    validate: async (
      input: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      if (input.length > maxLength) {
        return {
          valid: false,
          message: `Input exceeds maximum length of ${maxLength} characters (received ${input.length})`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create rate limiting guardrail (requires context with rate info)
 */
export function createRateLimitGuardrail(options?: {
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
}): InputGuardrail {
  const maxPerMinute = options?.maxRequestsPerMinute ?? 60;
  const maxPerHour = options?.maxRequestsPerHour ?? 1000;

  return {
    id: 'builtin:rate-limit',
    description: 'Enforces rate limiting on inputs',
    enabled: true,
    severity: 'error',
    validate: async (
      _input: string,
      context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const requestsPerMinute = (context?.['requestsPerMinute'] as number) ?? 0;
      const requestsPerHour = (context?.['requestsPerHour'] as number) ?? 0;

      if (requestsPerMinute > maxPerMinute) {
        return {
          valid: false,
          message: `Rate limit exceeded: ${requestsPerMinute}/${maxPerMinute} requests per minute`,
        };
      }

      if (requestsPerHour > maxPerHour) {
        return {
          valid: false,
          message: `Rate limit exceeded: ${requestsPerHour}/${maxPerHour} requests per hour`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Get all builtin input guardrails
 */
export function getBuiltinInputGuardrails(): InputGuardrail[] {
  return [
    createPromptInjectionGuardrail(),
    createPIIDetectionGuardrail(),
    createMaliciousContentGuardrail(),
    createInputLengthGuardrail(),
  ];
}
