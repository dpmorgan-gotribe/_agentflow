/**
 * Audit Store
 *
 * Immutable, append-only file storage for audit events.
 * Includes path validation, file rotation, and retention management.
 */

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AuditEvent,
  AuditQueryOptions,
  AuditStatistics,
  AuditStoreConfig,
  AuditCategory,
  AuditSeverity,
  AuditOutcome,
} from './types.js';
import { DEFAULT_STORE_CONFIG, AUDIT_LIMITS } from './types.js';
import {
  AuditStoreError,
  AuditPathError,
  AuditSizeError,
} from './errors.js';

/**
 * Date format regex for audit files
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Audit filename pattern
 */
const AUDIT_FILE_PATTERN = /^audit-(\d{4}-\d{2}-\d{2})\.jsonl$/;

/**
 * Audit Store implementation
 */
export class AuditStore {
  private readonly config: AuditStoreConfig;
  private _currentFile: string;
  private writeStream?: fs.WriteStream;
  private currentSize: number = 0;
  private lastSequence: number = 0;

  constructor(config: Partial<AuditStoreConfig> = {}) {
    this.config = { ...DEFAULT_STORE_CONFIG, ...config };
    this._currentFile = this.getFilename(new Date());
  }

  /**
   * Get current file path (for testing)
   */
  get currentFile(): string {
    return this._currentFile;
  }

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    try {
      // Create directory with restricted permissions
      await fsPromises.mkdir(this.config.basePath, {
        recursive: true,
        mode: 0o700,
      });

      // Verify directory exists and is a directory
      const stats = await fsPromises.stat(this.config.basePath);
      if (!stats.isDirectory()) {
        throw new AuditStoreError(
          'Audit path is not a directory',
          'initialize'
        );
      }

      // Load last sequence number from existing files
      await this.loadLastSequence();

      // Open write stream for current file
      await this.openWriteStream();

      // Cleanup old files based on retention
      await this.cleanupOldFiles();
    } catch (error) {
      if (error instanceof AuditStoreError || error instanceof AuditPathError) {
        throw error;
      }
      throw new AuditStoreError(
        `Failed to initialize audit store: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'initialize',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Shutdown the store
   */
  async shutdown(): Promise<void> {
    if (this.writeStream) {
      await new Promise<void>((resolve, reject) => {
        this.writeStream!.end((err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.writeStream = undefined;
    }
  }

  /**
   * Get the last sequence number
   */
  async getLastSequence(): Promise<number> {
    return this.lastSequence;
  }

  /**
   * Append a single event
   */
  async append(event: AuditEvent): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    const buffer = Buffer.from(line, 'utf-8');

    // Check event size
    if (buffer.length > AUDIT_LIMITS.maxEventSize) {
      throw new AuditSizeError(
        `Event exceeds maximum size`,
        'event_size',
        AUDIT_LIMITS.maxEventSize,
        buffer.length
      );
    }

    // Check if rotation needed
    if (this.currentSize + buffer.length > this.config.rotateSize) {
      await this.rotate();
    }

    // Write event
    await this.write(buffer);
    this.currentSize += buffer.length;
    this.lastSequence = event.sequence;
  }

  /**
   * Append batch of events
   */
  async appendBatch(events: AuditEvent[]): Promise<void> {
    if (events.length > AUDIT_LIMITS.maxBatchSize) {
      throw new AuditSizeError(
        `Batch exceeds maximum size`,
        'batch_size',
        AUDIT_LIMITS.maxBatchSize,
        events.length
      );
    }

    for (const event of events) {
      await this.append(event);
    }
  }

  /**
   * Query events
   */
  async query(options: AuditQueryOptions): Promise<AuditEvent[]> {
    const files = await this.getFilesInRange(options.startDate, options.endDate);
    const events: AuditEvent[] = [];

    // Apply query limit cap
    const maxLimit = Math.min(
      options.limit ?? AUDIT_LIMITS.maxQueryLimit,
      AUDIT_LIMITS.maxQueryLimit
    );

    for (const file of files) {
      const fileEvents = await this.readFile(file);
      const filtered = this.filterEvents(fileEvents, options);
      events.push(...filtered);

      if (events.length >= maxLimit + (options.offset ?? 0)) {
        break;
      }
    }

    // Apply offset and limit
    let result = events;
    if (options.offset && options.offset > 0) {
      result = result.slice(options.offset);
    }
    result = result.slice(0, maxLimit);

    return result;
  }

  /**
   * Get statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<AuditStatistics> {
    const events = await this.query({ startDate, endDate });

    const stats: AuditStatistics = {
      totalEvents: events.length,
      eventsByCategory: {},
      eventsBySeverity: {},
      eventsByOutcome: {},
      eventsPerDay: [],
      topActors: [],
      errorRate: 0,
    };

    const dayMap = new Map<string, number>();
    const actorMap = new Map<string, number>();
    let errorCount = 0;

    for (const event of events) {
      // By category
      const category = event.category as AuditCategory;
      stats.eventsByCategory[category] =
        (stats.eventsByCategory[category] ?? 0) + 1;

      // By severity
      const severity = event.severity as AuditSeverity;
      stats.eventsBySeverity[severity] =
        (stats.eventsBySeverity[severity] ?? 0) + 1;

      // By outcome
      const outcome = event.outcome as AuditOutcome;
      stats.eventsByOutcome[outcome] =
        (stats.eventsByOutcome[outcome] ?? 0) + 1;

      // By day
      const day = event.timestamp.split('T')[0]!;
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

      // By actor
      actorMap.set(event.actor.id, (actorMap.get(event.actor.id) ?? 0) + 1);

      // Error count
      if (event.outcome === 'failure') {
        errorCount++;
      }
    }

    stats.eventsPerDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    stats.topActors = Array.from(actorMap.entries())
      .map(([actorId, count]) => ({ actorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    stats.errorRate = events.length > 0 ? errorCount / events.length : 0;

    return stats;
  }

  /**
   * Validate path is within base directory
   */
  private validatePath(filePath: string): string {
    const normalizedBase = path.resolve(this.config.basePath);
    const normalizedPath = path.resolve(filePath);

    // Check path is within base directory
    const relativePath = path.relative(normalizedBase, normalizedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new AuditPathError(
        `Path traversal detected: ${filePath}`,
        filePath,
        'outside_root'
      );
    }

    // Check for symlinks
    try {
      const stats = fs.lstatSync(normalizedPath);
      if (stats.isSymbolicLink()) {
        throw new AuditPathError(
          `Symlinks are not allowed: ${filePath}`,
          filePath,
          'symlink'
        );
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        if (error instanceof AuditPathError) {
          throw error;
        }
      }
    }

    return normalizedPath;
  }

  /**
   * Get filename for date
   */
  private getFilename(date: Date): string {
    const dateStr = date.toISOString().split('T')[0]!;

    // Validate date format
    if (!DATE_REGEX.test(dateStr)) {
      throw new AuditPathError(
        `Invalid date format: ${dateStr}`,
        dateStr,
        'invalid_id'
      );
    }

    const filename = path.join(this.config.basePath, `audit-${dateStr}.jsonl`);
    return this.validatePath(filename);
  }

  /**
   * Open write stream
   */
  private async openWriteStream(): Promise<void> {
    const filename = this.getFilename(new Date());

    // Get current size if file exists
    try {
      const stat = await fsPromises.stat(filename);
      this.currentSize = stat.size;
    } catch {
      this.currentSize = 0;
    }

    this._currentFile = filename;
    this.writeStream = fs.createWriteStream(filename, {
      flags: 'a',
      mode: 0o600,
    });
  }

  /**
   * Write to stream
   */
  private async write(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.writeStream) {
        reject(new AuditStoreError('Write stream not open', 'write'));
        return;
      }

      this.writeStream.write(buffer, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Rotate log file
   */
  private async rotate(): Promise<void> {
    if (this.writeStream) {
      await new Promise<void>((resolve, reject) => {
        this.writeStream!.end((err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    await this.openWriteStream();
  }

  /**
   * Load last sequence from existing files
   */
  private async loadLastSequence(): Promise<void> {
    const files = await this.getAllFiles();
    if (files.length === 0) {
      this.lastSequence = 0;
      return;
    }

    // Read last file
    const lastFile = files[files.length - 1]!;
    const events = await this.readFile(lastFile);
    if (events.length > 0) {
      const lastEvent = events[events.length - 1]!;
      this.lastSequence = lastEvent.sequence;
    }
  }

  /**
   * Get all audit files
   */
  private async getAllFiles(): Promise<string[]> {
    try {
      const entries = await fsPromises.readdir(this.config.basePath);
      return entries
        .filter((e) => AUDIT_FILE_PATTERN.test(e))
        .map((e) => this.validatePath(path.join(this.config.basePath, e)))
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Get files in date range
   */
  private async getFilesInRange(
    startDate?: Date,
    endDate?: Date
  ): Promise<string[]> {
    const allFiles = await this.getAllFiles();

    return allFiles.filter((file) => {
      const match = path.basename(file).match(AUDIT_FILE_PATTERN);
      if (!match || !match[1]) return false;

      const fileDate = new Date(match[1]);
      if (startDate && fileDate < startDate) return false;
      if (endDate && fileDate > endDate) return false;
      return true;
    });
  }

  /**
   * Read events from file
   */
  private async readFile(filePath: string): Promise<AuditEvent[]> {
    try {
      const content = await fsPromises.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const events: AuditEvent[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as AuditEvent;
          events.push(event);
        } catch {
          // Skip invalid JSON lines
        }
      }

      return events;
    } catch {
      return [];
    }
  }

  /**
   * Filter events based on query options
   */
  private filterEvents(
    events: AuditEvent[],
    options: AuditQueryOptions
  ): AuditEvent[] {
    return events.filter((event) => {
      if (
        options.categories &&
        !options.categories.includes(event.category as AuditCategory)
      ) {
        return false;
      }
      if (
        options.severity &&
        !options.severity.includes(event.severity as AuditSeverity)
      ) {
        return false;
      }
      if (
        options.outcome &&
        !options.outcome.includes(event.outcome as AuditOutcome)
      ) {
        return false;
      }
      if (options.actorId && event.actor.id !== options.actorId) {
        return false;
      }
      if (options.targetId && event.target?.id !== options.targetId) {
        return false;
      }
      if (options.sessionId && event.sessionId !== options.sessionId) {
        return false;
      }
      if (options.projectId && event.projectId !== options.projectId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Cleanup old files based on retention
   */
  private async cleanupOldFiles(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const files = await this.getAllFiles();

    for (const file of files) {
      const match = path.basename(file).match(AUDIT_FILE_PATTERN);
      if (!match || !match[1]) continue;

      const fileDate = new Date(match[1]);
      if (fileDate < cutoffDate) {
        try {
          await fsPromises.unlink(file);
        } catch {
          // Silent failure - don't crash on cleanup errors
        }
      }
    }
  }
}
