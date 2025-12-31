/**
 * Base Vector Repository
 *
 * Abstract base class for vector repositories with tenant isolation.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { EmbeddingProvider } from '../embeddings.js';
import { CollectionName } from '../collections.js';

/**
 * Vector point to upsert
 */
export interface VectorPoint<T = Record<string, unknown>> {
  id?: string;
  content: string;
  metadata: T;
  embedding?: number[];
}

/**
 * Search result from vector query
 */
export interface SearchResult<T = Record<string, unknown>> {
  id: string;
  score: number;
  content: string;
  metadata: T;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
}

/**
 * Qdrant filter condition
 */
interface QdrantFilter {
  must?: Array<{
    key: string;
    match?: { value: string | number | boolean };
    range?: { gte?: number; lte?: number; gt?: number; lt?: number };
  }>;
  must_not?: Array<{
    key: string;
    match?: { value: string | number | boolean };
  }>;
  should?: Array<{
    key: string;
    match?: { value: string | number | boolean };
  }>;
}

/**
 * Abstract base repository for vector operations with tenant isolation
 */
export abstract class BaseVectorRepository<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  constructor(
    protected readonly client: QdrantClient,
    protected readonly embeddings: EmbeddingProvider,
    protected readonly collectionName: CollectionName,
    protected readonly tenantId?: string
  ) {
    // Validate tenantId if provided
    if (tenantId && !uuidValidate(tenantId)) {
      throw new Error('Invalid tenant ID format');
    }
  }

  /**
   * Get base filter for tenant isolation
   */
  protected getBaseFilter(): QdrantFilter | undefined {
    if (!this.tenantId) {
      return undefined;
    }

    return {
      must: [
        {
          key: 'tenant_id',
          match: { value: this.tenantId },
        },
      ],
    };
  }

  /**
   * Merge additional filter with base tenant filter
   */
  protected mergeFilters(
    additionalFilter?: Record<string, unknown>
  ): QdrantFilter | undefined {
    const baseFilter = this.getBaseFilter();

    if (!baseFilter && !additionalFilter) {
      return undefined;
    }

    if (!baseFilter) {
      return additionalFilter as QdrantFilter;
    }

    if (!additionalFilter) {
      return baseFilter;
    }

    const additional = additionalFilter as QdrantFilter;

    return {
      must: [
        ...(baseFilter.must || []),
        ...(additional.must || []),
      ],
      must_not: additional.must_not,
      should: additional.should,
    };
  }

  /**
   * Upsert a single vector point
   */
  async upsert(point: VectorPoint<T>): Promise<string> {
    const id = point.id || uuidv4();

    // Validate ID format
    if (!uuidValidate(id)) {
      throw new Error('Invalid point ID format');
    }

    // Generate embedding if not provided
    const embedding =
      point.embedding || (await this.embeddings.embed(point.content));

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: [
        {
          id,
          vector: embedding,
          payload: {
            content: point.content,
            tenant_id: this.tenantId,
            created_at: new Date().toISOString(),
            ...point.metadata,
          },
        },
      ],
    });

    return id;
  }

  /**
   * Upsert multiple vector points
   */
  async upsertBatch(points: VectorPoint<T>[]): Promise<string[]> {
    if (points.length === 0) {
      return [];
    }

    // Generate embeddings for all points
    const contents = points.map((p) => p.content);
    const embeddings = await this.embeddings.embedBatch(contents);

    const qdrantPoints = points.map((point, i) => {
      const id = point.id || uuidv4();

      // Validate ID format
      if (!uuidValidate(id)) {
        throw new Error(`Invalid point ID format at index ${i}`);
      }

      const embedding = point.embedding || embeddings[i];
      if (!embedding) {
        throw new Error(`Failed to generate embedding at index ${i}`);
      }

      return {
        id,
        vector: embedding,
        payload: {
          content: point.content,
          tenant_id: this.tenantId,
          created_at: new Date().toISOString(),
          ...point.metadata,
        },
      };
    });

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: qdrantPoints,
    });

    return qdrantPoints.map((p) => p.id as string);
  }

  /**
   * Search for similar vectors
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    const { limit = 10, scoreThreshold = 0.7, filter } = options;

    // Generate query embedding
    const queryEmbedding = await this.embeddings.embed(query);

    // Merge tenant filter with additional filter
    const mergedFilter = this.mergeFilters(filter);

    const results = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit,
      score_threshold: scoreThreshold,
      filter: mergedFilter as Record<string, unknown>,
      with_payload: true,
    });

    return results.map((r) => ({
      id: r.id as string,
      score: r.score,
      content: (r.payload?.['content'] as string) || '',
      metadata: r.payload as unknown as T,
    }));
  }

  /**
   * Search by embedding vector directly
   */
  async searchByVector(
    embedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    const { limit = 10, scoreThreshold = 0.7, filter } = options;

    const mergedFilter = this.mergeFilters(filter);

    const results = await this.client.search(this.collectionName, {
      vector: embedding,
      limit,
      score_threshold: scoreThreshold,
      filter: mergedFilter as Record<string, unknown>,
      with_payload: true,
    });

    return results.map((r) => ({
      id: r.id as string,
      score: r.score,
      content: (r.payload?.['content'] as string) || '',
      metadata: r.payload as unknown as T,
    }));
  }

  /**
   * Get a point by ID
   */
  async getById(id: string): Promise<SearchResult<T> | undefined> {
    if (!uuidValidate(id)) {
      throw new Error('Invalid point ID format');
    }

    const results = await this.client.retrieve(this.collectionName, {
      ids: [id],
      with_payload: true,
      with_vector: false,
    });

    const point = results[0];
    if (!point) {
      return undefined;
    }

    // Enforce tenant isolation
    if (
      this.tenantId &&
      point.payload?.['tenant_id'] !== this.tenantId
    ) {
      return undefined;
    }

    return {
      id: point.id as string,
      score: 1.0, // Direct retrieval, full match
      content: (point.payload?.['content'] as string) || '',
      metadata: point.payload as unknown as T,
    };
  }

  /**
   * Delete a point by ID
   */
  async delete(id: string): Promise<void> {
    if (!uuidValidate(id)) {
      throw new Error('Invalid point ID format');
    }

    // Check tenant isolation before delete
    if (this.tenantId) {
      const existing = await this.getById(id);
      if (!existing) {
        return; // Not found or not owned by tenant
      }
    }

    await this.client.delete(this.collectionName, {
      wait: true,
      points: [id],
    });
  }

  /**
   * Delete points by filter
   */
  async deleteByFilter(filter: Record<string, unknown>): Promise<void> {
    const mergedFilter = this.mergeFilters(filter);

    if (!mergedFilter) {
      throw new Error('Filter is required for bulk delete');
    }

    await this.client.delete(this.collectionName, {
      wait: true,
      filter: mergedFilter as Record<string, unknown>,
    });
  }

  /**
   * Count points matching filter
   */
  async count(filter?: Record<string, unknown>): Promise<number> {
    const mergedFilter = this.mergeFilters(filter);

    const result = await this.client.count(this.collectionName, {
      filter: mergedFilter as Record<string, unknown>,
      exact: true,
    });

    return result.count;
  }
}
