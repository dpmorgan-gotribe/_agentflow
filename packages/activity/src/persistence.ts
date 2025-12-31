/**
 * Activity Persistence
 *
 * Persists activity events for replay and analysis using JSONL format.
 *
 * Security features:
 * - Path traversal prevention
 * - Symlink detection
 * - File rotation with size limits
 * - Retention management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ActivityEvent,
  ActivityType,
  ActivityCategory,
  ActivityPersistenceConfig,
  ActivityPersistenceConfigSchema,
} from './types.js';
import type { ActivityPersistence as IActivityPersistence } from './activity-stream.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Maximum line length for JSONL
 */
export const MAX_LINE_LENGTH = 100000;

/**
 * File prefix for activity logs
 */
export const FILE_PREFIX = 'activity-';

/**
 * File extension for activity logs
 */
export const FILE_EXTENSION = '.jsonl';

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate path is within base directory (prevent traversal)
 */
function isPathWithinBase(filePath: string, basePath: string): boolean {
  const resolved = path.resolve(filePath);
  const base = path.resolve(basePath);
  return resolved.startsWith(base + path.sep) || resolved === base;
}

/**
 * Check if path is a symlink
 */
async function isSymlink(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

// ============================================================================
// Activity Persistence Class
// ============================================================================

/**
 * Activity persistence implementation using JSONL files
 */
export class FileActivityPersistence implements IActivityPersistence {
  private config: ActivityPersistenceConfig;
  private currentFile: string;
  private eventCount: number = 0;
  private currentFileSize: number = 0;
  private initialized: boolean = false;

  constructor(config: ActivityPersistenceConfig) {
    // Validate config
    const validation = ActivityPersistenceConfigSchema.safeParse(config);
    if (!validation.success) {
      throw new Error(`Invalid persistence config: ${validation.error.message}`);
    }
    this.config = validation.data;
    this.currentFile = this.getFilename();
  }

  /**
   * Initialize persistence (create directory)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure base path doesn't contain traversal
    const resolvedPath = path.resolve(this.config.basePath);
    if (resolvedPath.includes('..')) {
      throw new Error('Invalid base path: contains traversal');
    }

    // Check if base path is a symlink
    if (await isSymlink(this.config.basePath)) {
      throw new Error('Base path cannot be a symlink');
    }

    await fs.mkdir(this.config.basePath, { recursive: true, mode: 0o700 });
    await this.cleanup();
    this.initialized = true;
  }

  /**
   * Save a single event
   */
  async save(event: ActivityEvent): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if rotation needed
    if (
      this.eventCount >= this.config.maxEventsPerFile ||
      this.currentFileSize >= MAX_FILE_SIZE_BYTES
    ) {
      this.rotate();
    }

    const line = JSON.stringify(event);

    // Validate line length
    if (line.length > MAX_LINE_LENGTH) {
      throw new Error(`Event too large: ${line.length} bytes exceeds ${MAX_LINE_LENGTH}`);
    }

    const lineWithNewline = line + '\n';

    // Validate path is within base
    if (!isPathWithinBase(this.currentFile, this.config.basePath)) {
      throw new Error('File path outside base directory');
    }

    await fs.appendFile(this.currentFile, lineWithNewline, { mode: 0o600 });
    this.eventCount++;
    this.currentFileSize += lineWithNewline.length;
  }

  /**
   * Save multiple events
   */
  async saveBatch(events: ActivityEvent[]): Promise<void> {
    for (const event of events) {
      await this.save(event);
    }
  }

  /**
   * Load events for a session
   */
  async loadSession(sessionId: string): Promise<ActivityEvent[]> {
    const files = await this.getAllFiles();
    const events: ActivityEvent[] = [];

    for (const file of files) {
      const fileEvents = await this.readFile(file);
      events.push(...fileEvents.filter((e) => e.sessionId === sessionId));
    }

    return events.sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * Load events by time range
   */
  async loadByTimeRange(startTime: Date, endTime: Date): Promise<ActivityEvent[]> {
    const files = await this.getAllFiles();
    const events: ActivityEvent[] = [];

    for (const file of files) {
      const fileEvents = await this.readFile(file);
      events.push(
        ...fileEvents.filter((e) => {
          const eventTime = new Date(e.timestamp);
          return eventTime >= startTime && eventTime <= endTime;
        })
      );
    }

    return events.sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * Query events with filters
   */
  async query(options: {
    sessionId?: string;
    workflowId?: string;
    types?: ActivityType[];
    categories?: ActivityCategory[];
    limit?: number;
  }): Promise<ActivityEvent[]> {
    const files = await this.getAllFiles();
    let events: ActivityEvent[] = [];

    // Process files in reverse order (newest first) for limit efficiency
    for (const file of files.reverse()) {
      const fileEvents = await this.readFile(file);

      const filtered = fileEvents.filter((e) => {
        if (options.sessionId && e.sessionId !== options.sessionId) return false;
        if (options.workflowId && e.workflowId !== options.workflowId) return false;
        if (options.types?.length && !options.types.includes(e.type)) return false;
        if (options.categories?.length && !options.categories.includes(e.category)) return false;
        return true;
      });

      events = [...filtered, ...events];

      // Early exit if we have enough events
      if (options.limit && events.length >= options.limit) {
        break;
      }
    }

    // Apply limit
    if (options.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  /**
   * Get statistics about stored events
   */
  async getStatistics(): Promise<{
    totalEvents: number;
    fileCount: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    totalSizeBytes: number;
  }> {
    const files = await this.getAllFiles();
    let totalEvents = 0;
    let totalSizeBytes = 0;
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const file of files) {
      const events = await this.readFile(file);
      totalEvents += events.length;

      try {
        const stats = await fs.stat(file);
        totalSizeBytes += stats.size;
      } catch {
        // Ignore stat errors
      }

      for (const event of events) {
        byType[event.type] = (byType[event.type] ?? 0) + 1;
        byCategory[event.category] = (byCategory[event.category] ?? 0) + 1;
      }
    }

    return {
      totalEvents,
      fileCount: files.length,
      byType,
      byCategory,
      totalSizeBytes,
    };
  }

  /**
   * Get filename for current time
   */
  private getFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.config.basePath, `${FILE_PREFIX}${timestamp}${FILE_EXTENSION}`);
  }

  /**
   * Rotate to a new file
   */
  private rotate(): void {
    this.currentFile = this.getFilename();
    this.eventCount = 0;
    this.currentFileSize = 0;
  }

  /**
   * Get all activity files sorted by name
   */
  private async getAllFiles(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.config.basePath);
      return entries
        .filter((e) => e.startsWith(FILE_PREFIX) && e.endsWith(FILE_EXTENSION))
        .map((e) => path.join(this.config.basePath, e))
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Read events from a file
   */
  private async readFile(filePath: string): Promise<ActivityEvent[]> {
    // Validate path is within base
    if (!isPathWithinBase(filePath, this.config.basePath)) {
      throw new Error('File path outside base directory');
    }

    // Check for symlink
    if (await isSymlink(filePath)) {
      throw new Error('Cannot read symlinked file');
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => {
          try {
            return JSON.parse(line) as ActivityEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is ActivityEvent => e !== null);
    } catch {
      return [];
    }
  }

  /**
   * Cleanup old files based on retention policy
   */
  private async cleanup(): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - this.config.retentionHours);

    const files = await this.getAllFiles();
    let deleted = 0;

    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        if (stat.mtime < cutoff) {
          await fs.unlink(file);
          deleted++;
        }
      } catch {
        // Ignore errors during cleanup
      }
    }

    return deleted;
  }

  /**
   * Force cleanup (for testing or manual maintenance)
   */
  async forceCleanup(): Promise<number> {
    return this.cleanup();
  }

  /**
   * Delete all activity files
   */
  async deleteAll(): Promise<void> {
    const files = await this.getAllFiles();
    for (const file of files) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore errors
      }
    }
    this.eventCount = 0;
    this.currentFileSize = 0;
    this.currentFile = this.getFilename();
  }
}

// ============================================================================
// In-Memory Persistence (for testing)
// ============================================================================

/**
 * In-memory activity persistence for testing
 */
export class InMemoryActivityPersistence implements IActivityPersistence {
  private events: ActivityEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  async save(event: ActivityEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  async saveBatch(events: ActivityEvent[]): Promise<void> {
    for (const event of events) {
      await this.save(event);
    }
  }

  getEvents(): ActivityEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  getCount(): number {
    return this.events.length;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a file-based activity persistence
 */
export function createFileActivityPersistence(
  config: ActivityPersistenceConfig
): FileActivityPersistence {
  return new FileActivityPersistence(config);
}

/**
 * Create an in-memory activity persistence (for testing)
 */
export function createInMemoryActivityPersistence(
  maxEvents?: number
): InMemoryActivityPersistence {
  return new InMemoryActivityPersistence(maxEvents);
}
