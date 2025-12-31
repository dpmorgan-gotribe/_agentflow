/**
 * API Application Bootstrap
 *
 * Initializes NestJS with Fastify adapter and security hardening.
 */

// Load environment variables FIRST, before any other imports
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// Load from apps/api/.env (relative to dist directory)
loadEnv({ path: resolve(__dirname, '..', '.env') });
// Fallback to monorepo root .env
loadEnv({ path: resolve(__dirname, '..', '..', '..', '.env') });

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from './config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Create Fastify app
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV !== 'production',
      trustProxy: true,
    })
  );

  const configService = app.get(ConfigService);

  // Security headers via Helmet
  // Note: Using type assertion to work around Fastify version mismatch between
  // @nestjs/platform-fastify and @fastify/helmet peer dependencies
  const helmet = await import('@fastify/helmet');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  await app.register(helmet.default as any);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe with security settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    })
  );

  // CORS - NO wildcards in production
  const corsOrigins = configService.corsOrigins;
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });

  // Swagger documentation (only in development)
  if (configService.isDevelopment) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Aigentflow API')
      .setDescription('Multi-agent AI orchestrator for full-stack development')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('health', 'Health check endpoints')
      .addTag('tasks', 'Task orchestration endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs available at /api/docs');
  }

  // HTTPS enforcement in production
  if (configService.isProduction) {
    const fastify = app.getHttpAdapter().getInstance();
    fastify.addHook('onRequest', async (request, reply) => {
      const proto = request.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        const host = request.headers.host ?? '';
        await reply.redirect(301, `https://${host}${request.url}`);
      }
    });
  }

  // Start server
  const port = configService.port;
  await app.listen(port, '0.0.0.0');

  logger.log(`API running on http://localhost:${port}`);
  logger.log(`Environment: ${configService.nodeEnv}`);

  if (configService.isDevelopment) {
    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
