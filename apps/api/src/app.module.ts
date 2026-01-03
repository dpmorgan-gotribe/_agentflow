/**
 * Root Application Module
 *
 * Imports all feature modules and configures global providers.
 */

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { GlobalExceptionFilter } from './common/filters';
import { AuditInterceptor } from './common/interceptors';
import { ConfigModule, ConfigService } from './config';
import { DatabaseModule } from './modules/database';
import { HealthModule } from './modules/health';
import { TasksModule } from './modules/tasks';
import { ProjectsModule } from './modules/projects';
import { SystemModule } from './modules/system';
import { SettingsModule } from './modules/settings';
import { OrchestratorModule } from './modules/orchestrator';

@Module({
  imports: [
    // Configuration (global)
    ConfigModule,

    // Database (global)
    DatabaseModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.rateLimitWindowMs,
            limit: configService.rateLimitMax,
          },
        ],
      }),
    }),

    // Feature modules
    HealthModule,
    TasksModule,
    ProjectsModule,
    SystemModule,
    SettingsModule,
    OrchestratorModule,
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global audit interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
