/**
 * User Repository
 *
 * Repository for user operations with tenant isolation.
 */

import { eq, and, desc } from 'drizzle-orm';
import { BaseRepository } from './base.repository.js';
import type { Database } from '../client.js';
import { users, type User, type NewUser } from '../schema/index.js';

/**
 * User repository with tenant isolation
 */
export class UserRepository extends BaseRepository<
  typeof users,
  NewUser,
  User
> {
  constructor(db: Database, tenantId?: string) {
    super(db, users, tenantId);
  }

  /**
   * Find user by email within tenant
   */
  async findByEmail(email: string): Promise<User | undefined> {
    const condition = this.withTenantFilter(eq(users.email, email));

    const results = await this.db
      .select()
      .from(users)
      .where(condition!)
      .limit(1);

    return results[0] as User | undefined;
  }

  /**
   * Find user by external ID (from auth provider)
   */
  async findByExternalId(externalId: string): Promise<User | undefined> {
    const condition = this.withTenantFilter(eq(users.externalId, externalId));

    const results = await this.db
      .select()
      .from(users)
      .where(condition!)
      .limit(1);

    return results[0] as User | undefined;
  }

  /**
   * Find users by role
   */
  async findByRole(role: User['role']): Promise<User[]> {
    const condition = this.withTenantFilter(eq(users.role, role));

    const results = await this.db
      .select()
      .from(users)
      .where(condition!)
      .orderBy(desc(users.createdAt));

    return results as User[];
  }

  /**
   * Find active users
   */
  async findActive(): Promise<User[]> {
    const condition = this.withTenantFilter(eq(users.status, 'active'));

    const results = await this.db
      .select()
      .from(users)
      .where(condition!)
      .orderBy(desc(users.createdAt));

    return results as User[];
  }

  /**
   * Find pending users (awaiting activation)
   */
  async findPending(): Promise<User[]> {
    const condition = this.withTenantFilter(eq(users.status, 'pending'));

    const results = await this.db
      .select()
      .from(users)
      .where(condition!)
      .orderBy(desc(users.createdAt));

    return results as User[];
  }

  /**
   * Activate a user
   */
  async activate(id: string): Promise<User | undefined> {
    return this.update(id, { status: 'active' });
  }

  /**
   * Suspend a user
   */
  async suspend(id: string): Promise<User | undefined> {
    return this.update(id, { status: 'suspended' });
  }

  /**
   * Soft delete a user
   */
  async softDelete(id: string): Promise<User | undefined> {
    return this.update(id, {
      status: 'deleted',
      deletedAt: new Date(),
    });
  }

  /**
   * Update user role
   */
  async updateRole(id: string, role: User['role']): Promise<User | undefined> {
    return this.update(id, { role });
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<User | undefined> {
    return this.update(id, { lastLoginAt: new Date() });
  }

  /**
   * Check if email exists in tenant
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== undefined;
  }

  /**
   * Get tenant owner
   */
  async findOwner(): Promise<User | undefined> {
    return (await this.findByRole('owner'))[0];
  }

  /**
   * Get tenant admins
   */
  async findAdmins(): Promise<User[]> {
    return this.findByRole('admin');
  }

  /**
   * Count users by status
   */
  async countByStatus(): Promise<Record<string, number>> {
    const allUsers = await this.findAll({ limit: 1000 });
    const counts: Record<string, number> = {
      active: 0,
      pending: 0,
      suspended: 0,
      deleted: 0,
    };

    for (const user of allUsers) {
      counts[user.status] = (counts[user.status] || 0) + 1;
    }

    return counts;
  }

  /**
   * Find or create user by external ID
   */
  async findOrCreateByExternalId(
    externalId: string,
    userData: Omit<NewUser, 'externalId'>
  ): Promise<{ user: User; created: boolean }> {
    const existing = await this.findByExternalId(externalId);
    if (existing) {
      return { user: existing, created: false };
    }

    const created = await this.create({
      ...userData,
      externalId,
    });

    return { user: created, created: true };
  }
}
