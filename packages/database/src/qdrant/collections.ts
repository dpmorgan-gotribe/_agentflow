/**
 * Qdrant Collections
 *
 * Collection definitions and initialization for vector storage.
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Collection names as constants
 */
export const COLLECTIONS = {
  LESSONS: 'lessons',
  CODE_CONTEXT: 'code_context',
  TASK_HISTORY: 'task_history',
  DESIGN_PATTERNS: 'design_patterns',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/**
 * Standard embedding dimensions by provider
 */
export const EMBEDDING_DIMENSIONS = {
  OPENAI_SMALL: 1536, // text-embedding-3-small
  OPENAI_LARGE: 3072, // text-embedding-3-large
  VOYAGE_CODE: 1024, // voyage-code-2
} as const;

/**
 * Default embedding dimension
 */
export const DEFAULT_EMBEDDING_DIMENSION = EMBEDDING_DIMENSIONS.OPENAI_SMALL;

/**
 * Distance metrics
 */
export type DistanceMetric = 'Cosine' | 'Euclid' | 'Dot';

/**
 * Collection configuration
 */
export interface CollectionConfig {
  name: CollectionName;
  vectorSize: number;
  distance: DistanceMetric;
  onDiskPayload?: boolean;
}

/**
 * Collection configurations
 */
const collectionConfigs: Record<CollectionName, CollectionConfig> = {
  [COLLECTIONS.LESSONS]: {
    name: COLLECTIONS.LESSONS,
    vectorSize: DEFAULT_EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: true,
  },
  [COLLECTIONS.CODE_CONTEXT]: {
    name: COLLECTIONS.CODE_CONTEXT,
    vectorSize: DEFAULT_EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: true,
  },
  [COLLECTIONS.TASK_HISTORY]: {
    name: COLLECTIONS.TASK_HISTORY,
    vectorSize: DEFAULT_EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: false,
  },
  [COLLECTIONS.DESIGN_PATTERNS]: {
    name: COLLECTIONS.DESIGN_PATTERNS,
    vectorSize: DEFAULT_EMBEDDING_DIMENSION,
    distance: 'Cosine',
    onDiskPayload: true,
  },
};

/**
 * Get collection configuration
 */
export function getCollectionConfig(name: CollectionName): CollectionConfig {
  return collectionConfigs[name];
}

/**
 * Ensure all collections exist with proper indexes
 *
 * @param client - Qdrant client
 * @param dimension - Optional custom embedding dimension
 */
export async function ensureCollections(
  client: QdrantClient,
  dimension: number = DEFAULT_EMBEDDING_DIMENSION
): Promise<void> {
  const existingCollections = await client.getCollections();
  const existingNames = new Set(
    existingCollections.collections.map((c) => c.name)
  );

  for (const config of Object.values(collectionConfigs)) {
    if (!existingNames.has(config.name)) {
      await client.createCollection(config.name, {
        vectors: {
          size: dimension,
          distance: config.distance,
        },
        on_disk_payload: config.onDiskPayload,
      });

      // Create standard indexes for the collection
      await createStandardIndexes(client, config.name);
    }
  }
}

/**
 * Create standard indexes for a collection
 */
async function createStandardIndexes(
  client: QdrantClient,
  collectionName: CollectionName
): Promise<void> {
  // Tenant ID index for multi-tenant filtering
  await client.createPayloadIndex(collectionName, {
    field_name: 'tenant_id',
    field_schema: 'keyword',
  });

  // Created timestamp index for recency queries
  await client.createPayloadIndex(collectionName, {
    field_name: 'created_at',
    field_schema: 'datetime',
  });

  // Collection-specific indexes
  switch (collectionName) {
    case COLLECTIONS.LESSONS:
      await client.createPayloadIndex(collectionName, {
        field_name: 'category',
        field_schema: 'keyword',
      });
      await client.createPayloadIndex(collectionName, {
        field_name: 'agent_type',
        field_schema: 'keyword',
      });
      await client.createPayloadIndex(collectionName, {
        field_name: 'severity',
        field_schema: 'keyword',
      });
      break;

    case COLLECTIONS.CODE_CONTEXT:
      await client.createPayloadIndex(collectionName, {
        field_name: 'project_id',
        field_schema: 'keyword',
      });
      await client.createPayloadIndex(collectionName, {
        field_name: 'language',
        field_schema: 'keyword',
      });
      await client.createPayloadIndex(collectionName, {
        field_name: 'file_path',
        field_schema: 'keyword',
      });
      break;

    case COLLECTIONS.TASK_HISTORY:
      await client.createPayloadIndex(collectionName, {
        field_name: 'task_id',
        field_schema: 'keyword',
      });
      await client.createPayloadIndex(collectionName, {
        field_name: 'status',
        field_schema: 'keyword',
      });
      break;

    case COLLECTIONS.DESIGN_PATTERNS:
      await client.createPayloadIndex(collectionName, {
        field_name: 'pattern_type',
        field_schema: 'keyword',
      });
      await client.createPayloadIndex(collectionName, {
        field_name: 'language',
        field_schema: 'keyword',
      });
      break;
  }
}

/**
 * Delete a collection
 */
export async function deleteCollection(
  client: QdrantClient,
  name: CollectionName
): Promise<void> {
  await client.deleteCollection(name);
}

/**
 * Get collection info
 */
export async function getCollectionInfo(
  client: QdrantClient,
  name: CollectionName
): Promise<{
  pointsCount: number;
  vectorsCount: number;
  indexedVectorsCount: number;
}> {
  const info = await client.getCollection(name);

  return {
    pointsCount: info.points_count ?? 0,
    vectorsCount: info.points_count ?? 0, // Qdrant API uses points_count
    indexedVectorsCount: info.indexed_vectors_count ?? 0,
  };
}
