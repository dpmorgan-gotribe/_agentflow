/**
 * Database Module
 *
 * NestJS module for PostgreSQL database integration with Drizzle ORM.
 * Provides database connection, repositories, and tenant context management.
 */

import { Module, Global, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '../../config';
import {
  createDatabase,
  closeDatabase,
  isDatabaseHealthy,
  type Database,
} from '@aigentflow/database';

/**
 * Database provider token
 */
export const DATABASE_TOKEN = 'DATABASE_CONNECTION';

/**
 * Database provider factory
 */
const databaseProvider = {
  provide: DATABASE_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Database | null => {
    const logger = new Logger('DatabaseModule');
    const databaseUrl = configService.databaseUrl;

    if (!databaseUrl) {
      logger.warn(
        'DATABASE_URL not configured - running in memory-only mode. ' +
          'Set DATABASE_URL to enable PostgreSQL persistence.'
      );
      return null;
    }

    try {
      const db = createDatabase({
        connectionUrl: databaseUrl,
        maxConnections: 10,
        idleTimeout: 20,
        connectTimeout: 10,
      });

      logger.log('Database connection initialized successfully');
      return db;
    } catch (error) {
      logger.error('Failed to initialize database connection', error);
      throw error;
    }
  },
};

/**
 * Database health check provider
 */
const healthCheckProvider = {
  provide: 'DATABASE_HEALTH_CHECK',
  useValue: isDatabaseHealthy,
};

@Global()
@Module({
  providers: [databaseProvider, healthCheckProvider],
  exports: [DATABASE_TOKEN, 'DATABASE_HEALTH_CHECK'],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing database connections...');
    await closeDatabase();
    this.logger.log('Database connections closed');
  }
}
