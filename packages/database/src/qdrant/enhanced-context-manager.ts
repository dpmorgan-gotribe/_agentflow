/**
 * Enhanced Context Manager
 *
 * Advanced context retrieval with caching, ranking, history, and agent-specific configuration.
 * Extends the base ContextManager with additional capabilities.
 *
 * Security:
 * - Tenant isolation via repositories
 * - Input validation with Zod
 * - Bounded token budgets
 * - Cache size limits
 */

import { z } from 'zod';
import {
  LessonVectorRepository,
  LessonVectorMetadata,
} from './repositories/lesson-vector.repository.js';
import {
  ContextVectorRepository,
  CodeContextMetadata,
} from './repositories/context-vector.repository.js';
import { SearchResult } from './repositories/base-vector.repository.js';
import { HistoryRetriever, TaskProvider, HistoryItem } from './retrievers/history.retriever.js';
import { RelevanceRanker } from './rankers/relevance.ranker.js';
import { ContextCache } from './cache.js';
import { ContextFormatter, StructuredContext } from './formatters/context.formatter.js';
import type { ContextItem, RetrievedContext } from './context-manager.js';

/**
 * Extended context request schema
 */
export const ContextRequestSchema = z.object({
  query: z.string().min(1).max(5000),
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  agentType: z.string().max(50).optional(),
  tenantId: z.string().uuid(),
  tokenBudget: z.number().int().min(500).max(50000).optional(),
  includeOptions: z
    .object({
      lessons: z.boolean().default(true),
      code: z.boolean().default(true),
      history: z.boolean().default(true),
    })
    .optional(),
  filters: z
    .object({
      categories: z.array(z.string().max(50)).max(10).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
      timeRange: z
        .object({
          start: z.date(),
          end: z.date(),
        })
        .optional(),
    })
    .optional(),
});

export type ContextRequest = z.infer<typeof ContextRequestSchema>;

/**
 * Extended retrieved context with source breakdown
 */
export interface EnhancedRetrievedContext extends RetrievedContext {
  sources: {
    lessons: number;
    code: number;
    history: number;
  };
  cacheHit: boolean;
  rankingApplied: boolean;
}

/**
 * Agent-specific context configuration
 */
export interface AgentContextConfig {
  tokenBudget: number;
  sources: {
    lessons: boolean;
    code: boolean;
    history: boolean;
  };
  budgetAllocation: {
    lessons: number;
    code: number;
    history: number;
  };
}

/**
 * Default agent context configurations
 */
const AGENT_CONTEXT_CONFIGS: Record<string, AgentContextConfig> = {
  orchestrator: {
    tokenBudget: 2000,
    sources: { lessons: true, code: false, history: true },
    budgetAllocation: { lessons: 0.6, code: 0, history: 0.4 },
  },
  project_manager: {
    tokenBudget: 3000,
    sources: { lessons: true, code: false, history: true },
    budgetAllocation: { lessons: 0.5, code: 0, history: 0.5 },
  },
  architect: {
    tokenBudget: 4000,
    sources: { lessons: true, code: true, history: true },
    budgetAllocation: { lessons: 0.3, code: 0.5, history: 0.2 },
  },
  analyst: {
    tokenBudget: 3500,
    sources: { lessons: true, code: false, history: true },
    budgetAllocation: { lessons: 0.6, code: 0, history: 0.4 },
  },
  ui_designer: {
    tokenBudget: 3000,
    sources: { lessons: true, code: false, history: false },
    budgetAllocation: { lessons: 1.0, code: 0, history: 0 },
  },
  frontend_dev: {
    tokenBudget: 5000,
    sources: { lessons: true, code: true, history: true },
    budgetAllocation: { lessons: 0.2, code: 0.6, history: 0.2 },
  },
  backend_dev: {
    tokenBudget: 5000,
    sources: { lessons: true, code: true, history: true },
    budgetAllocation: { lessons: 0.2, code: 0.6, history: 0.2 },
  },
  tester: {
    tokenBudget: 4000,
    sources: { lessons: true, code: true, history: true },
    budgetAllocation: { lessons: 0.3, code: 0.4, history: 0.3 },
  },
  reviewer: {
    tokenBudget: 4000,
    sources: { lessons: true, code: true, history: true },
    budgetAllocation: { lessons: 0.3, code: 0.5, history: 0.2 },
  },
  compliance: {
    tokenBudget: 3500,
    sources: { lessons: true, code: true, history: false },
    budgetAllocation: { lessons: 0.5, code: 0.5, history: 0 },
  },
};

/**
 * Default context configuration
 */
const DEFAULT_CONFIG: AgentContextConfig = {
  tokenBudget: 4000,
  sources: { lessons: true, code: true, history: true },
  budgetAllocation: { lessons: 0.4, code: 0.4, history: 0.2 },
};

/**
 * Reserved tokens for system prompts
 */
const RESERVED_TOKENS = 500;

/**
 * Enhanced context manager with full feature set
 */
export class EnhancedContextManager {
  private readonly lessonRepo: LessonVectorRepository;
  private readonly codeRepo: ContextVectorRepository;
  private readonly historyRetriever: HistoryRetriever | null;
  private readonly ranker: RelevanceRanker;
  private readonly cache: ContextCache;
  private readonly formatter: ContextFormatter;

  constructor(options: {
    lessonRepo: LessonVectorRepository;
    codeRepo: ContextVectorRepository;
    taskProvider?: TaskProvider;
    cache?: ContextCache;
    ranker?: RelevanceRanker;
    formatter?: ContextFormatter;
  }) {
    this.lessonRepo = options.lessonRepo;
    this.codeRepo = options.codeRepo;
    this.historyRetriever = options.taskProvider
      ? new HistoryRetriever(options.taskProvider)
      : null;
    this.cache = options.cache ?? new ContextCache();
    this.ranker = options.ranker ?? new RelevanceRanker();
    this.formatter = options.formatter ?? new ContextFormatter();

    // Start cache cleanup
    this.cache.startCleanup();
  }

  /**
   * Retrieve context with full feature set
   */
  async retrieve(request: ContextRequest): Promise<EnhancedRetrievedContext> {
    const validated = ContextRequestSchema.parse(request);
    const {
      query,
      taskId,
      projectId,
      agentType,
      tenantId,
      includeOptions = { lessons: true, code: true, history: true },
      filters = {},
    } = validated;

    // Get agent-specific config
    const agentConfig = this.getAgentConfig(agentType);
    const tokenBudget = validated.tokenBudget ?? agentConfig.tokenBudget;
    const availableBudget = tokenBudget - RESERVED_TOKENS;

    // Check cache first
    const cacheKey = this.cache.buildContextKey(tenantId, query, agentType, {
      projectId,
      taskId,
      includeOptions,
    });
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        sources: this.countSources(cached.items),
        cacheHit: true,
        rankingApplied: false,
      };
    }

    // Calculate budget allocation
    const effectiveSources = {
      lessons: includeOptions.lessons && agentConfig.sources.lessons,
      code: includeOptions.code && agentConfig.sources.code && !!projectId,
      history:
        includeOptions.history &&
        agentConfig.sources.history &&
        !!this.historyRetriever,
    };

    const budgets = this.calculateBudgets(
      availableBudget,
      effectiveSources,
      agentConfig.budgetAllocation
    );

    // Retrieve from each source in parallel
    const [lessons, code, history] = await Promise.all([
      effectiveSources.lessons
        ? this.retrieveLessons(query, {
            agentType,
            categories: filters.categories,
            tags: filters.tags,
            limit: 20,
            budget: budgets.lessons,
          })
        : [],
      effectiveSources.code && projectId
        ? this.retrieveCode(query, {
            projectId,
            limit: 30,
            budget: budgets.code,
          })
        : [],
      effectiveSources.history && taskId && this.historyRetriever
        ? this.historyRetriever.retrieve({
            query,
            tenantId,
            taskId,
            timeRange: filters.timeRange,
            limit: 10,
          })
        : [],
    ]);

    // Combine all items
    const allItems: ContextItem[] = [
      ...lessons,
      ...code,
      ...this.historyItemsToContextItems(history),
    ];

    // Apply relevance ranking
    const rankedItems = this.ranker.rank(allItems, query, agentType);

    // Select items within token budget
    const selectedItems = this.selectWithinBudget(rankedItems, availableBudget);

    const result: EnhancedRetrievedContext = {
      items: selectedItems,
      totalTokens: selectedItems.reduce((sum, item) => sum + item.tokens, 0),
      tokenBudget: availableBudget,
      truncated: rankedItems.length > selectedItems.length,
      sources: this.countSources(selectedItems),
      cacheHit: false,
      rankingApplied: true,
    };

    // Cache result
    await this.cache.set(cacheKey, result, 300); // 5 min TTL

    return result;
  }

  /**
   * Get agent-specific context
   */
  async getAgentContext(
    agentType: string,
    taskDescription: string,
    taskId: string,
    tenantId: string,
    projectId?: string
  ): Promise<EnhancedRetrievedContext> {
    return this.retrieve({
      query: taskDescription,
      taskId,
      projectId,
      agentType,
      tenantId,
    });
  }

  /**
   * Format context for prompt injection
   */
  formatForPrompt(context: RetrievedContext): string {
    return this.formatter.format(context);
  }

  /**
   * Format context as structured data
   */
  formatStructured(context: RetrievedContext): StructuredContext {
    return this.formatter.formatStructured(context);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Invalidate cache for tenant
   */
  invalidateTenantCache(tenantId: string): number {
    return this.cache.invalidateTenant(tenantId);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.cache.stopCleanup();
  }

  /**
   * Retrieve lessons with budget constraint
   */
  private async retrieveLessons(
    query: string,
    options: {
      agentType?: string;
      categories?: string[];
      tags?: string[];
      limit: number;
      budget: number;
    }
  ): Promise<ContextItem[]> {
    const { agentType, categories, tags, limit, budget } = options;

    let results: SearchResult<LessonVectorMetadata>[];

    if (agentType) {
      results = await this.lessonRepo.searchByAgentType(query, agentType, {
        limit,
        scoreThreshold: 0.6,
      });
    } else if (tags && tags.length > 0) {
      results = await this.lessonRepo.searchByTags(query, tags, {
        limit,
        scoreThreshold: 0.6,
      });
    } else if (categories && categories.length > 0) {
      const category = categories[0];
      if (category) {
        results = await this.lessonRepo.searchByCategory(query, category, {
          limit,
          scoreThreshold: 0.6,
        });
      } else {
        results = await this.lessonRepo.searchLessons(query, {
          limit,
          scoreThreshold: 0.6,
        });
      }
    } else {
      results = await this.lessonRepo.searchLessons(query, {
        limit,
        scoreThreshold: 0.6,
      });
    }

    return this.resultsToItems(results, 'lesson', budget);
  }

  /**
   * Retrieve code with budget constraint
   */
  private async retrieveCode(
    query: string,
    options: {
      projectId: string;
      limit: number;
      budget: number;
    }
  ): Promise<ContextItem[]> {
    const { projectId, limit, budget } = options;

    const results = await this.codeRepo.searchInProject(query, projectId, {
      limit,
      scoreThreshold: 0.5,
    });

    // Deduplicate by file path (keep highest scoring chunk per file)
    const byFile = new Map<string, SearchResult<CodeContextMetadata>>();
    for (const result of results) {
      const filePath = result.metadata.file_path;
      const existing = byFile.get(filePath);
      if (!existing || result.score > existing.score) {
        byFile.set(filePath, result);
      }
    }

    return this.resultsToItems(Array.from(byFile.values()), 'code', budget);
  }

  /**
   * Convert search results to context items with budget
   */
  private resultsToItems<T extends Record<string, unknown>>(
    results: SearchResult<T>[],
    type: 'lesson' | 'code',
    budget: number
  ): ContextItem[] {
    const items: ContextItem[] = [];
    let usedBudget = 0;

    for (const result of results) {
      const tokens = this.estimateTokens(result.content);

      if (usedBudget + tokens <= budget) {
        items.push({
          type,
          content: result.content,
          relevance: result.score,
          metadata: result.metadata as unknown as Record<string, unknown>,
          tokens,
        });
        usedBudget += tokens;
      }
    }

    return items;
  }

  /**
   * Convert history items to context items
   */
  private historyItemsToContextItems(history: HistoryItem[]): ContextItem[] {
    return history.map((h) => ({
      type: 'history' as const,
      content: h.content,
      relevance: h.relevance,
      metadata: h.metadata as unknown as Record<string, unknown>,
      tokens: h.tokens,
    }));
  }

  /**
   * Select items within token budget
   */
  private selectWithinBudget(
    items: ContextItem[],
    budget: number
  ): ContextItem[] {
    const selected: ContextItem[] = [];
    let currentTokens = 0;

    for (const item of items) {
      if (currentTokens + item.tokens <= budget) {
        selected.push(item);
        currentTokens += item.tokens;
      } else if (currentTokens < budget * 0.9) {
        // Try to fit a truncated version
        const remainingBudget = budget - currentTokens;
        const truncated = this.truncateItem(item, remainingBudget);
        if (truncated) {
          selected.push(truncated);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * Truncate item to fit budget
   */
  private truncateItem(
    item: ContextItem,
    maxTokens: number
  ): ContextItem | null {
    if (maxTokens < 50) return null; // Too small to be useful

    const maxChars = (maxTokens - 10) * 4;
    let truncated = item.content.substring(0, maxChars);

    // Try to break at a good point
    const lastNewline = truncated.lastIndexOf('\n');
    const lastPeriod = truncated.lastIndexOf('.');
    const breakPoint = Math.max(lastNewline, lastPeriod, maxChars - 100);

    truncated = item.content.substring(0, breakPoint) + '\n[truncated]';

    return {
      ...item,
      content: truncated,
      tokens: this.estimateTokens(truncated),
    };
  }

  /**
   * Get agent-specific configuration
   */
  private getAgentConfig(agentType?: string): AgentContextConfig {
    if (!agentType) return DEFAULT_CONFIG;
    return AGENT_CONTEXT_CONFIGS[agentType] || DEFAULT_CONFIG;
  }

  /**
   * Calculate budgets for each source
   */
  private calculateBudgets(
    totalBudget: number,
    sources: { lessons: boolean; code: boolean; history: boolean },
    allocation: { lessons: number; code: number; history: number }
  ): { lessons: number; code: number; history: number } {
    // Normalize allocation based on active sources
    let totalAllocation = 0;
    if (sources.lessons) totalAllocation += allocation.lessons;
    if (sources.code) totalAllocation += allocation.code;
    if (sources.history) totalAllocation += allocation.history;

    if (totalAllocation === 0) {
      return { lessons: 0, code: 0, history: 0 };
    }

    return {
      lessons: sources.lessons
        ? Math.floor(totalBudget * (allocation.lessons / totalAllocation))
        : 0,
      code: sources.code
        ? Math.floor(totalBudget * (allocation.code / totalAllocation))
        : 0,
      history: sources.history
        ? Math.floor(totalBudget * (allocation.history / totalAllocation))
        : 0,
    };
  }

  /**
   * Count items by source type
   */
  private countSources(items: ContextItem[]): {
    lessons: number;
    code: number;
    history: number;
  } {
    return {
      lessons: items.filter((i) => i.type === 'lesson').length,
      code: items.filter((i) => i.type === 'code').length,
      history: items.filter((i) => i.type === 'history').length,
    };
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create enhanced context manager
 */
export function createEnhancedContextManager(options: {
  lessonRepo: LessonVectorRepository;
  codeRepo: ContextVectorRepository;
  taskProvider?: TaskProvider;
  cache?: ContextCache;
  ranker?: RelevanceRanker;
  formatter?: ContextFormatter;
}): EnhancedContextManager {
  return new EnhancedContextManager(options);
}
