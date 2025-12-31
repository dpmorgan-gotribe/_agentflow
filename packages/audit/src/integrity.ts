/**
 * Integrity Manager
 *
 * Tamper detection through cryptographic hash chains.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEvent,
  IntegrityCheckResult,
  IntegrityReport,
} from './types.js';
import { AuditStore } from './audit-store.js';
import { AuditIntegrityError } from './errors.js';

/**
 * Integrity Manager implementation
 */
export class IntegrityManager {
  private readonly store: AuditStore;
  private lastHash: string = '';

  constructor(store: AuditStore) {
    this.store = store;
  }

  /**
   * Initialize integrity manager
   */
  async initialize(): Promise<void> {
    // Load last hash from store
    const lastSequence = await this.store.getLastSequence();
    if (lastSequence > 0) {
      const events = await this.store.query({});
      if (events.length > 0) {
        const lastEvent = events[events.length - 1]!;
        this.lastHash = lastEvent.hash;
      }
    }
  }

  /**
   * Get last hash for chain continuity
   */
  async getLastHash(): Promise<string> {
    return this.lastHash;
  }

  /**
   * Calculate event hash
   *
   * Includes all critical fields to detect tampering.
   */
  calculateEventHash(event: Omit<AuditEvent, 'hash'>): string {
    // Include ALL fields that could indicate tampering
    const hashInput = {
      id: event.id,
      timestamp: event.timestamp,
      sequence: event.sequence,
      category: event.category,
      action: event.action,
      severity: event.severity,
      outcome: event.outcome,
      sessionId: event.sessionId,
      projectId: event.projectId,
      workflowId: event.workflowId,
      correlationId: event.correlationId,
      actor: event.actor,
      target: event.target,
      description: event.description,
      details: event.details,
      changes: event.changes,
      error: event.error,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      previousHash: event.previousHash,
    };

    const hash = createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex');

    this.lastHash = hash;
    return hash;
  }

  /**
   * Verify single event hash
   */
  verifyEventHash(event: AuditEvent): boolean {
    const eventWithoutHash = { ...event };
    delete (eventWithoutHash as Record<string, unknown>)['hash'];

    const calculated = this.calculateEventHashInternal(eventWithoutHash);
    return calculated === event.hash;
  }

  /**
   * Internal hash calculation (doesn't update lastHash)
   */
  private calculateEventHashInternal(event: Omit<AuditEvent, 'hash'>): string {
    const hashInput = {
      id: event.id,
      timestamp: event.timestamp,
      sequence: event.sequence,
      category: event.category,
      action: event.action,
      severity: event.severity,
      outcome: event.outcome,
      sessionId: event.sessionId,
      projectId: event.projectId,
      workflowId: event.workflowId,
      correlationId: event.correlationId,
      actor: event.actor,
      target: event.target,
      description: event.description,
      details: event.details,
      changes: event.changes,
      error: event.error,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      previousHash: event.previousHash,
    };

    return createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex');
  }

  /**
   * Verify chain integrity
   */
  async verifyChain(startDate?: Date, endDate?: Date): Promise<IntegrityCheckResult> {
    const events = await this.store.query({ startDate, endDate });

    const result: IntegrityCheckResult = {
      valid: true,
      checkedEvents: events.length,
      invalidEvents: [],
      chainBroken: false,
    };

    let expectedPreviousHash = '';

    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;

      // Verify hash
      if (!this.verifyEventHash(event)) {
        result.valid = false;
        result.invalidEvents.push({
          id: event.id,
          sequence: event.sequence,
          issue: 'Hash mismatch - event may have been modified',
        });
      }

      // Verify chain linkage (skip first event)
      if (i > 0 && event.previousHash !== expectedPreviousHash) {
        result.valid = false;
        result.chainBroken = true;
        result.chainBreakPoint = event.sequence;
        result.invalidEvents.push({
          id: event.id,
          sequence: event.sequence,
          issue: 'Chain broken - previousHash does not match expected value',
        });
      }

      expectedPreviousHash = event.hash;
    }

    return result;
  }

  /**
   * Generate integrity report
   */
  async generateIntegrityReport(): Promise<IntegrityReport> {
    const events = await this.store.query({});
    const verifyResult = await this.verifyChain();

    const report: IntegrityReport = {
      timestamp: new Date().toISOString(),
      result: verifyResult,
      statistics: {
        totalEvents: events.length,
        dateRange: {
          start: events[0]?.timestamp ?? '',
          end: events[events.length - 1]?.timestamp ?? '',
        },
        hashAlgorithm: 'sha256',
      },
      signature: '',
    };

    // Sign the report (hash of report without signature)
    const reportForSigning = { ...report, signature: undefined };
    report.signature = createHash('sha256')
      .update(JSON.stringify(reportForSigning))
      .digest('hex');

    return report;
  }

  /**
   * Verify a report signature
   */
  verifyReportSignature(report: IntegrityReport): boolean {
    const reportForSigning = { ...report, signature: undefined };
    const expectedSignature = createHash('sha256')
      .update(JSON.stringify(reportForSigning))
      .digest('hex');

    return report.signature === expectedSignature;
  }

  /**
   * Detect tampering and throw if found
   */
  async assertIntegrity(startDate?: Date, endDate?: Date): Promise<void> {
    const result = await this.verifyChain(startDate, endDate);

    if (!result.valid) {
      const firstInvalid = result.invalidEvents[0];
      throw new AuditIntegrityError(
        `Audit log integrity compromised: ${firstInvalid?.issue ?? 'Unknown issue'}`,
        firstInvalid?.id,
        firstInvalid?.sequence
      );
    }
  }
}
