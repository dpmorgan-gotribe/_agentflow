/**
 * Guardrail Types
 *
 * Type definitions for input/output validation guardrails.
 */

import { z } from 'zod';

/**
 * Guardrail validation result
 */
export interface GuardrailValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Guardrail manager result
 */
export interface GuardrailResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
}

/**
 * Guardrail severity levels
 */
export type GuardrailSeverity = 'error' | 'warning';

/**
 * Output types that guardrails can validate
 */
export type OutputType = 'code' | 'text' | 'json' | 'file';

/**
 * Input guardrail interface
 */
export interface InputGuardrail {
  id: string;
  description: string;
  enabled: boolean;
  severity: GuardrailSeverity;
  validate: (
    input: string,
    context?: Record<string, unknown>
  ) => Promise<GuardrailValidationResult>;
}

/**
 * Output guardrail interface
 */
export interface OutputGuardrail {
  id: string;
  description: string;
  enabled: boolean;
  severity: GuardrailSeverity;
  outputTypes?: OutputType[];
  validate: (
    output: string,
    outputType: string,
    context?: Record<string, unknown>
  ) => Promise<GuardrailValidationResult>;
}

/**
 * Guardrail configuration
 */
export interface GuardrailConfig {
  enabled: boolean;
  strictMode: boolean;
  logViolations: boolean;
}

/**
 * Secret detection result
 */
export interface SecretDetection {
  type: string;
  confidence: 'low' | 'medium' | 'high';
  line?: number;
  masked: string;
  hash?: string;
}

/**
 * OWASP vulnerability detection result
 */
export interface OWASPVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line?: number;
  description: string;
}

/**
 * Zod schema for guardrail config
 */
export const guardrailConfigSchema = z.object({
  enabled: z.boolean().default(true),
  strictMode: z.boolean().default(true), // Secure by default
  logViolations: z.boolean().default(true),
});

/**
 * Zod schema for guardrail result
 */
export const guardrailResultSchema = z.object({
  valid: z.boolean(),
  violations: z.array(z.string()),
  warnings: z.array(z.string()),
});
