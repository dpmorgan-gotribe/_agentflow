/**
 * Guardrails Module
 *
 * Exports all guardrail-related types, managers, and built-in guardrails.
 */

export * from './types.js';
export {
  GuardrailManager,
  getGuardrailManager,
  resetGuardrailManager,
  createGuardrailManager,
} from './guardrail-manager.js';

// Code guardrails
export {
  detectSecrets,
  detectOWASPVulnerabilities,
  createSecretDetectionGuardrail,
  createOWASPDetectionGuardrail,
  getBuiltinCodeGuardrails,
} from './code-guardrails.js';

// Input guardrails
export {
  createPromptInjectionGuardrail,
  createPIIDetectionGuardrail,
  createMaliciousContentGuardrail,
  createInputLengthGuardrail,
  createRateLimitGuardrail,
  getBuiltinInputGuardrails,
} from './input-guardrails.js';

// Output guardrails
export {
  createJSONValidationGuardrail,
  createCodeCompletenessGuardrail,
  createOutputLengthGuardrail,
  createUnsafeOutputGuardrail,
  createHallucinationDetectionGuardrail,
  createCodeSyntaxGuardrail,
  createFilePathGuardrail,
  getBuiltinOutputGuardrails,
} from './output-guardrails.js';
