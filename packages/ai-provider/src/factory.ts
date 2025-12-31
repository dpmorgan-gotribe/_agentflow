/**
 * AI Provider Factory
 *
 * Creates AI provider instances based on configuration.
 *
 * Default: Claude CLI (CLAUDE_CLI=true) for development
 * Production: Anthropic API (CLAUDE_CLI=false)
 */

import type { AIProvider } from './types.js';
import { getProviderConfig, validateApiKeyFormat } from './config.js';
import { ClaudeCliProvider } from './providers/claude-cli.js';
import { AnthropicApiProvider } from './providers/anthropic-api.js';
import { MockProvider } from './providers/mock.js';
import { ProviderNotAvailableError, AIProviderConfigError } from './errors.js';

/**
 * Create an AI provider based on configuration
 *
 * Default: Claude CLI (CLAUDE_CLI=true)
 * Production: Anthropic API (CLAUDE_CLI=false)
 *
 * @throws {ProviderNotAvailableError} If provider cannot be created
 * @throws {AIProviderConfigError} If configuration is invalid
 */
export function getAIProvider(): AIProvider {
  const config = getProviderConfig();

  // Test mode uses mock
  if (process.env['NODE_ENV'] === 'test') {
    return new MockProvider();
  }

  // CLI mode is DEFAULT for development (cost-effective)
  if (config.CLAUDE_CLI) {
    return new ClaudeCliProvider({
      cliPath: config.CLAUDE_CLI_PATH,
      timeoutMs: config.CLAUDE_CLI_TIMEOUT_MS,
      maxBuffer: config.CLAUDE_CLI_MAX_BUFFER,
    });
  }

  // API mode for production
  if (!config.ANTHROPIC_API_KEY) {
    throw new ProviderNotAvailableError(
      'anthropic-api',
      'ANTHROPIC_API_KEY required when CLAUDE_CLI=false'
    );
  }

  // Validate API key format
  if (!validateApiKeyFormat(config.ANTHROPIC_API_KEY)) {
    throw new AIProviderConfigError(
      'Invalid ANTHROPIC_API_KEY format. Expected sk-ant-...',
      'ANTHROPIC_API_KEY'
    );
  }

  return new AnthropicApiProvider({
    apiKey: config.ANTHROPIC_API_KEY,
    model: config.ANTHROPIC_MODEL,
    maxTokens: config.ANTHROPIC_MAX_TOKENS,
    temperature: config.ANTHROPIC_TEMPERATURE,
  });
}

/**
 * Create a mock provider for testing
 *
 * Convenience function that bypasses configuration.
 */
export function createMockProvider(): MockProvider {
  return new MockProvider();
}

/**
 * Create a CLI provider with explicit configuration
 *
 * Bypasses environment configuration.
 */
export function createCliProvider(config?: {
  cliPath?: string;
  timeoutMs?: number;
  maxBuffer?: number;
}): ClaudeCliProvider {
  return new ClaudeCliProvider(config);
}

/**
 * Create an API provider with explicit configuration
 *
 * Bypasses environment configuration.
 *
 * @throws {AIProviderConfigError} If API key format is invalid
 */
export function createApiProvider(config: {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}): AnthropicApiProvider {
  if (!validateApiKeyFormat(config.apiKey)) {
    throw new AIProviderConfigError(
      'Invalid API key format. Expected sk-ant-...',
      'apiKey'
    );
  }

  return new AnthropicApiProvider({
    apiKey: config.apiKey,
    model: config.model ?? 'claude-sonnet-4-20250514',
    maxTokens: config.maxTokens ?? 8192,
    temperature: config.temperature ?? 0.7,
  });
}
