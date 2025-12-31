# Step 04f: AI Provider Abstraction (MVP)

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04e-COMPONENT-INTEGRATION.md
> **Next Step:** 05-CLI-FOUNDATION.md

---

## Overview

The AI Provider abstraction enables the system to switch between different AI backends without changing application code. For MVP, two providers are implemented:

1. **Claude CLI** - Spawns the `claude` CLI process for AI operations (DEFAULT)
2. **Anthropic API** - Direct API calls using the Anthropic SDK (for production)

### CLI-First Development Approach

> **Key Decision:** Use Claude CLI (subscription-based) for all development work instead of
> Anthropic API (per-token). This is significantly more cost-effective for iterative development.

| Mode | Configuration | Use Case |
|------|---------------|----------|
| **CLI Mode** | `CLAUDE_CLI=true` | Development, building, iteration |
| **API Mode** | `CLAUDE_CLI=false` | Production, programmatic access |

This abstraction was implemented during MVP but was planned for CP7 (Platform Infrastructure). This document captures the actual MVP implementation with CLI-first enhancements.

---

## File Structure

```
src/ai/
├── config.ts           # Provider selection logic (CLAUDE_CLI toggle)
├── types.ts            # AIProvider interface with subagent support
├── index.ts            # getAIProvider() factory
└── providers/
    ├── anthropic-api.ts   # Direct Anthropic API (production)
    ├── claude-cli.ts      # Claude CLI wrapper (development - DEFAULT)
    └── mock.ts            # Mock for testing
```

---

## Provider Interface

```typescript
// src/ai/types.ts

export interface AIProviderRequest {
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  metadata?: {
    agent?: string;
    operation?: string;
  };
}

export interface AIProviderResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Options for subagent execution
 */
export interface SubagentOptions {
  timeout?: number;
  allowedTools?: string[];
}

export interface AIProvider {
  /**
   * Execute a completion request
   */
  complete(request: AIProviderRequest): Promise<AIProviderResponse>;

  /**
   * Get provider name for logging
   */
  getName(): string;

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
   */
  stream?(request: AIProviderRequest): AsyncIterable<string>;
}
```

---

## Provider Selection

```typescript
// src/ai/config.ts

import { z } from 'zod';
import { config } from 'dotenv';

config(); // Load .env

/**
 * AI Provider configuration schema with validation
 */
export const aiProviderConfigSchema = z.object({
  // Mode selection - CLI is DEFAULT for development
  CLAUDE_CLI: z.coerce.boolean().default(true),

  // CLI mode settings
  CLAUDE_CLI_PATH: z.string().default('claude'),
  CLAUDE_CLI_TIMEOUT_MS: z.coerce.number().default(300000),

  // API mode settings (only needed when CLAUDE_CLI=false)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().default(8192),
  ANTHROPIC_TEMPERATURE: z.coerce.number().default(0.7),
});

export type AIProviderConfig = z.infer<typeof aiProviderConfigSchema>;

/**
 * Get validated provider configuration
 */
export function getProviderConfig(): AIProviderConfig {
  return aiProviderConfigSchema.parse(process.env);
}
```

---

## Provider Factory

```typescript
// src/ai/index.ts

import { AIProvider } from './types';
import { getProviderConfig } from './config';
import { ClaudeCliProvider } from './providers/claude-cli';
import { AnthropicApiProvider } from './providers/anthropic-api';
import { MockProvider } from './providers/mock';

/**
 * Create an AI provider based on configuration
 *
 * Default: Claude CLI (CLAUDE_CLI=true)
 * Production: Anthropic API (CLAUDE_CLI=false)
 */
export function getAIProvider(): AIProvider {
  const config = getProviderConfig();

  // Test mode uses mock
  if (process.env.NODE_ENV === 'test') {
    return new MockProvider();
  }

  // CLI mode is DEFAULT for development (cost-effective)
  if (config.CLAUDE_CLI) {
    return new ClaudeCliProvider({
      cliPath: config.CLAUDE_CLI_PATH,
      timeoutMs: config.CLAUDE_CLI_TIMEOUT_MS,
    });
  }

  // API mode for production
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required when CLAUDE_CLI=false');
  }

  return new AnthropicApiProvider({
    apiKey: config.ANTHROPIC_API_KEY,
    model: config.ANTHROPIC_MODEL,
    maxTokens: config.ANTHROPIC_MAX_TOKENS,
    temperature: config.ANTHROPIC_TEMPERATURE,
  });
}

// Re-export types
export * from './types';
export { getProviderConfig } from './config';
```

---

## Claude CLI Provider

```typescript
// src/ai/providers/claude-cli.ts

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  SubagentOptions,
} from '../types';

interface ClaudeCliConfig {
  cliPath: string;
  timeoutMs: number;
}

export class ClaudeCliProvider implements AIProvider {
  private cliPath: string;
  private timeoutMs: number;

  constructor(config: ClaudeCliConfig) {
    this.cliPath = config.cliPath;
    this.timeoutMs = config.timeoutMs;
  }

  getName(): string {
    return 'claude-cli';
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    const prompt = this.buildPrompt(request);
    return this.executeCliCommand(['-p', prompt, '--no-markdown']);
  }

  /**
   * Spawn a subagent with role-specific context
   *
   * Uses .claude/agents/{role}/CLAUDE.md for context isolation
   */
  async spawnSubagent(
    role: string,
    task: string,
    options?: SubagentOptions
  ): Promise<AIProviderResponse> {
    const args = ['-p', task, '--no-markdown'];

    if (options?.allowedTools?.length) {
      args.push('--allowedTools', options.allowedTools.join(','));
    }

    // Use role-specific CLAUDE.md for context isolation
    const env = {
      ...process.env,
      CLAUDE_MD_PATH: `.claude/agents/${role}/CLAUDE.md`,
    };

    return this.executeCliCommand(args, {
      env,
      timeout: options?.timeout ?? this.timeoutMs,
    });
  }

  /**
   * Stream completion output (for real-time display)
   */
  async *stream(request: AIProviderRequest): AsyncIterable<string> {
    const prompt = this.buildPrompt(request);

    const claude = spawn(this.cliPath, ['-p', prompt, '--no-markdown'], {
      env: process.env,
    });

    for await (const chunk of claude.stdout) {
      yield chunk.toString();
    }
  }

  private async executeCliCommand(
    args: string[],
    options?: { env?: NodeJS.ProcessEnv; timeout?: number }
  ): Promise<AIProviderResponse> {
    const timeout = options?.timeout ?? this.timeoutMs;
    const env = options?.env ?? process.env;

    return new Promise((resolve, reject) => {
      const claude = spawn(this.cliPath, args, { env });

      let output = '';
      let error = '';

      const timer = setTimeout(() => {
        claude.kill();
        reject(new Error(`Claude CLI timeout after ${timeout}ms`));
      }, timeout);

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        error += data.toString();
      });

      claude.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${error}`));
        } else {
          resolve({ content: output.trim() });
        }
      });
    });
  }

  private buildPrompt(request: AIProviderRequest): string {
    let prompt = '';
    if (request.system) {
      prompt += `<system>\n${request.system}\n</system>\n\n`;
    }
    for (const msg of request.messages) {
      prompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n\n`;
    }
    return prompt;
  }
}
```

---

## Anthropic API Provider

```typescript
// src/ai/providers/anthropic-api.ts

import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  SubagentOptions,
} from '../types';

interface AnthropicApiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export class AnthropicApiProvider implements AIProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: AnthropicApiConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
  }

  getName(): string {
    return 'anthropic-api';
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: request.system,
      messages: request.messages,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const content = textBlock?.type === 'text' ? textBlock.text : '';

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
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
  }

  /**
   * Load role-specific context from .claude/agents/{role}/CLAUDE.md
   */
  private async loadRoleContext(role: string): Promise<string> {
    try {
      const contextPath = `.claude/agents/${role}/CLAUDE.md`;
      return await fs.readFile(contextPath, 'utf-8');
    } catch (error) {
      // Fall back to generic context if role-specific not found
      return `You are a ${role} agent. Complete the assigned task.`;
    }
  }
}
```

---

## Mock Provider (Testing)

```typescript
// src/ai/providers/mock.ts

import { AIProvider, AIProviderRequest, AIProviderResponse } from '../types';

export class MockProvider implements AIProvider {
  private responses: Map<string, string> = new Map();

  getName(): string {
    return 'mock';
  }

  setResponse(key: string, response: string): void {
    this.responses.set(key, response);
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    const operation = request.metadata?.operation || 'default';
    const mockResponse = this.responses.get(operation) ||
      '{"result": "mock response"}';

    return { content: mockResponse };
  }
}
```

---

## Environment Configuration

```env
# .env file

# =============================================================================
# AI Provider Mode
# =============================================================================
# CLAUDE_CLI=true  → Use Claude CLI (subscription-based, for development)
# CLAUDE_CLI=false → Use Anthropic API (per-token, for production)
CLAUDE_CLI=true

# =============================================================================
# CLI Mode Settings (used when CLAUDE_CLI=true)
# =============================================================================
CLAUDE_CLI_PATH=claude
CLAUDE_CLI_TIMEOUT_MS=300000     # 5 minutes

# =============================================================================
# API Mode Settings (used when CLAUDE_CLI=false)
# =============================================================================
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ANTHROPIC_MAX_TOKENS=8192
ANTHROPIC_TEMPERATURE=0.7
```

---

## Usage in Code

### Basic Completion

```typescript
import { getAIProvider } from './ai';

async function generateDesign(prompt: string): Promise<string> {
  const provider = getAIProvider();

  const response = await provider.complete({
    system: 'You are a UI designer...',
    messages: [
      { role: 'user', content: prompt }
    ],
    metadata: {
      agent: 'ui-designer',
      operation: 'generate-design'
    }
  });

  return response.content;
}
```

### Parallel Subagent Spawning

```typescript
import { getAIProvider } from './ai';

async function analyzeTask(task: string): Promise<{
  architecture: string;
  backend: string;
  security: string;
}> {
  const provider = getAIProvider();

  // Spawn parallel subagents for multi-perspective analysis
  const [architectResult, backendResult, securityResult] = await Promise.all([
    provider.spawnSubagent('architect', `Analyze architecture for: ${task}`),
    provider.spawnSubagent('backend', `Review backend patterns for: ${task}`),
    provider.spawnSubagent('security', `Check security implications for: ${task}`),
  ]);

  return {
    architecture: architectResult.content,
    backend: backendResult.content,
    security: securityResult.content,
  };
}
```

### Streaming Output

```typescript
import { getAIProvider } from './ai';

async function streamResponse(prompt: string): Promise<void> {
  const provider = getAIProvider();

  if (!provider.stream) {
    throw new Error('Streaming not supported by this provider');
  }

  for await (const chunk of provider.stream({
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: prompt }],
  })) {
    process.stdout.write(chunk);
  }
}
```

---

## Relationship to CP7 Plan

The full Model Abstraction Layer is planned for CP7 (`29-MODEL-ABSTRACTION.md`), which will add:
- Multi-provider support (OpenAI, local models)
- Model routing based on task complexity
- Cost tracking per request
- Rate limiting per provider
- Fallback routing on failure

This MVP implementation provides the foundation for that expansion.

---

## Validation Checklist

```
[x] AIProvider interface defined
    [x] complete() method
    [x] spawnSubagent() method for parallel execution
    [x] stream() method for real-time output
[x] Claude CLI provider implemented (DEFAULT for development)
    [x] Spawns claude process
    [x] Supports role-specific CLAUDE.md via CLAUDE_MD_PATH
    [x] Streaming support
[x] Anthropic API provider implemented (for production)
    [x] Direct SDK integration
    [x] Subagent spawning with role context injection
    [x] Streaming support
[x] Mock provider for testing
[x] Provider factory selects based on CLAUDE_CLI config
[x] Environment variables documented (CLAUDE_CLI toggle)
[x] Timeout handling works
[x] Error handling for failed CLI/API calls
[x] Zod validation for configuration
```
