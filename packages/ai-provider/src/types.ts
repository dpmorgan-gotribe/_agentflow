/**
 * AI Provider Types
 *
 * Type definitions and Zod schemas for the AI provider abstraction layer.
 */

import { z } from 'zod';

/**
 * Message role enum
 */
export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

/**
 * Message schema
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(1_000_000), // 1MB max content
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Request metadata schema
 */
export const RequestMetadataSchema = z.object({
  agent: z.string().optional(),
  operation: z.string().optional(),
  correlationId: z.string().optional(),
});

export type RequestMetadata = z.infer<typeof RequestMetadataSchema>;

/**
 * AI Provider request schema
 */
export const AIProviderRequestSchema = z.object({
  system: z.string().min(1).max(100_000), // 100KB max system prompt
  messages: z.array(MessageSchema).min(1).max(100),
  metadata: RequestMetadataSchema.optional(),
});

export type AIProviderRequest = z.infer<typeof AIProviderRequestSchema>;

/**
 * Token usage tracking
 */
export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * AI Provider response schema
 */
export const AIProviderResponseSchema = z.object({
  content: z.string(),
  usage: TokenUsageSchema.optional(),
});

export type AIProviderResponse = z.infer<typeof AIProviderResponseSchema>;

/**
 * Subagent options schema
 */
export const SubagentOptionsSchema = z.object({
  timeout: z.number().int().positive().max(600_000).optional(), // Max 10 minutes
  allowedTools: z.array(z.string()).optional(),
});

export type SubagentOptions = z.infer<typeof SubagentOptionsSchema>;

/**
 * Valid agent roles for subagent spawning
 */
export const AgentRoles = {
  ORCHESTRATOR: 'orchestrator',
  ARCHITECT: 'architect',
  BACKEND: 'backend',
  FRONTEND: 'frontend',
  UI_DESIGNER: 'ui_designer',
  REVIEWER: 'reviewer',
  TESTER: 'tester',
  DEVOPS: 'devops',
  SECURITY: 'security',
} as const;

export type AgentRole = (typeof AgentRoles)[keyof typeof AgentRoles];

/**
 * Schema for validating agent role parameter
 */
export const AgentRoleSchema = z.enum([
  'orchestrator',
  'architect',
  'backend',
  'frontend',
  'ui_designer',
  'reviewer',
  'tester',
  'devops',
  'security',
]);

/**
 * Provider names
 */
export const ProviderNames = {
  CLAUDE_CLI: 'claude-cli',
  ANTHROPIC_API: 'anthropic-api',
  MOCK: 'mock',
} as const;

export type ProviderName = (typeof ProviderNames)[keyof typeof ProviderNames];

/**
 * AI Provider interface
 *
 * Abstract interface for AI providers (Claude CLI, Anthropic API, etc.)
 */
export interface AIProvider {
  /**
   * Execute a completion request
   */
  complete(request: AIProviderRequest): Promise<AIProviderResponse>;

  /**
   * Get provider name for logging
   */
  getName(): ProviderName;

  /**
   * Spawn a subagent with role-specific context
   * Uses .claude/agents/{role}/CLAUDE.md for context isolation
   */
  spawnSubagent(
    role: string,
    task: string,
    options?: SubagentOptions
  ): Promise<AIProviderResponse>;

  /**
   * Stream a completion (for real-time output)
   * Optional - not all providers support streaming
   */
  stream?(request: AIProviderRequest): AsyncIterable<string>;
}

/**
 * Limits for security
 */
export const AI_PROVIDER_LIMITS = {
  /** Maximum system prompt size in bytes */
  MAX_SYSTEM_PROMPT_SIZE: 100_000,
  /** Maximum message content size in bytes */
  MAX_MESSAGE_SIZE: 1_000_000,
  /** Maximum messages per request */
  MAX_MESSAGES: 100,
  /** Maximum output buffer size for CLI */
  MAX_OUTPUT_BUFFER: 50_000_000, // 50MB
  /** Maximum timeout in milliseconds */
  MAX_TIMEOUT_MS: 900_000, // 15 minutes
  /** Default timeout in milliseconds */
  DEFAULT_TIMEOUT_MS: 900_000, // 15 minutes
} as const;
