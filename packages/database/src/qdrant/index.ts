/**
 * Qdrant Vector Database Module
 *
 * Provides semantic search and embedding storage capabilities.
 */

// Client
export {
  createQdrantClient,
  getQdrantClient,
  isQdrantHealthy,
  closeQdrantClient,
  getQdrantConnectionInfo,
  QdrantConfigSchema,
  type QdrantConfig,
  type QdrantEnvConfig,
} from './client.js';

// Collections
export {
  COLLECTIONS,
  EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_DIMENSION,
  ensureCollections,
  deleteCollection,
  getCollectionConfig,
  getCollectionInfo,
  type CollectionName,
  type CollectionConfig,
  type DistanceMetric,
} from './collections.js';

// Embeddings
export {
  OpenAIEmbeddings,
  VoyageEmbeddings,
  MockEmbeddings,
  createEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingProviderType,
  type EmbeddingProviderConfig,
} from './embeddings.js';

// Repositories
export {
  BaseVectorRepository,
  LessonVectorRepository,
  ContextVectorRepository,
  type VectorPoint,
  type SearchResult,
  type SearchOptions,
  type LessonVectorMetadata,
  type CodeContextMetadata,
  type ChunkOptions,
} from './repositories/index.js';

// Context Manager
export {
  ContextManager,
  type ContextItem,
  type ContextItemType,
  type RetrievedContext,
  type ContextRetrievalOptions,
} from './context-manager.js';
