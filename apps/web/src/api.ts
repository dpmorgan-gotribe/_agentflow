import type { Task, Artifact } from './types';

const API_BASE = '/api/v1';

/**
 * Development auth token - matches the dev bypass in AuthGuard
 * Only works when API is in development mode
 */
const DEV_TOKEN = 'dev-token-12345';

/**
 * Generic fetch wrapper with auth and error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEV_TOKEN}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Create a new task from user prompt
 */
export async function createTask(prompt: string): Promise<Task> {
  return fetchApi<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      projectId: '123e4567-e89b-12d3-a456-426614174000', // Dev project UUID
      prompt,
    }),
  });
}

/**
 * Get task by ID
 */
export async function getTask(taskId: string): Promise<Task> {
  return fetchApi<Task>(`/tasks/${taskId}`);
}

/**
 * Get artifacts for a task
 */
export async function getArtifacts(taskId: string): Promise<Artifact[]> {
  return fetchApi<Artifact[]>(`/tasks/${taskId}/artifacts`);
}

/**
 * Submit approval decision for a task
 */
export async function submitApproval(
  taskId: string,
  approved: boolean,
  feedback?: string
): Promise<void> {
  await fetchApi(`/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved, feedback }),
  });
}

/**
 * Get SSE stream URL for task events (includes auth token as query param)
 */
export function getTaskStreamUrl(taskId: string): string {
  return `${API_BASE}/tasks/${taskId}/stream?token=${DEV_TOKEN}`;
}

/**
 * API client with typed methods
 */
export const apiClient = {
  /**
   * Generic GET request
   */
  async get<T>(endpoint: string): Promise<T> {
    return fetchApi<T>(endpoint);
  },

  /**
   * Generic POST request
   */
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return fetchApi<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
