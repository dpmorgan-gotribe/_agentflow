/**
 * Health Service
 *
 * Provides health check indicators for various components.
 */

import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';

import { ConfigService } from '../../config';

@Injectable()
export class HealthService extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  /**
   * Check database connectivity
   */
  checkDatabase(): HealthIndicatorResult {
    const key = 'database';

    try {
      // In a real implementation, this would check database connectivity
      // For now, we verify the database URL is configured
      const dbUrl = this.configService.databaseUrl;

      if (!dbUrl) {
        throw new Error('Database URL not configured');
      }

      return this.getStatus(key, true, {
        message: 'Database connection configured',
      });
    } catch (error) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
  }

  /**
   * Check memory usage
   */
  checkMemory(): HealthIndicatorResult {
    const key = 'memory';
    const heapUsed = process.memoryUsage().heapUsed;
    const heapTotal = process.memoryUsage().heapTotal;
    const heapUsedMB = Math.round(heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(heapTotal / 1024 / 1024);
    const heapUsagePercent = Math.round((heapUsed / heapTotal) * 100);

    // Alert if memory usage is above 90%
    const isHealthy = heapUsagePercent < 90;

    if (!isHealthy) {
      throw new HealthCheckError(
        'Memory usage too high',
        this.getStatus(key, false, {
          heapUsedMB,
          heapTotalMB,
          heapUsagePercent,
        })
      );
    }

    return this.getStatus(key, true, {
      heapUsedMB,
      heapTotalMB,
      heapUsagePercent,
    });
  }
}
