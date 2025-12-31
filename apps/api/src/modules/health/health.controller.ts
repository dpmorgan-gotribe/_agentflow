/**
 * Health Check Controller
 *
 * Provides health, readiness, and liveness endpoints for Kubernetes.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';

import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthService: HealthService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.healthService.checkDatabase(),
      () => this.healthService.checkMemory(),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  ready(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
