/**
 * Projects Controller
 *
 * Exposes API endpoints for listing projects and their files.
 */

import {
  Controller,
  Delete,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { ProjectDirectoryService, type ProjectMetadata } from './project-directory.service.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * File tree node for directory structure
 */
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

/**
 * Project with file tree
 */
interface ProjectWithFiles extends ProjectMetadata {
  path: string;
  files: FileNode[];
}

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectDirectoryService: ProjectDirectoryService) {}

  /**
   * List all projects
   */
  @Get()
  async listProjects(): Promise<ProjectMetadata[]> {
    return this.projectDirectoryService.listProjects();
  }

  /**
   * Get a project by ID
   */
  @Get(':id')
  async getProject(@Param('id') id: string): Promise<ProjectMetadata> {
    const project = this.projectDirectoryService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }
    return project;
  }

  /**
   * Get project files
   */
  @Get(':id/files')
  async getProjectFiles(
    @Param('id') id: string,
    @Query('depth') depthStr?: string
  ): Promise<ProjectWithFiles> {
    const project = this.projectDirectoryService.getProject(id);
    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    const projectPath = this.projectDirectoryService.getProjectPath(id);
    if (!projectPath) {
      throw new NotFoundException(`Project path not found: ${id}`);
    }

    const depth = depthStr ? parseInt(depthStr, 10) : 3;
    const files = await this.buildFileTree(projectPath, '', depth);

    return {
      ...project,
      path: projectPath,
      files,
    };
  }

  /**
   * Build file tree recursively
   */
  private async buildFileTree(
    basePath: string,
    relativePath: string,
    maxDepth: number,
    currentDepth = 0
  ): Promise<FileNode[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const fullPath = relativePath
      ? path.join(basePath, relativePath)
      : basePath;

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      // Sort: directories first, then files, alphabetically
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of sorted) {
        // Skip hidden files and common ignore patterns
        if (this.shouldIgnore(entry.name)) {
          continue;
        }

        const entryRelativePath = relativePath
          ? path.join(relativePath, entry.name)
          : entry.name;

        const node: FileNode = {
          name: entry.name,
          path: entryRelativePath.replace(/\\/g, '/'), // Normalize to forward slashes
          type: entry.isDirectory() ? 'directory' : 'file',
        };

        if (entry.isDirectory()) {
          node.children = await this.buildFileTree(
            basePath,
            entryRelativePath,
            maxDepth,
            currentDepth + 1
          );
        }

        nodes.push(node);
      }

      return nodes;
    } catch (error) {
      // Directory might not exist or be inaccessible
      return [];
    }
  }

  /**
   * Check if a file/directory should be ignored
   */
  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      '.git',
      'node_modules',
      '.DS_Store',
      'Thumbs.db',
      '.env',
      '.env.local',
      'dist',
      'build',
      '.next',
      '.turbo',
      'coverage',
      '.nyc_output',
    ];

    return (
      name.startsWith('.') && name !== '.aigentflow.json' ||
      ignorePatterns.includes(name)
    );
  }

  /**
   * Delete all projects (cleanup)
   */
  @Delete()
  async deleteAllProjects(): Promise<{ deleted: string[]; errors: string[] }> {
    return this.projectDirectoryService.deleteAllProjects();
  }
}
