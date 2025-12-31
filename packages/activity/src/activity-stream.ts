/**
 * Activity Stream
 *
 * Core event streaming functionality for real-time activity tracking.
 *
 * Security features:
 * - Event validation with Zod
 * - Buffer size limits to prevent memory exhaustion
 * - Secret redaction in event details
 */

import {
  ActivityEvent,
  ActivityEventSchema,
  ActivityType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStreamConfig,
  SubscriptionFilter,
  EventHandler,
  TYPE_CATEGORIES,
  MAX_EVENTS_IN_MEMORY,
} from './types.js';
import { SubscriptionManager } from './subscriptions.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Activity persistence interface (implemented by persistence module)
 */
export interface ActivityPersistence {
  save(event: ActivityEvent): Promise<void>;
  saveBatch(events: ActivityEvent[]): Promise<void>;
}

/**
 * No-op persistence for when persistence is disabled
 */
class NullPersistence implements ActivityPersistence {
  async save(): Promise<void> {
    // No-op
  }
  async saveBatch(): Promise<void> {
    // No-op
  }
}

/**
 * Event emission options
 */
export interface EmitOptions {
  message?: string;
  severity?: ActivitySeverity;
  agentId?: string;
  details?: Record<string, unknown>;
  progress?: { current: number; total: number };
  duration?: number;
  parentId?: string;
  correlationId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: ActivityStreamConfig = {
  persistEvents: true,
  maxEventsInMemory: 1000,
  enableDebugEvents: false,
};

/**
 * Patterns to redact from event details
 */
const SECRET_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /private[_-]?key/i,
];

// ============================================================================
// Activity Stream Class
// ============================================================================

/**
 * Activity stream for real-time event streaming
 */
export class ActivityStream {
  private config: ActivityStreamConfig;
  private subscriptions: SubscriptionManager;
  private persistence: ActivityPersistence;
  private sequence: number = 0;
  private sessionId: string;
  private workflowId?: string;
  private eventBuffer: ActivityEvent[] = [];
  private listeners: Map<string, Set<(event: ActivityEvent) => void>> = new Map();

  constructor(
    persistence?: ActivityPersistence,
    config: Partial<ActivityStreamConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.subscriptions = new SubscriptionManager();
    this.persistence = persistence ?? new NullPersistence();
    this.sessionId = crypto.randomUUID();

    // Enforce max buffer size
    if (this.config.maxEventsInMemory > MAX_EVENTS_IN_MEMORY) {
      this.config.maxEventsInMemory = MAX_EVENTS_IN_MEMORY;
    }
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Set workflow ID for correlation
   */
  setWorkflowId(id: string): void {
    this.workflowId = id;
  }

  /**
   * Get current workflow ID
   */
  getWorkflowId(): string | undefined {
    return this.workflowId;
  }

  /**
   * Emit an activity event
   */
  async emit(
    type: ActivityType,
    title: string,
    options: EmitOptions = {}
  ): Promise<ActivityEvent> {
    // Skip debug events if disabled
    if (options.severity === 'debug' && !this.config.enableDebugEvents) {
      // Return a placeholder event for type safety
      return this.createPlaceholderEvent(type, title);
    }

    this.sequence++;

    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sequence: this.sequence,
      type,
      category: TYPE_CATEGORIES[type],
      severity: options.severity ?? this.inferSeverity(type),
      sessionId: this.sessionId,
      workflowId: this.workflowId,
      agentId: options.agentId,
      title,
      message: options.message ?? title,
      details: options.details ? this.redactSecrets(options.details) : undefined,
      progress: options.progress
        ? {
            ...options.progress,
            percentage: Math.round((options.progress.current / options.progress.total) * 100),
          }
        : undefined,
      duration: options.duration,
      parentId: options.parentId,
      correlationId: options.correlationId,
    };

    // Validate event
    const validation = ActivityEventSchema.safeParse(event);
    if (!validation.success) {
      throw new Error(`Invalid event: ${validation.error.message}`);
    }

    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.config.maxEventsInMemory) {
      this.eventBuffer.shift();
    }

    // Persist if enabled
    if (this.config.persistEvents) {
      await this.persistence.save(event);
    }

    // Notify subscribers via SubscriptionManager
    await this.subscriptions.dispatch(event);

    // Notify direct listeners
    this.notifyListeners('activity', event);
    this.notifyListeners(type, event);

    return event;
  }

  /**
   * Create a placeholder event for skipped debug events
   */
  private createPlaceholderEvent(type: ActivityType, title: string): ActivityEvent {
    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sequence: 0,
      type,
      category: TYPE_CATEGORIES[type],
      severity: 'debug',
      sessionId: this.sessionId,
      title,
      message: title,
    };
  }

  /**
   * Infer severity from event type
   */
  private inferSeverity(type: ActivityType): ActivitySeverity {
    if (type.includes('error') || type.includes('conflict')) {
      return 'error';
    }
    if (type.includes('warning')) {
      return 'warning';
    }
    if (type.includes('complete') || type.includes('approved')) {
      return 'success';
    }
    if (type.includes('start') || type.includes('thinking')) {
      return 'info';
    }
    return 'info';
  }

  /**
   * Redact secrets from details object
   */
  private redactSecrets(details: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      // Check if key matches secret pattern
      const isSecret = SECRET_PATTERNS.some((pattern) => pattern.test(key));

      if (isSecret) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        redacted[key] = this.redactSecrets(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Subscribe to events with filter
   */
  subscribe(handler: EventHandler, filter?: SubscriptionFilter): string {
    return this.subscriptions.subscribe(handler, filter ?? {});
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.unsubscribe(subscriptionId);
  }

  /**
   * Add a direct listener for an event type
   */
  on(eventType: string, handler: (event: ActivityEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }

  /**
   * Notify direct listeners
   */
  private notifyListeners(eventType: string, event: ActivityEvent): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 50): ActivityEvent[] {
    return this.eventBuffer.slice(-count);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: ActivityType, count: number = 50): ActivityEvent[] {
    return this.eventBuffer.filter((e) => e.type === type).slice(-count);
  }

  /**
   * Get events by category
   */
  getEventsByCategory(category: ActivityCategory, count: number = 50): ActivityEvent[] {
    return this.eventBuffer.filter((e) => e.category === category).slice(-count);
  }

  /**
   * Clear event buffer
   */
  clearBuffer(): void {
    this.eventBuffer = [];
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  // ============================================================================
  // Convenience Methods for Common Events
  // ============================================================================

  /**
   * Workflow started
   */
  async workflowStart(description: string): Promise<ActivityEvent> {
    return this.emit('workflow_start', 'Workflow Started', {
      message: description,
      severity: 'info',
    });
  }

  /**
   * Workflow completed
   */
  async workflowComplete(summary: string, duration: number): Promise<ActivityEvent> {
    return this.emit('workflow_complete', 'Workflow Complete', {
      message: summary,
      severity: 'success',
      duration,
    });
  }

  /**
   * Workflow error
   */
  async workflowError(error: Error): Promise<ActivityEvent> {
    return this.emit('workflow_error', 'Workflow Error', {
      message: error.message,
      severity: 'error',
      details: { error: error.name },
    });
  }

  /**
   * Agent started
   */
  async agentStart(agentId: string, task: string): Promise<ActivityEvent> {
    return this.emit('agent_start', `${agentId} Starting`, {
      message: task,
      severity: 'info',
      agentId,
    });
  }

  /**
   * Agent thinking
   */
  async agentThinking(agentId: string, what: string): Promise<ActivityEvent> {
    return this.emit('agent_thinking', `${agentId} Thinking`, {
      message: what,
      severity: 'debug',
      agentId,
    });
  }

  /**
   * Agent progress
   */
  async agentProgress(
    agentId: string,
    message: string,
    current: number,
    total: number
  ): Promise<ActivityEvent> {
    return this.emit('agent_progress', `${agentId} Progress`, {
      message,
      severity: 'info',
      agentId,
      progress: { current, total },
    });
  }

  /**
   * Agent output
   */
  async agentOutput(agentId: string, output: string): Promise<ActivityEvent> {
    return this.emit('agent_output', `${agentId} Output`, {
      message: output,
      severity: 'info',
      agentId,
    });
  }

  /**
   * Agent completed
   */
  async agentComplete(agentId: string, summary: string, duration: number): Promise<ActivityEvent> {
    return this.emit('agent_complete', `${agentId} Complete`, {
      message: summary,
      severity: 'success',
      agentId,
      duration,
    });
  }

  /**
   * Agent error
   */
  async agentError(agentId: string, error: Error): Promise<ActivityEvent> {
    return this.emit('agent_error', `${agentId} Error`, {
      message: error.message,
      severity: 'error',
      agentId,
      details: { error: error.name },
    });
  }

  /**
   * File operation
   */
  async fileOperation(
    operation: 'read' | 'write' | 'delete',
    path: string
  ): Promise<ActivityEvent> {
    const type = `file_${operation}` as ActivityType;
    const opName = operation.charAt(0).toUpperCase() + operation.slice(1);
    return this.emit(type, `File ${opName}`, {
      message: path,
      severity: 'debug',
      details: { path, operation },
    });
  }

  /**
   * Git operation
   */
  async gitOperation(operation: string, details?: Record<string, unknown>): Promise<ActivityEvent> {
    return this.emit('git_operation', `Git: ${operation}`, {
      message: operation,
      severity: 'info',
      details,
    });
  }

  /**
   * Git commit
   */
  async gitCommit(message: string, sha?: string): Promise<ActivityEvent> {
    return this.emit('git_commit', 'Git Commit', {
      message,
      severity: 'success',
      details: sha ? { sha } : undefined,
    });
  }

  /**
   * System message
   */
  async systemMessage(
    message: string,
    severity: ActivitySeverity = 'info'
  ): Promise<ActivityEvent> {
    return this.emit('system_message', 'System', {
      message,
      severity,
    });
  }

  /**
   * Progress update
   */
  async progressUpdate(
    title: string,
    current: number,
    total: number,
    message?: string
  ): Promise<ActivityEvent> {
    return this.emit('progress_update', title, {
      message: message ?? `${current}/${total}`,
      progress: { current, total },
    });
  }

  /**
   * Task start
   */
  async taskStart(taskName: string): Promise<ActivityEvent> {
    return this.emit('task_start', taskName, {
      message: `Starting: ${taskName}`,
      severity: 'info',
    });
  }

  /**
   * Task complete
   */
  async taskComplete(taskName: string, duration?: number): Promise<ActivityEvent> {
    return this.emit('task_complete', taskName, {
      message: `Completed: ${taskName}`,
      severity: 'success',
      duration,
    });
  }

  /**
   * Design event
   */
  async designEvent(
    type: 'design_generated' | 'design_approved' | 'design_rejected' | 'mockup_created' | 'tokens_extracted',
    title: string,
    message: string,
    details?: Record<string, unknown>
  ): Promise<ActivityEvent> {
    return this.emit(type, title, {
      message,
      severity: type === 'design_rejected' ? 'warning' : 'success',
      details,
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an activity stream
 */
export function createActivityStream(
  persistence?: ActivityPersistence,
  config?: Partial<ActivityStreamConfig>
): ActivityStream {
  return new ActivityStream(persistence, config);
}
