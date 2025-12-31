/**
 * Mock Provider
 *
 * AI provider implementation for testing purposes.
 * Allows setting canned responses for different operations.
 */

import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  SubagentOptions,
  ProviderName,
} from '../types.js';
import { ProviderNames } from '../types.js';

/**
 * Mock response configuration
 */
export interface MockResponseConfig {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  delay?: number;
}

/**
 * Mock Provider
 *
 * Implements AIProvider interface for testing.
 * Allows setting responses for specific operations or roles.
 */
export class MockProvider implements AIProvider {
  private readonly responses: Map<string, MockResponseConfig> = new Map();
  private readonly defaultResponse: MockResponseConfig = {
    content: '{"result": "mock response"}',
    usage: { inputTokens: 10, outputTokens: 20 },
  };
  private requestLog: Array<{
    type: 'complete' | 'subagent' | 'stream';
    request?: AIProviderRequest;
    role?: string;
    task?: string;
    timestamp: Date;
  }> = [];

  getName(): ProviderName {
    return ProviderNames.MOCK;
  }

  /**
   * Set a response for a specific operation key
   *
   * Keys can be:
   * - Operation name from request.metadata.operation
   * - Agent role for subagent calls
   * - 'default' for fallback
   */
  setResponse(key: string, response: string | MockResponseConfig): void {
    const config: MockResponseConfig =
      typeof response === 'string' ? { content: response } : response;
    this.responses.set(key, config);
  }

  /**
   * Set the default response for unmatched requests
   */
  setDefaultResponse(response: string | MockResponseConfig): void {
    const config: MockResponseConfig =
      typeof response === 'string' ? { content: response } : response;
    Object.assign(this.defaultResponse, config);
  }

  /**
   * Clear all configured responses
   */
  clearResponses(): void {
    this.responses.clear();
  }

  /**
   * Clear request log
   */
  clearRequestLog(): void {
    this.requestLog = [];
  }

  /**
   * Get request log for assertions
   */
  getRequestLog(): typeof this.requestLog {
    return [...this.requestLog];
  }

  /**
   * Get last request of a specific type
   */
  getLastRequest(
    type?: 'complete' | 'subagent' | 'stream'
  ): (typeof this.requestLog)[number] | undefined {
    if (!type) {
      return this.requestLog[this.requestLog.length - 1];
    }
    return [...this.requestLog].reverse().find((r) => r.type === type);
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    // Log request
    this.requestLog.push({
      type: 'complete',
      request,
      timestamp: new Date(),
    });

    // Find matching response
    const operation = request.metadata?.operation;
    const config = this.findResponse(operation);

    // Simulate delay if configured
    if (config.delay) {
      await this.delay(config.delay);
    }

    return {
      content: config.content,
      usage: config.usage,
    };
  }

  async spawnSubagent(
    role: string,
    task: string,
    _options?: SubagentOptions
  ): Promise<AIProviderResponse> {
    // Log request
    this.requestLog.push({
      type: 'subagent',
      role,
      task,
      timestamp: new Date(),
    });

    // Find matching response by role
    const config = this.findResponse(role);

    // Simulate delay if configured
    if (config.delay) {
      await this.delay(config.delay);
    }

    return {
      content: config.content,
      usage: config.usage,
    };
  }

  async *stream(request: AIProviderRequest): AsyncIterable<string> {
    // Log request
    this.requestLog.push({
      type: 'stream',
      request,
      timestamp: new Date(),
    });

    const operation = request.metadata?.operation;
    const config = this.findResponse(operation);

    // Stream content character by character with small delays
    for (const char of config.content) {
      if (config.delay) {
        await this.delay(Math.floor(config.delay / config.content.length));
      }
      yield char;
    }
  }

  /**
   * Find response for a key, falling back to default
   */
  private findResponse(key?: string): MockResponseConfig {
    if (key && this.responses.has(key)) {
      return this.responses.get(key)!;
    }
    return this.defaultResponse;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
