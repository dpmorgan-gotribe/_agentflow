# Step 04: NestJS API

> **Checkpoint:** CP0 - Foundation
> **Previous Step:** 03b-META-PROMPTS.md
> **Next Step:** 04a-HOOKS-GUARDRAILS.md

---

## Overview

This step implements the **NestJS backend server** with Fastify adapter that serves as the API layer for all Aigentflow operations. The CLI and web frontend will consume this API.

Key features:
- **Fastify adapter** for high performance
- **Modular architecture** with feature modules
- **OpenAPI/Swagger** documentation
- **tRPC** for type-safe internal APIs
- **Guards and interceptors** for auth and logging

---

## Deliverables

1. `apps/api/` - NestJS application
2. Core modules (Orchestrator, Projects, Tasks)
3. OpenAPI documentation
4. Authentication guards
5. Request/response interceptors
6. Health checks and metrics

---

## 1. Application Structure

```
apps/api/
├── src/
│   ├── main.ts                    # Application bootstrap
│   ├── app.module.ts              # Root module
│   ├── common/
│   │   ├── decorators/            # Custom decorators
│   │   ├── filters/               # Exception filters
│   │   ├── guards/                # Auth guards
│   │   ├── interceptors/          # Request interceptors
│   │   └── pipes/                 # Validation pipes
│   ├── config/
│   │   ├── config.module.ts       # Configuration module
│   │   └── config.service.ts      # Type-safe config
│   ├── modules/
│   │   ├── health/                # Health checks
│   │   ├── auth/                  # Authentication
│   │   ├── tenants/               # Tenant management
│   │   ├── projects/              # Project management
│   │   ├── tasks/                 # Task orchestration
│   │   └── agents/                # Agent management
│   └── trpc/
│       ├── trpc.module.ts         # tRPC module
│       └── routers/               # tRPC routers
├── test/
│   └── app.e2e-spec.ts
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 2. Package Configuration

### 2.1 apps/api/package.json

```json
{
  "name": "@aigentflow/api",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main",
    "start:prod": "node dist/main",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@aigentflow/core": "workspace:*",
    "@aigentflow/database": "workspace:*",
    "@aigentflow/langgraph": "workspace:*",
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "@nestjs/swagger": "^8.0.0",
    "@nestjs/terminus": "^11.0.0",
    "@trpc/server": "^10.0.0",
    "class-transformer": "^0.5.0",
    "class-validator": "^0.14.0",
    "fastify": "^4.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@aigentflow/tsconfig": "workspace:*",
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 3. Application Bootstrap

### 3.1 apps/api/src/main.ts

```typescript
/**
 * API Application Bootstrap
 */

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', '*').split(','),
    credentials: true,
  });

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aigentflow API')
    .setDescription('Multi-agent AI orchestrator for full-stack development')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('projects', 'Project management')
    .addTag('tasks', 'Task orchestration')
    .addTag('agents', 'Agent management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = configService.get('PORT', '3000');
  await app.listen(port, '0.0.0.0');

  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
```

### 3.2 apps/api/src/app.module.ts

```typescript
/**
 * Root Application Module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AgentsModule } from './modules/agents/agents.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [
    ConfigModule,
    HealthModule,
    AuthModule,
    TenantsModule,
    ProjectsModule,
    TasksModule,
    AgentsModule,
    TrpcModule,
  ],
})
export class AppModule {}
```

---

## 4. Tasks Module (Core Orchestration)

### 4.1 apps/api/src/modules/tasks/tasks.module.ts

```typescript
import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
```

### 4.2 apps/api/src/modules/tasks/tasks.controller.ts

```typescript
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Sse,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantContext } from '../../common/decorators/tenant.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto, TaskResponseDto } from './tasks.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create and start a new task' })
  @ApiResponse({ status: 201, type: TaskResponseDto })
  async create(
    @TenantContext() tenant: { tenantId: string; userId: string },
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(tenant, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, type: TaskResponseDto })
  async findOne(
    @TenantContext() tenant: { tenantId: string },
    @Param('id') id: string,
  ): Promise<TaskResponseDto> {
    return this.tasksService.findOne(tenant.tenantId, id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get task execution status' })
  async getStatus(
    @TenantContext() tenant: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.tasksService.getStatus(tenant.tenantId, id);
  }

  @Sse(':id/stream')
  @ApiOperation({ summary: 'Stream task execution events' })
  stream(
    @TenantContext() tenant: { tenantId: string },
    @Param('id') id: string,
  ): Observable<MessageEvent> {
    return this.tasksService.streamEvents(tenant.tenantId, id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve pending task checkpoint' })
  async approve(
    @TenantContext() tenant: { tenantId: string },
    @Param('id') id: string,
    @Body() body: { approved: boolean; feedback?: string },
  ) {
    return this.tasksService.handleApproval(tenant.tenantId, id, body);
  }

  @Post(':id/abort')
  @ApiOperation({ summary: 'Abort running task' })
  async abort(
    @TenantContext() tenant: { tenantId: string },
    @Param('id') id: string,
  ) {
    return this.tasksService.abort(tenant.tenantId, id);
  }
}
```

### 4.3 apps/api/src/modules/tasks/tasks.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { createDatabase, type Database } from '@aigentflow/database';
import {
  createOrchestratorGraph,
  PostgresCheckpointer,
  type OrchestratorStateType,
} from '@aigentflow/langgraph';
import { CreateTaskDto, TaskResponseDto } from './tasks.dto';

@Injectable()
export class TasksService {
  private db: Database;
  private checkpointer: PostgresCheckpointer;
  private eventStreams: Map<string, Subject<MessageEvent>> = new Map();

  constructor() {
    this.db = createDatabase({
      connectionString: process.env.DATABASE_URL!,
    });
    this.checkpointer = new PostgresCheckpointer(this.db);
  }

  async create(
    tenant: { tenantId: string; userId: string },
    dto: CreateTaskDto,
  ): Promise<TaskResponseDto> {
    const taskId = crypto.randomUUID();

    // Create task record
    await this.db.withTenant(tenant, async (db) => {
      await db.insert(tasks).values({
        id: taskId,
        tenantId: tenant.tenantId,
        projectId: dto.projectId,
        prompt: dto.prompt,
        type: 'feature', // Will be determined by analysis
        status: 'pending',
      });
    });

    // Start workflow in background
    this.executeWorkflow(tenant.tenantId, taskId, dto);

    return {
      id: taskId,
      projectId: dto.projectId,
      prompt: dto.prompt,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  }

  private async executeWorkflow(
    tenantId: string,
    taskId: string,
    dto: CreateTaskDto,
  ) {
    const graph = createOrchestratorGraph(this.checkpointer);

    const eventSubject = new Subject<MessageEvent>();
    this.eventStreams.set(taskId, eventSubject);

    try {
      // Stream workflow execution
      const stream = await graph.stream(
        {
          tenantId,
          projectId: dto.projectId,
          taskId,
          prompt: dto.prompt,
        },
        {
          configurable: {
            thread_id: taskId,
          },
        },
      );

      for await (const event of stream) {
        // Emit event to SSE stream
        eventSubject.next({
          data: JSON.stringify(event),
        } as MessageEvent);

        // Update task status in database
        await this.updateTaskStatus(tenantId, taskId, event);
      }

      eventSubject.complete();
    } catch (error) {
      eventSubject.error(error);
    } finally {
      this.eventStreams.delete(taskId);
    }
  }

  private async updateTaskStatus(
    tenantId: string,
    taskId: string,
    state: Partial<OrchestratorStateType>,
  ) {
    await this.db.withTenant({ tenantId }, async (db) => {
      await db
        .update(tasks)
        .set({
          status: state.status,
          currentAgent: state.currentAgent,
          completedAgents: state.completedAgents,
          analysis: state.analysis,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
    });
  }

  async findOne(tenantId: string, taskId: string): Promise<TaskResponseDto> {
    const result = await this.db.withTenant({ tenantId }, async (db) => {
      return db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    });

    if (result.length === 0) {
      throw new Error('Task not found');
    }

    return this.mapToResponse(result[0]);
  }

  async getStatus(tenantId: string, taskId: string) {
    const task = await this.findOne(tenantId, taskId);

    // Get checkpoint state
    const checkpoint = await this.checkpointer.getTuple({
      configurable: { thread_id: taskId },
    });

    return {
      ...task,
      checkpoint: checkpoint?.checkpoint,
      pendingApproval: checkpoint?.metadata?.pendingInterrupt,
    };
  }

  streamEvents(tenantId: string, taskId: string): Observable<MessageEvent> {
    const subject = this.eventStreams.get(taskId);
    if (!subject) {
      // Task not running, return empty observable
      return new Observable((subscriber) => subscriber.complete());
    }
    return subject.asObservable();
  }

  async handleApproval(
    tenantId: string,
    taskId: string,
    approval: { approved: boolean; feedback?: string },
  ) {
    const graph = createOrchestratorGraph(this.checkpointer);

    // Resume workflow with approval response
    await graph.invoke(
      {
        approvalResponse: {
          approved: approval.approved,
          feedback: approval.feedback,
          timestamp: new Date().toISOString(),
        },
      },
      {
        configurable: {
          thread_id: taskId,
        },
      },
    );

    return { success: true };
  }

  async abort(tenantId: string, taskId: string) {
    // Update task status
    await this.db.withTenant({ tenantId }, async (db) => {
      await db
        .update(tasks)
        .set({
          status: 'aborted',
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
    });

    // Close event stream
    const subject = this.eventStreams.get(taskId);
    if (subject) {
      subject.complete();
      this.eventStreams.delete(taskId);
    }

    return { success: true };
  }

  private mapToResponse(task: any): TaskResponseDto {
    return {
      id: task.id,
      projectId: task.projectId,
      prompt: task.prompt,
      status: task.status,
      analysis: task.analysis,
      currentAgent: task.currentAgent,
      completedAgents: task.completedAgents,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
```

### 4.4 apps/api/src/modules/tasks/tasks.dto.ts

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'Task prompt/description' })
  @IsString()
  @IsNotEmpty()
  prompt: string;
}

export class TaskResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  analysis?: any;

  @ApiProperty({ required: false })
  currentAgent?: string;

  @ApiProperty({ required: false })
  completedAgents?: string[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ required: false })
  updatedAt?: string;
}
```

---

## 5. Authentication Guard

### 5.1 apps/api/src/common/guards/auth.guard.ts

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Verify token and extract tenant context
      const payload = await this.verifyToken(token);

      // Attach to request for use in controllers
      (request as any).tenantContext = {
        tenantId: payload.tenantId,
        userId: payload.userId,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }

  private async verifyToken(token: string): Promise<{
    tenantId: string;
    userId: string;
  }> {
    // TODO: Implement JWT verification
    // For now, decode without verification for development
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString(),
    );
    return payload;
  }
}
```

### 5.2 apps/api/src/common/decorators/tenant.decorator.ts

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return (request as any).tenantContext;
  },
);
```

---

## 6. Health Checks

### 6.1 apps/api/src/modules/health/health.module.ts

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

### 6.2 apps/api/src/modules/health/health.controller.ts

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @HealthCheck()
  check() {
    return this.health.check([
      // Add database health check
      // Add Qdrant health check
      // Add external service checks
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  ready() {
    return { status: 'ok' };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  live() {
    return { status: 'ok' };
  }
}
```

---

## Test Scenarios

```typescript
// apps/api/test/tasks.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

describe('Tasks API (e2e)', () => {
  let app: NestFastifyApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Create test auth token
    authToken = createTestToken({ tenantId: 'test-tenant', userId: 'test-user' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/tasks - should create task', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      payload: {
        projectId: 'test-project-id',
        prompt: 'Add a login page',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.id).toBeDefined();
    expect(body.status).toBe('pending');
  });

  it('GET /api/v1/tasks/:id - should return task', async () => {
    // First create a task
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { Authorization: `Bearer ${authToken}` },
      payload: {
        projectId: 'test-project-id',
        prompt: 'Test task',
      },
    });

    const { id } = JSON.parse(createResponse.payload);

    // Then fetch it
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/tasks/${id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.id).toBe(id);
  });
});

function createTestToken(payload: { tenantId: string; userId: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${header}.${body}.signature`;
}
```

---

## Validation Checklist

```
□ apps/api created with NestJS
□ Fastify adapter configured
□ Root module with all feature modules
□ Tasks controller with CRUD endpoints
□ Tasks service with LangGraph integration
□ SSE streaming for task events
□ Approval endpoint for human-in-the-loop
□ Auth guard with tenant context
□ Swagger/OpenAPI documentation
□ Health check endpoints
□ All tests passing
```

---

## Next Step

Proceed to **05-CLI-FOUNDATION.md** to implement the CLI that wraps this API.
