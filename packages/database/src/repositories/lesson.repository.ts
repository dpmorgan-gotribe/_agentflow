/**
 * Lesson Repository
 *
 * Repository for lessons with search, tagging, and metrics tracking.
 */

import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
import type { Database } from '../client.js';
import {
  lessons,
  type Lesson,
  type NewLesson,
  type LessonMetrics,
} from '../schema/index.js';

/**
 * Search options for lessons
 */
export interface LessonSearchOptions {
  query?: string;
  category?: Lesson['category'];
  component?: string;
  technology?: string;
  limit?: number;
  offset?: number;
}

/**
 * Lesson repository with search and metrics
 */
export class LessonRepository extends BaseRepository<
  typeof lessons,
  NewLesson,
  Lesson
> {
  constructor(db: Database, tenantId?: string) {
    super(db, lessons, tenantId);
  }

  /**
   * Find lessons by category
   */
  async findByCategory(category: Lesson['category']): Promise<Lesson[]> {
    const condition = this.withTenantFilter(eq(lessons.category, category));

    const query = this.db.select().from(lessons);
    const results = condition
      ? await (query.where(condition) as typeof query).orderBy(
          desc(lessons.relevanceScore)
        )
      : await query.orderBy(desc(lessons.relevanceScore));

    return results as Lesson[];
  }

  /**
   * Find lessons by component (in tags.components array)
   */
  async findByComponent(component: string): Promise<Lesson[]> {
    const tenantCondition = this.getTenantCondition();
    const componentCondition = sql`${lessons.tags}->'components' ? ${component}`;

    const condition = tenantCondition
      ? and(tenantCondition, componentCondition)
      : componentCondition;

    const results = await this.db
      .select()
      .from(lessons)
      .where(condition)
      .orderBy(desc(lessons.relevanceScore));

    return results as Lesson[];
  }

  /**
   * Find lessons by technology (in tags.technologies array)
   */
  async findByTechnology(technology: string): Promise<Lesson[]> {
    const tenantCondition = this.getTenantCondition();
    const techCondition = sql`${lessons.tags}->'technologies' ? ${technology}`;

    const condition = tenantCondition
      ? and(tenantCondition, techCondition)
      : techCondition;

    const results = await this.db
      .select()
      .from(lessons)
      .where(condition)
      .orderBy(desc(lessons.relevanceScore));

    return results as Lesson[];
  }

  /**
   * Find lessons by keywords (in tags.keywords array)
   */
  async findByKeywords(keywords: string[]): Promise<Lesson[]> {
    if (keywords.length === 0) {
      return [];
    }

    const tenantCondition = this.getTenantCondition();

    // Use JSONB ?| operator for array containment (any keyword matches)
    const keywordCondition = sql`${lessons.tags}->'keywords' ?| array[${sql.join(
      keywords.map((k) => sql`${k}`),
      sql`, `
    )}]`;

    const condition = tenantCondition
      ? and(tenantCondition, keywordCondition)
      : keywordCondition;

    const results = await this.db
      .select()
      .from(lessons)
      .where(condition)
      .orderBy(desc(lessons.relevanceScore));

    return results as Lesson[];
  }

  /**
   * Search lessons by text (title and summary)
   */
  async search(query: string, limit: number = 20): Promise<Lesson[]> {
    if (!query.trim()) {
      return this.findAll({ limit });
    }

    const searchPattern = `%${query}%`;
    const tenantCondition = this.getTenantCondition();

    const searchCondition = or(
      ilike(lessons.title, searchPattern),
      ilike(lessons.summary, searchPattern)
    );

    const condition = tenantCondition
      ? and(tenantCondition, searchCondition)
      : searchCondition;

    const results = await this.db
      .select()
      .from(lessons)
      .where(condition!)
      .orderBy(desc(lessons.relevanceScore))
      .limit(limit);

    return results as Lesson[];
  }

  /**
   * Advanced search with multiple filters
   */
  async advancedSearch(options: LessonSearchOptions): Promise<Lesson[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    const tenantCondition = this.getTenantCondition();

    if (tenantCondition) {
      conditions.push(tenantCondition as ReturnType<typeof eq>);
    }

    if (options.category) {
      conditions.push(eq(lessons.category, options.category));
    }

    if (options.component) {
      conditions.push(
        sql`${lessons.tags}->'components' ? ${options.component}` as ReturnType<typeof eq>
      );
    }

    if (options.technology) {
      conditions.push(
        sql`${lessons.tags}->'technologies' ? ${options.technology}` as ReturnType<typeof eq>
      );
    }

    if (options.query) {
      const searchPattern = `%${options.query}%`;
      conditions.push(
        or(
          ilike(lessons.title, searchPattern),
          ilike(lessons.summary, searchPattern)
        ) as ReturnType<typeof eq>
      );
    }

    let query = this.db.select().from(lessons);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    query = query.orderBy(desc(lessons.relevanceScore)) as typeof query;
    query = query.limit(options.limit ?? 20) as typeof query;

    if (options.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query as Promise<Lesson[]>;
  }

  /**
   * Increment times applied when lesson is used
   */
  async incrementTimesApplied(id: string): Promise<void> {
    const condition = this.withTenantFilter(eq(lessons.id, id));
    if (!condition) {
      return;
    }

    await this.db
      .update(lessons)
      .set({
        metrics: sql`jsonb_set(
          ${lessons.metrics},
          '{timesApplied}',
          to_jsonb(COALESCE((${lessons.metrics}->>'timesApplied')::int, 0) + 1)
        )`,
        updatedAt: new Date(),
      })
      .where(condition);
  }

  /**
   * Increment prevented issues count
   */
  async incrementPreventedIssues(id: string): Promise<void> {
    const condition = this.withTenantFilter(eq(lessons.id, id));
    if (!condition) {
      return;
    }

    await this.db
      .update(lessons)
      .set({
        metrics: sql`jsonb_set(
          jsonb_set(
            ${lessons.metrics},
            '{preventedIssues}',
            to_jsonb(COALESCE((${lessons.metrics}->>'preventedIssues')::int, 0) + 1)
          ),
          '{lastApplied}',
          to_jsonb(${new Date().toISOString()})
        )`,
        updatedAt: new Date(),
      })
      .where(condition);
  }

  /**
   * Update relevance score
   */
  async updateRelevanceScore(id: string, score: number): Promise<Lesson | undefined> {
    // Clamp score between 0 and 100
    const clampedScore = Math.max(0, Math.min(100, score));
    return this.update(id, { relevanceScore: clampedScore });
  }

  /**
   * Archive a lesson
   */
  async archive(id: string): Promise<Lesson | undefined> {
    return this.update(id, { archivedAt: new Date() });
  }

  /**
   * Unarchive a lesson
   */
  async unarchive(id: string): Promise<Lesson | undefined> {
    return this.update(id, { archivedAt: null });
  }

  /**
   * Get top lessons by relevance score
   */
  async getTopLessons(limit: number = 10): Promise<Lesson[]> {
    const tenantCondition = this.getTenantCondition();

    const query = this.db.select().from(lessons);
    const results = tenantCondition
      ? await (query.where(tenantCondition) as typeof query)
          .orderBy(desc(lessons.relevanceScore))
          .limit(limit)
      : await query.orderBy(desc(lessons.relevanceScore)).limit(limit);

    return results as Lesson[];
  }

  /**
   * Get lessons with high usage (most times applied)
   */
  async getMostApplied(limit: number = 10): Promise<Lesson[]> {
    const tenantCondition = this.getTenantCondition();

    let query = this.db.select().from(lessons);

    if (tenantCondition) {
      query = query.where(tenantCondition) as typeof query;
    }

    const results = await query
      .orderBy(sql`(${lessons.metrics}->>'timesApplied')::int DESC NULLS LAST`)
      .limit(limit);

    return results as Lesson[];
  }

  /**
   * Find lessons by severity
   */
  async findBySeverity(severity: Lesson['severity']): Promise<Lesson[]> {
    const condition = this.withTenantFilter(eq(lessons.severity, severity));

    const query = this.db.select().from(lessons);
    const results = condition
      ? await (query.where(condition) as typeof query).orderBy(
          desc(lessons.relevanceScore)
        )
      : await query.orderBy(desc(lessons.relevanceScore));

    return results as Lesson[];
  }

  /**
   * Find critical lessons
   */
  async findCritical(): Promise<Lesson[]> {
    return this.findBySeverity('critical');
  }
}
