/**
 * Approval Gate
 *
 * Implements the approval workflow for user flows.
 * Pauses execution until user approves or rejects designs.
 *
 * Security features:
 * - Decision validation with Zod
 * - Reviewer authorization checks
 * - Audit trail for all decisions
 * - Request deduplication
 * - Timeout enforcement
 */

import {
  FlowCollection,
  ApprovalDecision,
  ApprovalDecisionSchema,
  ApprovalStatus,
  FlowIdSchema,
  NameSchema,
  validateApprovalDecision,
} from './schema.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Approval request status
 */
export interface ApprovalRequest {
  id: string;
  flowCollectionId: string;
  flowIds: string[];
  status: ApprovalStatus;
  createdAt: Date;
  respondedAt?: Date;
  decisions: ApprovalDecision[];
  timeoutMs?: number;
  expiresAt?: Date;
  authorizedReviewers?: string[];
}

/**
 * Approval gate event types
 */
export type ApprovalGateEventType =
  | 'request:created'
  | 'request:approved'
  | 'request:rejected'
  | 'request:revision'
  | 'request:timeout'
  | 'request:cancelled'
  | 'decision:submitted';

/**
 * Approval gate event
 */
export interface ApprovalGateEvent {
  type: ApprovalGateEventType;
  request: ApprovalRequest;
  decision?: ApprovalDecision;
  timestamp: Date;
}

/**
 * Approval gate event listener
 */
export type ApprovalGateListener = (event: ApprovalGateEvent) => void;

/**
 * State store interface for persistence
 */
export interface ApprovalStateStore {
  saveApprovalRequest(request: ApprovalRequest): Promise<void>;
  getApprovalRequest(requestId: string): Promise<ApprovalRequest | null>;
  getPendingApprovalRequests(): Promise<ApprovalRequest[]>;
  deleteApprovalRequest(requestId: string): Promise<void>;
}

/**
 * In-memory state store for testing/development
 */
export class InMemoryApprovalStore implements ApprovalStateStore {
  private requests: Map<string, ApprovalRequest> = new Map();

  async saveApprovalRequest(request: ApprovalRequest): Promise<void> {
    this.requests.set(request.id, { ...request });
  }

  async getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
    return this.requests.get(requestId) ?? null;
  }

  async getPendingApprovalRequests(): Promise<ApprovalRequest[]> {
    return Array.from(this.requests.values()).filter(
      (r) => r.status === 'pending'
    );
  }

  async deleteApprovalRequest(requestId: string): Promise<void> {
    this.requests.delete(requestId);
  }

  clear(): void {
    this.requests.clear();
  }
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `apr-${timestamp}-${random}`;
}

// ============================================================================
// Approval Gate Class
// ============================================================================

/**
 * Approval gate class
 */
export class ApprovalGate {
  private stateStore: ApprovalStateStore;
  private pendingRequests: Map<string, ApprovalRequest> = new Map();
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private listeners: Set<ApprovalGateListener> = new Set();

  constructor(stateStore?: ApprovalStateStore) {
    this.stateStore = stateStore ?? new InMemoryApprovalStore();
  }

  /**
   * Create an approval request for flows
   */
  async createRequest(
    collection: FlowCollection,
    options: {
      timeoutMs?: number;
      authorizedReviewers?: string[];
    } = {}
  ): Promise<ApprovalRequest> {
    const now = new Date();

    const request: ApprovalRequest = {
      id: generateRequestId(),
      flowCollectionId: collection.featureId,
      flowIds: collection.flows.map((f) => f.id),
      status: 'pending',
      createdAt: now,
      decisions: [],
      timeoutMs: options.timeoutMs,
      expiresAt: options.timeoutMs
        ? new Date(now.getTime() + options.timeoutMs)
        : undefined,
      authorizedReviewers: options.authorizedReviewers,
    };

    this.pendingRequests.set(request.id, request);

    // Persist to state store
    await this.stateStore.saveApprovalRequest(request);

    // Set timeout if specified
    if (options.timeoutMs && options.timeoutMs > 0) {
      const timeout = globalThis.setTimeout(() => {
        this.handleTimeout(request.id);
      }, options.timeoutMs);
      this.timeouts.set(request.id, timeout);
    }

    this.emit({
      type: 'request:created',
      request,
      timestamp: now,
    });

    return request;
  }

  /**
   * Wait for approval decision (blocking)
   */
  async waitForApproval(
    requestId: string,
    pollIntervalMs: number = 1000,
    maxWaitMs: number = 3600000 // 1 hour default
  ): Promise<ApprovalRequest> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkStatus = async (): Promise<void> => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= maxWaitMs) {
          reject(new Error(`Wait timeout exceeded: ${maxWaitMs}ms`));
          return;
        }

        const request = this.pendingRequests.get(requestId);
        if (!request) {
          // Try to load from store
          const stored = await this.stateStore.getApprovalRequest(requestId);
          if (!stored) {
            reject(new Error(`Request not found: ${requestId}`));
            return;
          }
          if (stored.status !== 'pending') {
            resolve(stored);
            return;
          }
        } else if (request.status !== 'pending') {
          resolve(request);
          return;
        }

        // Continue polling
        globalThis.setTimeout(checkStatus, pollIntervalMs);
      };

      checkStatus();
    });
  }

  /**
   * Submit approval decision
   */
  async submitDecision(decision: ApprovalDecision): Promise<ApprovalRequest> {
    // Validate decision
    const validation = validateApprovalDecision(decision);
    if (!validation.success) {
      throw new Error(`Invalid decision: ${validation.error.message}`);
    }

    // Find request containing this flow
    let request: ApprovalRequest | undefined;
    for (const [, req] of this.pendingRequests) {
      if (req.flowIds.includes(decision.flowId)) {
        request = req;
        break;
      }
    }

    if (!request) {
      throw new Error(`No pending request for flow: ${decision.flowId}`);
    }

    // Check authorization if configured
    if (
      request.authorizedReviewers &&
      request.authorizedReviewers.length > 0 &&
      !request.authorizedReviewers.includes(decision.reviewer)
    ) {
      throw new Error(
        `Reviewer "${decision.reviewer}" is not authorized for this request`
      );
    }

    // Check for duplicate decision
    const existingDecision = request.decisions.find(
      (d) => d.flowId === decision.flowId && d.reviewer === decision.reviewer
    );
    if (existingDecision) {
      throw new Error(
        `Reviewer "${decision.reviewer}" has already submitted a decision for flow "${decision.flowId}"`
      );
    }

    // Add decision
    request.decisions.push(validation.data);

    // Emit decision event
    this.emit({
      type: 'decision:submitted',
      request,
      decision: validation.data,
      timestamp: new Date(),
    });

    // Check if all flows have decisions
    const allDecided = request.flowIds.every((flowId) =>
      request!.decisions.some((d) => d.flowId === flowId)
    );

    if (allDecided) {
      this.finalizeRequest(request);
    }

    // Persist updated state
    await this.stateStore.saveApprovalRequest(request);

    return request;
  }

  /**
   * Finalize request after all decisions received
   */
  private finalizeRequest(request: ApprovalRequest): void {
    request.respondedAt = new Date();

    // Determine overall status
    const hasReject = request.decisions.some((d) => d.decision === 'reject');
    const hasRevision = request.decisions.some(
      (d) => d.decision === 'request_revision'
    );

    if (hasReject) {
      request.status = 'rejected';
      this.emit({
        type: 'request:rejected',
        request,
        timestamp: request.respondedAt,
      });
    } else if (hasRevision) {
      request.status = 'revision_requested';
      this.emit({
        type: 'request:revision',
        request,
        timestamp: request.respondedAt,
      });
    } else {
      request.status = 'approved';
      this.emit({
        type: 'request:approved',
        request,
        timestamp: request.respondedAt,
      });
    }

    // Clear timeout
    this.clearRequestTimeout(request.id);
  }

  /**
   * Approve all flows in a request
   */
  async approveAll(
    requestId: string,
    reviewer: string,
    comments?: string
  ): Promise<ApprovalRequest> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const now = new Date().toISOString();

    for (const flowId of request.flowIds) {
      // Skip if already decided
      if (request.decisions.some((d) => d.flowId === flowId)) continue;

      await this.submitDecision({
        flowId,
        decision: 'approve',
        reviewer,
        timestamp: now,
        comments,
      });
    }

    return this.pendingRequests.get(requestId)!;
  }

  /**
   * Reject all flows in a request
   */
  async rejectAll(
    requestId: string,
    reviewer: string,
    comments: string
  ): Promise<ApprovalRequest> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const now = new Date().toISOString();

    for (const flowId of request.flowIds) {
      // Skip if already decided
      if (request.decisions.some((d) => d.flowId === flowId)) continue;

      await this.submitDecision({
        flowId,
        decision: 'reject',
        reviewer,
        timestamp: now,
        comments,
      });
    }

    return this.pendingRequests.get(requestId)!;
  }

  /**
   * Request revision for all flows
   */
  async requestRevisionAll(
    requestId: string,
    reviewer: string,
    comments: string
  ): Promise<ApprovalRequest> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    const now = new Date().toISOString();

    for (const flowId of request.flowIds) {
      // Skip if already decided
      if (request.decisions.some((d) => d.flowId === flowId)) continue;

      await this.submitDecision({
        flowId,
        decision: 'request_revision',
        reviewer,
        timestamp: now,
        comments,
      });
    }

    return this.pendingRequests.get(requestId)!;
  }

  /**
   * Get pending requests
   */
  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingRequests.values()).filter(
      (r) => r.status === 'pending'
    );
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * Handle request timeout
   */
  private async handleTimeout(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request || request.status !== 'pending') {
      return;
    }

    request.status = 'rejected';
    request.respondedAt = new Date();

    await this.stateStore.saveApprovalRequest(request);

    this.emit({
      type: 'request:timeout',
      request,
      timestamp: request.respondedAt,
    });
  }

  /**
   * Cancel a pending request
   */
  async cancelRequest(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Request not found: ${requestId}`);
    }

    // Clear timeout
    this.clearRequestTimeout(requestId);

    // Emit cancel event before removal
    this.emit({
      type: 'request:cancelled',
      request,
      timestamp: new Date(),
    });

    // Remove from pending
    this.pendingRequests.delete(requestId);

    // Delete from store
    await this.stateStore.deleteApprovalRequest(requestId);
  }

  /**
   * Clear timeout for a request
   */
  private clearRequestTimeout(requestId: string): void {
    const timeout = this.timeouts.get(requestId);
    if (timeout) {
      globalThis.clearTimeout(timeout);
      this.timeouts.delete(requestId);
    }
  }

  /**
   * Load pending requests from store (recovery)
   */
  async loadPendingRequests(): Promise<void> {
    const requests = await this.stateStore.getPendingApprovalRequests();

    for (const request of requests) {
      this.pendingRequests.set(request.id, request);

      // Restore timeouts
      if (request.expiresAt) {
        const remaining = request.expiresAt.getTime() - Date.now();

        if (remaining > 0) {
          const timeout = globalThis.setTimeout(() => {
            this.handleTimeout(request.id);
          }, remaining);
          this.timeouts.set(request.id, timeout);
        } else {
          // Already timed out
          await this.handleTimeout(request.id);
        }
      }
    }
  }

  /**
   * Add event listener
   */
  addListener(listener: ApprovalGateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove event listener
   */
  removeListener(listener: ApprovalGateListener): boolean {
    return this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: ApprovalGateEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      globalThis.clearTimeout(timeout);
    }
    this.timeouts.clear();
    this.listeners.clear();
    this.pendingRequests.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an approval gate with in-memory store
 */
export function createApprovalGate(
  stateStore?: ApprovalStateStore
): ApprovalGate {
  return new ApprovalGate(stateStore);
}

/**
 * Format approval request for CLI display
 */
export function formatApprovalRequestForCli(
  request: ApprovalRequest,
  collection?: FlowCollection
): string {
  const lines: string[] = [
    '',
    '═'.repeat(60),
    'APPROVAL REQUIRED',
    '═'.repeat(60),
  ];

  if (collection) {
    lines.push(`Feature: ${collection.featureName}`);
    lines.push(`Flows: ${collection.flows.length}`);
    lines.push('');
    lines.push('Flows to review:');

    for (const flow of collection.flows) {
      lines.push(`  • ${flow.name}: ${flow.description}`);
      lines.push(
        `    Steps: ${flow.steps.length}, Transitions: ${flow.transitions.length}`
      );
    }
  } else {
    lines.push(`Request ID: ${request.id}`);
    lines.push(`Flow IDs: ${request.flowIds.join(', ')}`);
  }

  lines.push('');
  lines.push('Options:');
  lines.push('  [A] Approve all');
  lines.push('  [R] Reject all');
  lines.push('  [V] Request revision');
  lines.push('  [D] View detailed flows');

  if (request.expiresAt) {
    const remaining = request.expiresAt.getTime() - Date.now();
    const minutes = Math.max(0, Math.floor(remaining / 60000));
    lines.push('');
    lines.push(`⏱ Expires in ${minutes} minutes`);
  }

  lines.push('');

  return lines.join('\n');
}
