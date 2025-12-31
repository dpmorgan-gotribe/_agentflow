/**
 * Artifact Schema
 *
 * Generated files, code, and assets from agent executions.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uuid,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';

import { tasks } from './tasks.js';
import { taskExecutions } from './task-executions.js';

export const artifactTypeEnum = pgEnum('artifact_type', [
  'mockup',
  'source_file',
  'test_file',
  'config_file',
  'documentation',
  'schema',
  'migration',
  'asset',
]);

export const artifactStatusEnum = pgEnum('artifact_status', [
  'generated',
  'pending_review',
  'approved',
  'rejected',
  'superseded',
]);

export interface ArtifactMetadata {
  language?: string;
  framework?: string;
  mimeType?: string;
  encoding?: string;
  generatedBy?: string;
  version?: number;
  dependencies?: string[];
  checksum?: string;
}

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    executionId: uuid('execution_id').references(() => taskExecutions.id, {
      onDelete: 'set null',
    }),

    // Artifact details
    type: artifactTypeEnum('type').notNull(),
    path: text('path').notNull(),
    filename: text('filename').notNull(),

    // Content (for small artifacts, large ones use storage)
    content: text('content'),
    contentSize: integer('content_size'),

    // Status
    status: artifactStatusEnum('status').notNull().default('generated'),
    approved: boolean('approved'),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at'),

    // Metadata
    metadata: jsonb('metadata').$type<ArtifactMetadata>().default({}),

    // Versioning
    version: integer('version').default(1),
    previousVersionId: uuid('previous_version_id'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('artifacts_task_idx').on(table.taskId),
    index('artifacts_execution_idx').on(table.executionId),
    index('artifacts_type_idx').on(table.type),
    index('artifacts_status_idx').on(table.status),
    index('artifacts_path_idx').on(table.path),
  ]
);

export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;
