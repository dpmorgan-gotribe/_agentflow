/**
 * ContextManager - Curates context for agent execution
 *
 * Provides relevant context to agents based on their requirements.
 * Handles context retrieval, filtering, and relevance scoring.
 *
 * Security features:
 * - Tenant isolation on all context queries
 * - Content validation and sanitization
 * - Token budget enforcement for context size
 */

import { z } from 'zod';
import type {
  AgentMetadata,
  ContextItem,
  ContextRequirement,
  ContextType,
  AuthContext,
} from './types.js';
import { ContextTypeSchema, ContextItemSchema } from './types.js';

/**
 * Context source interface - pluggable context providers
 */
export interface ContextSource {
  type: ContextType;
  fetch(params: ContextFetchParams): Promise<ContextItem[]>;
  isAvailable(): Promise<boolean>;
}

/**
 * Parameters for fetching context
 */
export interface ContextFetchParams {
  tenantId: string;
  projectId: string;
  query?: string;
  maxItems?: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
}

/**
 * Context fetch params schema for validation
 */
export const ContextFetchParamsSchema = z.object({
  tenantId: z.string().uuid(),
  projectId: z.string().uuid(),
  query: z.string().max(10000).optional(),
  maxItems: z.number().int().positive().max(100).optional(),
  filter: z.record(z.unknown()).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

/**
 * Context budget configuration
 */
export interface ContextBudget {
  maxTotalTokens: number;
  maxTokensPerType: Record<ContextType, number>;
  priorityOrder: ContextType[];
}

/**
 * Default context budget
 */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  maxTotalTokens: 8000,
  maxTokensPerType: {
    project_config: 500,
    design_tokens: 1000,
    user_flows: 1500,
    mockups: 1000,
    source_code: 2000,
    test_results: 500,
    git_status: 300,
    lessons_learned: 1000,
    execution_history: 500,
    current_task: 500,
    agent_outputs: 1000,
  },
  priorityOrder: [
    'current_task',
    'project_config',
    'source_code',
    'lessons_learned',
    'agent_outputs',
    'test_results',
    'design_tokens',
    'user_flows',
    'mockups',
    'git_status',
    'execution_history',
  ],
};

/**
 * Simple logger interface
 */
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: Logger = {
  debug: (msg, meta) => console.debug(`[ContextManager] ${msg}`, meta || ''),
  info: (msg, meta) => console.info(`[ContextManager] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[ContextManager] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[ContextManager] ${msg}`, meta || ''),
};

/**
 * Curated context result
 */
export interface CuratedContext {
  items: ContextItem[];
  totalTokens: number;
  truncated: boolean;
  missingRequired: ContextType[];
  sources: ContextType[];
}

/**
 * ContextManager - Manages context retrieval and curation for agents
 */
export class ContextManager {
  private sources: Map<ContextType, ContextSource> = new Map();
  private cache: Map<string, { items: ContextItem[]; expires: Date }> =
    new Map();
  private budget: ContextBudget;
  private logger: Logger;
  private cacheTtlMs: number;

  constructor(options?: {
    budget?: Partial<ContextBudget>;
    logger?: Logger;
    cacheTtlMs?: number;
  }) {
    this.budget = {
      ...DEFAULT_CONTEXT_BUDGET,
      ...options?.budget,
      maxTokensPerType: {
        ...DEFAULT_CONTEXT_BUDGET.maxTokensPerType,
        ...options?.budget?.maxTokensPerType,
      },
    };
    this.logger = options?.logger || defaultLogger;
    this.cacheTtlMs = options?.cacheTtlMs ?? 60000; // 1 minute default
  }

  /**
   * Register a context source
   */
  registerSource(source: ContextSource): void {
    if (this.sources.has(source.type)) {
      this.logger.warn(`Overwriting context source for type: ${source.type}`);
    }
    this.sources.set(source.type, source);
    this.logger.debug(`Registered context source: ${source.type}`);
  }

  /**
   * Unregister a context source
   */
  unregisterSource(type: ContextType): void {
    this.sources.delete(type);
    this.logger.debug(`Unregistered context source: ${type}`);
  }

  /**
   * Get registered source types
   */
  getRegisteredTypes(): ContextType[] {
    return Array.from(this.sources.keys());
  }

  /**
   * Curate context for an agent based on its requirements
   *
   * @param agentMetadata - Agent's metadata including context requirements
   * @param auth - Auth context for tenant isolation (SECURITY)
   * @param projectId - Project to fetch context for
   * @param taskQuery - Optional query to find relevant context
   */
  async curateContext(
    agentMetadata: AgentMetadata,
    auth: AuthContext,
    projectId: string,
    taskQuery?: string
  ): Promise<CuratedContext> {
    const startTime = Date.now();
    const items: ContextItem[] = [];
    const missingRequired: ContextType[] = [];
    const sourcesUsed: Set<ContextType> = new Set();
    let totalTokens = 0;
    let truncated = false;

    // Sort requirements by priority
    const sortedRequirements = this.sortRequirementsByPriority(
      agentMetadata.requiredContext
    );

    for (const requirement of sortedRequirements) {
      // Check if we've exceeded total budget
      if (totalTokens >= this.budget.maxTotalTokens) {
        truncated = true;
        this.logger.debug(
          `Total token budget exceeded, stopping context fetch`
        );
        break;
      }

      const typeTokenBudget =
        this.budget.maxTokensPerType[requirement.type] ?? 1000;
      const remainingBudget = Math.min(
        typeTokenBudget,
        this.budget.maxTotalTokens - totalTokens
      );

      try {
        const contextItems = await this.fetchContextForType(
          requirement,
          auth,
          projectId,
          taskQuery,
          remainingBudget
        );

        if (contextItems.length === 0 && requirement.required) {
          missingRequired.push(requirement.type);
          this.logger.warn(
            `Missing required context type: ${requirement.type}`
          );
        }

        // Add items within token budget
        for (const item of contextItems) {
          const itemTokens = this.estimateTokens(item);
          if (totalTokens + itemTokens <= this.budget.maxTotalTokens) {
            items.push(item);
            totalTokens += itemTokens;
            sourcesUsed.add(requirement.type);
          } else {
            truncated = true;
            break;
          }
        }
      } catch (error) {
        this.logger.error(`Failed to fetch context for ${requirement.type}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        if (requirement.required) {
          missingRequired.push(requirement.type);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    this.logger.info(`Curated context for ${agentMetadata.id}`, {
      itemCount: items.length,
      totalTokens,
      truncated,
      missingRequired: missingRequired.length,
      durationMs,
    });

    return {
      items,
      totalTokens,
      truncated,
      missingRequired,
      sources: Array.from(sourcesUsed),
    };
  }

  /**
   * Fetch context for a specific type
   */
  private async fetchContextForType(
    requirement: ContextRequirement,
    auth: AuthContext,
    projectId: string,
    query?: string,
    tokenBudget?: number
  ): Promise<ContextItem[]> {
    const source = this.sources.get(requirement.type);

    if (!source) {
      this.logger.debug(`No source registered for type: ${requirement.type}`);
      return [];
    }

    // Check cache first
    const cacheKey = this.buildCacheKey(
      auth.tenantId,
      projectId,
      requirement.type,
      query
    );
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return this.applyLimits(cached, requirement, tokenBudget);
    }

    // Check source availability
    const isAvailable = await source.isAvailable();
    if (!isAvailable) {
      this.logger.warn(`Context source not available: ${requirement.type}`);
      return [];
    }

    // Fetch from source with tenant isolation
    const fetchParams: ContextFetchParams = {
      tenantId: auth.tenantId,
      projectId,
      query,
      maxItems: requirement.maxItems ?? 10,
      filter: requirement.filter,
      scoreThreshold: 0.5,
    };

    // Validate fetch params (SECURITY)
    const validatedParams = ContextFetchParamsSchema.parse(fetchParams);
    const items = await source.fetch(validatedParams);

    // Validate fetched items
    const validatedItems = items
      .map((item) => {
        try {
          return ContextItemSchema.parse(item);
        } catch {
          this.logger.warn(`Invalid context item from ${requirement.type}`);
          return null;
        }
      })
      .filter((item): item is ContextItem => item !== null);

    // Cache results
    this.setCache(cacheKey, validatedItems);

    return this.applyLimits(validatedItems, requirement, tokenBudget);
  }

  /**
   * Apply limits to context items
   */
  private applyLimits(
    items: ContextItem[],
    requirement: ContextRequirement,
    tokenBudget?: number
  ): ContextItem[] {
    let result = items;

    // Apply maxItems limit
    if (requirement.maxItems && result.length > requirement.maxItems) {
      result = result.slice(0, requirement.maxItems);
    }

    // Apply token budget
    if (tokenBudget) {
      let totalTokens = 0;
      const budgetedItems: ContextItem[] = [];

      for (const item of result) {
        const itemTokens = this.estimateTokens(item);
        if (totalTokens + itemTokens <= tokenBudget) {
          budgetedItems.push(item);
          totalTokens += itemTokens;
        } else {
          break;
        }
      }

      result = budgetedItems;
    }

    return result;
  }

  /**
   * Sort requirements by priority order
   */
  private sortRequirementsByPriority(
    requirements: ContextRequirement[]
  ): ContextRequirement[] {
    return [...requirements].sort((a, b) => {
      const aIndex = this.budget.priorityOrder.indexOf(a.type);
      const bIndex = this.budget.priorityOrder.indexOf(b.type);

      // Required items come first
      if (a.required !== b.required) {
        return a.required ? -1 : 1;
      }

      // Then by priority order
      return (
        (aIndex === -1 ? Infinity : aIndex) -
        (bIndex === -1 ? Infinity : bIndex)
      );
    });
  }

  /**
   * Estimate tokens for a context item (rough approximation)
   */
  private estimateTokens(item: ContextItem): number {
    const content = JSON.stringify(item.content);
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Build cache key
   */
  private buildCacheKey(
    tenantId: string,
    projectId: string,
    type: ContextType,
    query?: string
  ): string {
    const parts = [tenantId, projectId, type];
    if (query) {
      // Use first 50 chars of query for cache key
      parts.push(query.substring(0, 50));
    }
    return parts.join(':');
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): ContextItem[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expires < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return entry.items;
  }

  /**
   * Set cache entry
   */
  private setCache(key: string, items: ContextItem[]): void {
    const expires = new Date(Date.now() + this.cacheTtlMs);
    this.cache.set(key, { items, expires });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = new Date();
    let cleared = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expires < now) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.debug(`Cleared ${cleared} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; types: ContextType[] } {
    const types = new Set<ContextType>();

    for (const key of this.cache.keys()) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        const type = parts[2] as ContextType;
        if (ContextTypeSchema.safeParse(type).success) {
          types.add(type);
        }
      }
    }

    return {
      size: this.cache.size,
      types: Array.from(types),
    };
  }

  /**
   * Update budget configuration
   */
  updateBudget(budget: Partial<ContextBudget>): void {
    this.budget = {
      ...this.budget,
      ...budget,
      maxTokensPerType: {
        ...this.budget.maxTokensPerType,
        ...budget.maxTokensPerType,
      },
    };
    this.logger.debug('Budget updated', { maxTotalTokens: this.budget.maxTotalTokens });
  }

  /**
   * Get current budget configuration
   */
  getBudget(): ContextBudget {
    return { ...this.budget };
  }
}

/**
 * Create a simple in-memory context source for testing
 */
export function createMemoryContextSource(
  type: ContextType,
  items: ContextItem[]
): ContextSource {
  return {
    type,
    async fetch(params: ContextFetchParams): Promise<ContextItem[]> {
      // Filter by relevance if query provided
      let filtered = items.filter((item) => item.type === type);

      // Apply filter if provided
      if (params.filter) {
        filtered = filtered.filter((item) => {
          for (const [key, value] of Object.entries(params.filter!)) {
            if ((item.metadata as Record<string, unknown>)[key] !== value) {
              return false;
            }
          }
          return true;
        });
      }

      // Apply maxItems limit
      if (params.maxItems) {
        filtered = filtered.slice(0, params.maxItems);
      }

      return filtered;
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
  };
}
