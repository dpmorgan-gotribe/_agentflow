/**
 * System Controller
 *
 * Provides system-level API endpoints.
 */

import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { SystemService } from './system.service';

class ShutdownDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('system')
@ApiTags('system')
export class SystemController {
  private readonly logger = new Logger(SystemController.name);

  constructor(private readonly systemService: SystemService) {}

  @Post('shutdown')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger graceful shutdown',
    description: 'Initiates a graceful shutdown of the API server. All active connections will be closed cleanly.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Reason for shutdown' },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 202,
    description: 'Shutdown initiated',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        shuttingDown: { type: 'boolean' },
      },
    },
  })
  async shutdown(@Body() body: ShutdownDto): Promise<{ message: string; shuttingDown: boolean }> {
    const reason = body?.reason ?? 'User requested shutdown from UI';
    this.logger.warn(`Shutdown requested: ${reason}`);

    // Trigger shutdown asynchronously so we can send response first
    setImmediate(() => {
      this.systemService.triggerShutdown(reason).catch((err) => {
        this.logger.error('Shutdown failed:', err);
      });
    });

    return {
      message: 'Shutdown initiated',
      shuttingDown: true,
    };
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get system status' })
  @ApiResponse({
    status: 200,
    description: 'System status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        shuttingDown: { type: 'boolean' },
        uptime: { type: 'number' },
      },
    },
  })
  getStatus(): { status: string; shuttingDown: boolean; uptime: number } {
    return {
      status: this.systemService.isShutdownInProgress() ? 'shutting_down' : 'running',
      shuttingDown: this.systemService.isShutdownInProgress(),
      uptime: process.uptime(),
    };
  }
}
