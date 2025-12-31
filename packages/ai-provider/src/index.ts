/**
 * @aigentflow/ai-provider
 *
 * AI Provider abstraction layer for Aigentflow.
 *
 * Provides a unified interface for AI backends:
 * - Claude CLI (DEFAULT for development - subscription-based)
 * - Anthropic API (for production - per-token)
 * - Mock provider (for testing)
 *
 * @example
 * ```typescript
 * import { getAIProvider } from '@aigentflow/ai-provider';
 *
 * // Get provider based on CLAUDE_CLI environment variable
 * const provider = getAIProvider();
 *
 * // Complete a request
 * const response = await provider.complete({
 *   system: 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * // Spawn a subagent with role-specific context
 * const result = await provider.spawnSubagent(
 *   'architect',
 *   'Design the database schema for user management'
 * );
 *
 * // Stream output
 * if (provider.stream) {
 *   for await (const chunk of provider.stream({
 *     system: 'You are a helpful assistant.',
 *     messages: [{ role: 'user', content: 'Hello!' }],
 *   })) {
 *     process.stdout.write(chunk);
 *   }
 * }
 * ```
 */

// Types and schemas
export {
  // Message types
  type Message,
  MessageRole,
  MessageSchema,
  // Request types
  type AIProviderRequest,
  AIProviderRequestSchema,
  type RequestMetadata,
  RequestMetadataSchema,
  // Response types
  type AIProviderResponse,
  AIProviderResponseSchema,
  type TokenUsage,
  TokenUsageSchema,
  // Subagent types
  type SubagentOptions,
  SubagentOptionsSchema,
  // Provider interface
  type AIProvider,
  type ProviderName,
  ProviderNames,
  // Agent roles
  type AgentRole,
  AgentRoles,
  AgentRoleSchema,
  // Limits
  AI_PROVIDER_LIMITS,
} from './types.js';

// Errors
export {
  // Base error
  AIProviderError,
  // Configuration errors
  AIProviderConfigError,
  // CLI errors
  CLIExecutionError,
  CLITimeoutError,
  // API errors
  APIError,
  APIRateLimitError,
  APIAuthenticationError,
  // Validation errors
  AIProviderValidationError,
  InvalidRoleError,
  PathTraversalError,
  // Provider errors
  ProviderNotAvailableError,
  StreamingNotSupportedError,
  // Type guards
  isAIProviderError,
  hasErrorCode,
  isRecoverableError,
} from './errors.js';

// Configuration
export {
  type AIProviderConfig,
  AIProviderConfigSchema,
  getProviderConfig,
  clearConfigCache,
  validateApiKeyFormat,
  redactApiKey,
} from './config.js';

// Factory
export {
  getAIProvider,
  createMockProvider,
  createCliProvider,
  createApiProvider,
} from './factory.js';

// Providers (for direct instantiation if needed)
export {
  ClaudeCliProvider,
  type ClaudeCliConfig,
  AnthropicApiProvider,
  type AnthropicApiConfig,
  MockProvider,
  type MockResponseConfig,
} from './providers/index.js';
