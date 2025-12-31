/**
 * Security Module
 *
 * Exports security-related utilities for the CLI.
 */

export {
  sanitizeErrorMessage,
  sanitizeError,
  sanitizeObject,
  sanitizeUrl,
  containsSensitiveInfo,
  maskToken,
} from './sanitizer.js';

export {
  validatePrompt,
  validateProjectPath,
  validateTaskId,
  validateApiUrl,
  validatePort,
  CliInputSchema,
  type CliInput,
} from './validator.js';
