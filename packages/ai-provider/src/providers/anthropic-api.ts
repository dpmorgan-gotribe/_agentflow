/**
 * Anthropic API Provider
 *
 * AI provider implementation using the Anthropic SDK.
 * For production use (per-token billing).
 *
 * Security features:
 * - API key validation
 * - Path traversal prevention for role context loading
 * - Input validation
 * - Error sanitization
 */

import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  SubagentOptions,
  ProviderName,
} from '../types.js';
import {
  ProviderNames,
  AgentRoleSchema,
  AIProviderRequestSchema,
  SubagentOptionsSchema,
} from '../types.js';
import {
  APIError,
  APIAuthenticationError,
  APIRateLimitError,
  AIProviderValidationError,
  InvalidRoleError,
  PathTraversalError,
} from '../errors.js';

/**
 * Anthropic API configuration
 */
export interface AnthropicApiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  /** Enable prompt caching for system prompts (reduces costs by ~40%) */
  enablePromptCaching?: boolean;
}

/**
 * Base directory for agent CLAUDE.md files
 */
const AGENTS_BASE_DIR = '.claude/agents';

/**
 * Valid agent roles for path validation
 */
const VALID_ROLES = [
  'orchestrator',
  'architect',
  'backend',
  'frontend',
  'ui_designer',
  'reviewer',
  'tester',
  'devops',
  'security',
] as const;

/**
 * Anthropic API Provider
 *
 * Implements AIProvider interface using the Anthropic SDK.
 */
export class AnthropicApiProvider implements AIProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly enablePromptCaching: boolean;

  constructor(config: AnthropicApiConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
    this.enablePromptCaching = config.enablePromptCaching ?? true; // Enable by default
  }

  getName(): ProviderName {
    return ProviderNames.ANTHROPIC_API;
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    // Validate request
    const validationResult = AIProviderRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new AIProviderValidationError(
        'Invalid request',
        'request',
        validationResult.error.format()
      );
    }

    try {
      // Build system message with optional caching
      // Caching reduces costs by ~40% for repeated system prompts
      const system = this.buildSystemMessage(request.system);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system,
        messages: request.messages,
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const content = textBlock?.type === 'text' ? textBlock.text : '';

      // Extract cache metrics if available (these fields are added by Anthropic when caching is enabled)
      const usageRecord = response.usage as unknown as Record<string, number>;
      const cacheCreationInputTokens = usageRecord['cache_creation_input_tokens'] ?? 0;
      const cacheReadInputTokens = usageRecord['cache_read_input_tokens'] ?? 0;

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheCreationInputTokens,
          cacheReadInputTokens,
        },
      };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Build system message with optional caching
   *
   * When caching is enabled, marks the system prompt as ephemeral
   * so it can be cached for 5 minutes and reused across requests.
   */
  private buildSystemMessage(
    systemContent?: string
  ): string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> | undefined {
    if (!systemContent) {
      return undefined;
    }

    if (!this.enablePromptCaching) {
      return systemContent;
    }

    // Use structured format with cache_control for caching
    return [
      {
        type: 'text' as const,
        text: systemContent,
        cache_control: { type: 'ephemeral' as const },
      },
    ];
  }

  /**
   * Spawn a subagent with role-specific context
   *
   * For API mode, subagents are separate API calls with role context injected
   */
  async spawnSubagent(
    role: string,
    task: string,
    options?: SubagentOptions
  ): Promise<AIProviderResponse> {
    // Validate role to prevent path traversal
    const roleValidation = AgentRoleSchema.safeParse(role);
    if (!roleValidation.success) {
      throw new InvalidRoleError(role, [...VALID_ROLES]);
    }

    // Validate options
    if (options) {
      const optionsValidation = SubagentOptionsSchema.safeParse(options);
      if (!optionsValidation.success) {
        throw new AIProviderValidationError(
          'Invalid subagent options',
          'options',
          optionsValidation.error.format()
        );
      }
    }

    // Load role-specific context
    const roleContext = await this.loadRoleContext(role);

    return this.complete({
      system: roleContext,
      messages: [{ role: 'user', content: task }],
      metadata: { agent: role, operation: 'subagent' },
    });
  }

  /**
   * Stream completion output
   */
  async *stream(request: AIProviderRequest): AsyncIterable<string> {
    // Validate request
    const validationResult = AIProviderRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new AIProviderValidationError(
        'Invalid request',
        'request',
        validationResult.error.format()
      );
    }

    try {
      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: request.system,
        messages: request.messages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Load role-specific context from .claude/agents/{role}/CLAUDE.md
   */
  private async loadRoleContext(role: string): Promise<string> {
    // Build safe path
    const contextPath = this.buildSafeAgentPath(role);

    try {
      return await fs.readFile(contextPath, 'utf-8');
    } catch {
      // Fall back to generic context if role-specific not found
      return `You are a ${role} agent. Complete the assigned task following best practices.`;
    }
  }

  /**
   * Build safe path to agent CLAUDE.md file
   *
   * Prevents path traversal attacks.
   */
  private buildSafeAgentPath(role: string): string {
    // Role is already validated by AgentRoleSchema
    // Additional safety: only allow alphanumeric and underscore
    if (!/^[a-z_]+$/.test(role)) {
      throw new PathTraversalError(role, 'Invalid role format');
    }

    const agentPath = path.join(AGENTS_BASE_DIR, role, 'CLAUDE.md');

    // Resolve to absolute path and verify it's within agents dir
    const resolved = path.resolve(agentPath);
    const baseResolved = path.resolve(AGENTS_BASE_DIR);

    if (!resolved.startsWith(baseResolved + path.sep)) {
      throw new PathTraversalError(agentPath, 'Path outside agents directory');
    }

    return agentPath;
  }

  /**
   * Handle API errors and convert to typed errors
   */
  private handleApiError(error: unknown): never {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new APIAuthenticationError();
    }

    if (error instanceof Anthropic.RateLimitError) {
      throw new APIRateLimitError();
    }

    if (error instanceof Anthropic.APIError) {
      // Sanitize error message to prevent API key leakage
      const message = this.sanitizeErrorMessage(error.message);
      throw new APIError(message, error.status);
    }

    // Unknown error
    const message =
      error instanceof Error ? error.message : 'Unknown API error';
    throw new APIError(this.sanitizeErrorMessage(message));
  }

  /**
   * Sanitize error messages to prevent sensitive info leakage
   */
  private sanitizeErrorMessage(message: string): string {
    return message
      .replace(/sk-ant-[a-zA-Z0-9]+/g, '[REDACTED_API_KEY]')
      .replace(/api[_-]?key[=:]\s*[^\s]+/gi, '[REDACTED]')
      .replace(/authorization[=:]\s*[^\s]+/gi, '[REDACTED]')
      .replace(/bearer\s+[^\s]+/gi, '[REDACTED]');
  }
}
