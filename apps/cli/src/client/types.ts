/**
 * API Client Types
 *
 * Type definitions for API communication.
 */

import type { TaskStatus, CreateTaskInput, ApprovalDecision } from '../types.js';

/**
 * API client options
 */
export interface ApiClientOptions {
  baseUrl: string;
  token?: string;
  timeout?: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Task list query options
 */
export interface ListTasksOptions {
  limit?: number;
  offset?: number;
  state?: string;
}

/**
 * Re-export types from main types module
 */
export type { TaskStatus, CreateTaskInput, ApprovalDecision };
