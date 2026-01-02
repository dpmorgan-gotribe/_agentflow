/**
 * Configuration Service
 *
 * Provides type-safe access to validated environment variables.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import type { EnvConfig } from './env.schema';

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService<EnvConfig>) {}

  get nodeEnv(): string {
    return this.configService.get('NODE_ENV', { infer: true }) ?? 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true }) ?? 3000;
  }

  get databaseUrl(): string | undefined {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get hasDatabaseUrl(): boolean {
    return !!this.databaseUrl;
  }

  get jwtSecret(): string {
    const secret = this.configService.get('JWT_SECRET', { infer: true });
    // Default for development only
    return secret ?? 'development-secret-key-do-not-use-in-production-32chars';
  }

  get jwtExpiresIn(): string {
    return this.configService.get('JWT_EXPIRES_IN', { infer: true }) ?? '1h';
  }

  get corsOrigins(): string[] {
    const origins = this.configService.get('CORS_ORIGINS', { infer: true });
    // Default for development only
    const defaultOrigins = 'http://localhost:5173,http://localhost:3000';
    return (origins ?? defaultOrigins).split(',').map((o) => o.trim());
  }

  get rateLimitMax(): number {
    return this.configService.get('RATE_LIMIT_MAX', { infer: true }) ?? 100;
  }

  get rateLimitWindowMs(): number {
    return (
      this.configService.get('RATE_LIMIT_WINDOW_MS', { infer: true }) ?? 60000
    );
  }

  get qdrantUrl(): string | undefined {
    return this.configService.get('QDRANT_URL', { infer: true });
  }

  get anthropicApiKey(): string | undefined {
    return this.configService.get('ANTHROPIC_API_KEY', { infer: true });
  }
}
