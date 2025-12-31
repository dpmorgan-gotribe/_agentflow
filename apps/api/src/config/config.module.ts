/**
 * Configuration Module
 *
 * Loads and validates environment configuration.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { resolve } from 'path';

import { ConfigService } from './config.service';
import { validateEnv } from './env.schema';

// Resolve paths from the package root (apps/api/)
const packageRoot = resolve(__dirname, '..', '..');
const monorepoRoot = resolve(packageRoot, '..', '..');

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
      envFilePath: [
        resolve(packageRoot, '.env'),      // apps/api/.env
        resolve(monorepoRoot, '.env'),     // root .env
      ],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
