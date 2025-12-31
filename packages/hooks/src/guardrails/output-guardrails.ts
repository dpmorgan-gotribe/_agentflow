/**
 * Output Guardrails
 *
 * Guardrails for validating AI outputs before delivery.
 * Includes JSON validation, code completeness checks, and content filtering.
 */

import type { OutputGuardrail, GuardrailValidationResult } from './types.js';

/**
 * Hallucination indicators
 */
const HALLUCINATION_PATTERNS = [
  // Uncertainty phrases that might indicate hallucination
  /(?:I\s+(?:think|believe|assume|guess)(?:\s+that)?|probably|maybe|perhaps|possibly|might\s+be|could\s+be)/gi,

  // Made-up references
  /(?:according\s+to|as\s+stated\s+in|based\s+on)\s+(?:(?:my|the)\s+)?(?:knowledge|information|data)\s+(?:from|about)/gi,

  // Fabricated sources
  /(?:research|study|paper)\s+(?:by|from)\s+(?:Dr\.?|Professor|Prof\.?)\s+[A-Z][a-z]+/g,

  // Invented URLs
  /https?:\/\/(?:www\.)?(?:example\.com|fake\.url|placeholder\.org)/gi,
];

/**
 * Incomplete code patterns
 */
const INCOMPLETE_CODE_PATTERNS = [
  // Placeholder comments
  /\/\/\s*TODO/gi,
  /\/\/\s*FIXME/gi,
  /\/\/\s*\.\.\./g,
  /\/\*\s*TODO/gi,
  /#\s*TODO/gi,

  // Placeholder code
  /\bpass\b(?:\s*#.*)?$/gm,
  /throw\s+new\s+Error\s*\(\s*['"](?:Not\s+implemented|TODO)['"]\s*\)/gi,
  /\.\.\.\s*(?:\/\/|#)?\s*(?:rest|more|implement)/gi,

  // Ellipsis in code
  /^\s*\.\.\.\s*$/gm,

  // Unimplemented functions
  /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/g,
  /=>\s*\{\s*\}/g,

  // Placeholder values
  /['"](?:INSERT_|REPLACE_|YOUR_|PLACEHOLDER)/gi,
];

/**
 * Unsafe content patterns for output
 */
const UNSAFE_OUTPUT_PATTERNS = [
  // Executable code in text responses
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /data:text\/html/gi,

  // Potential XSS in output
  /on(?:click|load|error|mouseover)\s*=/gi,

  // Harmful content
  /(?:self-?harm|suicide)\s+(?:methods?|instructions?|ways?\s+to)/gi,

  // Illegal activity instructions
  /(?:step-?by-?step|detailed)\s+(?:instructions?|guide)\s+(?:for|to|on)\s+(?:illegal|criminal)/gi,
];

/**
 * Create JSON validation guardrail
 */
export function createJSONValidationGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:json-validation',
    description: 'Validates JSON output is well-formed',
    enabled: true,
    severity: 'error',
    outputTypes: ['json'],
    validate: async (
      output: string,
      _outputType: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      try {
        JSON.parse(output);
        return { valid: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON';
        return {
          valid: false,
          message: `Invalid JSON output: ${message}`,
        };
      }
    },
  };
}

/**
 * Create code completeness guardrail
 */
export function createCodeCompletenessGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:code-completeness',
    description: 'Checks for incomplete or placeholder code',
    enabled: true,
    severity: 'warning',
    outputTypes: ['code', 'file'],
    validate: async (
      output: string,
      _outputType: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const issues: string[] = [];

      for (const pattern of INCOMPLETE_CODE_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = output.match(pattern);
        if (matches && matches.length > 0) {
          issues.push(`Found ${matches.length} instance(s) of incomplete code pattern`);
        }
      }

      if (issues.length > 0) {
        return {
          valid: true, // Warning only
          message: `Code may be incomplete: ${issues.join('; ')}`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create output length guardrail
 */
export function createOutputLengthGuardrail(options?: {
  maxLength?: number;
  minLength?: number;
}): OutputGuardrail {
  const maxLength = options?.maxLength ?? 500000;
  const minLength = options?.minLength ?? 0;

  return {
    id: 'builtin:output-length',
    description: `Validates output length (${minLength}-${maxLength} chars)`,
    enabled: true,
    severity: 'error',
    validate: async (
      output: string,
      _outputType: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      if (output.length > maxLength) {
        return {
          valid: false,
          message: `Output exceeds maximum length of ${maxLength} characters (received ${output.length})`,
        };
      }

      if (output.length < minLength) {
        return {
          valid: false,
          message: `Output below minimum length of ${minLength} characters (received ${output.length})`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create unsafe content detection guardrail for outputs
 */
export function createUnsafeOutputGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:unsafe-output',
    description: 'Detects potentially unsafe content in output',
    enabled: true,
    severity: 'error',
    outputTypes: ['text', 'code'],
    validate: async (
      output: string,
      _outputType: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      for (const pattern of UNSAFE_OUTPUT_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(output)) {
          return {
            valid: false,
            message: 'Output contains potentially unsafe content',
          };
        }
      }

      return { valid: true };
    },
  };
}

/**
 * Create hallucination detection guardrail
 */
export function createHallucinationDetectionGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:hallucination-detection',
    description: 'Detects potential hallucination indicators',
    enabled: true,
    severity: 'warning',
    outputTypes: ['text'],
    validate: async (
      output: string,
      _outputType: string,
      _context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      let indicatorCount = 0;

      for (const pattern of HALLUCINATION_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = output.match(pattern);
        if (matches) {
          indicatorCount += matches.length;
        }
      }

      // Threshold for concern
      if (indicatorCount > 5) {
        return {
          valid: true, // Warning only
          message: `Output may contain hallucinated content (${indicatorCount} uncertainty indicators detected)`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create code syntax validation guardrail
 * Note: This is a basic check - full syntax validation would require language-specific parsers
 */
export function createCodeSyntaxGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:code-syntax',
    description: 'Basic syntax validation for code output',
    enabled: true,
    severity: 'warning',
    outputTypes: ['code', 'file'],
    validate: async (
      output: string,
      _outputType: string,
      context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const language = (context?.['language'] as string | undefined)?.toLowerCase();
      const issues: string[] = [];

      // Check for unbalanced brackets/braces
      const openBraces = (output.match(/\{/g) || []).length;
      const closeBraces = (output.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
      }

      const openParens = (output.match(/\(/g) || []).length;
      const closeParens = (output.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        issues.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
      }

      const openBrackets = (output.match(/\[/g) || []).length;
      const closeBrackets = (output.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        issues.push(`Unbalanced brackets: ${openBrackets} open, ${closeBrackets} close`);
      }

      // Language-specific checks
      if (language === 'typescript' || language === 'javascript') {
        // Check for common JS/TS issues
        if (/\bconst\s+\w+\s*;/.test(output)) {
          issues.push('Const declaration without initialization');
        }
      }

      if (language === 'python') {
        // Check for common Python issues
        if (/:\s*$/.test(output) && !/^\s+/m.test(output.split(':').pop() ?? '')) {
          issues.push('Possible missing indentation after colon');
        }
      }

      if (issues.length > 0) {
        return {
          valid: true, // Warning only
          message: `Potential syntax issues: ${issues.join('; ')}`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Create file path validation guardrail
 */
export function createFilePathGuardrail(): OutputGuardrail {
  return {
    id: 'builtin:file-path',
    description: 'Validates file paths in output',
    enabled: true,
    severity: 'error',
    outputTypes: ['file'],
    validate: async (
      _output: string,
      _outputType: string,
      context?: Record<string, unknown>
    ): Promise<GuardrailValidationResult> => {
      const filePath = context?.['filePath'] as string | undefined;

      if (!filePath) {
        return { valid: true };
      }

      // Check for path traversal attempts
      if (filePath.includes('..')) {
        return {
          valid: false,
          message: 'File path contains path traversal sequence (..)',
        };
      }

      // Check for absolute paths to sensitive directories
      const sensitivePatterns = [
        /^\/etc\//,
        /^\/root\//,
        /^\/var\/log\//,
        /^C:\\Windows\\/i,
        /^C:\\Program Files/i,
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(filePath)) {
          return {
            valid: false,
            message: 'File path points to sensitive system directory',
          };
        }
      }

      // Check for dangerous file extensions
      const dangerousExtensions = ['.exe', '.dll', '.so', '.sh', '.bat', '.cmd', '.ps1'];
      const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
      if (dangerousExtensions.includes(ext)) {
        return {
          valid: false,
          message: `File has potentially dangerous extension: ${ext}`,
        };
      }

      return { valid: true };
    },
  };
}

/**
 * Get all builtin output guardrails
 */
export function getBuiltinOutputGuardrails(): OutputGuardrail[] {
  return [
    createJSONValidationGuardrail(),
    createCodeCompletenessGuardrail(),
    createOutputLengthGuardrail(),
    createUnsafeOutputGuardrail(),
    createHallucinationDetectionGuardrail(),
    createCodeSyntaxGuardrail(),
    createFilePathGuardrail(),
  ];
}
