/**
 * Security Sanitizer
 *
 * Functions for sanitizing error messages and output
 * to prevent credential leakage.
 */

import { SENSITIVE_PATTERNS } from '../constants.js';

/**
 * Redaction placeholder
 */
const REDACTED = '[REDACTED]';

/**
 * Sanitize an error message by removing sensitive information
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, REDACTED);
  }

  return sanitized;
}

/**
 * Sanitize an Error object
 */
export function sanitizeError(error: Error): Error {
  const sanitized = new Error(sanitizeErrorMessage(error.message));
  sanitized.name = error.name;

  // Sanitize stack trace if present
  if (error.stack) {
    sanitized.stack = sanitizeErrorMessage(error.stack);
  }

  return sanitized;
}

/**
 * Sanitize an object by redacting sensitive keys
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: string[] = [
    'token',
    'password',
    'secret',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
    'credential',
    'credentials',
  ]
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const isKeySensitive = sensitiveKeys.some(
      (sk) =>
        key.toLowerCase().includes(sk.toLowerCase()) ||
        sk.toLowerCase().includes(key.toLowerCase())
    );

    if (isKeySensitive) {
      result[key] = REDACTED;
    } else if (typeof value === 'string') {
      result[key] = sanitizeErrorMessage(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(
        value as Record<string, unknown>,
        sensitiveKeys
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Sanitize URL by removing credentials and tokens
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove credentials from URL
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
    }

    // Remove sensitive query parameters
    const sensitiveParams = ['token', 'key', 'api_key', 'apiKey', 'secret'];
    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, REDACTED);
      }
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, apply general sanitization
    return sanitizeErrorMessage(url);
  }
}

/**
 * Check if a string contains potentially sensitive information
 */
export function containsSensitiveInfo(text: string): boolean {
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Mask a token for display (show only first/last few characters)
 */
export function maskToken(token: string, visibleChars: number = 4): string {
  if (token.length <= visibleChars * 2) {
    return '*'.repeat(token.length);
  }

  const start = token.slice(0, visibleChars);
  const end = token.slice(-visibleChars);
  const middle = '*'.repeat(Math.min(token.length - visibleChars * 2, 20));

  return `${start}${middle}${end}`;
}
