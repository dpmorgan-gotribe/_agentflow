/**
 * API Client
 *
 * HTTP client for communicating with the Aigentflow API.
 * Includes error sanitization and input validation.
 */

import got, { type Got, HTTPError, TimeoutError } from 'got';
import type { Config } from '../config/types.js';
import type {
  CreateTaskInput,
  TaskStatus,
  ApprovalDecision,
  ListTasksOptions,
} from './types.js';
import {
  CreateTaskInputSchema,
  TaskStatusSchema,
  ApprovalDecisionSchema,
} from '../types.js';
import {
  APIConnectionError,
  APIAuthenticationError,
  TaskNotFoundError,
} from '../errors.js';
import { API_ENDPOINTS, CONFIG_DEFAULTS } from '../constants.js';
import { sanitizeErrorMessage, sanitizeUrl } from '../security/sanitizer.js';
import { validateTaskId, validateApiUrl } from '../security/validator.js';
import type { ExecutionMode } from '../types.js';

/**
 * API Client for Aigentflow
 *
 * Wraps HTTP communication with the API server.
 */
export class ApiClient {
  private readonly client: Got;
  private readonly mode: ExecutionMode;
  private readonly baseUrl: string;

  constructor(config: Config, mode: ExecutionMode = 'local') {
    this.mode = mode;

    // Determine base URL based on mode
    this.baseUrl =
      mode === 'local'
        ? `http://localhost:${config.api.port}`
        : config.api.remoteUrl;

    // Validate remote URL
    if (mode === 'remote') {
      validateApiUrl(this.baseUrl);
    }

    // Create HTTP client with secure defaults
    this.client = got.extend({
      prefixUrl: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'aigentflow-cli/0.0.0',
        ...(config.api.token
          ? { Authorization: `Bearer ${config.api.token}` }
          : {}),
      },
      responseType: 'json',
      timeout: {
        request: config.api.timeout || CONFIG_DEFAULTS.REQUEST_TIMEOUT_MS,
      },
      retry: {
        limit: 2,
        methods: ['GET'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      },
      // For remote mode, enforce TLS verification
      https:
        mode === 'remote'
          ? {
              rejectUnauthorized: true,
            }
          : undefined,
    });
  }

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput): Promise<{ id: string }> {
    // Validate input
    const validation = CreateTaskInputSchema.safeParse(input);
    if (!validation.success) {
      throw new APIConnectionError(
        `Invalid task input: ${validation.error.errors[0]?.message || 'unknown error'}`
      );
    }

    try {
      const response = await this.client
        .post(API_ENDPOINTS.TASKS.slice(1), {
          json: validation.data,
        })
        .json<{ id: string }>();

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get task status by ID
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    // Validate task ID
    const validatedId = validateTaskId(taskId);

    try {
      const response = await this.client
        .get(API_ENDPOINTS.TASK_BY_ID(validatedId).slice(1))
        .json<TaskStatus>();

      // Validate response structure
      const validation = TaskStatusSchema.safeParse(response);
      if (!validation.success) {
        throw new APIConnectionError(
          'Invalid response from API: unexpected task status format'
        );
      }

      return validation.data;
    } catch (error) {
      throw this.handleError(error, taskId);
    }
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(options: ListTasksOptions = {}): Promise<TaskStatus[]> {
    try {
      const searchParams: Record<string, string | number> = {};

      if (options.limit !== undefined) {
        searchParams['limit'] = options.limit;
      }
      if (options.offset !== undefined) {
        searchParams['offset'] = options.offset;
      }
      if (options.state !== undefined) {
        searchParams['state'] = options.state;
      }

      const response = await this.client
        .get(API_ENDPOINTS.TASKS.slice(1), { searchParams })
        .json<TaskStatus[]>();

      // Validate each task in response
      const validated: TaskStatus[] = [];
      for (const task of response) {
        const validation = TaskStatusSchema.safeParse(task);
        if (validation.success) {
          validated.push(validation.data);
        }
      }

      return validated;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Submit approval decision for a task
   */
  async submitApproval(
    taskId: string,
    decision: ApprovalDecision
  ): Promise<void> {
    // Validate task ID
    const validatedId = validateTaskId(taskId);

    // Validate decision
    const validation = ApprovalDecisionSchema.safeParse(decision);
    if (!validation.success) {
      throw new APIConnectionError(
        `Invalid approval decision: ${validation.error.errors[0]?.message || 'unknown error'}`
      );
    }

    try {
      await this.client.post(API_ENDPOINTS.TASK_APPROVE(validatedId).slice(1), {
        json: validation.data,
      });
    } catch (error) {
      throw this.handleError(error, taskId);
    }
  }

  /**
   * Get the SSE stream URL for a task
   */
  getStreamUrl(taskId: string): string {
    const validatedId = validateTaskId(taskId);
    return `${this.baseUrl}${API_ENDPOINTS.TASK_STREAM(validatedId)}`;
  }

  /**
   * Get the current execution mode
   */
  getMode(): ExecutionMode {
    return this.mode;
  }

  /**
   * Get the base URL (sanitized for display)
   */
  getBaseUrl(): string {
    return sanitizeUrl(this.baseUrl);
  }

  /**
   * Handle API errors with sanitization
   */
  private handleError(error: unknown, taskId?: string): never {
    // HTTP errors
    if (error instanceof HTTPError) {
      const statusCode = error.response?.statusCode;

      // Authentication error
      if (statusCode === 401) {
        throw new APIAuthenticationError();
      }

      // Not found
      if (statusCode === 404 && taskId) {
        throw new TaskNotFoundError(taskId);
      }

      // Extract error message from response body
      let message = 'API request failed';
      const body = error.response?.body as
        | { error?: { message?: string } }
        | undefined;
      if (body?.error?.message) {
        message = sanitizeErrorMessage(body.error.message);
      } else if (error.message) {
        message = sanitizeErrorMessage(error.message);
      }

      throw new APIConnectionError(message, statusCode);
    }

    // Timeout errors
    if (error instanceof TimeoutError) {
      throw new APIConnectionError('API request timed out');
    }

    // Network errors
    if (error instanceof Error) {
      const message = sanitizeErrorMessage(error.message);

      // Check for connection refused
      if (
        message.includes('ECONNREFUSED') ||
        message.includes('connect ECONNREFUSED')
      ) {
        throw new APIConnectionError(
          `Unable to connect to API at ${sanitizeUrl(this.baseUrl)}. Is the server running?`
        );
      }

      throw new APIConnectionError(message);
    }

    // Unknown error
    throw new APIConnectionError('An unexpected error occurred');
  }
}
