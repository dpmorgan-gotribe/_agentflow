/**
 * Vector Repositories Index
 *
 * Aggregated exports for vector repositories.
 */

export {
  BaseVectorRepository,
  type VectorPoint,
  type SearchResult,
  type SearchOptions,
} from './base-vector.repository.js';

export {
  LessonVectorRepository,
  type LessonVectorMetadata,
} from './lesson-vector.repository.js';

export {
  ContextVectorRepository,
  type CodeContextMetadata,
  type ChunkOptions,
} from './context-vector.repository.js';
