/**
 * Event Bus
 *
 * Central event dispatcher for inter-component communication.
 * Implements event validation, history tracking, and rate limiting.
 */

import { EventEmitter } from 'events';
import type {
  SystemEvent,
  EventBusConfig,
  EventHistoryFilter,
  AllowedEventSource,
} from './types.js';
import {
  SystemEventSchema,
  AllowedEventSources,
  DEFAULT_EVENT_BUS_CONFIG,
} from './types.js';
import {
  EventEmissionError,
  EventValidationError,
  EventRateLimitError,
} from './errors.js';

/**
 * Event listener callback type
 */
export type EventListener = (event: SystemEvent) => void | Promise<void>;

/**
 * Rate limit tracker per source
 */
interface RateLimitState {
  count: number;
  windowStart: number;
}

/**
 * EventBus implementation
 *
 * Provides typed event emission with validation, history tracking,
 * and rate limiting for security.
 */
export class EventBus extends EventEmitter {
  private readonly config: EventBusConfig;
  private history: SystemEvent[] = [];
  private rateLimits: Map<string, RateLimitState> = new Map();
  private readonly RATE_WINDOW_MS = 1000;

  constructor(config: Partial<EventBusConfig> = {}) {
    super();
    this.config = { ...DEFAULT_EVENT_BUS_CONFIG, ...config };
    this.setMaxListeners(100); // Allow many component listeners
  }

  /**
   * Emit a system event
   *
   * Validates the event, checks rate limits, adds to history,
   * and notifies all listeners.
   */
  emitEvent(event: SystemEvent): void {
    // Validate event structure
    if (this.config.validateEvents) {
      this.validateEvent(event);
    }

    // Check rate limit
    this.checkRateLimit(event.source);

    // Add to history
    this.addToHistory(event);

    // Emit to type-specific listeners
    try {
      this.emit(event.type, event);
    } catch (error) {
      throw new EventEmissionError(
        event.type,
        `Error emitting event: ${(error as Error).message}`,
        error as Error
      );
    }

    // Emit to wildcard listeners
    this.emit('*', event);
  }

  /**
   * Emit event asynchronously with error handling
   *
   * Catches listener errors without throwing.
   */
  async emitEventAsync(event: SystemEvent): Promise<void> {
    // Validate event structure
    if (this.config.validateEvents) {
      this.validateEvent(event);
    }

    // Check rate limit
    this.checkRateLimit(event.source);

    // Add to history
    this.addToHistory(event);

    // Get listeners for this event type
    const typeListeners = this.listeners(event.type) as EventListener[];
    const wildcardListeners = this.listeners('*') as EventListener[];
    const allListeners = [...typeListeners, ...wildcardListeners];

    // Execute all listeners, catching errors
    const results = await Promise.allSettled(
      allListeners.map(async (listener) => {
        try {
          await listener(event);
        } catch (error) {
          // Log but don't throw - other listeners should still run
          console.error(
            `[EventBus] Listener error for ${event.type}:`,
            error
          );
        }
      })
    );

    // Check for failures
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(
        `[EventBus] ${failures.length} listener(s) failed for ${event.type}`
      );
    }
  }

  /**
   * Get event history with optional filtering
   */
  getHistory(filter?: Partial<EventHistoryFilter>): SystemEvent[] {
    let result = [...this.history];

    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type);
    }

    if (filter?.source) {
      result = result.filter((e) => e.source === filter.source);
    }

    if (filter?.correlationId) {
      result = result.filter((e) => e.correlationId === filter.correlationId);
    }

    if (filter?.startTime) {
      result = result.filter((e) => e.timestamp >= filter.startTime!);
    }

    if (filter?.endTime) {
      result = result.filter((e) => e.timestamp <= filter.endTime!);
    }

    // Apply offset and limit
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 1000;

    return result.slice(offset, offset + limit);
  }

  /**
   * Get history statistics
   */
  getHistoryStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
    oldestEvent?: Date;
    newestEvent?: Date;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySource: Record<string, number> = {};

    for (const event of this.history) {
      eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
      eventsBySource[event.source] = (eventsBySource[event.source] ?? 0) + 1;
    }

    return {
      totalEvents: this.history.length,
      eventsByType,
      eventsBySource,
      oldestEvent: this.history[0]?.timestamp,
      newestEvent: this.history[this.history.length - 1]?.timestamp,
    };
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get current history size
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Create a typed event helper
   */
  createEvent(
    type: string,
    source: AllowedEventSource,
    data: unknown,
    correlationId?: string
  ): SystemEvent {
    return {
      type,
      source,
      timestamp: new Date(),
      data,
      correlationId,
    };
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe(eventType: string, listener: EventListener): () => void {
    this.on(eventType, listener);
    return () => this.off(eventType, listener);
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(listener: EventListener): () => void {
    this.on('*', listener);
    return () => this.off('*', listener);
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: SystemEvent): void {
    // Validate with Zod schema
    const result = SystemEventSchema.safeParse(event);
    if (!result.success) {
      const firstError = result.error.errors[0];
      throw new EventValidationError(
        event.type ?? 'unknown',
        firstError?.path.join('.') ?? 'unknown',
        `Invalid event: ${firstError?.message ?? 'validation failed'}`
      );
    }

    // Check source is in whitelist
    if (!AllowedEventSources.includes(event.source)) {
      throw new EventValidationError(
        event.type,
        'source',
        `Invalid event source: ${event.source}. Must be one of: ${AllowedEventSources.join(', ')}`
      );
    }
  }

  /**
   * Check and enforce rate limits
   */
  private checkRateLimit(source: string): void {
    const now = Date.now();
    const state = this.rateLimits.get(source);

    if (!state || now - state.windowStart >= this.RATE_WINDOW_MS) {
      // New window
      this.rateLimits.set(source, { count: 1, windowStart: now });
      return;
    }

    // Same window - check limit
    state.count++;
    if (state.count > this.config.maxEventsPerSecond) {
      throw new EventRateLimitError(
        source,
        this.config.maxEventsPerSecond,
        state.count
      );
    }
  }

  /**
   * Add event to history with size limit enforcement
   */
  private addToHistory(event: SystemEvent): void {
    this.history.push(event);

    // Enforce max history size
    while (this.history.length > this.config.maxHistory) {
      this.history.shift();
    }
  }
}

/**
 * Singleton event bus instance
 *
 * Use this for application-wide event coordination.
 */
let globalEventBus: EventBus | undefined;

export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetGlobalEventBus(): void {
  globalEventBus = undefined;
}
