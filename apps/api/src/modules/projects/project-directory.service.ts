/**
 * Project Directory Service
 *
 * Manages project directories including creation, git initialization,
 * and artifact file management. Creates a structured project folder
 * that multi-agent systems can use for context.
 *
 * When DATABASE_URL is configured, projects are also inserted into
 * PostgreSQL to satisfy foreign key constraints from the tasks table.
 */

import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  extractProjectName,
  generateUniqueSlug,
  type ProjectNameResult,
} from './project-name-extractor.js';
import { DATABASE_TOKEN } from '../database/index.js';
import {
  ProjectRepository,
  type Database,
} from '@aigentflow/database';

/**
 * Base directory for all projects (at repository root, not in apps/api)
 * This keeps user-generated projects separate from the aigentflow codebase
 */
const PROJECTS_BASE_DIR = path.resolve(
  process.cwd(),
  '../../.aigentflow/projects'
);

/**
 * Project metadata stored in .aigentflow.json
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  slug: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  techStack?: Record<string, unknown>;
  status: 'initializing' | 'active' | 'archived';
}

/**
 * Directory structure template for new projects
 */
const PROJECT_STRUCTURE = [
  'docs/architecture/decisions',
  'docs/api',
  'designs/mockups',
  'designs/tokens',
  'designs/flows',
  'src',
];

/**
 * Project info returned after creation
 */
export interface ProjectInfo {
  id: string;
  name: string;
  slug: string;
  path: string;
  isNew: boolean;
}

@Injectable()
export class ProjectDirectoryService implements OnModuleInit {
  private readonly logger = new Logger(ProjectDirectoryService.name);
  private existingProjects = new Set<string>();
  private projectMap = new Map<string, ProjectMetadata>();

  /**
   * Whether database mode is active (for FK constraint satisfaction)
   */
  private readonly useDatabase: boolean;

  constructor(
    @Optional() @Inject(DATABASE_TOKEN) private readonly db: Database | null
  ) {
    this.useDatabase = this.db !== null;
  }

  async onModuleInit(): Promise<void> {
    await this.loadExistingProjects();
  }

  /**
   * Load existing projects from disk
   */
  private async loadExistingProjects(): Promise<void> {
    try {
      await fs.mkdir(PROJECTS_BASE_DIR, { recursive: true });
      const entries = await fs.readdir(PROJECTS_BASE_DIR, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          this.existingProjects.add(entry.name);

          // Load metadata if exists
          const metadataPath = path.join(
            PROJECTS_BASE_DIR,
            entry.name,
            '.aigentflow.json'
          );
          try {
            const data = await fs.readFile(metadataPath, 'utf-8');
            const metadata = JSON.parse(data) as ProjectMetadata;
            this.projectMap.set(metadata.id, metadata);
          } catch {
            // No metadata file, skip
          }
        }
      }

      this.logger.log(
        `Loaded ${this.existingProjects.size} existing projects`
      );
    } catch (error) {
      this.logger.warn('Failed to load existing projects:', error);
    }
  }

  /**
   * Get or create a project directory for a task
   *
   * @param projectId - UUID of the project
   * @param prompt - User prompt to extract name from
   * @param tenantId - Tenant ID for database insertion (required when DATABASE_URL is configured)
   * @returns Project info with path
   */
  async getOrCreateProject(
    projectId: string,
    prompt: string,
    tenantId?: string
  ): Promise<ProjectInfo> {
    // Check if project already exists by ID
    const existing = this.projectMap.get(projectId);
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        path: path.join(PROJECTS_BASE_DIR, existing.slug),
        isNew: false,
      };
    }

    // Extract project name from prompt
    const nameResult = extractProjectName(prompt);
    const slug = generateUniqueSlug(nameResult.name, this.existingProjects);

    // Create project directory
    const projectPath = path.join(PROJECTS_BASE_DIR, slug);
    await this.createProjectStructure(projectPath);

    // Initialize git
    await this.initGitRepo(projectPath);

    // Create metadata
    const metadata: ProjectMetadata = {
      id: projectId,
      name: nameResult.name,
      slug,
      prompt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'initializing',
    };

    // Save metadata
    await this.saveMetadata(projectPath, metadata);

    // Insert into database if configured (for FK constraint satisfaction)
    if (this.useDatabase && tenantId) {
      await this.insertProjectToDatabase(projectId, tenantId, nameResult.name, prompt);
    }

    // Track project
    this.existingProjects.add(slug);
    this.projectMap.set(projectId, metadata);

    this.logger.log(
      `Created project directory: ${slug} (explicit: ${nameResult.isExplicit})`
    );

    return {
      id: projectId,
      name: nameResult.name,
      slug,
      path: projectPath,
      isNew: true,
    };
  }

  /**
   * Insert project into PostgreSQL database
   * This satisfies the FK constraint from the tasks table
   */
  private async insertProjectToDatabase(
    projectId: string,
    tenantId: string,
    name: string,
    description: string
  ): Promise<void> {
    if (!this.db) return;

    try {
      const repo = new ProjectRepository(this.db, tenantId);
      await repo.create({
        id: projectId,
        tenantId,
        name,
        description,
        status: 'active',
      });
      this.logger.debug(`Inserted project ${projectId} into database for tenant ${tenantId}`);
    } catch (error) {
      // Log but don't throw - file system is the source of truth
      // The database insert failing shouldn't block project creation
      this.logger.error(`Failed to insert project into database: ${error}`);
      throw error; // Re-throw to prevent task creation with invalid FK
    }
  }

  /**
   * Create the project directory structure
   */
  private async createProjectStructure(projectPath: string): Promise<void> {
    for (const dir of PROJECT_STRUCTURE) {
      const fullPath = path.join(projectPath, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }
  }

  /**
   * Initialize a git repository in the project
   */
  private async initGitRepo(projectPath: string): Promise<void> {
    try {
      await this.runGitCommand(projectPath, ['init']);

      // Create .gitignore
      const gitignore = `# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/
.nyc_output/
`;
      await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);

      this.logger.debug(`Initialized git repo at ${projectPath}`);
    } catch (error) {
      this.logger.warn(`Failed to init git repo: ${error}`);
    }
  }

  /**
   * Run a git command in a directory
   */
  private runGitCommand(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, { cwd, shell: true });
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Save project metadata
   */
  private async saveMetadata(
    projectPath: string,
    metadata: ProjectMetadata
  ): Promise<void> {
    const metadataPath = path.join(projectPath, '.aigentflow.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Update project metadata
   */
  async updateMetadata(
    projectId: string,
    updates: Partial<ProjectMetadata>
  ): Promise<void> {
    const metadata = this.projectMap.get(projectId);
    if (!metadata) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const updated = {
      ...metadata,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const projectPath = path.join(PROJECTS_BASE_DIR, metadata.slug);
    await this.saveMetadata(projectPath, updated);
    this.projectMap.set(projectId, updated);
  }

  /**
   * Write CLAUDE.md file to project
   */
  async writeClaudeMd(projectId: string, content: string): Promise<string> {
    const metadata = this.projectMap.get(projectId);
    if (!metadata) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const filePath = path.join(PROJECTS_BASE_DIR, metadata.slug, 'CLAUDE.md');
    await fs.writeFile(filePath, content, 'utf-8');

    this.logger.log(`Wrote CLAUDE.md for project ${metadata.slug}`);
    return filePath;
  }

  /**
   * Write a file to the project directory
   */
  async writeFile(
    projectId: string,
    relativePath: string,
    content: string
  ): Promise<string> {
    const metadata = this.projectMap.get(projectId);
    if (!metadata) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Validate path (prevent traversal)
    const normalizedPath = path.normalize(relativePath);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      throw new Error(`Invalid path: ${relativePath}`);
    }

    const filePath = path.join(PROJECTS_BASE_DIR, metadata.slug, normalizedPath);
    const fileDir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(fileDir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  /**
   * Write multiple files to the project
   */
  async writeFiles(
    projectId: string,
    files: Array<{ path: string; content: string }>
  ): Promise<string[]> {
    const paths: string[] = [];
    for (const file of files) {
      const filePath = await this.writeFile(projectId, file.path, file.content);
      paths.push(filePath);
    }
    return paths;
  }

  /**
   * Create directory structure from architect output
   */
  async createDirectoryStructure(
    projectId: string,
    structure: { path: string; description: string; children?: unknown[] }
  ): Promise<void> {
    const metadata = this.projectMap.get(projectId);
    if (!metadata) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const basePath = path.join(PROJECTS_BASE_DIR, metadata.slug);
    await this.createStructureRecursive(basePath, structure);
  }

  private async createStructureRecursive(
    basePath: string,
    node: { path: string; description?: string; children?: unknown[] },
    prefix = ''
  ): Promise<void> {
    const nodePath = path.join(basePath, prefix, node.path);

    // Create directory
    await fs.mkdir(nodePath, { recursive: true });

    // Create .description file for documentation
    if (node.description) {
      const descPath = path.join(nodePath, '.description');
      await fs.writeFile(descPath, node.description, 'utf-8');
    }

    // Recurse into children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === 'object' && child !== null && 'path' in child) {
          await this.createStructureRecursive(
            basePath,
            child as { path: string; description?: string; children?: unknown[] },
            path.join(prefix, node.path)
          );
        }
      }
    }
  }

  /**
   * Create a new project explicitly with a name
   *
   * @param name - Project name
   * @param description - Optional project description
   * @param tenantId - Tenant ID for database insertion (required when DATABASE_URL is configured)
   * @returns Project metadata
   */
  async createProject(name: string, description?: string, tenantId?: string): Promise<ProjectMetadata> {
    const id = crypto.randomUUID();
    const slug = generateUniqueSlug(name, this.existingProjects);

    // Create project directory
    const projectPath = path.join(PROJECTS_BASE_DIR, slug);
    await this.createProjectStructure(projectPath);

    // Initialize git
    await this.initGitRepo(projectPath);

    // Create metadata
    const metadata: ProjectMetadata = {
      id,
      name,
      slug,
      prompt: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };

    // Save metadata
    await this.saveMetadata(projectPath, metadata);

    // Insert into database if configured (for FK constraint satisfaction)
    if (this.useDatabase && tenantId) {
      await this.insertProjectToDatabase(id, tenantId, name, description || '');
    }

    // Track project
    this.existingProjects.add(slug);
    this.projectMap.set(id, metadata);

    this.logger.log(`Created project: ${name} (${slug})`);

    return metadata;
  }

  /**
   * Get the absolute path to a project
   */
  getProjectPath(projectId: string): string | null {
    const metadata = this.projectMap.get(projectId);
    if (!metadata) {
      return null;
    }
    return path.resolve(PROJECTS_BASE_DIR, metadata.slug);
  }

  /**
   * Get project metadata by ID
   */
  getProject(projectId: string): ProjectMetadata | null {
    return this.projectMap.get(projectId) ?? null;
  }

  /**
   * List all projects
   */
  listProjects(): ProjectMetadata[] {
    return Array.from(this.projectMap.values());
  }

  /**
   * Commit current state to git
   */
  async commitChanges(
    projectId: string,
    message: string
  ): Promise<void> {
    const metadata = this.projectMap.get(projectId);
    if (!metadata) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const projectPath = path.join(PROJECTS_BASE_DIR, metadata.slug);

    try {
      await this.runGitCommand(projectPath, ['add', '-A']);
      await this.runGitCommand(projectPath, [
        'commit',
        '-m',
        `"${message.replace(/"/g, '\\"')}"`,
        '--allow-empty',
      ]);
      this.logger.debug(`Committed changes: ${message}`);
    } catch (error) {
      this.logger.warn(`Failed to commit: ${error}`);
    }
  }

  /**
   * Delete a single project by ID
   *
   * Note: The caller should abort running tasks BEFORE calling this method.
   * This method only handles file/database deletion.
   */
  async deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
    // Find project by ID
    let projectSlug: string | undefined;
    let projectMeta: ProjectMetadata | undefined;

    for (const [slug, meta] of this.projectMap.entries()) {
      if (meta.id === projectId) {
        projectSlug = slug;
        projectMeta = meta;
        break;
      }
    }

    if (!projectSlug || !projectMeta) {
      return { success: false, error: `Project not found: ${projectId}` };
    }

    const projectPath = path.join(PROJECTS_BASE_DIR, projectSlug);

    try {
      // Delete from disk
      await fs.rm(projectPath, { recursive: true, force: true });
      this.logger.log(`Deleted project directory: ${projectSlug}`);

      // Delete from database if using database mode
      if (this.useDatabase && this.db) {
        try {
          const repo = new ProjectRepository(this.db);
          await repo.delete(projectId);
          this.logger.log(`Deleted project from database: ${projectId}`);
        } catch (dbError) {
          // Log but don't fail - disk deletion succeeded
          this.logger.warn(`Failed to delete project from database: ${dbError}`);
        }
      }

      // Remove from in-memory state
      this.existingProjects.delete(projectSlug);
      this.projectMap.delete(projectSlug);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete project ${projectSlug}: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Delete all projects from disk
   */
  async deleteAllProjects(): Promise<{ deleted: string[]; errors: string[] }> {
    const deleted: string[] = [];
    const errors: string[] = [];

    for (const slug of this.existingProjects) {
      const projectPath = path.join(PROJECTS_BASE_DIR, slug);
      try {
        await fs.rm(projectPath, { recursive: true, force: true });
        deleted.push(slug);
        this.logger.log(`Deleted project: ${slug}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${slug}: ${message}`);
        this.logger.warn(`Failed to delete project ${slug}: ${message}`);
      }
    }

    // Clear in-memory state
    this.existingProjects.clear();
    this.projectMap.clear();

    return { deleted, errors };
  }
}
