/**
 * Context Manager
 *
 * Token-budget-aware context retrieval for RAG.
 */

import {
  LessonVectorRepository,
  LessonVectorMetadata,
} from './repositories/lesson-vector.repository.js';
import {
  ContextVectorRepository,
  CodeContextMetadata,
} from './repositories/context-vector.repository.js';
import { SearchResult } from './repositories/base-vector.repository.js';

/**
 * Context item types
 */
export type ContextItemType = 'lesson' | 'code' | 'history';

/**
 * A single context item
 */
export interface ContextItem {
  type: ContextItemType;
  content: string;
  relevance: number;
  metadata: Record<string, unknown>;
  tokens: number;
}

/**
 * Retrieved context with budget info
 */
export interface RetrievedContext {
  items: ContextItem[];
  totalTokens: number;
  tokenBudget: number;
  truncated: boolean;
}

/**
 * Context retrieval options
 */
export interface ContextRetrievalOptions {
  projectId?: string;
  agentType?: string;
  category?: string;
  includeCode?: boolean;
  includeLessons?: boolean;
  lessonLimit?: number;
  codeLimit?: number;
  minScoreThreshold?: number;
}

/**
 * Default retrieval options
 */
const DEFAULT_OPTIONS: Required<ContextRetrievalOptions> = {
  projectId: '',
  agentType: '',
  category: '',
  includeCode: true,
  includeLessons: true,
  lessonLimit: 10,
  codeLimit: 20,
  minScoreThreshold: 0.6,
};

/**
 * Context manager for token-budget-aware retrieval
 */
export class ContextManager {
  private readonly tokenBudget: number;
  private readonly lessonBudgetRatio: number;

  constructor(
    private readonly lessonRepo: LessonVectorRepository,
    private readonly codeRepo: ContextVectorRepository,
    options: {
      tokenBudget?: number;
      lessonBudgetRatio?: number;
    } = {}
  ) {
    this.tokenBudget = options.tokenBudget ?? 4000;
    this.lessonBudgetRatio = options.lessonBudgetRatio ?? 0.4;
  }

  /**
   * Retrieve context for a query within token budget
   */
  async retrieveContext(
    query: string,
    options: ContextRetrievalOptions = {}
  ): Promise<RetrievedContext> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const items: ContextItem[] = [];
    let totalTokens = 0;
    const lessonBudget = Math.floor(
      this.tokenBudget * this.lessonBudgetRatio
    );
    const codeBudget = this.tokenBudget - lessonBudget;

    // Retrieve lessons
    if (opts.includeLessons) {
      const lessonItems = await this.retrieveLessons(
        query,
        opts,
        lessonBudget
      );
      for (const item of lessonItems) {
        if (totalTokens + item.tokens <= this.tokenBudget) {
          items.push(item);
          totalTokens += item.tokens;
        }
      }
    }

    // Retrieve code context
    if (opts.includeCode && opts.projectId) {
      const codeItems = await this.retrieveCode(
        query,
        opts,
        codeBudget
      );
      for (const item of codeItems) {
        if (totalTokens + item.tokens <= this.tokenBudget) {
          items.push(item);
          totalTokens += item.tokens;
        }
      }
    }

    // Sort by relevance
    items.sort((a, b) => b.relevance - a.relevance);

    return {
      items,
      totalTokens,
      tokenBudget: this.tokenBudget,
      truncated: totalTokens >= this.tokenBudget * 0.95,
    };
  }

  /**
   * Retrieve lessons within budget
   */
  private async retrieveLessons(
    query: string,
    options: Required<ContextRetrievalOptions>,
    budget: number
  ): Promise<ContextItem[]> {
    let results: SearchResult<LessonVectorMetadata>[];

    if (options.agentType) {
      results = await this.lessonRepo.searchByAgentType(
        query,
        options.agentType,
        {
          limit: options.lessonLimit,
          scoreThreshold: options.minScoreThreshold,
        }
      );
    } else if (options.category) {
      results = await this.lessonRepo.searchByCategory(
        query,
        options.category,
        {
          limit: options.lessonLimit,
          scoreThreshold: options.minScoreThreshold,
        }
      );
    } else {
      results = await this.lessonRepo.searchLessons(query, {
        limit: options.lessonLimit,
        scoreThreshold: options.minScoreThreshold,
      });
    }

    const items: ContextItem[] = [];
    let usedBudget = 0;

    for (const result of results) {
      const tokens = this.estimateTokens(result.content);

      if (usedBudget + tokens <= budget) {
        items.push({
          type: 'lesson',
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
   * Retrieve code context within budget
   */
  private async retrieveCode(
    query: string,
    options: Required<ContextRetrievalOptions>,
    budget: number
  ): Promise<ContextItem[]> {
    const results = await this.codeRepo.searchInProject(
      query,
      options.projectId,
      {
        limit: options.codeLimit,
        scoreThreshold: options.minScoreThreshold,
      }
    );

    const items: ContextItem[] = [];
    let usedBudget = 0;

    for (const result of results) {
      const tokens = this.estimateTokens(result.content);

      if (usedBudget + tokens <= budget) {
        items.push({
          type: 'code',
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
   * Estimate token count for text
   * Uses rough approximation: ~4 characters per token
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Format retrieved context for prompt injection
   */
  formatForPrompt(context: RetrievedContext): string {
    const sections: string[] = [];

    // Group by type
    const lessons = context.items.filter((i) => i.type === 'lesson');
    const code = context.items.filter((i) => i.type === 'code');

    // Format lessons section
    if (lessons.length > 0) {
      sections.push('## Relevant Lessons\n');
      for (const lesson of lessons) {
        const meta = lesson.metadata as unknown as LessonVectorMetadata;
        sections.push(
          `### ${meta.category || 'Lesson'} (relevance: ${(lesson.relevance * 100).toFixed(0)}%)\n`
        );
        sections.push(`${lesson.content}\n`);
      }
    }

    // Format code section
    if (code.length > 0) {
      sections.push('\n## Relevant Code\n');
      for (const item of code) {
        const meta = item.metadata as unknown as CodeContextMetadata;
        const filePath = meta.file_path || 'unknown';
        const language = meta.language || '';
        const lineInfo =
          meta.line_start !== undefined
            ? ` (lines ${meta.line_start}-${meta.line_end})`
            : '';

        sections.push(`### ${filePath}${lineInfo}\n`);
        sections.push(`\`\`\`${language}\n${item.content}\n\`\`\`\n`);
      }
    }

    // Add budget info
    sections.push(
      `\n<!-- Context: ${context.totalTokens}/${context.tokenBudget} tokens${context.truncated ? ' (truncated)' : ''} -->\n`
    );

    return sections.join('\n');
  }

  /**
   * Get a summary of retrieved context
   */
  summarizeContext(context: RetrievedContext): {
    lessonCount: number;
    codeCount: number;
    totalTokens: number;
    tokenBudget: number;
    utilizationPercent: number;
  } {
    return {
      lessonCount: context.items.filter((i) => i.type === 'lesson').length,
      codeCount: context.items.filter((i) => i.type === 'code').length,
      totalTokens: context.totalTokens,
      tokenBudget: context.tokenBudget,
      utilizationPercent: Math.round(
        (context.totalTokens / context.tokenBudget) * 100
      ),
    };
  }
}
