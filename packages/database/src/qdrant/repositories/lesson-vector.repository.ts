/**
 * Lesson Vector Repository
 *
 * Vector repository for lesson semantic search and similarity.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import {
  BaseVectorRepository,
  VectorPoint,
  SearchResult,
  SearchOptions,
} from './base-vector.repository.js';
import { EmbeddingProvider } from '../embeddings.js';
import { COLLECTIONS } from '../collections.js';

/**
 * Lesson vector metadata
 */
export interface LessonVectorMetadata {
  lesson_id: string;
  category: string;
  severity?: string;
  agent_type?: string;
  tags: string[];
  relevance_score: number;
  times_applied?: number;
  [key: string]: unknown;
}

/**
 * Lesson vector repository for semantic lesson search
 */
export class LessonVectorRepository extends BaseVectorRepository<LessonVectorMetadata> {
  constructor(
    client: QdrantClient,
    embeddings: EmbeddingProvider,
    tenantId?: string
  ) {
    super(client, embeddings, COLLECTIONS.LESSONS, tenantId);
  }

  /**
   * Index a lesson for semantic search
   */
  async indexLesson(
    lessonId: string,
    content: string,
    metadata: Omit<LessonVectorMetadata, 'lesson_id'>
  ): Promise<string> {
    return this.upsert({
      id: lessonId,
      content,
      metadata: {
        lesson_id: lessonId,
        ...metadata,
      } as LessonVectorMetadata,
    });
  }

  /**
   * Search lessons by semantic similarity
   */
  async searchLessons(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    return this.search(query, {
      limit: options.limit ?? 10,
      scoreThreshold: options.scoreThreshold ?? 0.6,
      filter: options.filter,
    });
  }

  /**
   * Search lessons by category
   */
  async searchByCategory(
    query: string,
    category: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [{ key: 'category', match: { value: category } }],
      },
    });
  }

  /**
   * Search lessons by severity
   */
  async searchBySeverity(
    query: string,
    severity: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [{ key: 'severity', match: { value: severity } }],
      },
    });
  }

  /**
   * Search lessons by agent type
   */
  async searchByAgentType(
    query: string,
    agentType: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [{ key: 'agent_type', match: { value: agentType } }],
      },
    });
  }

  /**
   * Search lessons by tags (any match)
   */
  async searchByTags(
    query: string,
    tags: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    if (tags.length === 0) {
      return this.search(query, options);
    }

    return this.search(query, {
      ...options,
      filter: {
        should: tags.map((tag) => ({
          key: 'tags',
          match: { value: tag },
        })),
      },
    });
  }

  /**
   * Find similar lessons to a given lesson
   */
  async findSimilarLessons(
    lessonId: string,
    limit: number = 5
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    // Get the lesson's embedding
    const points = await this.client.retrieve(this.collectionName, {
      ids: [lessonId],
      with_vector: true,
    });

    const point = points[0];
    if (!point || !point.vector) {
      return [];
    }

    const embedding = point.vector as number[];

    // Search for similar lessons, excluding the original
    const results = await this.searchByVector(embedding, {
      limit: limit + 1,
      scoreThreshold: 0.5,
      filter: {
        must_not: [{ key: 'lesson_id', match: { value: lessonId } }],
      },
    });

    return results.filter((r) => r.metadata.lesson_id !== lessonId).slice(0, limit);
  }

  /**
   * Get lessons most relevant for a given context
   */
  async getRelevantLessons(
    query: string,
    context: {
      category?: string;
      agentType?: string;
      minRelevanceScore?: number;
    },
    limit: number = 5
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    const filters: Array<{ key: string; match: { value: string | number } }> =
      [];

    if (context.category) {
      filters.push({ key: 'category', match: { value: context.category } });
    }

    if (context.agentType) {
      filters.push({ key: 'agent_type', match: { value: context.agentType } });
    }

    if (context.minRelevanceScore !== undefined) {
      filters.push({
        key: 'relevance_score',
        match: { value: context.minRelevanceScore },
      });
    }

    const filter = filters.length > 0 ? { must: filters } : undefined;

    return this.search(query, {
      limit,
      scoreThreshold: 0.6,
      filter,
    });
  }

  /**
   * Delete lesson vector by lesson ID
   */
  async deleteLessonVector(lessonId: string): Promise<void> {
    await this.delete(lessonId);
  }

  /**
   * Sync lesson from database to vector store
   */
  async syncLesson(
    lessonId: string,
    title: string,
    summary: string,
    metadata: Omit<LessonVectorMetadata, 'lesson_id'>
  ): Promise<string> {
    // Combine title and summary for embedding
    const content = `${title}\n\n${summary}`;

    return this.indexLesson(lessonId, content, metadata);
  }
}
