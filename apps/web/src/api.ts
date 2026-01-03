import type { Task, Artifact, AgentEvent, Project } from './types';

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
  // Only set Content-Type if there's a body
  const headers: HeadersInit = {
    Authorization: `Bearer ${DEV_TOKEN}`,
    ...options.headers,
  };

  if (options.body) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
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
export async function createTask(prompt: string, projectId: string): Promise<Task> {
  return fetchApi<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
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
 * Approval options for style selection
 */
export interface ApprovalSubmitOptions {
  /** Approval decision */
  approved: boolean;
  /** Selected option ID (for style selection) */
  selectedOption?: string;
  /** Reject all options and trigger re-research */
  rejectAll?: boolean;
  /** Feedback explaining the decision */
  feedback?: string;
}

/**
 * Submit approval decision for a task
 */
export async function submitApproval(
  taskId: string,
  approved: boolean,
  feedbackOrOptions?: string | Omit<ApprovalSubmitOptions, 'approved'>
): Promise<void> {
  // Handle both old signature (string feedback) and new options object
  const body: ApprovalSubmitOptions = typeof feedbackOrOptions === 'string'
    ? { approved, feedback: feedbackOrOptions }
    : { approved, ...feedbackOrOptions };

  await fetchApi(`/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Get SSE stream URL for task events (includes auth token as query param)
 */
export function getTaskStreamUrl(taskId: string): string {
  return `${API_BASE}/tasks/${taskId}/stream?token=${DEV_TOKEN}`;
}

/**
 * Trigger server shutdown
 * Also passes the frontend port so the API can kill the Vite dev server
 */
export async function triggerShutdown(reason?: string): Promise<{ message: string; shuttingDown: boolean }> {
  // Get the current port from the browser's URL (e.g., 5173 for Vite)
  const frontendPort = window.location.port ? parseInt(window.location.port, 10) : undefined;

  return fetchApi<{ message: string; shuttingDown: boolean }>('/system/shutdown', {
    method: 'POST',
    body: JSON.stringify({
      reason: reason ?? 'User clicked Kill All button',
      frontendPort,
    }),
  });
}

/**
 * Get system status
 */
export async function getSystemStatus(): Promise<{ status: string; shuttingDown: boolean; uptime: number }> {
  return fetchApi<{ status: string; shuttingDown: boolean; uptime: number }>('/system/status', {
    method: 'POST',
  });
}

/**
 * Delete all projects (cleanup)
 */
export async function cleanupProjects(): Promise<{ deleted: string[]; errors: string[] }> {
  return fetchApi<{ deleted: string[]; errors: string[] }>('/projects', {
    method: 'DELETE',
    body: JSON.stringify({}), // Empty body required when Content-Type is set
  });
}

/**
 * Delete a single project by ID
 * Also aborts all running tasks for the project
 */
export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; abortedTasks: number; error?: string }> {
  return fetchApi<{ success: boolean; abortedTasks: number; error?: string }>(
    `/projects/${projectId}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Workflow settings interface
 */
export interface WorkflowSettings {
  stylePackageCount: number;
  parallelDesignerCount: number;
  enableStyleCompetition: boolean;
  maxStyleRejections: number;
  claudeCliTimeoutMs: number;
}

/**
 * Get current workflow settings
 */
export async function getSettings(): Promise<WorkflowSettings> {
  return fetchApi<WorkflowSettings>('/settings');
}

/**
 * Update workflow settings (partial update)
 */
export async function updateSettings(settings: Partial<WorkflowSettings>): Promise<WorkflowSettings> {
  return fetchApi<WorkflowSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<WorkflowSettings> {
  return fetchApi<WorkflowSettings>('/settings/reset', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * Fetch stored events for a task
 * Used to restore session after page refresh
 */
export async function fetchTaskEvents(taskId: string): Promise<AgentEvent[]> {
  return fetchApi<AgentEvent[]>(`/tasks/${taskId}/events`);
}

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  return fetchApi<Project[]>('/projects');
}

/**
 * Create a new project
 */
export async function createProject(name: string, description?: string): Promise<Project> {
  return fetchApi<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

/**
 * Get a project by ID
 */
export async function getProject(projectId: string): Promise<Project> {
  return fetchApi<Project>(`/projects/${projectId}`);
}

// ============================================================================
// Orchestrator Interaction
// ============================================================================

/**
 * Orchestrator message
 */
export interface OrchestratorMessage {
  id: string;
  taskId: string;
  role: 'user' | 'orchestrator';
  content: string;
  timestamp: string;
}

/**
 * Send a message to the orchestrator
 */
export async function sendOrchestratorMessage(
  taskId: string,
  content: string
): Promise<OrchestratorMessage> {
  const response = await fetchApi<{ message: OrchestratorMessage }>(
    `/tasks/${taskId}/orchestrator/message`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
  return response.message;
}

/**
 * Get orchestrator conversation history
 */
export async function getOrchestratorHistory(taskId: string): Promise<OrchestratorMessage[]> {
  const response = await fetchApi<{ messages: OrchestratorMessage[] }>(
    `/tasks/${taskId}/orchestrator/messages`
  );
  return response.messages;
}

/**
 * Clear orchestrator conversation history
 */
export async function clearOrchestratorHistory(taskId: string): Promise<void> {
  await fetchApi(`/tasks/${taskId}/orchestrator/history`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Generic API Client
// ============================================================================

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
