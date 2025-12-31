/**
 * Project Repository
 *
 * Repository for project operations.
 */

import { eq, desc, sql } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
import type { Database } from '../client.js';
import {
  projects,
  tasks,
  type Project,
  type NewProject,
} from '../schema/index.js';

/**
 * Project with statistics
 */
export interface ProjectWithStats extends Project {
  taskCount: number;
  completedTaskCount: number;
}

/**
 * Project repository
 */
export class ProjectRepository extends BaseRepository<
  typeof projects,
  NewProject,
  Project
> {
  constructor(db: Database, tenantId?: string) {
    super(db, projects, tenantId);
  }

  /**
   * Find projects by status
   */
  async findByStatus(status: Project['status']): Promise<Project[]> {
    const condition = this.withTenantFilter(eq(projects.status, status));

    const query = this.db.select().from(projects);
    const results = condition
      ? await (query.where(condition) as typeof query).orderBy(
          desc(projects.updatedAt)
        )
      : await query.orderBy(desc(projects.updatedAt));

    return results as Project[];
  }

  /**
   * Find active projects
   */
  async findActive(): Promise<Project[]> {
    return this.findByStatus('active');
  }

  /**
   * Archive a project
   */
  async archive(id: string): Promise<Project | undefined> {
    return this.update(id, { status: 'archived' });
  }

  /**
   * Activate a project
   */
  async activate(id: string): Promise<Project | undefined> {
    return this.update(id, { status: 'active' });
  }

  /**
   * Get project with task statistics
   */
  async getWithStats(id: string): Promise<ProjectWithStats | null> {
    const project = await this.findById(id);
    if (!project) {
      return null;
    }

    const stats = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
      })
      .from(tasks)
      .where(eq(tasks.projectId, id));

    return {
      ...project,
      taskCount: stats[0]?.total ?? 0,
      completedTaskCount: stats[0]?.completed ?? 0,
    };
  }

  /**
   * Get all projects with task counts
   */
  async getAllWithStats(): Promise<ProjectWithStats[]> {
    const projectList = await this.findAll();

    const projectsWithStats = await Promise.all(
      projectList.map(async (project) => {
        const stats = await this.db
          .select({
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`,
          })
          .from(tasks)
          .where(eq(tasks.projectId, project.id));

        return {
          ...project,
          taskCount: stats[0]?.total ?? 0,
          completedTaskCount: stats[0]?.completed ?? 0,
        };
      })
    );

    return projectsWithStats;
  }

  /**
   * Update project configuration
   */
  async updateConfig(
    id: string,
    config: Partial<Project['config']>
  ): Promise<Project | undefined> {
    const project = await this.findById(id);
    if (!project) {
      return undefined;
    }

    const mergedConfig = { ...project.config, ...config };
    return this.update(id, { config: mergedConfig });
  }

  /**
   * Find projects by repository URL
   */
  async findByRepositoryUrl(repositoryUrl: string): Promise<Project | undefined> {
    const condition = this.withTenantFilter(
      eq(projects.repositoryUrl, repositoryUrl)
    );

    const query = this.db.select().from(projects);
    const results = condition
      ? await (query.where(condition) as typeof query).limit(1)
      : await query.limit(1);

    return results[0] as Project | undefined;
  }
}
