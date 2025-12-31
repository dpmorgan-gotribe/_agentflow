/**
 * Relevance Ranker
 *
 * Multi-factor relevance ranking for context items.
 * Considers item type, agent affinity, recency, and confidence.
 *
 * Security:
 * - Bounded weight values
 * - No external input used in calculations
 */

import { z } from 'zod';
import type { ContextItem } from '../context-manager.js';

/**
 * Extended context item with ranking metadata
 */
export interface RankedContextItem extends ContextItem {
  originalRelevance: number;
  rankingFactors: {
    typeWeight: number;
    agentAffinity: number;
    recencyBoost: number;
    confidenceBoost: number;
    finalScore: number;
  };
}

/**
 * Ranker configuration schema
 */
export const RankerConfigSchema = z.object({
  typeWeights: z
    .object({
      lesson: z.number().min(0).max(2).default(1.2),
      code: z.number().min(0).max(2).default(1.0),
      history: z.number().min(0).max(2).default(0.8),
      artifact: z.number().min(0).max(2).default(0.9),
    })
    .default({}),
  recencyDecayDays: z.number().min(1).max(365).default(30),
  minScore: z.number().min(0).max(1).default(0.1),
});

export type RankerConfig = z.infer<typeof RankerConfigSchema>;

/**
 * Default type weights - lessons are valued highest
 */
const DEFAULT_TYPE_WEIGHTS: Record<string, number> = {
  lesson: 1.2, // Lessons are highly valuable
  code: 1.0, // Code is directly relevant
  history: 0.8, // History provides context
  artifact: 0.9, // Artifacts from current task
};

/**
 * Agent type affinity matrix
 * Maps agent types to their preference multipliers for each context type
 */
const AGENT_TYPE_AFFINITY: Record<string, Record<string, number>> = {
  orchestrator: {
    lesson: 1.3,
    code: 0.5,
    history: 1.2,
    artifact: 0.8,
  },
  project_manager: {
    lesson: 1.2,
    code: 0.4,
    history: 1.3,
    artifact: 0.6,
  },
  architect: {
    lesson: 1.2,
    code: 1.2,
    history: 1.0,
    artifact: 1.0,
  },
  analyst: {
    lesson: 1.4,
    code: 0.6,
    history: 1.0,
    artifact: 0.8,
  },
  ui_designer: {
    lesson: 1.1,
    code: 0.6,
    history: 0.7,
    artifact: 1.2,
  },
  frontend_dev: {
    lesson: 1.0,
    code: 1.5,
    history: 1.0,
    artifact: 1.1,
  },
  backend_dev: {
    lesson: 1.0,
    code: 1.5,
    history: 1.0,
    artifact: 1.1,
  },
  tester: {
    lesson: 1.1,
    code: 1.3,
    history: 1.2,
    artifact: 1.0,
  },
  reviewer: {
    lesson: 1.2,
    code: 1.4,
    history: 1.0,
    artifact: 1.0,
  },
  compliance: {
    lesson: 1.5,
    code: 1.0,
    history: 0.8,
    artifact: 0.9,
  },
};

/**
 * Default agent affinity (no preference)
 */
const DEFAULT_AGENT_AFFINITY: Record<string, number> = {
  lesson: 1.0,
  code: 1.0,
  history: 1.0,
  artifact: 1.0,
};

/**
 * Relevance ranker for context items
 */
export class RelevanceRanker {
  private readonly config: Required<RankerConfig>;
  private readonly typeWeights: Record<string, number>;

  constructor(config: Partial<RankerConfig> = {}) {
    this.config = RankerConfigSchema.parse(config) as Required<RankerConfig>;
    this.typeWeights = {
      ...DEFAULT_TYPE_WEIGHTS,
      ...this.config.typeWeights,
    };
  }

  /**
   * Rank context items by relevance
   */
  rank(
    items: ContextItem[],
    _query: string,
    agentType?: string
  ): ContextItem[] {
    const agentAffinity = agentType
      ? AGENT_TYPE_AFFINITY[agentType] || DEFAULT_AGENT_AFFINITY
      : DEFAULT_AGENT_AFFINITY;

    // Calculate scores for all items
    const scoredItems = items.map((item) =>
      this.calculateRankedItem(item, agentAffinity)
    );

    // Sort by final score descending
    scoredItems.sort(
      (a, b) => b.rankingFactors.finalScore - a.rankingFactors.finalScore
    );

    // Filter by minimum score and return as ContextItem
    return scoredItems
      .filter((item) => item.rankingFactors.finalScore >= this.config.minScore)
      .map((item) => ({
        ...item,
        relevance: item.rankingFactors.finalScore,
      }));
  }

  /**
   * Calculate ranked item with all factors
   */
  private calculateRankedItem(
    item: ContextItem,
    agentAffinity: Record<string, number>
  ): RankedContextItem {
    const typeWeight = this.typeWeights[item.type] || 1.0;
    const affinity = agentAffinity[item.type] || 1.0;
    const recencyBoost = this.calculateRecencyBoost(item);
    const confidenceBoost = this.calculateConfidenceBoost(item);

    // Combined score with weighted factors
    const finalScore =
      item.relevance *
      typeWeight *
      affinity *
      (1 + recencyBoost * 0.2) *
      (1 + confidenceBoost * 0.1);

    return {
      ...item,
      originalRelevance: item.relevance,
      rankingFactors: {
        typeWeight,
        agentAffinity: affinity,
        recencyBoost,
        confidenceBoost,
        finalScore: Math.min(1, Math.max(0, finalScore)), // Clamp to [0, 1]
      },
    };
  }

  /**
   * Calculate recency boost based on creation time
   */
  private calculateRecencyBoost(item: ContextItem): number {
    const createdAt = item.metadata['createdAt'] || item.metadata['last_modified'];

    if (!createdAt) {
      return 0;
    }

    const date =
      typeof createdAt === 'string' ? new Date(createdAt) : (createdAt as Date);

    if (isNaN(date.getTime())) {
      return 0;
    }

    const ageMs = Date.now() - date.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Exponential decay with configurable half-life
    return Math.exp(-ageDays / this.config.recencyDecayDays);
  }

  /**
   * Calculate confidence boost for lessons
   */
  private calculateConfidenceBoost(item: ContextItem): number {
    if (item.type !== 'lesson') {
      return 0;
    }

    const confidence = item.metadata['confidence'];
    const successRate = item.metadata['success_rate'] || item.metadata['successRate'];
    const timesApplied = item.metadata['times_applied'] || item.metadata['timesApplied'];

    let boost = 0;

    // Confidence factor
    if (typeof confidence === 'number') {
      boost += (confidence - 0.5) * 0.5; // Scale confidence above 0.5
    }

    // Success rate factor
    if (typeof successRate === 'number') {
      boost += (successRate - 0.5) * 0.3; // Scale success rate above 0.5
    }

    // Times applied factor (logarithmic)
    if (typeof timesApplied === 'number' && timesApplied > 0) {
      boost += Math.log10(timesApplied + 1) * 0.1;
    }

    return Math.max(0, boost);
  }

  /**
   * Get agent-specific type preferences
   */
  getAgentPreferences(agentType: string): Record<string, number> {
    return AGENT_TYPE_AFFINITY[agentType] || DEFAULT_AGENT_AFFINITY;
  }

  /**
   * Get available agent types
   */
  getAvailableAgentTypes(): string[] {
    return Object.keys(AGENT_TYPE_AFFINITY);
  }
}

/**
 * Create a relevance ranker
 */
export function createRelevanceRanker(
  config?: Partial<RankerConfig>
): RelevanceRanker {
  return new RelevanceRanker(config);
}
