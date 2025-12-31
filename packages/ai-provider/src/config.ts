/**
 * AI Provider Configuration
 *
 * Provider selection logic with Zod validation.
 * CLI mode is DEFAULT for development (subscription-based, cost-effective).
 */

import { z } from 'zod';
import { AI_PROVIDER_LIMITS } from './types.js';
import { AIProviderConfigError } from './errors.js';

/**
 * AI Provider configuration schema with validation
 */
export const AIProviderConfigSchema = z.object({
  // Mode selection - CLI is DEFAULT for development
  CLAUDE_CLI: z.coerce.boolean().default(true),

  // CLI mode settings
  CLAUDE_CLI_PATH: z.string().default('claude'),
  CLAUDE_CLI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(AI_PROVIDER_LIMITS.MAX_TIMEOUT_MS)
    .default(AI_PROVIDER_LIMITS.DEFAULT_TIMEOUT_MS),
  CLAUDE_CLI_MAX_BUFFER: z.coerce
    .number()
    .int()
    .positive()
    .max(AI_PROVIDER_LIMITS.MAX_OUTPUT_BUFFER)
    .default(AI_PROVIDER_LIMITS.MAX_OUTPUT_BUFFER),

  // API mode settings (only needed when CLAUDE_CLI=false)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(8192),
  ANTHROPIC_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.7),
});

export type AIProviderConfig = z.infer<typeof AIProviderConfigSchema>;

/**
 * Cached configuration
 */
let cachedConfig: AIProviderConfig | null = null;

/**
 * Get validated provider configuration
 *
 * @throws {AIProviderConfigError} If configuration is invalid
 */
export function getProviderConfig(): AIProviderConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const result = AIProviderConfigSchema.safeParse(process.env);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new AIProviderConfigError(
      `Invalid AI provider configuration: ${firstError?.message ?? 'Unknown error'}`,
      firstError?.path.join('.') ?? 'unknown',
      result.error.format()
    );
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Clear cached configuration (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Validate API key format (security check)
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  // Anthropic API keys start with 'sk-ant-'
  return apiKey.startsWith('sk-ant-') && apiKey.length >= 40;
}

/**
 * Redact API key for logging (show only first 10 chars)
 */
export function redactApiKey(apiKey: string): string {
  if (apiKey.length <= 10) {
    return '[REDACTED]';
  }
  return `${apiKey.substring(0, 10)}...[REDACTED]`;
}
