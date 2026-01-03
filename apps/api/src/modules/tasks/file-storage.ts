/**
 * File-based storage for tasks and artifacts
 *
 * Persists tasks and artifacts to disk so they survive server restarts.
 * Uses JSON files in the .aigentflow/data directory.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Logger } from '@nestjs/common';

const logger = new Logger('FileStorage');

/**
 * Base directory for persistent storage
 */
const DATA_DIR = '.aigentflow/data';
const TASKS_FILE = 'tasks.json';
const ARTIFACTS_DIR = 'artifacts';
const EVENTS_DIR = 'events';

/**
 * Stored task structure (serializable)
 */
export interface PersistedTask {
  id: string;
  projectId: string;
  tenantId: string;
  prompt: string;
  status: string;
  priority: string;
  analysis?: Record<string, unknown>;
  currentAgent?: string;
  completedAgents: string[];
  error?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stored artifact structure (serializable)
 */
export interface PersistedArtifact {
  id: string;
  taskId: string;
  type: string;
  name: string;
  path: string;
  content?: string;
  createdAt: string;
}

/**
 * Stored event structure (serializable)
 */
export interface PersistedEvent {
  type: string;
  taskId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Initialize the storage directory structure
 */
export async function initStorage(): Promise<void> {
  const dirs = [
    DATA_DIR,
    path.join(DATA_DIR, ARTIFACTS_DIR),
    path.join(DATA_DIR, EVENTS_DIR),
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        logger.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  logger.log(`Storage initialized at ${DATA_DIR}`);
}

/**
 * Load all persisted tasks
 */
export async function loadTasks(): Promise<Map<string, PersistedTask>> {
  const tasksPath = path.join(DATA_DIR, TASKS_FILE);
  const tasks = new Map<string, PersistedTask>();

  try {
    const data = await fs.readFile(tasksPath, 'utf-8');
    const parsed = JSON.parse(data) as PersistedTask[];

    for (const task of parsed) {
      tasks.set(task.id, task);
    }

    logger.log(`Loaded ${tasks.size} tasks from disk`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Failed to load tasks:', error);
    }
    // File doesn't exist yet, return empty map
  }

  return tasks;
}

/**
 * Save all tasks to disk
 */
export async function saveTasks(tasks: Map<string, PersistedTask>): Promise<void> {
  const tasksPath = path.join(DATA_DIR, TASKS_FILE);
  const tasksArray = Array.from(tasks.values());

  try {
    await fs.writeFile(tasksPath, JSON.stringify(tasksArray, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to save tasks:', error);
    throw error;
  }
}

/**
 * Load artifacts for a specific task
 */
export async function loadArtifacts(taskId: string): Promise<PersistedArtifact[]> {
  const artifactsPath = path.join(DATA_DIR, ARTIFACTS_DIR, `${taskId}.json`);

  try {
    const data = await fs.readFile(artifactsPath, 'utf-8');
    return JSON.parse(data) as PersistedArtifact[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`Failed to load artifacts for task ${taskId}:`, error);
    }
    return [];
  }
}

/**
 * Load all artifacts for all tasks
 */
export async function loadAllArtifacts(): Promise<Map<string, PersistedArtifact[]>> {
  const artifactsDir = path.join(DATA_DIR, ARTIFACTS_DIR);
  const artifacts = new Map<string, PersistedArtifact[]>();

  try {
    const files = await fs.readdir(artifactsDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const taskId = file.replace('.json', '');
        const taskArtifacts = await loadArtifacts(taskId);
        if (taskArtifacts.length > 0) {
          artifacts.set(taskId, taskArtifacts);
        }
      }
    }

    const totalArtifacts = Array.from(artifacts.values()).reduce((sum, arr) => sum + arr.length, 0);
    logger.log(`Loaded ${totalArtifacts} artifacts for ${artifacts.size} tasks`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Failed to load artifacts:', error);
    }
  }

  return artifacts;
}

/**
 * Save artifacts for a specific task
 */
export async function saveArtifacts(taskId: string, artifacts: PersistedArtifact[]): Promise<void> {
  const artifactsPath = path.join(DATA_DIR, ARTIFACTS_DIR, `${taskId}.json`);

  try {
    await fs.writeFile(artifactsPath, JSON.stringify(artifacts, null, 2), 'utf-8');
  } catch (error) {
    logger.error(`Failed to save artifacts for task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Save artifact content to a file (for large artifacts)
 */
export async function saveArtifactContent(
  taskId: string,
  artifactId: string,
  content: string,
  extension: string = 'html'
): Promise<string> {
  const contentDir = path.join(DATA_DIR, ARTIFACTS_DIR, taskId);
  const contentPath = path.join(contentDir, `${artifactId}.${extension}`);

  try {
    await fs.mkdir(contentDir, { recursive: true });
    await fs.writeFile(contentPath, content, 'utf-8');
    return contentPath;
  } catch (error) {
    logger.error(`Failed to save artifact content ${artifactId}:`, error);
    throw error;
  }
}

/**
 * Delete artifacts for a task
 */
export async function deleteTaskArtifacts(taskId: string): Promise<void> {
  const artifactsPath = path.join(DATA_DIR, ARTIFACTS_DIR, `${taskId}.json`);
  const contentDir = path.join(DATA_DIR, ARTIFACTS_DIR, taskId);

  try {
    await fs.unlink(artifactsPath).catch(() => {});
    await fs.rm(contentDir, { recursive: true, force: true }).catch(() => {});
  } catch (error) {
    logger.warn(`Failed to delete artifacts for task ${taskId}:`, error);
  }
}

/**
 * Get the data directory path
 */
export function getDataDir(): string {
  return DATA_DIR;
}

/**
 * Load events for a specific task
 */
export async function loadEvents(taskId: string): Promise<PersistedEvent[]> {
  const eventsPath = path.join(DATA_DIR, EVENTS_DIR, `${taskId}.json`);

  try {
    const data = await fs.readFile(eventsPath, 'utf-8');
    return JSON.parse(data) as PersistedEvent[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(`Failed to load events for task ${taskId}:`, error);
    }
    return [];
  }
}

/**
 * Load all events for all tasks
 */
export async function loadAllEvents(): Promise<Map<string, PersistedEvent[]>> {
  const eventsDir = path.join(DATA_DIR, EVENTS_DIR);
  const events = new Map<string, PersistedEvent[]>();

  try {
    const files = await fs.readdir(eventsDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const taskId = file.replace('.json', '');
        const taskEvents = await loadEvents(taskId);
        if (taskEvents.length > 0) {
          events.set(taskId, taskEvents);
        }
      }
    }

    const totalEvents = Array.from(events.values()).reduce((sum, arr) => sum + arr.length, 0);
    logger.log(`Loaded ${totalEvents} events for ${events.size} tasks`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Failed to load events:', error);
    }
  }

  return events;
}

/**
 * Save events for a specific task
 */
export async function saveEvents(taskId: string, events: PersistedEvent[]): Promise<void> {
  const eventsPath = path.join(DATA_DIR, EVENTS_DIR, `${taskId}.json`);

  try {
    await fs.writeFile(eventsPath, JSON.stringify(events, null, 2), 'utf-8');
  } catch (error) {
    logger.error(`Failed to save events for task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Delete events for a task
 */
export async function deleteTaskEvents(taskId: string): Promise<void> {
  const eventsPath = path.join(DATA_DIR, EVENTS_DIR, `${taskId}.json`);

  try {
    await fs.unlink(eventsPath).catch(() => {});
  } catch (error) {
    logger.warn(`Failed to delete events for task ${taskId}:`, error);
  }
}
