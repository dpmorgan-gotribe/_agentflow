/**
 * Base Repository
 *
 * Abstract base class providing common CRUD operations with tenant isolation.
 * All repositories should extend this class for consistent behavior.
 */

import { eq, and, SQL, desc, asc } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { Database } from '../client.js';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'asc' | 'desc';
  orderColumn?: string;
}

/**
 * Result with pagination metadata
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Repository configuration
 */
export interface RepositoryConfig {
  maxLimit?: number;
  defaultLimit?: number;
}

const DEFAULT_CONFIG: RepositoryConfig = {
  maxLimit: 100,
  defaultLimit: 20,
};

/**
 * Abstract base repository with tenant isolation
 *
 * @template TTable - Drizzle table type
 * @template TInsert - Insert type (from $inferInsert)
 * @template TSelect - Select type (from $inferSelect)
 */
export abstract class BaseRepository<
  TTable extends PgTable,
  TInsert,
  TSelect extends { id: string },
> {
  protected readonly config: RepositoryConfig;

  constructor(
    protected readonly db: Database,
    protected readonly table: TTable,
    protected readonly tenantId?: string,
    config?: Partial<RepositoryConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get tenant filtering condition if tenant isolation is enabled
   */
  protected getTenantCondition(): SQL | undefined {
    if (!this.tenantId) {
      return undefined;
    }

    // Check if table has tenantId column
    const tableColumns = this.table as unknown as Record<string, PgColumn>;
    if (!('tenantId' in tableColumns)) {
      return undefined;
    }

    return eq(tableColumns['tenantId'] as PgColumn, this.tenantId);
  }

  /**
   * Combine conditions with tenant filter
   */
  protected withTenantFilter(...conditions: (SQL | undefined)[]): SQL | undefined {
    const tenantCondition = this.getTenantCondition();
    const allConditions = [tenantCondition, ...conditions].filter(
      (c): c is SQL => c !== undefined
    );

    if (allConditions.length === 0) {
      return undefined;
    }

    if (allConditions.length === 1) {
      return allConditions[0];
    }

    return and(...allConditions);
  }

  /**
   * Get the ID column from the table
   */
  protected getIdColumn(): PgColumn {
    const tableColumns = this.table as unknown as Record<string, PgColumn>;
    return tableColumns['id'] as PgColumn;
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<TSelect | undefined> {
    const idColumn = this.getIdColumn();
    const condition = this.withTenantFilter(eq(idColumn, id));

    const query = this.db.select().from(this.table);
    const results = condition
      ? await (query.where(condition) as unknown as typeof query).limit(1)
      : await query.limit(1);

    return results[0] as TSelect | undefined;
  }

  /**
   * Find all records with optional pagination
   */
  async findAll(options?: PaginationOptions): Promise<TSelect[]> {
    const limit = Math.min(
      options?.limit ?? this.config.defaultLimit!,
      this.config.maxLimit!
    );
    const offset = options?.offset ?? 0;
    const tenantCondition = this.getTenantCondition();

    let query = this.db.select().from(this.table);

    if (tenantCondition) {
      query = query.where(tenantCondition) as unknown as typeof query;
    }

    // Apply ordering
    const tableColumns = this.table as unknown as Record<string, PgColumn>;
    const orderColumn = options?.orderColumn
      ? tableColumns[options.orderColumn]
      : tableColumns['createdAt'];

    if (orderColumn) {
      query =
        options?.orderBy === 'asc'
          ? (query.orderBy(asc(orderColumn)) as unknown as typeof query)
          : (query.orderBy(desc(orderColumn)) as unknown as typeof query);
    }

    query = query.limit(limit) as unknown as typeof query;
    query = query.offset(offset) as unknown as typeof query;

    return query as Promise<TSelect[]>;
  }

  /**
   * Find all records with pagination metadata
   */
  async findAllPaginated(
    options?: PaginationOptions
  ): Promise<PaginatedResult<TSelect>> {
    const limit = Math.min(
      options?.limit ?? this.config.defaultLimit!,
      this.config.maxLimit!
    );
    const offset = options?.offset ?? 0;

    const [data, countResult] = await Promise.all([
      this.findAll({ ...options, limit, offset }),
      this.count(),
    ]);

    return {
      data,
      total: countResult,
      limit,
      offset,
      hasMore: offset + data.length < countResult,
    };
  }

  /**
   * Count total records
   */
  async count(condition?: SQL): Promise<number> {
    const finalCondition = this.withTenantFilter(condition);

    const query = this.db.select().from(this.table);
    const results = finalCondition
      ? await (query.where(finalCondition) as unknown as typeof query)
      : await query;

    return results.length;
  }

  /**
   * Create a new record
   */
  async create(data: TInsert): Promise<TSelect> {
    // Add tenantId if available and table supports it
    const insertData = this.tenantId
      ? { ...data, tenantId: this.tenantId }
      : data;

    // Use type assertion for Drizzle's complex type requirements
    const result = await this.db
      .insert(this.table)
      .values(insertData as unknown as TTable['$inferInsert'])
      .returning();

    return result[0] as TSelect;
  }

  /**
   * Create multiple records
   */
  async createMany(data: TInsert[]): Promise<TSelect[]> {
    if (data.length === 0) {
      return [];
    }

    // Add tenantId if available
    const insertData = this.tenantId
      ? data.map((d) => ({ ...d, tenantId: this.tenantId }))
      : data;

    // Use type assertion for Drizzle's complex type requirements
    const result = await this.db
      .insert(this.table)
      .values(insertData as unknown as TTable['$inferInsert'][])
      .returning();

    return result as TSelect[];
  }

  /**
   * Update a record by ID
   */
  async update(
    id: string,
    data: Partial<TInsert>
  ): Promise<TSelect | undefined> {
    const idColumn = this.getIdColumn();
    const condition = this.withTenantFilter(eq(idColumn, id));

    if (!condition) {
      return undefined;
    }

    // Add updatedAt if table has it
    const tableColumns = this.table as unknown as Record<string, PgColumn>;
    const updateData =
      'updatedAt' in tableColumns
        ? { ...data, updatedAt: new Date() }
        : data;

    // Prevent updating tenantId
    const { tenantId: _, ...safeData } = updateData as Record<string, unknown>;

    // Use type assertion for Drizzle's complex type requirements
    const result = await this.db
      .update(this.table)
      .set(safeData as unknown as Partial<TTable['$inferInsert']>)
      .where(condition)
      .returning();

    return result[0] as TSelect | undefined;
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const idColumn = this.getIdColumn();
    const condition = this.withTenantFilter(eq(idColumn, id));

    if (!condition) {
      return false;
    }

    const result = await this.db
      .delete(this.table)
      .where(condition)
      .returning();

    return result.length > 0;
  }

  /**
   * Delete multiple records by IDs
   */
  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    let deleted = 0;
    for (const id of ids) {
      const success = await this.delete(id);
      if (success) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== undefined;
  }
}
