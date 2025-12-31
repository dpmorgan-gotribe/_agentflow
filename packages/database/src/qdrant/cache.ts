/**
 * Context Cache
 *
 * In-memory cache for context retrieval results and embeddings.
 * Implements TTL expiration and LRU-style eviction.
 *
 * Security:
 * - Bounded cache size to prevent memory exhaustion
 * - No sensitive data logging
 * - TTL prevents stale data
 */

import { z } from 'zod';
import type { RetrievedContext } from './context-manager.js';

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
}

/**
 * Cache configuration schema
 */
export const CacheConfigSchema = z.object({
  maxContextEntries: z.number().int().min(10).max(10000).default(1000),
  maxEmbeddingEntries: z.number().int().min(100).max(100000).default(5000),
  defaultContextTtlSeconds: z.number().int().min(60).max(3600).default(300),
  defaultEmbeddingTtlSeconds: z.number().int().min(300).max(86400).default(3600),
  cleanupIntervalMs: z.number().int().min(1000).max(300000).default(60000),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

/**
 * Cache statistics
 */
export interface CacheStats {
  contextHits: number;
  contextMisses: number;
  embeddingHits: number;
  embeddingMisses: number;
  contextEntries: number;
  embeddingEntries: number;
  hitRate: number;
}

/**
 * Context cache for RAG retrieval
 */
export class ContextCache {
  private readonly config: Required<CacheConfig>;
  private readonly contextCache: Map<string, CacheEntry<RetrievedContext>>;
  private readonly embeddingCache: Map<string, CacheEntry<number[]>>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // Statistics
  private contextHits = 0;
  private contextMisses = 0;
  private embeddingHits = 0;
  private embeddingMisses = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = CacheConfigSchema.parse(config) as Required<CacheConfig>;
    this.contextCache = new Map();
    this.embeddingCache = new Map();
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // Prevent timer from keeping process alive
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get cached context
   */
  async get(key: string): Promise<RetrievedContext | null> {
    const entry = this.contextCache.get(key);

    if (!entry) {
      this.contextMisses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.contextCache.delete(key);
      this.contextMisses++;
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    this.contextHits++;

    return entry.value;
  }

  /**
   * Set cached context
   */
  async set(
    key: string,
    value: RetrievedContext,
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.config.defaultContextTtlSeconds;

    // Evict if at capacity
    if (this.contextCache.size >= this.config.maxContextEntries) {
      this.evictLRU(this.contextCache);
    }

    const now = Date.now();
    this.contextCache.set(key, {
      value,
      expiresAt: now + ttl * 1000,
      accessedAt: now,
    });
  }

  /**
   * Get cached embedding
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    const key = this.hashText(text);
    const entry = this.embeddingCache.get(key);

    if (!entry) {
      this.embeddingMisses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.embeddingCache.delete(key);
      this.embeddingMisses++;
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();
    this.embeddingHits++;

    return entry.value;
  }

  /**
   * Set cached embedding
   */
  async setEmbedding(
    text: string,
    embedding: number[],
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds ?? this.config.defaultEmbeddingTtlSeconds;
    const key = this.hashText(text);

    // Evict if at capacity
    if (this.embeddingCache.size >= this.config.maxEmbeddingEntries) {
      this.evictLRU(this.embeddingCache);
    }

    const now = Date.now();
    this.embeddingCache.set(key, {
      value: embedding,
      expiresAt: now + ttl * 1000,
      accessedAt: now,
    });
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string): number {
    let count = 0;

    for (const key of this.contextCache.keys()) {
      if (key.includes(pattern)) {
        this.contextCache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Invalidate all cache entries for a tenant
   */
  invalidateTenant(tenantId: string): number {
    return this.invalidate(`${tenantId}:`);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.contextCache.clear();
    this.embeddingCache.clear();
    this.contextHits = 0;
    this.contextMisses = 0;
    this.embeddingHits = 0;
    this.embeddingMisses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests =
      this.contextHits +
      this.contextMisses +
      this.embeddingHits +
      this.embeddingMisses;
    const totalHits = this.contextHits + this.embeddingHits;

    return {
      contextHits: this.contextHits,
      contextMisses: this.contextMisses,
      embeddingHits: this.embeddingHits,
      embeddingMisses: this.embeddingMisses,
      contextEntries: this.contextCache.size,
      embeddingEntries: this.embeddingCache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }

  /**
   * Build cache key for context request
   */
  buildContextKey(
    tenantId: string,
    query: string,
    agentType?: string,
    options?: Record<string, unknown>
  ): string {
    const queryHash = this.hashText(query.substring(0, 100));
    const optionsHash = options
      ? this.hashText(JSON.stringify(options))
      : 'default';

    return `context:${tenantId}:${queryHash}:${agentType || 'any'}:${optionsHash}`;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.contextCache.entries()) {
      if (now > entry.expiresAt) {
        this.contextCache.delete(key);
      }
    }

    for (const [key, entry] of this.embeddingCache.entries()) {
      if (now > entry.expiresAt) {
        this.embeddingCache.delete(key);
      }
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU<T>(cache: Map<string, CacheEntry<T>>): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  /**
   * Hash text for cache key
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `emb:${Math.abs(hash).toString(36)}`;
  }
}

/**
 * Create context cache
 */
export function createContextCache(config?: Partial<CacheConfig>): ContextCache {
  return new ContextCache(config);
}
