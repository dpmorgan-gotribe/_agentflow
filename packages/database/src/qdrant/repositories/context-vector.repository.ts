/**
 * Context Vector Repository
 *
 * Vector repository for code context semantic search.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import {
  BaseVectorRepository,
  SearchResult,
  SearchOptions,
} from './base-vector.repository.js';
import { EmbeddingProvider } from '../embeddings.js';
import { COLLECTIONS } from '../collections.js';

/**
 * Code context vector metadata
 */
export interface CodeContextMetadata {
  file_path: string;
  language: string;
  project_id: string;
  chunk_index: number;
  total_chunks: number;
  last_modified: string;
  line_start?: number;
  line_end?: number;
  [key: string]: unknown;
}

/**
 * Chunking options
 */
export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * Context vector repository for code semantic search
 */
export class ContextVectorRepository extends BaseVectorRepository<CodeContextMetadata> {
  constructor(
    client: QdrantClient,
    embeddings: EmbeddingProvider,
    tenantId?: string
  ) {
    super(client, embeddings, COLLECTIONS.CODE_CONTEXT, tenantId);
  }

  /**
   * Search code context by semantic similarity
   */
  async searchCode(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<CodeContextMetadata>[]> {
    return this.search(query, {
      limit: options.limit ?? 10,
      scoreThreshold: options.scoreThreshold ?? 0.6,
      filter: options.filter,
    });
  }

  /**
   * Search code within a specific project
   */
  async searchInProject(
    query: string,
    projectId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<CodeContextMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [{ key: 'project_id', match: { value: projectId } }],
      },
    });
  }

  /**
   * Search code by programming language
   */
  async searchByLanguage(
    query: string,
    language: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<CodeContextMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [{ key: 'language', match: { value: language } }],
      },
    });
  }

  /**
   * Search code in a specific file
   */
  async searchInFile(
    query: string,
    filePath: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<CodeContextMetadata>[]> {
    return this.search(query, {
      ...options,
      filter: {
        must: [{ key: 'file_path', match: { value: filePath } }],
      },
    });
  }

  /**
   * Index a file for semantic search with automatic chunking
   */
  async indexFile(
    filePath: string,
    content: string,
    metadata: Omit<
      CodeContextMetadata,
      'file_path' | 'chunk_index' | 'total_chunks'
    >,
    chunkOptions: ChunkOptions = {}
  ): Promise<string[]> {
    const { chunkSize = 1000, overlap = 100 } = chunkOptions;

    // Chunk the file content
    const chunks = this.chunkContent(content, chunkSize, overlap);

    if (chunks.length === 0) {
      return [];
    }

    // Create points for each chunk
    const points = chunks.map((chunk, index) => ({
      id: this.generateChunkId(filePath, index),
      content: chunk.content,
      metadata: {
        ...metadata,
        file_path: filePath,
        chunk_index: index,
        total_chunks: chunks.length,
        line_start: chunk.lineStart,
        line_end: chunk.lineEnd,
      } as CodeContextMetadata,
    }));

    return this.upsertBatch(points);
  }

  /**
   * Delete all chunks for a file
   */
  async deleteFile(filePath: string): Promise<void> {
    await this.deleteByFilter({
      must: [{ key: 'file_path', match: { value: filePath } }],
    });
  }

  /**
   * Delete all code context for a project
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.deleteByFilter({
      must: [{ key: 'project_id', match: { value: projectId } }],
    });
  }

  /**
   * Update a file (delete old chunks and re-index)
   */
  async updateFile(
    filePath: string,
    content: string,
    metadata: Omit<
      CodeContextMetadata,
      'file_path' | 'chunk_index' | 'total_chunks'
    >,
    chunkOptions: ChunkOptions = {}
  ): Promise<string[]> {
    // Delete existing chunks
    await this.deleteFile(filePath);

    // Re-index the file
    return this.indexFile(filePath, content, metadata, chunkOptions);
  }

  /**
   * Get all chunks for a file
   */
  async getFileChunks(
    filePath: string
  ): Promise<SearchResult<CodeContextMetadata>[]> {
    // Use a high limit to get all chunks
    const results = await this.search('', {
      limit: 1000,
      scoreThreshold: 0,
      filter: {
        must: [{ key: 'file_path', match: { value: filePath } }],
      },
    });

    // Sort by chunk index
    return results.sort(
      (a, b) => a.metadata.chunk_index - b.metadata.chunk_index
    );
  }

  /**
   * Chunk content into overlapping segments
   */
  private chunkContent(
    content: string,
    chunkSize: number,
    overlap: number
  ): Array<{ content: string; lineStart: number; lineEnd: number }> {
    const chunks: Array<{
      content: string;
      lineStart: number;
      lineEnd: number;
    }> = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentSize = 0;
    let chunkStartLine = 0;
    let currentLine = 0;

    for (const line of lines) {
      currentChunk.push(line);
      currentSize += line.length + 1; // +1 for newline
      currentLine++;

      if (currentSize >= chunkSize) {
        chunks.push({
          content: currentChunk.join('\n'),
          lineStart: chunkStartLine,
          lineEnd: currentLine - 1,
        });

        // Calculate overlap in lines
        const avgLineLength = currentSize / currentChunk.length;
        const overlapLines = Math.max(
          1,
          Math.ceil(overlap / avgLineLength)
        );

        // Keep overlap lines for next chunk
        currentChunk = currentChunk.slice(-overlapLines);
        chunkStartLine = currentLine - overlapLines;
        currentSize = currentChunk.reduce(
          (sum, l) => sum + l.length + 1,
          0
        );
      }
    }

    // Add remaining content as final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        lineStart: chunkStartLine,
        lineEnd: currentLine - 1,
      });
    }

    return chunks;
  }

  /**
   * Generate a deterministic chunk ID
   */
  private generateChunkId(filePath: string, chunkIndex: number): string {
    // Create a deterministic ID based on file path and chunk index
    // This allows idempotent updates
    const hash = this.hashString(`${filePath}:${chunkIndex}`);
    return `${hash.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
