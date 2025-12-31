/**
 * Security Validator
 *
 * Input validation functions for CLI security.
 */

import path from 'node:path';
import { z } from 'zod';
import {
  InputValidationError,
  PathTraversalError,
} from '../errors.js';
import { CLI_LIMITS } from '../constants.js';

/**
 * Validate and sanitize a prompt input
 */
export function validatePrompt(prompt: string): string {
  if (!prompt || typeof prompt !== 'string') {
    throw new InputValidationError('Prompt is required', 'prompt');
  }

  const trimmed = prompt.trim();

  if (trimmed.length === 0) {
    throw new InputValidationError('Prompt cannot be empty', 'prompt');
  }

  if (trimmed.length > CLI_LIMITS.MAX_PROMPT_LENGTH) {
    throw new InputValidationError(
      `Prompt exceeds maximum length of ${CLI_LIMITS.MAX_PROMPT_LENGTH} characters`,
      'prompt',
      { length: trimmed.length, max: CLI_LIMITS.MAX_PROMPT_LENGTH }
    );
  }

  return trimmed;
}

/**
 * Validate a project path to prevent path traversal
 */
export function validateProjectPath(projectPath: string): string {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new InputValidationError('Project path is required', 'projectPath');
  }

  // Normalize the path
  const normalized = path.normalize(projectPath);

  // Check for path traversal attempts
  if (normalized.includes('..')) {
    throw new PathTraversalError(
      projectPath,
      'Path traversal sequences (..) not allowed'
    );
  }

  // Check path length
  if (normalized.length > CLI_LIMITS.MAX_PROJECT_PATH_LENGTH) {
    throw new InputValidationError(
      `Project path exceeds maximum length of ${CLI_LIMITS.MAX_PROJECT_PATH_LENGTH} characters`,
      'projectPath',
      { length: normalized.length, max: CLI_LIMITS.MAX_PROJECT_PATH_LENGTH }
    );
  }

  // Resolve to absolute path
  const resolved = path.resolve(normalized);
  const cwd = process.cwd();
  const cwdResolved = path.resolve(cwd);

  // For security, ensure the path is within or is the current working directory
  // or an absolute path that doesn't escape system boundaries
  if (
    !resolved.startsWith(cwdResolved) &&
    !path.isAbsolute(projectPath)
  ) {
    // Allow absolute paths that don't contain traversal
    if (projectPath.includes('..')) {
      throw new PathTraversalError(
        projectPath,
        'Relative path escapes current directory'
      );
    }
  }

  return resolved;
}

/**
 * Validate a task ID format
 */
export function validateTaskId(taskId: string): string {
  if (!taskId || typeof taskId !== 'string') {
    throw new InputValidationError('Task ID is required', 'taskId');
  }

  const trimmed = taskId.trim();

  // Task IDs should be alphanumeric with hyphens (UUID-like or short IDs)
  const taskIdPattern = /^[a-zA-Z0-9-]+$/;
  if (!taskIdPattern.test(trimmed)) {
    throw new InputValidationError(
      'Invalid task ID format',
      'taskId',
      { value: trimmed }
    );
  }

  // Reasonable length limits
  if (trimmed.length < 1 || trimmed.length > 128) {
    throw new InputValidationError(
      'Task ID must be between 1 and 128 characters',
      'taskId',
      { length: trimmed.length }
    );
  }

  return trimmed;
}

/**
 * Validate API URL
 */
export function validateApiUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new InputValidationError('API URL is required', 'apiUrl');
  }

  try {
    const parsed = new URL(url);

    // Only allow http (for localhost) or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new InputValidationError(
        'API URL must use http or https protocol',
        'apiUrl',
        { protocol: parsed.protocol }
      );
    }

    // For non-localhost, require HTTPS
    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';

    if (!isLocalhost && parsed.protocol !== 'https:') {
      throw new InputValidationError(
        'Remote API URL must use HTTPS',
        'apiUrl',
        { url }
      );
    }

    return url;
  } catch (error) {
    if (error instanceof InputValidationError) {
      throw error;
    }
    throw new InputValidationError('Invalid API URL format', 'apiUrl', {
      url,
    });
  }
}

/**
 * Validate port number
 */
export function validatePort(port: number | string): number {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new InputValidationError(
      'Port must be a number between 1 and 65535',
      'port',
      { value: port }
    );
  }

  return portNum;
}

/**
 * Zod schema for CLI input validation
 */
export const CliInputSchema = z.object({
  prompt: z.string().min(1).max(CLI_LIMITS.MAX_PROMPT_LENGTH),
  project: z
    .string()
    .max(CLI_LIMITS.MAX_PROJECT_PATH_LENGTH)
    .refine((p) => !p.includes('..'), {
      message: 'Path traversal not allowed',
    })
    .optional(),
  taskId: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/, 'Invalid task ID format')
    .min(1)
    .max(128)
    .optional(),
  mode: z.enum(['local', 'remote']).optional(),
  format: z.enum(['pretty', 'json']).optional(),
});

export type CliInput = z.infer<typeof CliInputSchema>;
