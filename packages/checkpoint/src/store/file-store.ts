/**
 * File-based Checkpoint Store
 *
 * Persistence layer for checkpoints with security hardening.
 * Includes path validation, compression, and size limits.
 */

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import type {
  Checkpoint,
  CheckpointStoreConfig,
  CheckpointIndexEntry,
  CheckpointStoreStats,
} from '../types.js';
import { CheckpointSchema, CHECKPOINT_LIMITS } from '../types.js';
import {
  CheckpointStoreError,
  CheckpointPathError,
  CheckpointSizeError,
  CheckpointCorruptionError,
  CompressionError,
} from '../errors.js';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Default store configuration
 */
export const DEFAULT_STORE_CONFIG: CheckpointStoreConfig = {
  basePath: '.checkpoints',
  compression: true,
  indexEnabled: true,
  maxCheckpointSize: CHECKPOINT_LIMITS.maxCheckpointSize,
  maxDecompressedSize: CHECKPOINT_LIMITS.maxDecompressedSize,
};

/**
 * File-based Checkpoint Store
 */
export class FileCheckpointStore {
  private readonly config: CheckpointStoreConfig;
  private readonly indexPath: string;
  private index: Map<string, CheckpointIndexEntry> = new Map();

  constructor(config: Partial<CheckpointStoreConfig> = {}) {
    this.config = { ...DEFAULT_STORE_CONFIG, ...config };
    this.indexPath = path.join(this.config.basePath, 'index.json');
  }

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    try {
      // Create directory with restricted permissions (owner only)
      await fsPromises.mkdir(this.config.basePath, {
        recursive: true,
        mode: 0o700,
      });

      // Verify directory permissions
      const stats = await fsPromises.stat(this.config.basePath);
      if (!stats.isDirectory()) {
        throw new CheckpointStoreError(
          'Checkpoint path is not a directory',
          'initialize'
        );
      }

      // Load index if enabled
      if (this.config.indexEnabled) {
        await this.loadIndex();
      }
    } catch (error) {
      if (error instanceof CheckpointStoreError) {
        throw error;
      }
      throw new CheckpointStoreError(
        `Failed to initialize checkpoint store: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'initialize',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate checkpoint ID is a valid UUID v4
   */
  private validateCheckpointId(id: string): void {
    if (!UUID_REGEX.test(id)) {
      throw new CheckpointPathError(
        `Invalid checkpoint ID format: ${id}`,
        id,
        'invalid_id'
      );
    }
  }

  /**
   * Validate path is within base directory (prevent path traversal)
   */
  private validatePath(filePath: string): string {
    const normalizedBase = path.resolve(this.config.basePath);
    const normalizedPath = path.resolve(filePath);

    // Check path is within base directory
    const relativePath = path.relative(normalizedBase, normalizedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new CheckpointPathError(
        `Path traversal detected: ${filePath}`,
        filePath,
        'outside_root'
      );
    }

    // Check for symlinks
    try {
      const stats = fs.lstatSync(normalizedPath);
      if (stats.isSymbolicLink()) {
        throw new CheckpointPathError(
          `Symlinks are not allowed: ${filePath}`,
          filePath,
          'symlink'
        );
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (error instanceof CheckpointPathError) {
          throw error;
        }
      }
    }

    return normalizedPath;
  }

  /**
   * Get file path for checkpoint
   */
  private getCheckpointPath(id: string): string {
    this.validateCheckpointId(id);
    const extension = this.config.compression ? '.json.gz' : '.json';
    const filePath = path.join(this.config.basePath, `${id}${extension}`);
    return this.validatePath(filePath);
  }

  /**
   * Save checkpoint to file
   */
  async save(checkpoint: Checkpoint): Promise<void> {
    const filePath = this.getCheckpointPath(checkpoint.id);

    try {
      // Serialize checkpoint
      let data = JSON.stringify(checkpoint, null, 2);
      let buffer = Buffer.from(data, 'utf-8');

      // Check uncompressed size
      if (buffer.length > this.config.maxCheckpointSize) {
        throw new CheckpointSizeError(
          `Checkpoint exceeds maximum size: ${buffer.length} > ${this.config.maxCheckpointSize}`,
          'checkpoint_size',
          this.config.maxCheckpointSize,
          buffer.length
        );
      }

      // Compress if enabled
      if (this.config.compression) {
        try {
          buffer = await gzipAsync(buffer);
        } catch (error) {
          throw new CompressionError(
            'Failed to compress checkpoint',
            'compress',
            error instanceof Error ? error : undefined
          );
        }
      }

      // Update checkpoint size in metadata
      checkpoint.metadata.checkpointSize = buffer.length;

      // Write with restricted permissions
      await fsPromises.writeFile(filePath, buffer, { mode: 0o600 });

      // Update index
      if (this.config.indexEnabled) {
        this.index.set(checkpoint.id, {
          id: checkpoint.id,
          createdAt: checkpoint.createdAt,
          trigger: checkpoint.trigger,
          status: checkpoint.status,
          state: checkpoint.workflow.currentState,
          canResume: checkpoint.recovery.canResume,
          size: buffer.length,
          path: filePath,
        });
        await this.saveIndex();
      }
    } catch (error) {
      if (
        error instanceof CheckpointSizeError ||
        error instanceof CompressionError ||
        error instanceof CheckpointPathError
      ) {
        throw error;
      }
      throw new CheckpointStoreError(
        `Failed to save checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'save',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Load checkpoint by ID
   */
  async get(id: string): Promise<Checkpoint | null> {
    // Check index first for path
    const indexEntry = this.index.get(id);
    let filePath: string;

    if (indexEntry) {
      filePath = this.validatePath(indexEntry.path);
    } else {
      filePath = this.getCheckpointPath(id);
    }

    try {
      // Check if file exists
      try {
        await fsPromises.access(filePath, fs.constants.R_OK);
      } catch {
        return null;
      }

      // Read file
      let buffer = await fsPromises.readFile(filePath);

      // Check compressed size
      if (buffer.length > this.config.maxCheckpointSize) {
        throw new CheckpointSizeError(
          `Checkpoint file exceeds maximum size`,
          'checkpoint_size',
          this.config.maxCheckpointSize,
          buffer.length
        );
      }

      // Decompress if needed
      if (this.config.compression || filePath.endsWith('.gz')) {
        try {
          const decompressed = await gunzipAsync(buffer);

          // Check decompressed size
          if (decompressed.length > this.config.maxDecompressedSize) {
            throw new CheckpointSizeError(
              `Decompressed checkpoint exceeds maximum size`,
              'decompressed_size',
              this.config.maxDecompressedSize,
              decompressed.length
            );
          }

          // Check compression ratio (zip bomb detection)
          const ratio = decompressed.length / buffer.length;
          if (ratio > CHECKPOINT_LIMITS.maxCompressionRatio) {
            throw new CheckpointSizeError(
              `Suspicious compression ratio detected`,
              'compression_ratio',
              CHECKPOINT_LIMITS.maxCompressionRatio,
              ratio
            );
          }

          buffer = decompressed;
        } catch (error) {
          if (error instanceof CheckpointSizeError) {
            throw error;
          }
          throw new CompressionError(
            'Failed to decompress checkpoint',
            'decompress',
            error instanceof Error ? error : undefined
          );
        }
      }

      // Parse and validate JSON
      let data: unknown;
      try {
        data = JSON.parse(buffer.toString('utf-8'));
      } catch (error) {
        throw new CheckpointCorruptionError(
          id,
          'Invalid JSON in checkpoint file',
          error instanceof Error ? error : undefined
        );
      }

      // Validate against schema
      try {
        return CheckpointSchema.parse(data);
      } catch (error) {
        throw new CheckpointCorruptionError(
          id,
          `Checkpoint schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined
        );
      }
    } catch (error) {
      if (
        error instanceof CheckpointSizeError ||
        error instanceof CompressionError ||
        error instanceof CheckpointCorruptionError ||
        error instanceof CheckpointPathError
      ) {
        throw error;
      }
      throw new CheckpointStoreError(
        `Failed to load checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'load',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * List all checkpoints
   */
  async list(): Promise<Checkpoint[]> {
    try {
      // If index is populated, use it
      if (this.config.indexEnabled && this.index.size > 0) {
        const checkpoints: Checkpoint[] = [];
        for (const entry of this.index.values()) {
          try {
            const checkpoint = await this.get(entry.id);
            if (checkpoint) {
              checkpoints.push(checkpoint);
            }
          } catch {
            // Skip corrupted/invalid checkpoints
          }
        }
        return checkpoints;
      }

      // Fallback to directory scan
      const files = await fsPromises.readdir(this.config.basePath);
      const checkpoints: Checkpoint[] = [];

      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.json.gz')) {
          const id = file.replace('.json.gz', '').replace('.json', '');
          if (UUID_REGEX.test(id)) {
            try {
              const checkpoint = await this.get(id);
              if (checkpoint) {
                checkpoints.push(checkpoint);
              }
            } catch {
              // Skip corrupted/invalid checkpoints
            }
          }
        }
      }

      return checkpoints;
    } catch (error) {
      throw new CheckpointStoreError(
        `Failed to list checkpoints: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'list',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete checkpoint by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const indexEntry = this.index.get(id);
      let filePath: string;

      if (indexEntry) {
        filePath = this.validatePath(indexEntry.path);
      } else {
        filePath = this.getCheckpointPath(id);
      }

      try {
        await fsPromises.unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return false;
        }
        throw error;
      }

      // Remove from index
      this.index.delete(id);
      if (this.config.indexEnabled) {
        await this.saveIndex();
      }

      return true;
    } catch (error) {
      if (error instanceof CheckpointPathError) {
        throw error;
      }
      throw new CheckpointStoreError(
        `Failed to delete checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Archive checkpoint (mark as archived)
   */
  async archive(id: string): Promise<void> {
    const checkpoint = await this.get(id);
    if (!checkpoint) {
      return;
    }

    checkpoint.status = 'archived';
    await this.save(checkpoint);
  }

  /**
   * Delete checkpoints older than date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const checkpoints = await this.list();
    let deleted = 0;

    for (const checkpoint of checkpoints) {
      if (new Date(checkpoint.createdAt) < date) {
        if (await this.delete(checkpoint.id)) {
          deleted++;
        }
      }
    }

    return deleted;
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<CheckpointStoreStats> {
    const checkpoints = await this.list();

    if (checkpoints.length === 0) {
      return {
        count: 0,
        totalSize: 0,
        oldestCheckpoint: null,
        newestCheckpoint: null,
      };
    }

    const sorted = checkpoints.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Safe access - we know sorted is non-empty from the check above
    const oldest = sorted[0]!;
    const newest = sorted[sorted.length - 1]!;

    return {
      count: checkpoints.length,
      totalSize: checkpoints.reduce((sum, cp) => sum + cp.metadata.checkpointSize, 0),
      oldestCheckpoint: oldest.id,
      newestCheckpoint: newest.id,
    };
  }

  /**
   * Load index from disk
   */
  private async loadIndex(): Promise<void> {
    try {
      const data = await fsPromises.readFile(this.indexPath, 'utf-8');
      const entries = JSON.parse(data) as CheckpointIndexEntry[];
      this.index = new Map(entries.map((e) => [e.id, e]));
    } catch {
      // Index doesn't exist or is corrupted - start fresh
      this.index = new Map();
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(): Promise<void> {
    const entries = Array.from(this.index.values());
    await fsPromises.writeFile(
      this.indexPath,
      JSON.stringify(entries, null, 2),
      { mode: 0o600 }
    );
  }
}
