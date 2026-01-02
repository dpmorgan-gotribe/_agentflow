/**
 * Artifact Repository
 *
 * Repository for artifact operations with task-based tenant isolation.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  artifacts,
  tasks,
  type Artifact,
  type NewArtifact,
} from '../schema/index.js';

/**
 * Artifact repository with task-based tenant isolation
 */
export class ArtifactRepository {
  constructor(
    private readonly db: Database,
    private readonly tenantId?: string
  ) {}

  /**
   * Find artifact by ID with tenant check via task
   */
  async findById(id: string): Promise<Artifact | undefined> {
    const results = await this.db
      .select()
      .from(artifacts)
      .innerJoin(tasks, eq(artifacts.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(artifacts.id, id), eq(tasks.tenantId, this.tenantId))
          : eq(artifacts.id, id)
      )
      .limit(1);

    return results[0]?.artifacts as Artifact | undefined;
  }

  /**
   * Find all artifacts for a task
   */
  async findByTaskId(taskId: string): Promise<Artifact[]> {
    const results = await this.db
      .select()
      .from(artifacts)
      .innerJoin(tasks, eq(artifacts.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(artifacts.taskId, taskId), eq(tasks.tenantId, this.tenantId))
          : eq(artifacts.taskId, taskId)
      )
      .orderBy(desc(artifacts.createdAt));

    return results.map((r) => r.artifacts) as Artifact[];
  }

  /**
   * Find artifacts by status
   */
  async findByStatus(status: Artifact['status']): Promise<Artifact[]> {
    const results = await this.db
      .select()
      .from(artifacts)
      .innerJoin(tasks, eq(artifacts.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(artifacts.status, status), eq(tasks.tenantId, this.tenantId))
          : eq(artifacts.status, status)
      )
      .orderBy(desc(artifacts.createdAt));

    return results.map((r) => r.artifacts) as Artifact[];
  }

  /**
   * Find artifacts pending review
   */
  async findPendingReview(): Promise<Artifact[]> {
    return this.findByStatus('pending_review');
  }

  /**
   * Create a new artifact
   */
  async create(data: NewArtifact): Promise<Artifact> {
    const result = await this.db.insert(artifacts).values(data).returning();
    return result[0] as Artifact;
  }

  /**
   * Create multiple artifacts
   */
  async createMany(data: NewArtifact[]): Promise<Artifact[]> {
    if (data.length === 0) return [];
    const result = await this.db.insert(artifacts).values(data).returning();
    return result as Artifact[];
  }

  /**
   * Update an artifact
   */
  async update(
    id: string,
    data: Partial<NewArtifact>
  ): Promise<Artifact | undefined> {
    // Verify tenant access first
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const result = await this.db
      .update(artifacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(artifacts.id, id))
      .returning();

    return result[0] as Artifact | undefined;
  }

  /**
   * Update artifact status
   */
  async updateStatus(
    id: string,
    status: Artifact['status']
  ): Promise<Artifact | undefined> {
    return this.update(id, { status });
  }

  /**
   * Approve an artifact
   */
  async approve(id: string, userId: string): Promise<Artifact | undefined> {
    return this.update(id, {
      status: 'approved',
      approved: true,
      approvedBy: userId,
      approvedAt: new Date(),
    });
  }

  /**
   * Reject an artifact
   */
  async reject(id: string): Promise<Artifact | undefined> {
    return this.update(id, {
      status: 'rejected',
      approved: false,
    });
  }

  /**
   * Delete an artifact
   */
  async delete(id: string): Promise<boolean> {
    // Verify tenant access first
    const existing = await this.findById(id);
    if (!existing) return false;

    const result = await this.db
      .delete(artifacts)
      .where(eq(artifacts.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Delete all artifacts for a task
   */
  async deleteByTaskId(taskId: string): Promise<number> {
    const result = await this.db
      .delete(artifacts)
      .where(eq(artifacts.taskId, taskId))
      .returning();

    return result.length;
  }

  /**
   * Find artifacts by type
   */
  async findByType(type: Artifact['type']): Promise<Artifact[]> {
    const results = await this.db
      .select()
      .from(artifacts)
      .innerJoin(tasks, eq(artifacts.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(eq(artifacts.type, type), eq(tasks.tenantId, this.tenantId))
          : eq(artifacts.type, type)
      )
      .orderBy(desc(artifacts.createdAt));

    return results.map((r) => r.artifacts) as Artifact[];
  }

  /**
   * Find artifacts by IDs
   */
  async findByIds(ids: string[]): Promise<Artifact[]> {
    if (ids.length === 0) return [];

    const results = await this.db
      .select()
      .from(artifacts)
      .innerJoin(tasks, eq(artifacts.taskId, tasks.id))
      .where(
        this.tenantId
          ? and(inArray(artifacts.id, ids), eq(tasks.tenantId, this.tenantId))
          : inArray(artifacts.id, ids)
      );

    return results.map((r) => r.artifacts) as Artifact[];
  }
}
