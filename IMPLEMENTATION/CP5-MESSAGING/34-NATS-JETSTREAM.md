# Step 34: NATS JetStream Integration

> **Checkpoint:** CP5 - Messaging
> **Previous Step:** 16a-LESSON-EXTRACTION.md (CP4)
> **Next Step:** 35-BULLMQ-JOBS.md

---

## Overview

Implement NATS JetStream for pub/sub messaging between agents and services. JetStream provides persistence, at-least-once delivery, and consumer groups for distributed agent coordination.

---

## Objectives

1. Set up NATS server with JetStream enabled
2. Create NestJS module for NATS connection
3. Define message streams for agent communication
4. Implement publish/subscribe patterns
5. Add message persistence and replay capabilities

---

## Technical Requirements

### 34.1 NATS Server Configuration

```yaml
# docker-compose.nats.yml
services:
  nats:
    image: nats:2.10-alpine
    command:
      - "--jetstream"
      - "--store_dir=/data"
      - "--http_port=8222"
    ports:
      - "4222:4222"   # Client connections
      - "8222:8222"   # Monitoring
    volumes:
      - nats_data:/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8222/healthz"]
      interval: 5s
      timeout: 3s
      retries: 3

volumes:
  nats_data:
```

### 34.2 NATS Module

```typescript
// packages/messaging/src/nats/nats.module.ts
import { Module, Global } from '@nestjs/common';
import { NatsService } from './nats.service';
import { NatsHealthIndicator } from './nats.health';

@Global()
@Module({
  providers: [NatsService, NatsHealthIndicator],
  exports: [NatsService, NatsHealthIndicator],
})
export class NatsModule {}
```

### 34.3 NATS Service

```typescript
// packages/messaging/src/nats/nats.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  connect,
  NatsConnection,
  JetStreamManager,
  JetStreamClient,
  StringCodec,
  consumerOpts,
  createInbox,
} from 'nats';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export interface NatsConfig {
  NATS_URL: string;
  NATS_USER?: string;
  NATS_PASSWORD?: string;
  NATS_TOKEN?: string;
}

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private connection: NatsConnection | null = null;
  private jsm: JetStreamManager | null = null;
  private js: JetStreamClient | null = null;
  private readonly sc = StringCodec();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
    await this.ensureStreams();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const servers = this.config.get<string>('NATS_URL', 'nats://localhost:4222');

      this.connection = await connect({
        servers: servers.split(','),
        user: this.config.get<string>('NATS_USER'),
        pass: this.config.get<string>('NATS_PASSWORD'),
        token: this.config.get<string>('NATS_TOKEN'),
        reconnect: true,
        maxReconnectAttempts: -1, // Infinite
        reconnectTimeWait: 1000,
      });

      this.jsm = await this.connection.jetstreamManager();
      this.js = this.connection.jetstream();

      this.logger.log('Connected to NATS JetStream');

      // Handle connection events
      (async () => {
        for await (const status of this.connection!.status()) {
          this.logger.log(`NATS status: ${status.type}`);
        }
      })();
    } catch (error) {
      this.logger.error('Failed to connect to NATS', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      this.connection = null;
      this.jsm = null;
      this.js = null;
      this.logger.log('Disconnected from NATS');
    }
  }

  /**
   * Ensure required streams exist
   */
  private async ensureStreams(): Promise<void> {
    const streams = [
      {
        name: 'AGENT_EVENTS',
        subjects: ['agent.>', 'workflow.>'],
        retention: 'limits' as const,
        maxAge: 7 * 24 * 60 * 60 * 1000 * 1000000, // 7 days in nanoseconds
        maxBytes: 1024 * 1024 * 1024, // 1GB
        storage: 'file' as const,
        replicas: 1,
      },
      {
        name: 'TASK_EVENTS',
        subjects: ['task.>'],
        retention: 'limits' as const,
        maxAge: 30 * 24 * 60 * 60 * 1000 * 1000000, // 30 days
        maxBytes: 5 * 1024 * 1024 * 1024, // 5GB
        storage: 'file' as const,
        replicas: 1,
      },
      {
        name: 'AUDIT_EVENTS',
        subjects: ['audit.>'],
        retention: 'limits' as const,
        maxAge: 365 * 24 * 60 * 60 * 1000 * 1000000, // 1 year
        maxBytes: 10 * 1024 * 1024 * 1024, // 10GB
        storage: 'file' as const,
        replicas: 1,
      },
    ];

    for (const stream of streams) {
      try {
        await this.jsm!.streams.info(stream.name);
        this.logger.debug(`Stream ${stream.name} exists`);
      } catch {
        await this.jsm!.streams.add(stream);
        this.logger.log(`Created stream ${stream.name}`);
      }
    }
  }

  /**
   * Publish message to JetStream
   */
  async publish<T>(subject: string, data: T): Promise<void> {
    if (!this.js) {
      throw new Error('NATS not connected');
    }

    const payload = this.sc.encode(JSON.stringify(data));
    await this.js.publish(subject, payload);
    this.logger.debug(`Published to ${subject}`);
  }

  /**
   * Subscribe to JetStream with durable consumer
   */
  async subscribe<T>(
    stream: string,
    subject: string,
    durableName: string,
    handler: (data: T, ack: () => void, nak: () => void) => Promise<void>,
  ): Promise<void> {
    if (!this.js) {
      throw new Error('NATS not connected');
    }

    const opts = consumerOpts();
    opts.durable(durableName);
    opts.manualAck();
    opts.ackExplicit();
    opts.deliverTo(createInbox());
    opts.filterSubject(subject);

    const sub = await this.js.subscribe(subject, opts);

    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as T;
          await handler(
            data,
            () => msg.ack(),
            () => msg.nak(),
          );
        } catch (error) {
          this.logger.error(`Error processing message from ${subject}`, error);
          msg.nak();
        }
      }
    })();

    this.logger.log(`Subscribed to ${subject} with durable ${durableName}`);
  }

  /**
   * Request-reply pattern
   */
  async request<TReq, TRes>(
    subject: string,
    data: TReq,
    timeoutMs = 5000,
  ): Promise<TRes> {
    if (!this.connection) {
      throw new Error('NATS not connected');
    }

    const payload = this.sc.encode(JSON.stringify(data));
    const response = await this.connection.request(subject, payload, {
      timeout: timeoutMs,
    });

    return JSON.parse(this.sc.decode(response.data)) as TRes;
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  /**
   * Get JetStream client for advanced operations
   */
  getJetStream(): JetStreamClient {
    if (!this.js) {
      throw new Error('NATS not connected');
    }
    return this.js;
  }
}
```

### 34.4 Message Types

```typescript
// packages/messaging/src/types/messages.ts
import { z } from 'zod';

// Base message schema
export const baseMessageSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  source: z.string(),
  correlationId: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
});

// Agent event types
export const agentEventSchema = baseMessageSchema.extend({
  type: z.enum([
    'agent.started',
    'agent.completed',
    'agent.failed',
    'agent.progress',
    'agent.blocked',
  ]),
  agentId: z.string().uuid(),
  agentType: z.string(),
  payload: z.record(z.unknown()),
});

export type AgentEvent = z.infer<typeof agentEventSchema>;

// Workflow event types
export const workflowEventSchema = baseMessageSchema.extend({
  type: z.enum([
    'workflow.started',
    'workflow.completed',
    'workflow.failed',
    'workflow.step.started',
    'workflow.step.completed',
  ]),
  workflowId: z.string().uuid(),
  stepId: z.string().optional(),
  payload: z.record(z.unknown()),
});

export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

// Task event types
export const taskEventSchema = baseMessageSchema.extend({
  type: z.enum([
    'task.created',
    'task.assigned',
    'task.started',
    'task.completed',
    'task.failed',
    'task.cancelled',
  ]),
  taskId: z.string().uuid(),
  taskType: z.string(),
  payload: z.record(z.unknown()),
});

export type TaskEvent = z.infer<typeof taskEventSchema>;

// Audit event types
export const auditEventSchema = baseMessageSchema.extend({
  type: z.enum([
    'audit.access',
    'audit.mutation',
    'audit.security',
    'audit.compliance',
  ]),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  userId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;
```

### 34.5 Event Publisher Service

```typescript
// packages/messaging/src/publishers/event-publisher.service.ts
import { Injectable } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import {
  AgentEvent,
  WorkflowEvent,
  TaskEvent,
  AuditEvent,
} from '../types/messages';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventPublisherService {
  constructor(private readonly nats: NatsService) {}

  private createBaseMessage(tenantId: string, correlationId?: string) {
    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      source: 'aigentflow-api',
      tenantId,
      correlationId,
    };
  }

  /**
   * Publish agent event
   */
  async publishAgentEvent(
    tenantId: string,
    event: Omit<AgentEvent, 'id' | 'timestamp' | 'source' | 'tenantId'>,
    correlationId?: string,
  ): Promise<void> {
    const fullEvent: AgentEvent = {
      ...this.createBaseMessage(tenantId, correlationId),
      ...event,
    };

    await this.nats.publish(`agent.${event.agentType}.${event.type}`, fullEvent);
  }

  /**
   * Publish workflow event
   */
  async publishWorkflowEvent(
    tenantId: string,
    event: Omit<WorkflowEvent, 'id' | 'timestamp' | 'source' | 'tenantId'>,
    correlationId?: string,
  ): Promise<void> {
    const fullEvent: WorkflowEvent = {
      ...this.createBaseMessage(tenantId, correlationId),
      ...event,
    };

    await this.nats.publish(`workflow.${event.type}`, fullEvent);
  }

  /**
   * Publish task event
   */
  async publishTaskEvent(
    tenantId: string,
    event: Omit<TaskEvent, 'id' | 'timestamp' | 'source' | 'tenantId'>,
    correlationId?: string,
  ): Promise<void> {
    const fullEvent: TaskEvent = {
      ...this.createBaseMessage(tenantId, correlationId),
      ...event,
    };

    await this.nats.publish(`task.${event.taskType}.${event.type}`, fullEvent);
  }

  /**
   * Publish audit event
   */
  async publishAuditEvent(
    tenantId: string,
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'source' | 'tenantId'>,
    correlationId?: string,
  ): Promise<void> {
    const fullEvent: AuditEvent = {
      ...this.createBaseMessage(tenantId, correlationId),
      ...event,
    };

    await this.nats.publish(`audit.${event.type}`, fullEvent);
  }
}
```

### 34.6 Event Subscriber Service

```typescript
// packages/messaging/src/subscribers/event-subscriber.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { AgentEvent, WorkflowEvent, TaskEvent } from '../types/messages';
import { Logger } from '@nestjs/common';

type EventHandler<T> = (event: T) => Promise<void>;

@Injectable()
export class EventSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(EventSubscriberService.name);
  private agentHandlers: Map<string, EventHandler<AgentEvent>[]> = new Map();
  private workflowHandlers: Map<string, EventHandler<WorkflowEvent>[]> = new Map();
  private taskHandlers: Map<string, EventHandler<TaskEvent>[]> = new Map();

  constructor(private readonly nats: NatsService) {}

  async onModuleInit(): Promise<void> {
    await this.setupSubscriptions();
  }

  private async setupSubscriptions(): Promise<void> {
    // Agent events
    await this.nats.subscribe<AgentEvent>(
      'AGENT_EVENTS',
      'agent.>',
      'api-agent-consumer',
      async (event, ack) => {
        await this.handleAgentEvent(event);
        ack();
      },
    );

    // Workflow events
    await this.nats.subscribe<WorkflowEvent>(
      'AGENT_EVENTS',
      'workflow.>',
      'api-workflow-consumer',
      async (event, ack) => {
        await this.handleWorkflowEvent(event);
        ack();
      },
    );

    // Task events
    await this.nats.subscribe<TaskEvent>(
      'TASK_EVENTS',
      'task.>',
      'api-task-consumer',
      async (event, ack) => {
        await this.handleTaskEvent(event);
        ack();
      },
    );
  }

  /**
   * Register agent event handler
   */
  onAgentEvent(eventType: string, handler: EventHandler<AgentEvent>): void {
    const handlers = this.agentHandlers.get(eventType) || [];
    handlers.push(handler);
    this.agentHandlers.set(eventType, handlers);
  }

  /**
   * Register workflow event handler
   */
  onWorkflowEvent(eventType: string, handler: EventHandler<WorkflowEvent>): void {
    const handlers = this.workflowHandlers.get(eventType) || [];
    handlers.push(handler);
    this.workflowHandlers.set(eventType, handlers);
  }

  /**
   * Register task event handler
   */
  onTaskEvent(eventType: string, handler: EventHandler<TaskEvent>): void {
    const handlers = this.taskHandlers.get(eventType) || [];
    handlers.push(handler);
    this.taskHandlers.set(eventType, handlers);
  }

  private async handleAgentEvent(event: AgentEvent): Promise<void> {
    const handlers = this.agentHandlers.get(event.type) || [];
    const wildcardHandlers = this.agentHandlers.get('*') || [];

    for (const handler of [...handlers, ...wildcardHandlers]) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error in agent event handler for ${event.type}`, error);
      }
    }
  }

  private async handleWorkflowEvent(event: WorkflowEvent): Promise<void> {
    const handlers = this.workflowHandlers.get(event.type) || [];
    const wildcardHandlers = this.workflowHandlers.get('*') || [];

    for (const handler of [...handlers, ...wildcardHandlers]) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error in workflow event handler for ${event.type}`, error);
      }
    }
  }

  private async handleTaskEvent(event: TaskEvent): Promise<void> {
    const handlers = this.taskHandlers.get(event.type) || [];
    const wildcardHandlers = this.taskHandlers.get('*') || [];

    for (const handler of [...handlers, ...wildcardHandlers]) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error in task event handler for ${event.type}`, error);
      }
    }
  }
}
```

### 34.7 Health Check

```typescript
// packages/messaging/src/nats/nats.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { NatsService } from './nats.service';

@Injectable()
export class NatsHealthIndicator extends HealthIndicator {
  constructor(private readonly nats: NatsService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isConnected = this.nats.isConnected();

    if (isConnected) {
      return this.getStatus(key, true, { status: 'connected' });
    }

    throw new HealthCheckError(
      'NATS health check failed',
      this.getStatus(key, false, { status: 'disconnected' }),
    );
  }
}
```

---

## Configuration

```env
# .env
NATS_URL=nats://localhost:4222
NATS_USER=
NATS_PASSWORD=
NATS_TOKEN=
```

```typescript
// packages/shared/src/config/messaging.config.ts
import { z } from 'zod';

export const messagingConfigSchema = z.object({
  NATS_URL: z.string().default('nats://localhost:4222'),
  NATS_USER: z.string().optional(),
  NATS_PASSWORD: z.string().optional(),
  NATS_TOKEN: z.string().optional(),
});

export type MessagingConfig = z.infer<typeof messagingConfigSchema>;
```

---

## Testing

```typescript
// packages/messaging/src/nats/__tests__/nats.service.spec.ts
import { Test } from '@nestjs/testing';
import { NatsService } from '../nats.service';
import { ConfigService } from '@nestjs/config';

describe('NatsService', () => {
  let service: NatsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NatsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                NATS_URL: 'nats://localhost:4222',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<NatsService>(NatsService);
  });

  describe('publish', () => {
    it('should publish message to subject', async () => {
      // Mock connection and test publish
    });
  });

  describe('subscribe', () => {
    it('should receive messages from subscription', async () => {
      // Mock subscription and test message handling
    });
  });
});
```

---

## Acceptance Criteria

- [ ] NATS JetStream server running in Docker
- [ ] NestJS module connects to NATS on startup
- [ ] Streams created for agent, task, and audit events
- [ ] Publish/subscribe working with message persistence
- [ ] Durable consumers survive restarts
- [ ] Health check endpoint for NATS status
- [ ] Request-reply pattern implemented
- [ ] 90%+ test coverage

---

## Security Considerations

1. **Authentication**: Use NATS credentials or token auth
2. **TLS**: Enable TLS for production connections
3. **Authorization**: Implement NATS account-based permissions
4. **Audit**: All messages include tenant context
5. **Encryption**: Consider message encryption for sensitive data

---

## References

- [NATS JetStream Documentation](https://docs.nats.io/nats-concepts/jetstream)
- [NATS.js Client](https://github.com/nats-io/nats.js)
- [NestJS Custom Transports](https://docs.nestjs.com/microservices/custom-transport)
