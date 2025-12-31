/**
 * Token Allocator
 *
 * Manages token budgets across prompt layers with bounds checking.
 */

import { TokenBudgetError } from './errors.js';
import type { LayerCategory, TokenAllocation } from './types.js';

/**
 * Characters per token estimate (conservative for English text)
 */
const CHARS_PER_TOKEN = 4;

/**
 * Minimum allocation per category
 */
const MIN_CATEGORY_ALLOCATION = 50;

/**
 * Maximum total allocation (safety limit)
 */
const MAX_TOTAL_ALLOCATION = 1_000_000;

/**
 * Token usage summary for a category
 */
export interface CategoryUsage {
  used: number;
  budget: number;
  percent: number;
}

/**
 * Token Allocator class for managing prompt token budgets
 */
export class TokenAllocator {
  private readonly allocation: TokenAllocation;
  private usage: Record<LayerCategory, number>;

  constructor(allocation: TokenAllocation) {
    this.validateAllocation(allocation);
    this.allocation = allocation;
    this.usage = {
      identity: 0,
      operational: 0,
      context: 0,
      reasoning: 0,
      meta: 0,
    };
  }

  /**
   * Validate token allocation bounds
   */
  private validateAllocation(allocation: TokenAllocation): void {
    if (allocation.total <= 0 || allocation.total > MAX_TOTAL_ALLOCATION) {
      throw new TokenBudgetError(
        `Total allocation must be between 1 and ${MAX_TOTAL_ALLOCATION}`,
        allocation.total,
        MAX_TOTAL_ALLOCATION,
        { allocation }
      );
    }

    const categories: LayerCategory[] = [
      'identity',
      'operational',
      'context',
      'reasoning',
      'meta',
    ];
    for (const category of categories) {
      if (allocation[category] < 0) {
        throw new TokenBudgetError(
          `Category ${category} allocation cannot be negative`,
          allocation[category],
          0,
          { category, allocation }
        );
      }
    }

    const categorySum =
      allocation.identity +
      allocation.operational +
      allocation.context +
      allocation.reasoning +
      allocation.meta;

    if (categorySum > allocation.total) {
      throw new TokenBudgetError(
        `Category allocations (${categorySum}) exceed total budget (${allocation.total})`,
        categorySum,
        allocation.total,
        { allocation }
      );
    }
  }

  /**
   * Estimate tokens for a string
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Check if budget available for category
   */
  hasBudget(category: LayerCategory, tokens: number): boolean {
    if (tokens < 0) {
      return false;
    }
    return this.usage[category] + tokens <= this.allocation[category];
  }

  /**
   * Allocate tokens for a category
   * @returns true if allocation succeeded, false if budget exceeded
   */
  allocate(category: LayerCategory, tokens: number): boolean {
    if (tokens < 0) {
      return false;
    }
    if (!this.hasBudget(category, tokens)) {
      return false;
    }
    this.usage[category] += tokens;
    return true;
  }

  /**
   * Force allocate tokens (for required layers that must be included)
   * Throws if this would cause total to exceed budget
   */
  forceAllocate(category: LayerCategory, tokens: number): void {
    if (tokens < 0) {
      throw new TokenBudgetError('Cannot allocate negative tokens', tokens, 0, {
        category,
      });
    }

    const totalUsed = this.getTotalUsed() + tokens;
    if (totalUsed > this.allocation.total * 1.5) {
      throw new TokenBudgetError(
        `Force allocation would exceed 150% of total budget`,
        totalUsed,
        this.allocation.total * 1.5,
        { category, tokens }
      );
    }

    this.usage[category] += tokens;
  }

  /**
   * Get remaining budget for category
   */
  getRemainingBudget(category: LayerCategory): number {
    return Math.max(0, this.allocation[category] - this.usage[category]);
  }

  /**
   * Get total tokens used
   */
  getTotalUsed(): number {
    return Object.values(this.usage).reduce((a, b) => a + b, 0);
  }

  /**
   * Get total remaining budget
   */
  getTotalRemaining(): number {
    return Math.max(0, this.allocation.total - this.getTotalUsed());
  }

  /**
   * Get usage summary
   */
  getSummary(): Record<LayerCategory | 'total', CategoryUsage> {
    const summary: Record<string, CategoryUsage> = {};

    const categories: LayerCategory[] = [
      'identity',
      'operational',
      'context',
      'reasoning',
      'meta',
    ];
    for (const category of categories) {
      const budget = this.allocation[category];
      const used = this.usage[category];
      summary[category] = {
        used,
        budget,
        percent: budget > 0 ? Math.round((used / budget) * 100) : 0,
      };
    }

    const totalUsed = this.getTotalUsed();
    summary['total'] = {
      used: totalUsed,
      budget: this.allocation.total,
      percent: Math.round((totalUsed / this.allocation.total) * 100),
    };

    return summary as Record<LayerCategory | 'total', CategoryUsage>;
  }

  /**
   * Reset usage counters
   */
  reset(): void {
    this.usage = {
      identity: 0,
      operational: 0,
      context: 0,
      reasoning: 0,
      meta: 0,
    };
  }

  /**
   * Get allocation configuration
   */
  getAllocation(): TokenAllocation {
    return { ...this.allocation };
  }

  /**
   * Create adjusted allocation based on context size
   * @param contextTokens Total context window size
   * @param systemPromptPercent Percentage of context for system prompt (default 8%)
   */
  static createForContextSize(
    contextTokens: number,
    systemPromptPercent = 0.08
  ): TokenAllocation {
    if (contextTokens <= 0 || contextTokens > MAX_TOTAL_ALLOCATION) {
      throw new TokenBudgetError(
        `Context tokens must be between 1 and ${MAX_TOTAL_ALLOCATION}`,
        contextTokens,
        MAX_TOTAL_ALLOCATION
      );
    }

    if (systemPromptPercent <= 0 || systemPromptPercent > 0.5) {
      throw new TokenBudgetError(
        'System prompt percentage must be between 0 and 50%',
        systemPromptPercent * 100,
        50
      );
    }

    const systemBudget = Math.floor(contextTokens * systemPromptPercent);

    return {
      identity: Math.max(
        MIN_CATEGORY_ALLOCATION,
        Math.floor(systemBudget * 0.06)
      ),
      operational: Math.max(
        MIN_CATEGORY_ALLOCATION,
        Math.floor(systemBudget * 0.1)
      ),
      context: Math.max(
        MIN_CATEGORY_ALLOCATION,
        Math.floor(systemBudget * 0.5)
      ),
      reasoning: Math.max(
        MIN_CATEGORY_ALLOCATION,
        Math.floor(systemBudget * 0.15)
      ),
      meta: Math.max(MIN_CATEGORY_ALLOCATION, Math.floor(systemBudget * 0.19)),
      total: systemBudget,
    };
  }

  /**
   * Create allocation for common model context sizes
   */
  static forModel(modelName: string): TokenAllocation {
    const contextSizes: Record<string, number> = {
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
    };

    const contextSize = contextSizes[modelName] ?? 100000;
    return TokenAllocator.createForContextSize(contextSize);
  }
}
