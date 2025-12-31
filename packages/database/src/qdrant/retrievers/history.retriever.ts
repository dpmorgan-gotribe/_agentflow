/**
 * History Retriever
 *
 * Retrieves relevant task history for context.
 * Uses keyword matching and temporal decay for relevance scoring.
 *
 * Security:
 * - Tenant isolation via repository
 * - String length limits on content
 * - No SQL injection (uses Drizzle ORM)
 */

import { z } from 'zod';
import type { Task } from '../../schema/index.js';

/**
 * History item for context
 */
export interface HistoryItem {
  id: string;
  type: 'history';
  content: string;
  source: string;
  relevance: number;
  tokens: number;
  metadata: {
    taskId: string;
    prompt: string;
    status: string;
    completedAt?: Date;
    agentTypes?: string[];
    projectId?: string;
  };
}

/**
 * History retrieval options schema
 */
export const HistoryRetrieveOptionsSchema = z.object({
  query: z.string().max(2000),
  tenantId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  timeRange: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .optional(),
  projectId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type HistoryRetrieveOptions = z.infer<typeof HistoryRetrieveOptionsSchema>;

/**
 * Task provider interface for dependency injection
 */
export interface TaskProvider {
  findByProject(
    projectId: string,
    options?: { limit?: number; state?: string }
  ): Promise<Task[]>;
  findByState(state: string): Promise<Task[]>;
  findAll(options?: { limit?: number }): Promise<Task[]>;
}

/**
 * Maximum content length for history items
 */
const MAX_CONTENT_LENGTH = 2000;

/**
 * Time decay factor (30 days half-life)
 */
const TIME_DECAY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * History retriever for task context
 */
export class HistoryRetriever {
  constructor(private readonly taskProvider: TaskProvider) {}

  /**
   * Retrieve relevant task history
   */
  async retrieve(options: HistoryRetrieveOptions): Promise<HistoryItem[]> {
    const validated = HistoryRetrieveOptionsSchema.parse(options);
    const { query, taskId, timeRange, projectId, limit } = validated;

    let tasks: Task[];

    // Fetch tasks based on filters
    if (projectId) {
      tasks = await this.taskProvider.findByProject(projectId, {
        limit: limit * 3, // Fetch more to filter
      });
    } else {
      tasks = await this.taskProvider.findAll({
        limit: limit * 3,
      });
    }

    // Filter out current task and apply time range
    const filteredTasks = tasks.filter((t) => {
      if (taskId && t.id === taskId) return false;

      if (timeRange) {
        const taskDate = t.completedAt || t.createdAt;
        if (taskDate < timeRange.start || taskDate > timeRange.end) {
          return false;
        }
      }

      // Only include completed or partially completed tasks
      if (!['completed', 'awaiting_approval'].includes(t.status)) {
        return false;
      }

      return true;
    });

    // Calculate relevance scores
    const queryWords = this.extractKeywords(query);

    const scoredTasks = filteredTasks.map((task) => ({
      task,
      score: this.calculateRelevance(task, queryWords),
    }));

    // Sort by relevance and take top results
    scoredTasks.sort((a, b) => b.score - a.score);
    const topTasks = scoredTasks.slice(0, limit);

    // Convert to history items
    return topTasks
      .filter((st) => st.score > 0.1) // Minimum relevance threshold
      .map((st) => this.toHistoryItem(st.task, st.score));
  }

  /**
   * Extract keywords from query for matching
   */
  private extractKeywords(query: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'and',
      'but',
      'or',
      'nor',
      'so',
      'yet',
      'both',
      'either',
      'neither',
      'not',
      'only',
      'own',
      'same',
      'than',
      'too',
      'very',
      'just',
      'also',
    ]);

    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
      .slice(0, 20); // Limit keywords for performance
  }

  /**
   * Calculate relevance score for a task
   */
  private calculateRelevance(task: Task, queryWords: string[]): number {
    if (queryWords.length === 0) return 0;

    const taskWords = new Set(
      task.prompt
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    // Keyword overlap score
    const matchCount = queryWords.filter((w) => taskWords.has(w)).length;
    const keywordScore = matchCount / queryWords.length;

    // Time decay (exponential decay with 30-day half-life)
    const taskTime = (task.completedAt || task.createdAt).getTime();
    const age = Date.now() - taskTime;
    const timeScore = Math.pow(0.5, age / TIME_DECAY_HALF_LIFE_MS);

    // Status boost (completed tasks are more valuable)
    const statusBoost = task.status === 'completed' ? 1.0 : 0.8;

    // Combined score
    return keywordScore * 0.6 + timeScore * 0.3 + statusBoost * 0.1;
  }

  /**
   * Convert task to history item
   */
  private toHistoryItem(task: Task, relevance: number): HistoryItem {
    const content = this.formatTaskContent(task);
    const tokens = this.estimateTokens(content);

    return {
      id: `history:${task.id}`,
      type: 'history',
      content,
      source: `task:${task.id.substring(0, 8)}`,
      relevance,
      tokens,
      metadata: {
        taskId: task.id,
        prompt: task.prompt.substring(0, 200),
        status: task.status,
        completedAt: task.completedAt || undefined,
        agentTypes: task.completedAgents || undefined,
        projectId: task.projectId || undefined,
      },
    };
  }

  /**
   * Format task content for context
   */
  private formatTaskContent(task: Task): string {
    const lines: string[] = [];

    lines.push(`Task: ${this.truncate(task.prompt, 200)}`);
    lines.push(`Status: ${task.status}`);

    if (task.completedAgents && task.completedAgents.length > 0) {
      lines.push(`Agents: ${task.completedAgents.join(', ')}`);
    }

    // Include analysis summary if available
    if (task.analysis) {
      const analysis = task.analysis as { taskType?: string; complexity?: string };
      if (analysis.taskType) {
        lines.push(`Type: ${analysis.taskType}`);
      }
      if (analysis.complexity) {
        lines.push(`Complexity: ${analysis.complexity}`);
      }
    }

    // Include error info if present
    if (task.error) {
      const errorMsg =
        typeof task.error === 'object' && 'message' in task.error
          ? (task.error as { message: string }).message
          : String(task.error);
      lines.push(`Error: ${this.truncate(errorMsg, 200)}`);
    }

    const content = lines.join('\n');
    return content.length > MAX_CONTENT_LENGTH
      ? content.substring(0, MAX_CONTENT_LENGTH) + '...'
      : content;
  }

  /**
   * Truncate string to max length
   */
  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }

  /**
   * Estimate token count (~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create history retriever
 */
export function createHistoryRetriever(
  taskProvider: TaskProvider
): HistoryRetriever {
  return new HistoryRetriever(taskProvider);
}
