# Step 04f: AI Provider Abstraction (MVP)

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 04d-AUDIT-LOGGING.md
> **Next Checkpoint:** CP1 - Design System
> **Added:** 2025-12-30 (Post-implementation documentation)

---

## Overview

The AI Provider abstraction enables the system to switch between different AI backends without changing application code. For MVP, two providers are implemented:

1. **Claude CLI** - Spawns the `claude` CLI process for AI operations
2. **Anthropic API** - Direct API calls using the Anthropic SDK

This abstraction was implemented during MVP but was planned for CP7 (Platform Infrastructure). This document captures the actual MVP implementation.

---

## File Structure

```
src/ai/
├── config.ts           # Provider selection logic
├── types.ts            # AIProvider interface
├── index.ts            # getAIProvider() factory
└── providers/
    ├── anthropic-api.ts   # Direct Anthropic API
    ├── claude-cli.ts      # Claude CLI wrapper
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

export interface AIProvider {
  complete(request: AIProviderRequest): Promise<AIProviderResponse>;
  getName(): string;
}
```

---

## Provider Selection

```typescript
// src/ai/config.ts

import { config } from 'dotenv';

config(); // Load .env

export function getProviderConfig() {
  return {
    useCli: process.env.USE_CLAUDE_CLI === 'true',
    model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '8192'),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    cliTimeout: parseInt(process.env.CLAUDE_CLI_TIMEOUT || '300000'),
  };
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

export function getAIProvider(): AIProvider {
  const config = getProviderConfig();

  // Development mode uses mock
  if (process.env.NODE_ENV === 'test') {
    return new MockProvider();
  }

  // Select based on configuration
  if (config.useCli) {
    return new ClaudeCliProvider(config);
  } else {
    return new AnthropicApiProvider(config);
  }
}
```

---

## Claude CLI Provider

```typescript
// src/ai/providers/claude-cli.ts

import { spawn } from 'child_process';
import { AIProvider, AIProviderRequest, AIProviderResponse } from '../types';

export class ClaudeCliProvider implements AIProvider {
  private timeout: number;

  constructor(config: { cliTimeout: number }) {
    this.timeout = config.cliTimeout;
  }

  getName(): string {
    return 'claude-cli';
  }

  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    // Build prompt from messages
    const prompt = this.buildPrompt(request);

    return new Promise((resolve, reject) => {
      const claude = spawn('claude', [
        '-p', prompt,
        '--no-markdown',
      ]);

      let output = '';
      let error = '';

      const timeout = setTimeout(() => {
        claude.kill();
        reject(new Error(`Claude CLI timeout after ${this.timeout}ms`));
      }, this.timeout);

      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.stderr.on('data', (data) => {
        error += data.toString();
      });

      claude.on('close', (code) => {
        clearTimeout(timeout);
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
import { AIProvider, AIProviderRequest, AIProviderResponse } from '../types';

export class AnthropicApiProvider implements AIProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: {
    model: string;
    maxTokens: number;
    temperature: number;
  }) {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
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

# Provider Selection
USE_CLAUDE_CLI=true              # true = CLI, false = API

# Anthropic API (required if USE_CLAUDE_CLI=false)
ANTHROPIC_API_KEY=sk-ant-...

# Model Configuration
AI_MODEL=claude-sonnet-4-20250514
AI_MAX_TOKENS=8192
AI_TEMPERATURE=0.7

# Claude CLI Configuration
CLAUDE_CLI_TIMEOUT=300000        # 5 minutes
```

---

## Usage in Code

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
[x] Claude CLI provider implemented
[x] Anthropic API provider implemented
[x] Mock provider for testing
[x] Provider factory selects based on config
[x] Environment variables documented
[x] Timeout handling works
[x] Error handling for failed CLI/API calls
```
