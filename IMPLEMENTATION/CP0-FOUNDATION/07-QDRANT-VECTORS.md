# Step 07: Qdrant Vectors

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 06-PERSISTENCE-LAYER.md
> **Next Step:** 05-AGENT-FRAMEWORK.md (CP1)
> **Architecture Reference:** `ARCHITECTURE.md` - Vector Database

---

## Overview

**Qdrant Vectors** provides semantic search and embedding storage for Aigentflow. This enables intelligent context retrieval, lesson similarity matching, and RAG (Retrieval-Augmented Generation) capabilities across the agent system.

---

## Key Principles

1. **Semantic Search**: Find similar content by meaning, not keywords
2. **Multi-Collection**: Separate collections for lessons, code, and context
3. **Hybrid Search**: Combine vector similarity with metadata filtering
4. **Efficient Retrieval**: Token-budget-aware context fetching
5. **Embedding Abstraction**: Support multiple embedding providers

---

## Deliverables

1. `packages/database/src/qdrant/client.ts` - Qdrant client configuration
2. `packages/database/src/qdrant/collections.ts` - Collection definitions
3. `packages/database/src/qdrant/embeddings.ts` - Embedding generation
4. `packages/database/src/qdrant/repositories/` - Vector repositories
5. `packages/database/src/qdrant/search.ts` - Search utilities

---

## 1. Qdrant Client

### 1.1 Client Configuration

```typescript
// packages/database/src/qdrant/client.ts

import { QdrantClient } from '@qdrant/js-client-rest';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  https?: boolean;
}

let client: QdrantClient | null = null;

export function createQdrantClient(config: QdrantConfig): QdrantClient {
  if (client) {
    return client;
  }

  client = new QdrantClient({
    url: config.url,
    apiKey: config.apiKey,
    https: config.https ?? false,
  });

  return client;
}

export function getQdrantClient(): QdrantClient {
  if (!client) {
    throw new Error('Qdrant client not initialized. Call createQdrantClient() first.');
  }
  return client;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const client = getQdrantClient();
    await client.getCollections();
    return true;
  } catch (error) {
    return false;
  }
}
```

### 1.2 Collection Definitions

```typescript
// packages/database/src/qdrant/collections.ts

import { QdrantClient } from '@qdrant/js-client-rest';

export const COLLECTIONS = {
  LESSONS: 'lessons',
  CODE_CONTEXT: 'code_context',
  TASK_HISTORY: 'task_history',
  DESIGN_PATTERNS: 'design_patterns',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

// Standard embedding dimension (OpenAI text-embedding-3-small)
export const EMBEDDING_DIMENSION = 1536;

export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
  onDiskPayload?: boolean;
}

const collectionConfigs: Record<CollectionName, CollectionConfig> = {
  [COLLECTIONS.LESSONS]: {
    name: COLLECTIONS.LESSONS,
    vectorSize: EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: true,
  },
  [COLLECTIONS.CODE_CONTEXT]: {
    name: COLLECTIONS.CODE_CONTEXT,
    vectorSize: EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: true,
  },
  [COLLECTIONS.TASK_HISTORY]: {
    name: COLLECTIONS.TASK_HISTORY,
    vectorSize: EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: false,
  },
  [COLLECTIONS.DESIGN_PATTERNS]: {
    name: COLLECTIONS.DESIGN_PATTERNS,
    vectorSize: EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: true,
  },
};

export async function ensureCollections(client: QdrantClient): Promise<void> {
  const existingCollections = await client.getCollections();
  const existingNames = new Set(existingCollections.collections.map(c => c.name));

  for (const config of Object.values(collectionConfigs)) {
    if (!existingNames.has(config.name)) {
      await client.createCollection(config.name, {
        vectors: {
          size: config.vectorSize,
          distance: config.distance,
        },
        on_disk_payload: config.onDiskPayload,
      });

      // Create standard indexes
      await createStandardIndexes(client, config.name);

      console.log(`Created collection: ${config.name}`);
    }
  }
}

async function createStandardIndexes(
  client: QdrantClient,
  collectionName: string
): Promise<void> {
  // Tenant ID index for filtering
  await client.createPayloadIndex(collectionName, {
    field_name: 'tenant_id',
    field_schema: 'keyword',
  });

  // Category index for lessons
  if (collectionName === COLLECTIONS.LESSONS) {
    await client.createPayloadIndex(collectionName, {
      field_name: 'category',
      field_schema: 'keyword',
    });
    await client.createPayloadIndex(collectionName, {
      field_name: 'agent_type',
      field_schema: 'keyword',
    });
  }

  // Timestamp index for recency
  await client.createPayloadIndex(collectionName, {
    field_name: 'created_at',
    field_schema: 'datetime',
  });
}
```

---

## 2. Embedding Generation

### 2.1 Embedding Provider Interface

```typescript
// packages/database/src/qdrant/embeddings.ts

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimension: number;
}

export class OpenAIEmbeddings implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  readonly dimension = 1536;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  }
}

export class VoyageEmbeddings implements EmbeddingProvider {
  private apiKey: string;
  readonly dimension = 1024;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'voyage-code-2',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'voyage-code-2',
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  }
}

// Factory function
export function createEmbeddingProvider(
  provider: 'openai' | 'voyage',
  apiKey: string
): EmbeddingProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddings(apiKey);
    case 'voyage':
      return new VoyageEmbeddings(apiKey);
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}
```

---

## 3. Vector Repositories

### 3.1 Base Vector Repository

```typescript
// packages/database/src/qdrant/repositories/base-vector.repository.ts

import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { EmbeddingProvider } from '../embeddings';
import { CollectionName } from '../collections';

export interface VectorPoint<T = Record<string, unknown>> {
  id: string;
  content: string;
  metadata: T;
  embedding?: number[];
}

export interface SearchResult<T = Record<string, unknown>> {
  id: string;
  score: number;
  content: string;
  metadata: T;
}

export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
}

export abstract class BaseVectorRepository<T extends Record<string, unknown>> {
  constructor(
    protected client: QdrantClient,
    protected embeddings: EmbeddingProvider,
    protected collectionName: CollectionName,
    protected tenantId?: string
  ) {}

  protected getBaseFilter(): Record<string, unknown> | undefined {
    if (!this.tenantId) return undefined;

    return {
      must: [
        {
          key: 'tenant_id',
          match: { value: this.tenantId },
        },
      ],
    };
  }

  protected mergeFilters(
    additionalFilter?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    const baseFilter = this.getBaseFilter();

    if (!baseFilter && !additionalFilter) return undefined;
    if (!baseFilter) return additionalFilter;
    if (!additionalFilter) return baseFilter;

    return {
      must: [
        ...(baseFilter.must as any[]),
        ...(additionalFilter.must || [additionalFilter]),
      ],
    };
  }

  async upsert(point: VectorPoint<T>): Promise<string> {
    const id = point.id || uuidv4();
    const embedding = point.embedding || await this.embeddings.embed(point.content);

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

  async upsertBatch(points: VectorPoint<T>[]): Promise<string[]> {
    const contents = points.map(p => p.content);
    const embeddings = await this.embeddings.embedBatch(contents);

    const qdrantPoints = points.map((point, i) => ({
      id: point.id || uuidv4(),
      vector: point.embedding || embeddings[i],
      payload: {
        content: point.content,
        tenant_id: this.tenantId,
        created_at: new Date().toISOString(),
        ...point.metadata,
      },
    }));

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: qdrantPoints,
    });

    return qdrantPoints.map(p => p.id as string);
  }

  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>[]> {
    const { limit = 10, scoreThreshold = 0.7, filter } = options;

    const queryEmbedding = await this.embeddings.embed(query);
    const mergedFilter = this.mergeFilters(filter);

    const results = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit,
      score_threshold: scoreThreshold,
      filter: mergedFilter as any,
      with_payload: true,
    });

    return results.map(r => ({
      id: r.id as string,
      score: r.score,
      content: (r.payload?.content as string) || '',
      metadata: r.payload as unknown as T,
    }));
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      wait: true,
      points: [id],
    });
  }

  async deleteByFilter(filter: Record<string, unknown>): Promise<void> {
    const mergedFilter = this.mergeFilters(filter);

    await this.client.delete(this.collectionName, {
      wait: true,
      filter: mergedFilter as any,
    });
  }
}
```

### 3.2 Lesson Vector Repository

```typescript
// packages/database/src/qdrant/repositories/lesson-vector.repository.ts

import { BaseVectorRepository, VectorPoint, SearchResult, SearchOptions } from './base-vector.repository';

export interface LessonVectorMetadata {
  lesson_id: string;
  category: string;
  agent_type?: string;
  tags: string[];
  confidence: number;
  success_rate?: number;
}

export class LessonVectorRepository extends BaseVectorRepository<LessonVectorMetadata> {
  async searchByCategory(
    query: string,
    category: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [
          { key: 'category', match: { value: category } },
        ],
      },
    });
  }

  async searchByAgent(
    query: string,
    agentType: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [
          { key: 'agent_type', match: { value: agentType } },
        ],
      },
    });
  }

  async searchByTags(
    query: string,
    tags: string[],
    options: SearchOptions = {}
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        should: tags.map(tag => ({
          key: 'tags',
          match: { value: tag },
        })),
      },
    });
  }

  async findSimilarLessons(
    lessonId: string,
    limit: number = 5
  ): Promise<SearchResult<LessonVectorMetadata>[]> {
    // Get the lesson's embedding
    const points = await this.client.retrieve(this.collectionName, {
      ids: [lessonId],
      with_vector: true,
    });

    if (points.length === 0 || !points[0].vector) {
      return [];
    }

    const embedding = points[0].vector as number[];

    // Search for similar lessons, excluding the original
    const results = await this.client.search(this.collectionName, {
      vector: embedding,
      limit: limit + 1,
      filter: this.mergeFilters({
        must_not: [
          { key: 'lesson_id', match: { value: lessonId } },
        ],
      }) as any,
      with_payload: true,
    });

    return results
      .filter(r => r.id !== lessonId)
      .slice(0, limit)
      .map(r => ({
        id: r.id as string,
        score: r.score,
        content: (r.payload?.content as string) || '',
        metadata: r.payload as unknown as LessonVectorMetadata,
      }));
  }
}
```

### 3.3 Context Vector Repository

```typescript
// packages/database/src/qdrant/repositories/context-vector.repository.ts

import { BaseVectorRepository, SearchResult, SearchOptions } from './base-vector.repository';

export interface CodeContextMetadata {
  file_path: string;
  language: string;
  project_id: string;
  chunk_index: number;
  total_chunks: number;
  last_modified: string;
}

export class ContextVectorRepository extends BaseVectorRepository<CodeContextMetadata> {
  async searchInProject(
    query: string,
    projectId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<CodeContextMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [
          { key: 'project_id', match: { value: projectId } },
        ],
      },
    });
  }

  async searchByLanguage(
    query: string,
    language: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<CodeContextMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [
          { key: 'language', match: { value: language } },
        ],
      },
    });
  }

  async indexFile(
    filePath: string,
    content: string,
    metadata: Omit<CodeContextMetadata, 'chunk_index' | 'total_chunks'>
  ): Promise<string[]> {
    // Chunk the file content
    const chunks = this.chunkContent(content, 1000, 100);

    const points = chunks.map((chunk, index) => ({
      id: `${filePath}:${index}`,
      content: chunk,
      metadata: {
        ...metadata,
        file_path: filePath,
        chunk_index: index,
        total_chunks: chunks.length,
      },
    }));

    return this.upsertBatch(points);
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.deleteByFilter({
      must: [
        { key: 'file_path', match: { value: filePath } },
      ],
    });
  }

  private chunkContent(
    content: string,
    chunkSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (const line of lines) {
      currentChunk.push(line);
      currentSize += line.length + 1;

      if (currentSize >= chunkSize) {
        chunks.push(currentChunk.join('\n'));

        // Keep overlap lines
        const overlapLines = Math.ceil(overlap / (currentSize / currentChunk.length));
        currentChunk = currentChunk.slice(-overlapLines);
        currentSize = currentChunk.reduce((sum, l) => sum + l.length + 1, 0);
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }
}
```

---

## 4. Context Manager Integration

### 4.1 Token-Budget-Aware Retrieval

```typescript
// packages/database/src/qdrant/context-manager.ts

import { LessonVectorRepository, LessonVectorMetadata } from './repositories/lesson-vector.repository';
import { ContextVectorRepository, CodeContextMetadata } from './repositories/context-vector.repository';
import { SearchResult } from './repositories/base-vector.repository';

export interface ContextItem {
  type: 'lesson' | 'code' | 'history';
  content: string;
  relevance: number;
  metadata: Record<string, unknown>;
  tokens: number;
}

export interface RetrievedContext {
  items: ContextItem[];
  totalTokens: number;
  truncated: boolean;
}

export class ContextManager {
  constructor(
    private lessonRepo: LessonVectorRepository,
    private codeRepo: ContextVectorRepository,
    private tokenBudget: number = 4000
  ) {}

  async retrieveContext(
    query: string,
    options: {
      projectId?: string;
      agentType?: string;
      includeCode?: boolean;
      includeLessons?: boolean;
    } = {}
  ): Promise<RetrievedContext> {
    const {
      projectId,
      agentType,
      includeCode = true,
      includeLessons = true,
    } = options;

    const items: ContextItem[] = [];
    let totalTokens = 0;

    // Retrieve lessons
    if (includeLessons) {
      const lessonResults = agentType
        ? await this.lessonRepo.searchByAgent(query, agentType, { limit: 10 })
        : await this.lessonRepo.search(query, { limit: 10 });

      for (const result of lessonResults) {
        const tokens = this.estimateTokens(result.content);
        if (totalTokens + tokens <= this.tokenBudget * 0.5) {
          items.push({
            type: 'lesson',
            content: result.content,
            relevance: result.score,
            metadata: result.metadata,
            tokens,
          });
          totalTokens += tokens;
        }
      }
    }

    // Retrieve code context
    if (includeCode && projectId) {
      const codeResults = await this.codeRepo.searchInProject(
        query,
        projectId,
        { limit: 20 }
      );

      for (const result of codeResults) {
        const tokens = this.estimateTokens(result.content);
        if (totalTokens + tokens <= this.tokenBudget) {
          items.push({
            type: 'code',
            content: result.content,
            relevance: result.score,
            metadata: result.metadata,
            tokens,
          });
          totalTokens += tokens;
        }
      }
    }

    // Sort by relevance
    items.sort((a, b) => b.relevance - a.relevance);

    return {
      items,
      totalTokens,
      truncated: totalTokens >= this.tokenBudget,
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  formatForPrompt(context: RetrievedContext): string {
    const sections: string[] = [];

    const lessons = context.items.filter(i => i.type === 'lesson');
    if (lessons.length > 0) {
      sections.push('## Relevant Lessons\n');
      for (const lesson of lessons) {
        sections.push(`- ${lesson.content}\n`);
      }
    }

    const code = context.items.filter(i => i.type === 'code');
    if (code.length > 0) {
      sections.push('\n## Relevant Code\n');
      for (const item of code) {
        const filePath = (item.metadata as CodeContextMetadata).file_path;
        sections.push(`### ${filePath}\n\`\`\`\n${item.content}\n\`\`\`\n`);
      }
    }

    return sections.join('\n');
  }
}
```

---

## Validation Checklist

```
□ Qdrant Vectors (Step 07)
  □ Qdrant client connects
  □ Collections created with indexes
  □ OpenAI embeddings work
  □ Voyage embeddings work (optional)
  □ Lesson vector repository works
  □ Context vector repository works
  □ Similarity search returns results
  □ Tenant filtering enforced
  □ Token budget respected
  □ Context formatting works
  □ Tests pass
```

---

## Next Step

Proceed to **03a-PROMPT-ARCHITECTURE.md** to implement the meta-prompt system and prompt templates.
