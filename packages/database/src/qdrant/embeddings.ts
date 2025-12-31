/**
 * Embedding Providers
 *
 * Abstract embedding generation with support for multiple providers.
 */

import { z } from 'zod';
import { EMBEDDING_DIMENSIONS } from './collections.js';

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts (batch)
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Embedding dimension
   */
  readonly dimension: number;

  /**
   * Provider name
   */
  readonly provider: string;
}

/**
 * OpenAI embedding response schema
 */
const OpenAIEmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number(),
    })
  ),
  usage: z.object({
    prompt_tokens: z.number(),
    total_tokens: z.number(),
  }),
});

/**
 * OpenAI Embeddings Provider
 */
export class OpenAIEmbeddings implements EmbeddingProvider {
  readonly provider = 'openai';
  readonly dimension: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    model: string = 'text-embedding-3-small',
    baseUrl: string = 'https://api.openai.com/v1'
  ) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.dimension =
      model === 'text-embedding-3-large'
        ? EMBEDDING_DIMENSIONS.OPENAI_LARGE
        : EMBEDDING_DIMENSIONS.OPENAI_SMALL;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    const embedding = results[0];
    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Sanitize input texts
    const sanitizedTexts = texts.map((t) => this.sanitizeText(t));

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: sanitizedTexts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI embedding failed: ${response.status} ${response.statusText} - ${this.sanitizeErrorMessage(errorText)}`
      );
    }

    const data = await response.json();
    const validated = OpenAIEmbeddingResponseSchema.parse(data);

    // Sort by index to ensure correct order
    return validated.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  private sanitizeText(text: string): string {
    // Remove null bytes and control characters
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove any potential API key leakage from error messages
    return message.replace(/sk-[a-zA-Z0-9]+/g, '[REDACTED]');
  }
}

/**
 * Voyage AI embedding response schema
 */
const VoyageEmbeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
      index: z.number(),
    })
  ),
  usage: z.object({
    total_tokens: z.number(),
  }),
});

/**
 * Voyage AI Embeddings Provider (optimized for code)
 */
export class VoyageEmbeddings implements EmbeddingProvider {
  readonly provider = 'voyage';
  readonly dimension = EMBEDDING_DIMENSIONS.VOYAGE_CODE;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(
    apiKey: string,
    model: string = 'voyage-code-2',
    baseUrl: string = 'https://api.voyageai.com/v1'
  ) {
    if (!apiKey) {
      throw new Error('Voyage AI API key is required');
    }

    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    const embedding = results[0];
    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Sanitize input texts
    const sanitizedTexts = texts.map((t) => this.sanitizeText(t));

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: sanitizedTexts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Voyage embedding failed: ${response.status} ${response.statusText} - ${this.sanitizeErrorMessage(errorText)}`
      );
    }

    const data = await response.json();
    const validated = VoyageEmbeddingResponseSchema.parse(data);

    // Sort by index to ensure correct order
    return validated.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  private sanitizeText(text: string): string {
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  private sanitizeErrorMessage(message: string): string {
    // Remove any potential API key leakage
    return message.replace(/pa-[a-zA-Z0-9]+/g, '[REDACTED]');
  }
}

/**
 * Mock Embeddings Provider (for testing)
 */
export class MockEmbeddings implements EmbeddingProvider {
  readonly provider = 'mock';
  readonly dimension: number;

  constructor(dimension: number = EMBEDDING_DIMENSIONS.OPENAI_SMALL) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    // Generate deterministic mock embedding based on text hash
    return this.generateMockEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateMockEmbedding(t));
  }

  private generateMockEmbedding(text: string): number[] {
    // Simple hash-based deterministic embedding for testing
    const hash = this.hashString(text);
    const embedding: number[] = [];

    for (let i = 0; i < this.dimension; i++) {
      // Generate pseudo-random value based on hash and index
      const value = Math.sin(hash * (i + 1)) * 0.5;
      embedding.push(value);
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, v) => sum + v * v, 0)
    );
    return embedding.map((v) => v / magnitude);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }
}

/**
 * Embedding provider types
 */
export type EmbeddingProviderType = 'openai' | 'voyage' | 'mock';

/**
 * Embedding provider configuration
 */
export interface EmbeddingProviderConfig {
  provider: EmbeddingProviderType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  dimension?: number;
}

/**
 * Create an embedding provider from configuration
 */
export function createEmbeddingProvider(
  config: EmbeddingProviderConfig
): EmbeddingProvider {
  switch (config.provider) {
    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      return new OpenAIEmbeddings(
        config.apiKey,
        config.model,
        config.baseUrl
      );

    case 'voyage':
      if (!config.apiKey) {
        throw new Error('Voyage API key is required');
      }
      return new VoyageEmbeddings(
        config.apiKey,
        config.model,
        config.baseUrl
      );

    case 'mock':
      return new MockEmbeddings(config.dimension);

    default:
      throw new Error(`Unknown embedding provider: ${config.provider}`);
  }
}
