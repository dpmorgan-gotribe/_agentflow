/**
 * Lessons Schema
 *
 * Captured learnings and patterns for continuous improvement.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
  integer,
} from 'drizzle-orm/pg-core';

import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { tenants } from './tenants.js';

export const lessonCategoryEnum = pgEnum('lesson_category', [
  'bug_fix',
  'architecture',
  'security',
  'performance',
  'pattern',
  'tooling',
  'process',
]);

export const lessonSeverityEnum = pgEnum('lesson_severity', [
  'info',
  'warning',
  'critical',
]);

export interface LessonTags {
  components: string[];
  technologies: string[];
  keywords: string[];
}

export interface LessonContext {
  symptom?: string;
  rootCause?: string;
  solution?: string;
  codeExamples?: Array<{
    before?: string;
    after?: string;
    language: string;
  }>;
}

export interface LessonMetrics {
  timesApplied: number;
  preventedIssues: number;
  lastApplied?: string;
}

export const lessons = pgTable(
  'lessons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    taskId: uuid('task_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),

    // Lesson content
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    category: lessonCategoryEnum('category').notNull(),
    severity: lessonSeverityEnum('severity').notNull().default('info'),

    // Detailed context
    context: jsonb('context').$type<LessonContext>().default({}),

    // Tags for searchability
    tags: jsonb('tags').$type<LessonTags>().default({
      components: [],
      technologies: [],
      keywords: [],
    }),

    // Usage metrics
    metrics: jsonb('metrics').$type<LessonMetrics>().default({
      timesApplied: 0,
      preventedIssues: 0,
    }),

    // Relevance scoring
    relevanceScore: integer('relevance_score').default(50),

    // Capture metadata
    capturedBy: text('captured_by'), // agent role or 'user'
    phase: text('phase'), // e.g., 'Phase 1', 'CP0'

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    archivedAt: timestamp('archived_at'),
  },
  (table) => [
    index('lessons_tenant_idx').on(table.tenantId),
    index('lessons_project_idx').on(table.projectId),
    index('lessons_category_idx').on(table.category),
    index('lessons_severity_idx').on(table.severity),
  ]
);

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
