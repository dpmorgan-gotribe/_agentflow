/**
 * Subscription Manager
 *
 * Manages event subscriptions and dispatching for the activity stream.
 *
 * Security features:
 * - Subscription limit to prevent resource exhaustion
 * - Handler error isolation
 * - Filter validation
 */

import {
  ActivityEvent,
  Subscription,
  SubscriptionFilter,
  EventHandler,
  validateSubscriptionFilter,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum subscriptions per manager
 */
export const MAX_SUBSCRIPTIONS = 1000;

/**
 * Handler timeout in milliseconds
 */
export const HANDLER_TIMEOUT_MS = 5000;

// ============================================================================
// Subscription Manager Class
// ============================================================================

/**
 * Manages event subscriptions and dispatching
 */
export class SubscriptionManager {
  private subscriptions: Map<string, Subscription> = new Map();

  /**
   * Subscribe to events
   */
  subscribe(handler: EventHandler, filter: SubscriptionFilter = {}): string {
    // Validate filter
    const validation = validateSubscriptionFilter(filter);
    if (!validation.success) {
      throw new Error(`Invalid subscription filter: ${validation.error.message}`);
    }

    // Check subscription limit
    if (this.subscriptions.size >= MAX_SUBSCRIPTIONS) {
      throw new Error(`Maximum subscriptions reached: ${MAX_SUBSCRIPTIONS}`);
    }

    const id = crypto.randomUUID();

    const subscription: Subscription = {
      id,
      filter: validation.data,
      handler,
      createdAt: new Date(),
    };

    this.subscriptions.set(id, subscription);

    return id;
  }

  /**
   * Unsubscribe by ID
   */
  unsubscribe(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  /**
   * Dispatch event to matching subscribers
   */
  async dispatch(event: ActivityEvent): Promise<void> {
    const matchingSubscriptions = this.getMatchingSubscriptions(event);

    await Promise.all(
      matchingSubscriptions.map(async (sub) => {
        try {
          // Create a timeout promise for handler safety
          const handlerPromise = Promise.resolve(sub.handler(event));
          const timeoutPromise = new Promise<void>((_, reject) => {
            globalThis.setTimeout(() => {
              reject(new Error(`Handler timeout for subscription ${sub.id}`));
            }, HANDLER_TIMEOUT_MS);
          });

          await Promise.race([handlerPromise, timeoutPromise]);
        } catch {
          // Isolate handler errors - don't propagate to other subscribers
          // In production, this would be logged
        }
      })
    );
  }

  /**
   * Get subscriptions matching an event
   */
  private getMatchingSubscriptions(event: ActivityEvent): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((sub) =>
      this.matchesFilter(event, sub.filter)
    );
  }

  /**
   * Check if event matches filter criteria
   */
  private matchesFilter(event: ActivityEvent, filter: SubscriptionFilter): boolean {
    // Empty filter matches all events
    if (
      !filter.types?.length &&
      !filter.categories?.length &&
      !filter.severities?.length &&
      !filter.agentIds?.length &&
      !filter.workflowId
    ) {
      return true;
    }

    // Check type filter
    if (filter.types?.length && !filter.types.includes(event.type)) {
      return false;
    }

    // Check category filter
    if (filter.categories?.length && !filter.categories.includes(event.category)) {
      return false;
    }

    // Check severity filter
    if (filter.severities?.length && !filter.severities.includes(event.severity)) {
      return false;
    }

    // Check agent ID filter
    if (filter.agentIds?.length) {
      if (!event.agentId || !filter.agentIds.includes(event.agentId)) {
        return false;
      }
    }

    // Check workflow ID filter
    if (filter.workflowId && event.workflowId !== filter.workflowId) {
      return false;
    }

    return true;
  }

  /**
   * Get subscription count
   */
  getCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscription by ID
   */
  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * Get all subscription IDs
   */
  getSubscriptionIds(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
  }

  /**
   * Check if a filter would match an event (for testing)
   */
  testFilter(event: ActivityEvent, filter: SubscriptionFilter): boolean {
    return this.matchesFilter(event, filter);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a subscription manager
 */
export function createSubscriptionManager(): SubscriptionManager {
  return new SubscriptionManager();
}

/**
 * Create a simple subscription (convenience function)
 */
export function createSubscription(
  manager: SubscriptionManager,
  handler: EventHandler,
  options: {
    types?: string[];
    categories?: string[];
    severities?: string[];
    agentIds?: string[];
    workflowId?: string;
  } = {}
): string {
  return manager.subscribe(handler, options as SubscriptionFilter);
}
