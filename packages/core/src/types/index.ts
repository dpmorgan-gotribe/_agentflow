/**
 * Core type definitions for Aigentflow.
 */

import { z } from 'zod';

/**
 * Base result type for all operations.
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Agent status enum.
 */
export const AgentStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

/**
 * Agent status schema for runtime validation.
 */
export const agentStatusSchema = z.enum([
  'idle',
  'running',
  'paused',
  'completed',
  'failed',
]);

/**
 * Tenant identifier type.
 */
export type TenantId = string & { readonly __brand: unique symbol };

/**
 * Create a branded TenantId.
 */
export function createTenantId(id: string): TenantId {
  return id as TenantId;
}

/**
 * User identifier type.
 */
export type UserId = string & { readonly __brand: unique symbol };

/**
 * Create a branded UserId.
 */
export function createUserId(id: string): UserId {
  return id as UserId;
}
