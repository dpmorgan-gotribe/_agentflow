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

// Context Manager (Basic)
export {
  ContextManager,
  type ContextItem,
  type ContextItemType,
  type RetrievedContext,
  type ContextRetrievalOptions,
} from './context-manager.js';

// Enhanced Context Manager
export {
  EnhancedContextManager,
  createEnhancedContextManager,
  ContextRequestSchema,
  type ContextRequest,
  type EnhancedRetrievedContext,
  type AgentContextConfig,
} from './enhanced-context-manager.js';

// Retrievers
export {
  HistoryRetriever,
  createHistoryRetriever,
  HistoryRetrieveOptionsSchema,
  type HistoryItem,
  type HistoryRetrieveOptions,
  type TaskProvider,
} from './retrievers/index.js';

// Rankers
export {
  RelevanceRanker,
  createRelevanceRanker,
  RankerConfigSchema,
  type RankedContextItem,
  type RankerConfig,
} from './rankers/index.js';

// Cache
export {
  ContextCache,
  createContextCache,
  CacheConfigSchema,
  type CacheConfig,
  type CacheStats,
} from './cache.js';

// Formatters
export {
  ContextFormatter,
  createContextFormatter,
  type FormatOptions,
  type StructuredContext,
} from './formatters/index.js';
