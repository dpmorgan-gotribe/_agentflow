/**
 * Qdrant Client
 *
 * Singleton Qdrant vector database client with configuration validation.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { z } from 'zod';

/**
 * Qdrant configuration schema
 */
export const QdrantConfigSchema = z.object({
  url: z
    .string()
    .min(1, 'QDRANT_URL is required')
    .refine(
      (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'QDRANT_URL must be a valid URL' }
    ),
  apiKey: z.string().optional(),
  https: z.boolean().default(false),
});

export type QdrantConfig = z.infer<typeof QdrantConfigSchema>;

/**
 * Validated Qdrant configuration from environment
 */
export interface QdrantEnvConfig {
  url: string;
  apiKey?: string;
  https?: boolean;
}

/**
 * Module-level singleton instance
 */
let client: QdrantClient | null = null;
let clientConfig: QdrantConfig | null = null;

/**
 * Create and configure the Qdrant client
 *
 * @param config - Qdrant configuration
 * @returns Configured Qdrant client
 * @throws Error if configuration is invalid
 */
export function createQdrantClient(config: QdrantEnvConfig): QdrantClient {
  // Validate configuration
  const validatedConfig = QdrantConfigSchema.parse(config);

  // Return existing client if config matches
  if (
    client &&
    clientConfig &&
    clientConfig.url === validatedConfig.url &&
    clientConfig.apiKey === validatedConfig.apiKey
  ) {
    return client;
  }

  // Determine if HTTPS should be used
  const parsedUrl = new URL(validatedConfig.url);
  const useHttps =
    validatedConfig.https ?? parsedUrl.protocol === 'https:';

  // Create new client
  client = new QdrantClient({
    url: validatedConfig.url,
    apiKey: validatedConfig.apiKey,
    https: useHttps,
  });

  clientConfig = validatedConfig;

  return client;
}

/**
 * Get the current Qdrant client instance
 *
 * @returns Qdrant client
 * @throws Error if client not initialized
 */
export function getQdrantClient(): QdrantClient {
  if (!client) {
    throw new Error(
      'Qdrant client not initialized. Call createQdrantClient() first.'
    );
  }
  return client;
}

/**
 * Check if Qdrant is healthy and reachable
 *
 * @returns true if healthy, false otherwise
 */
export async function isQdrantHealthy(): Promise<boolean> {
  try {
    const qdrant = getQdrantClient();
    await qdrant.getCollections();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the Qdrant client connection
 * Note: Qdrant JS client doesn't have explicit close, but we clear the instance
 */
export function closeQdrantClient(): void {
  client = null;
  clientConfig = null;
}

/**
 * Get Qdrant connection info (sanitized, no API key)
 */
export function getQdrantConnectionInfo(): { url: string; https: boolean } | null {
  if (!clientConfig) {
    return null;
  }

  return {
    url: clientConfig.url,
    https: clientConfig.https,
  };
}
