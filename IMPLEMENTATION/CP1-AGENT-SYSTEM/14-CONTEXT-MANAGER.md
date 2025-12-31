# Step 14: Context Manager

> **Checkpoint:** CP1 - Agent System
> **Previous Step:** 13-ORCHESTRATOR-GRAPH.md
> **Next Step:** 05a-ORCHESTRATOR-AGENT.md
> **Architecture Reference:** `ARCHITECTURE.md` - RAG and Context Retrieval

---

## Overview

The **Context Manager** provides intelligent context retrieval for agents using Qdrant vector search. It retrieves relevant lessons, code context, and historical task information while respecting token budgets and prioritizing high-relevance content.

---

## Key Principles

1. **Token-Budget Aware**: Never exceed the configured token limit
2. **Multi-Source Retrieval**: Combine lessons, code, and history
3. **Relevance Ranking**: Prioritize most relevant context
4. **Agent-Specific Context**: Tailor context to the executing agent
5. **Caching**: Cache embeddings and frequent queries

---

## Deliverables

1. `packages/core/src/context/context-manager.ts` - Main context manager
2. `packages/core/src/context/retrievers/` - Source-specific retrievers
3. `packages/core/src/context/rankers/` - Relevance ranking algorithms
4. `packages/core/src/context/formatters/` - Context formatting utilities
5. `packages/core/src/context/cache.ts` - Embedding and result cache

---

## 1. Context Manager Core

### 1.1 Main Context Manager

```typescript
// packages/core/src/context/context-manager.ts

import { LessonRetriever } from './retrievers/lesson.retriever';
import { CodeRetriever } from './retrievers/code.retriever';
import { HistoryRetriever } from './retrievers/history.retriever';
import { RelevanceRanker } from './rankers/relevance.ranker';
import { ContextFormatter } from './formatters/context.formatter';
import { ContextCache } from './cache';

export interface ContextItem {
  id: string;
  type: 'lesson' | 'code' | 'history' | 'artifact';
  content: string;
  source: string;
  relevance: number;
  tokens: number;
  metadata: Record<string, unknown>;
}

export interface RetrievedContext {
  items: ContextItem[];
  totalTokens: number;
  tokenBudget: number;
  truncated: boolean;
  sources: {
    lessons: number;
    code: number;
    history: number;
  };
}

export interface ContextRequest {
  query: string;
  taskId: string;
  projectId?: string;
  agentType?: string;
  tenantId: string;
  tokenBudget?: number;
  includeOptions?: {
    lessons?: boolean;
    code?: boolean;
    history?: boolean;
  };
  filters?: {
    categories?: string[];
    tags?: string[];
    timeRange?: { start: Date; end: Date };
  };
}

export class ContextManager {
  private lessonRetriever: LessonRetriever;
  private codeRetriever: CodeRetriever;
  private historyRetriever: HistoryRetriever;
  private ranker: RelevanceRanker;
  private formatter: ContextFormatter;
  private cache: ContextCache;

  private defaultTokenBudget = 4000;
  private reservedTokens = 500; // Reserve for system prompts

  constructor(
    lessonRetriever: LessonRetriever,
    codeRetriever: CodeRetriever,
    historyRetriever: HistoryRetriever,
    cache: ContextCache
  ) {
    this.lessonRetriever = lessonRetriever;
    this.codeRetriever = codeRetriever;
    this.historyRetriever = historyRetriever;
    this.ranker = new RelevanceRanker();
    this.formatter = new ContextFormatter();
    this.cache = cache;
  }

  async retrieve(request: ContextRequest): Promise<RetrievedContext> {
    const {
      query,
      taskId,
      projectId,
      agentType,
      tenantId,
      tokenBudget = this.defaultTokenBudget,
      includeOptions = { lessons: true, code: true, history: true },
      filters = {},
    } = request;

    const availableBudget = tokenBudget - this.reservedTokens;
    const allItems: ContextItem[] = [];

    // Check cache first
    const cacheKey = this.buildCacheKey(request);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Retrieve from each source in parallel
    const [lessons, code, history] = await Promise.all([
      includeOptions.lessons
        ? this.lessonRetriever.retrieve({
            query,
            tenantId,
            agentType,
            categories: filters.categories,
            tags: filters.tags,
            limit: 20,
          })
        : [],
      includeOptions.code && projectId
        ? this.codeRetriever.retrieve({
            query,
            projectId,
            tenantId,
            limit: 30,
          })
        : [],
      includeOptions.history
        ? this.historyRetriever.retrieve({
            query,
            tenantId,
            taskId,
            timeRange: filters.timeRange,
            limit: 10,
          })
        : [],
    ]);

    // Add all items
    allItems.push(...lessons, ...code, ...history);

    // Rank by relevance
    const rankedItems = this.ranker.rank(allItems, query, agentType);

    // Select items within token budget
    const selectedItems = this.selectWithinBudget(rankedItems, availableBudget);

    const result: RetrievedContext = {
      items: selectedItems,
      totalTokens: selectedItems.reduce((sum, item) => sum + item.tokens, 0),
      tokenBudget: availableBudget,
      truncated: rankedItems.length > selectedItems.length,
      sources: {
        lessons: selectedItems.filter(i => i.type === 'lesson').length,
        code: selectedItems.filter(i => i.type === 'code').length,
        history: selectedItems.filter(i => i.type === 'history').length,
      },
    };

    // Cache result
    await this.cache.set(cacheKey, result, 300); // 5 min TTL

    return result;
  }

  private selectWithinBudget(items: ContextItem[], budget: number): ContextItem[] {
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

  private truncateItem(item: ContextItem, maxTokens: number): ContextItem | null {
    if (maxTokens < 50) return null; // Too small to be useful

    const truncatedContent = this.truncateToTokens(item.content, maxTokens - 10);
    return {
      ...item,
      content: truncatedContent + '\n[truncated]',
      tokens: this.estimateTokens(truncatedContent) + 5,
    };
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    // Rough estimate: 4 chars per token
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;

    // Find a good break point (sentence or line)
    let breakPoint = text.lastIndexOf('.', maxChars);
    if (breakPoint < maxChars * 0.5) {
      breakPoint = text.lastIndexOf('\n', maxChars);
    }
    if (breakPoint < maxChars * 0.5) {
      breakPoint = maxChars;
    }

    return text.substring(0, breakPoint);
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private buildCacheKey(request: ContextRequest): string {
    return `context:${request.tenantId}:${request.query.substring(0, 50)}:${request.agentType || 'all'}`;
  }

  /**
   * Format context for inclusion in a prompt
   */
  formatForPrompt(context: RetrievedContext): string {
    return this.formatter.format(context);
  }

  /**
   * Get context specifically tailored for an agent type
   */
  async getAgentContext(
    agentType: string,
    taskDescription: string,
    taskId: string,
    tenantId: string,
    projectId?: string
  ): Promise<RetrievedContext> {
    const agentConfig = this.getAgentContextConfig(agentType);

    return this.retrieve({
      query: taskDescription,
      taskId,
      projectId,
      agentType,
      tenantId,
      tokenBudget: agentConfig.tokenBudget,
      includeOptions: agentConfig.sources,
    });
  }

  private getAgentContextConfig(agentType: string): {
    tokenBudget: number;
    sources: { lessons: boolean; code: boolean; history: boolean };
  } {
    const configs: Record<string, any> = {
      orchestrator: { tokenBudget: 2000, sources: { lessons: true, code: false, history: true } },
      project_manager: { tokenBudget: 3000, sources: { lessons: true, code: false, history: true } },
      architect: { tokenBudget: 4000, sources: { lessons: true, code: true, history: true } },
      ui_designer: { tokenBudget: 3000, sources: { lessons: true, code: false, history: false } },
      frontend_dev: { tokenBudget: 5000, sources: { lessons: true, code: true, history: true } },
      backend_dev: { tokenBudget: 5000, sources: { lessons: true, code: true, history: true } },
      tester: { tokenBudget: 4000, sources: { lessons: true, code: true, history: true } },
      reviewer: { tokenBudget: 4000, sources: { lessons: true, code: true, history: true } },
    };

    return configs[agentType] || { tokenBudget: 3000, sources: { lessons: true, code: true, history: true } };
  }
}
```

---

## 2. Source Retrievers

### 2.1 Lesson Retriever

```typescript
// packages/core/src/context/retrievers/lesson.retriever.ts

import { LessonVectorRepository } from '@aigentflow/database';
import { ContextItem } from '../context-manager';

export interface LessonRetrieveOptions {
  query: string;
  tenantId: string;
  agentType?: string;
  categories?: string[];
  tags?: string[];
  limit: number;
}

export class LessonRetriever {
  constructor(private vectorRepo: LessonVectorRepository) {}

  async retrieve(options: LessonRetrieveOptions): Promise<ContextItem[]> {
    const { query, agentType, categories, tags, limit } = options;

    let results;

    if (agentType) {
      results = await this.vectorRepo.searchByAgent(query, agentType, {
        limit,
        scoreThreshold: 0.6,
      });
    } else if (tags && tags.length > 0) {
      results = await this.vectorRepo.searchByTags(query, tags, {
        limit,
        scoreThreshold: 0.6,
      });
    } else if (categories && categories.length > 0) {
      results = await this.vectorRepo.searchByCategory(query, categories[0], {
        limit,
        scoreThreshold: 0.6,
      });
    } else {
      results = await this.vectorRepo.search(query, {
        limit,
        scoreThreshold: 0.6,
      });
    }

    return results.map(r => ({
      id: r.id,
      type: 'lesson' as const,
      content: r.content,
      source: `lesson:${r.metadata.category}`,
      relevance: r.score,
      tokens: this.estimateTokens(r.content),
      metadata: {
        lessonId: r.metadata.lesson_id,
        category: r.metadata.category,
        agentType: r.metadata.agent_type,
        tags: r.metadata.tags,
        confidence: r.metadata.confidence,
        successRate: r.metadata.success_rate,
      },
    }));
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

### 2.2 Code Retriever

```typescript
// packages/core/src/context/retrievers/code.retriever.ts

import { ContextVectorRepository } from '@aigentflow/database';
import { ContextItem } from '../context-manager';

export interface CodeRetrieveOptions {
  query: string;
  projectId: string;
  tenantId: string;
  language?: string;
  limit: number;
}

export class CodeRetriever {
  constructor(private vectorRepo: ContextVectorRepository) {}

  async retrieve(options: CodeRetrieveOptions): Promise<ContextItem[]> {
    const { query, projectId, language, limit } = options;

    let results;

    if (language) {
      results = await this.vectorRepo.searchByLanguage(query, language, {
        limit,
        scoreThreshold: 0.5,
      });
    } else {
      results = await this.vectorRepo.searchInProject(query, projectId, {
        limit,
        scoreThreshold: 0.5,
      });
    }

    // Deduplicate by file path (keep highest scoring chunk per file)
    const byFile = new Map<string, typeof results[0]>();
    for (const result of results) {
      const filePath = result.metadata.file_path;
      const existing = byFile.get(filePath);
      if (!existing || result.score > existing.score) {
        byFile.set(filePath, result);
      }
    }

    return Array.from(byFile.values()).map(r => ({
      id: r.id,
      type: 'code' as const,
      content: r.content,
      source: r.metadata.file_path,
      relevance: r.score,
      tokens: this.estimateTokens(r.content),
      metadata: {
        filePath: r.metadata.file_path,
        language: r.metadata.language,
        chunkIndex: r.metadata.chunk_index,
        totalChunks: r.metadata.total_chunks,
      },
    }));
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

### 2.3 History Retriever

```typescript
// packages/core/src/context/retrievers/history.retriever.ts

import { TaskRepository, SelfReviewRepository } from '@aigentflow/database';
import { ContextItem } from '../context-manager';

export interface HistoryRetrieveOptions {
  query: string;
  tenantId: string;
  taskId: string;
  timeRange?: { start: Date; end: Date };
  limit: number;
}

export class HistoryRetriever {
  constructor(
    private taskRepo: TaskRepository,
    private reviewRepo: SelfReviewRepository
  ) {}

  async retrieve(options: HistoryRetrieveOptions): Promise<ContextItem[]> {
    const { query, taskId, limit } = options;
    const items: ContextItem[] = [];

    // Get recent similar tasks
    const recentTasks = await this.taskRepo.findAll({ limit: limit * 2 });

    // Filter to similar tasks (simple keyword matching)
    const queryWords = query.toLowerCase().split(/\s+/);
    const similarTasks = recentTasks
      .filter(t => t.id !== taskId) // Exclude current task
      .filter(t => {
        const taskWords = t.prompt.toLowerCase().split(/\s+/);
        const overlap = queryWords.filter(w => taskWords.includes(w)).length;
        return overlap >= queryWords.length * 0.3;
      })
      .slice(0, limit);

    for (const task of similarTasks) {
      if (task.result) {
        items.push({
          id: `history:${task.id}`,
          type: 'history' as const,
          content: this.formatTaskHistory(task),
          source: `task:${task.id.substring(0, 8)}`,
          relevance: this.calculateTaskRelevance(task, queryWords),
          tokens: this.estimateTokens(JSON.stringify(task.result)),
          metadata: {
            taskId: task.id,
            state: task.state,
            completedAt: task.completedAt,
          },
        });
      }
    }

    return items;
  }

  private formatTaskHistory(task: any): string {
    const lines = [
      `Previous Task: ${task.prompt.substring(0, 100)}`,
      `Outcome: ${task.state}`,
    ];

    if (task.result) {
      const result = typeof task.result === 'string' ? task.result : JSON.stringify(task.result);
      lines.push(`Result: ${result.substring(0, 500)}`);
    }

    return lines.join('\n');
  }

  private calculateTaskRelevance(task: any, queryWords: string[]): number {
    const taskWords = task.prompt.toLowerCase().split(/\s+/);
    const overlap = queryWords.filter(w => taskWords.includes(w)).length;
    return overlap / queryWords.length;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

---

## 3. Relevance Ranking

### 3.1 Relevance Ranker

```typescript
// packages/core/src/context/rankers/relevance.ranker.ts

import { ContextItem } from '../context-manager';

export class RelevanceRanker {
  private typeWeights: Record<string, number> = {
    lesson: 1.2,    // Lessons are highly valuable
    code: 1.0,      // Code is directly relevant
    history: 0.8,   // History is context
    artifact: 0.9,  // Artifacts from current task
  };

  private agentTypeAffinity: Record<string, Record<string, number>> = {
    ui_designer: { lesson: 1.3, code: 0.5, history: 0.8 },
    frontend_dev: { lesson: 1.0, code: 1.5, history: 1.0 },
    backend_dev: { lesson: 1.0, code: 1.5, history: 1.0 },
    architect: { lesson: 1.2, code: 1.2, history: 1.0 },
    tester: { lesson: 1.1, code: 1.3, history: 1.2 },
    reviewer: { lesson: 1.0, code: 1.4, history: 1.0 },
  };

  rank(
    items: ContextItem[],
    query: string,
    agentType?: string
  ): ContextItem[] {
    const scoredItems = items.map(item => ({
      item,
      score: this.calculateScore(item, query, agentType),
    }));

    // Sort by score descending
    scoredItems.sort((a, b) => b.score - a.score);

    // Update relevance scores on items
    return scoredItems.map(({ item, score }) => ({
      ...item,
      relevance: score,
    }));
  }

  private calculateScore(
    item: ContextItem,
    query: string,
    agentType?: string
  ): number {
    let score = item.relevance;

    // Apply type weight
    score *= this.typeWeights[item.type] || 1.0;

    // Apply agent affinity if applicable
    if (agentType && this.agentTypeAffinity[agentType]) {
      score *= this.agentTypeAffinity[agentType][item.type] || 1.0;
    }

    // Boost for recency (if available in metadata)
    if (item.metadata.createdAt) {
      const age = Date.now() - new Date(item.metadata.createdAt as string).getTime();
      const dayAge = age / (1000 * 60 * 60 * 24);
      score *= Math.exp(-dayAge / 30); // Decay over 30 days
    }

    // Boost for high confidence (lessons)
    if (item.type === 'lesson' && item.metadata.confidence) {
      score *= 0.7 + (item.metadata.confidence as number) * 0.3;
    }

    // Boost for high success rate (lessons)
    if (item.type === 'lesson' && item.metadata.successRate) {
      score *= 0.8 + (item.metadata.successRate as number) * 0.2;
    }

    return score;
  }
}
```

---

## 4. Context Formatting

### 4.1 Context Formatter

```typescript
// packages/core/src/context/formatters/context.formatter.ts

import { RetrievedContext, ContextItem } from '../context-manager';

export class ContextFormatter {
  format(context: RetrievedContext): string {
    const sections: string[] = [];

    // Group items by type
    const lessons = context.items.filter(i => i.type === 'lesson');
    const code = context.items.filter(i => i.type === 'code');
    const history = context.items.filter(i => i.type === 'history');

    // Format lessons section
    if (lessons.length > 0) {
      sections.push(this.formatLessonsSection(lessons));
    }

    // Format code section
    if (code.length > 0) {
      sections.push(this.formatCodeSection(code));
    }

    // Format history section
    if (history.length > 0) {
      sections.push(this.formatHistorySection(history));
    }

    // Add footer with stats
    sections.push(this.formatFooter(context));

    return sections.join('\n\n');
  }

  private formatLessonsSection(lessons: ContextItem[]): string {
    const lines = ['## Relevant Lessons', ''];

    for (const lesson of lessons) {
      const tags = (lesson.metadata.tags as string[])?.join(', ') || '';
      const confidence = lesson.metadata.confidence
        ? ` (${Math.round((lesson.metadata.confidence as number) * 100)}% confidence)`
        : '';

      lines.push(`### ${lesson.metadata.category || 'General'}${confidence}`);
      lines.push(lesson.content);
      if (tags) {
        lines.push(`Tags: ${tags}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatCodeSection(code: ContextItem[]): string {
    const lines = ['## Relevant Code', ''];

    for (const item of code) {
      const filePath = item.metadata.filePath as string;
      const language = item.metadata.language as string || 'text';

      lines.push(`### ${filePath}`);
      lines.push(`\`\`\`${language}`);
      lines.push(item.content);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatHistorySection(history: ContextItem[]): string {
    const lines = ['## Previous Similar Tasks', ''];

    for (const item of history) {
      lines.push(`- ${item.content}`);
    }

    return lines.join('\n');
  }

  private formatFooter(context: RetrievedContext): string {
    const parts = [
      `---`,
      `Context: ${context.items.length} items`,
      `(${context.sources.lessons} lessons, ${context.sources.code} code, ${context.sources.history} history)`,
      `Tokens: ${context.totalTokens}/${context.tokenBudget}`,
    ];

    if (context.truncated) {
      parts.push('(truncated)');
    }

    return parts.join(' | ');
  }

  /**
   * Format for structured agent input
   */
  formatStructured(context: RetrievedContext): {
    lessons: Array<{ content: string; category: string; confidence: number }>;
    code: Array<{ content: string; filePath: string; language: string }>;
    history: Array<{ content: string; taskId: string }>;
  } {
    return {
      lessons: context.items
        .filter(i => i.type === 'lesson')
        .map(i => ({
          content: i.content,
          category: i.metadata.category as string || 'general',
          confidence: i.metadata.confidence as number || 0.5,
        })),
      code: context.items
        .filter(i => i.type === 'code')
        .map(i => ({
          content: i.content,
          filePath: i.metadata.filePath as string,
          language: i.metadata.language as string || 'text',
        })),
      history: context.items
        .filter(i => i.type === 'history')
        .map(i => ({
          content: i.content,
          taskId: i.metadata.taskId as string,
        })),
    };
  }
}
```

---

## 5. Context Cache

### 5.1 Cache Implementation

```typescript
// packages/core/src/context/cache.ts

import { RetrievedContext } from './context-manager';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ContextCache {
  private cache: Map<string, CacheEntry<RetrievedContext>> = new Map();
  private embeddingCache: Map<string, CacheEntry<number[]>> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<RetrievedContext | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: RetrievedContext, ttlSeconds: number): Promise<void> {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getEmbedding(text: string): Promise<number[] | null> {
    const key = this.hashText(text);
    const entry = this.embeddingCache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.embeddingCache.delete(key);
      return null;
    }

    return entry.value;
  }

  async setEmbedding(text: string, embedding: number[], ttlSeconds: number = 3600): Promise<void> {
    const key = this.hashText(text);

    if (this.embeddingCache.size >= this.maxSize * 2) {
      this.evictOldestEmbedding();
    }

    this.embeddingCache.set(key, {
      value: embedding,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.embeddingCache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private evictOldestEmbedding(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.embeddingCache.entries()) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.embeddingCache.delete(oldestKey);
    }
  }

  private hashText(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `emb:${hash.toString(36)}`;
  }
}
```

---

## Validation Checklist

```
□ Context Manager (Step 14)
  □ Multi-source retrieval works
  □ Token budget respected
  □ Lesson retrieval works
  □ Code retrieval works
  □ History retrieval works
  □ Relevance ranking orders correctly
  □ Agent-specific context config works
  □ Caching improves performance
  □ Context formatting produces valid prompts
  □ Truncation preserves usefulness
  □ Tests pass
```

---

## Next Step

Proceed to **05a-ORCHESTRATOR-AGENT.md** to implement the main orchestrator agent that uses the context manager.
