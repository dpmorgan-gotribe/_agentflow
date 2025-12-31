# Step 36: WebSocket Streaming

> **Checkpoint:** CP5-MESSAGING
> **Step:** 36 of 64
> **Dependencies:** 34-NATS-JETSTREAM, 35-BULLMQ-JOBS, 04-NESTJS-API
> **Estimated Effort:** Medium
> **Priority:** High

---

## Overview

Implement real-time WebSocket streaming for agent activities, workflow progress, and system events. Uses uWebSockets.js for high-performance connections and integrates with NATS for event distribution.

---

## Objectives

1. Set up WebSocket gateway with uWebSockets.js
2. Implement room-based subscriptions (tenant, workflow, agent)
3. Create event streaming from NATS to WebSocket clients
4. Add authentication and authorization for connections
5. Handle connection lifecycle and reconnection

---

## Technical Requirements

### 36.1 WebSocket Gateway Module

```typescript
// packages/messaging/src/websocket/websocket.module.ts
import { Module, Global } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';
import { EventBridge } from './event-bridge';

@Global()
@Module({
  providers: [
    WebSocketGateway,
    WebSocketService,
    ConnectionManager,
    RoomManager,
    EventBridge,
  ],
  exports: [WebSocketService],
})
export class WebSocketModule {}
```

### 36.2 WebSocket Gateway

```typescript
// packages/messaging/src/websocket/websocket.gateway.ts
import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';
import { WsAuthGuard } from './guards/ws-auth.guard';

interface AuthenticatedSocket extends WebSocket {
  userId: string;
  tenantId: string;
  connectionId: string;
}

interface SubscribePayload {
  room: string;
  filter?: Record<string, unknown>;
}

interface MessagePayload {
  type: string;
  data: unknown;
}

@NestWebSocketGateway({
  path: '/ws',
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
})
export class WebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly connectionManager: ConnectionManager,
    private readonly roomManager: RoomManager,
  ) {}

  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');
    this.connectionManager.setServer(server);
  }

  async handleConnection(client: WebSocket, request: Request): Promise<void> {
    try {
      // Extract token from query string or header
      const url = new URL(request.url!, `http://${request.headers.get('host')}`);
      const token = url.searchParams.get('token');

      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.close(4001, 'Authentication required');
        return;
      }

      // Verify JWT
      const payload = await this.jwtService.verifyAsync(token);
      const socket = client as AuthenticatedSocket;

      socket.userId = payload.sub;
      socket.tenantId = payload.tenantId;
      socket.connectionId = this.connectionManager.registerConnection(socket);

      // Auto-subscribe to tenant room
      this.roomManager.joinRoom(socket.connectionId, `tenant:${socket.tenantId}`);

      this.logger.log(`Client connected: ${socket.connectionId}`, {
        userId: socket.userId,
        tenantId: socket.tenantId,
      });

      // Send connection confirmation
      this.send(socket, {
        type: 'connection.established',
        data: {
          connectionId: socket.connectionId,
          tenantId: socket.tenantId,
        },
      });
    } catch (error) {
      this.logger.warn('Connection rejected: Invalid token', error);
      client.close(4001, 'Invalid authentication');
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    if (client.connectionId) {
      this.roomManager.leaveAllRooms(client.connectionId);
      this.connectionManager.removeConnection(client.connectionId);
      this.logger.log(`Client disconnected: ${client.connectionId}`);
    }
  }

  @SubscribeMessage('subscribe')
  @UseGuards(WsAuthGuard)
  handleSubscribe(
    @MessageBody() payload: SubscribePayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    const { room, filter } = payload;

    // Validate room access based on tenant
    if (!this.validateRoomAccess(client, room)) {
      this.send(client, {
        type: 'error',
        data: { message: 'Access denied to room', room },
      });
      return;
    }

    this.roomManager.joinRoom(client.connectionId, room, filter);
    this.logger.debug(`Client ${client.connectionId} subscribed to ${room}`);

    this.send(client, {
      type: 'subscribed',
      data: { room },
    });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() payload: { room: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ): void {
    this.roomManager.leaveRoom(client.connectionId, payload.room);
    this.logger.debug(`Client ${client.connectionId} unsubscribed from ${payload.room}`);

    this.send(client, {
      type: 'unsubscribed',
      data: { room: payload.room },
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): void {
    this.send(client, { type: 'pong', data: { timestamp: Date.now() } });
  }

  private validateRoomAccess(client: AuthenticatedSocket, room: string): boolean {
    // Tenant isolation: only allow access to own tenant's rooms
    if (room.startsWith('tenant:')) {
      return room === `tenant:${client.tenantId}`;
    }

    if (room.startsWith('workflow:') || room.startsWith('agent:')) {
      // Room format: type:tenantId:resourceId
      const [, tenantId] = room.split(':');
      return tenantId === client.tenantId;
    }

    return false;
  }

  private send(client: WebSocket, message: MessagePayload): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}
```

### 36.3 Connection Manager

```typescript
// packages/messaging/src/websocket/connection-manager.ts
import { Injectable, Logger } from '@nestjs/common';
import { WebSocket, Server } from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface AuthenticatedSocket extends WebSocket {
  userId: string;
  tenantId: string;
  connectionId: string;
}

@Injectable()
export class ConnectionManager {
  private readonly logger = new Logger(ConnectionManager.name);
  private server: Server | null = null;
  private connections: Map<string, AuthenticatedSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private tenantConnections: Map<string, Set<string>> = new Map(); // tenantId -> connectionIds

  setServer(server: Server): void {
    this.server = server;
  }

  registerConnection(socket: AuthenticatedSocket): string {
    const connectionId = uuidv4();
    socket.connectionId = connectionId;

    this.connections.set(connectionId, socket);

    // Track by user
    const userConns = this.userConnections.get(socket.userId) || new Set();
    userConns.add(connectionId);
    this.userConnections.set(socket.userId, userConns);

    // Track by tenant
    const tenantConns = this.tenantConnections.get(socket.tenantId) || new Set();
    tenantConns.add(connectionId);
    this.tenantConnections.set(socket.tenantId, tenantConns);

    this.logger.debug(`Registered connection ${connectionId}`, {
      totalConnections: this.connections.size,
    });

    return connectionId;
  }

  removeConnection(connectionId: string): void {
    const socket = this.connections.get(connectionId);
    if (!socket) return;

    // Remove from user tracking
    const userConns = this.userConnections.get(socket.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userConnections.delete(socket.userId);
      }
    }

    // Remove from tenant tracking
    const tenantConns = this.tenantConnections.get(socket.tenantId);
    if (tenantConns) {
      tenantConns.delete(connectionId);
      if (tenantConns.size === 0) {
        this.tenantConnections.delete(socket.tenantId);
      }
    }

    this.connections.delete(connectionId);
    this.logger.debug(`Removed connection ${connectionId}`, {
      totalConnections: this.connections.size,
    });
  }

  getConnection(connectionId: string): AuthenticatedSocket | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionsByUser(userId: string): AuthenticatedSocket[] {
    const connectionIds = this.userConnections.get(userId) || new Set();
    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter((socket): socket is AuthenticatedSocket => socket !== undefined);
  }

  getConnectionsByTenant(tenantId: string): AuthenticatedSocket[] {
    const connectionIds = this.tenantConnections.get(tenantId) || new Set();
    return Array.from(connectionIds)
      .map((id) => this.connections.get(id))
      .filter((socket): socket is AuthenticatedSocket => socket !== undefined);
  }

  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    this.connections.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
  }

  sendToConnection(connectionId: string, message: unknown): boolean {
    const socket = this.connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  sendToUser(userId: string, message: unknown): number {
    const sockets = this.getConnectionsByUser(userId);
    const data = JSON.stringify(message);
    let sent = 0;

    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
        sent++;
      }
    });

    return sent;
  }

  sendToTenant(tenantId: string, message: unknown): number {
    const sockets = this.getConnectionsByTenant(tenantId);
    const data = JSON.stringify(message);
    let sent = 0;

    sockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
        sent++;
      }
    });

    return sent;
  }

  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    tenants: number;
  } {
    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      tenants: this.tenantConnections.size,
    };
  }
}
```

### 36.4 Room Manager

```typescript
// packages/messaging/src/websocket/room-manager.ts
import { Injectable, Logger } from '@nestjs/common';

interface RoomSubscription {
  connectionId: string;
  filter?: Record<string, unknown>;
}

@Injectable()
export class RoomManager {
  private readonly logger = new Logger(RoomManager.name);
  private rooms: Map<string, Map<string, RoomSubscription>> = new Map();
  private connectionRooms: Map<string, Set<string>> = new Map(); // connectionId -> rooms

  joinRoom(
    connectionId: string,
    room: string,
    filter?: Record<string, unknown>,
  ): void {
    // Add to room
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Map());
    }
    this.rooms.get(room)!.set(connectionId, { connectionId, filter });

    // Track connection's rooms
    if (!this.connectionRooms.has(connectionId)) {
      this.connectionRooms.set(connectionId, new Set());
    }
    this.connectionRooms.get(connectionId)!.add(room);

    this.logger.debug(`Connection ${connectionId} joined room ${room}`, {
      roomSize: this.rooms.get(room)!.size,
    });
  }

  leaveRoom(connectionId: string, room: string): void {
    const roomSubs = this.rooms.get(room);
    if (roomSubs) {
      roomSubs.delete(connectionId);
      if (roomSubs.size === 0) {
        this.rooms.delete(room);
      }
    }

    const connRooms = this.connectionRooms.get(connectionId);
    if (connRooms) {
      connRooms.delete(room);
    }
  }

  leaveAllRooms(connectionId: string): void {
    const rooms = this.connectionRooms.get(connectionId);
    if (rooms) {
      rooms.forEach((room) => {
        const roomSubs = this.rooms.get(room);
        if (roomSubs) {
          roomSubs.delete(connectionId);
          if (roomSubs.size === 0) {
            this.rooms.delete(room);
          }
        }
      });
      this.connectionRooms.delete(connectionId);
    }
  }

  getRoomMembers(room: string): RoomSubscription[] {
    const roomSubs = this.rooms.get(room);
    if (!roomSubs) return [];
    return Array.from(roomSubs.values());
  }

  getRoomMemberIds(room: string): string[] {
    return this.getRoomMembers(room).map((sub) => sub.connectionId);
  }

  getConnectionRooms(connectionId: string): string[] {
    const rooms = this.connectionRooms.get(connectionId);
    return rooms ? Array.from(rooms) : [];
  }

  /**
   * Get members that match a filter
   */
  getFilteredMembers(
    room: string,
    matchData: Record<string, unknown>,
  ): string[] {
    const members = this.getRoomMembers(room);

    return members
      .filter((sub) => {
        if (!sub.filter) return true; // No filter = matches all

        // Check if matchData matches all filter criteria
        return Object.entries(sub.filter).every(
          ([key, value]) => matchData[key] === value,
        );
      })
      .map((sub) => sub.connectionId);
  }

  getRoomStats(): Map<string, number> {
    const stats = new Map<string, number>();
    this.rooms.forEach((members, room) => {
      stats.set(room, members.size);
    });
    return stats;
  }
}
```

### 36.5 Event Bridge (NATS to WebSocket)

```typescript
// packages/messaging/src/websocket/event-bridge.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { NatsService } from '../nats/nats.service';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';
import { AgentEvent, WorkflowEvent, TaskEvent } from '../types/messages';

interface WebSocketEvent {
  type: string;
  room: string;
  data: unknown;
  timestamp: string;
}

@Injectable()
export class EventBridge implements OnModuleInit {
  private readonly logger = new Logger(EventBridge.name);

  constructor(
    private readonly nats: NatsService,
    private readonly connectionManager: ConnectionManager,
    private readonly roomManager: RoomManager,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.setupEventBridges();
  }

  private async setupEventBridges(): Promise<void> {
    // Bridge agent events to WebSocket
    await this.nats.subscribe<AgentEvent>(
      'AGENT_EVENTS',
      'agent.>',
      'ws-agent-bridge',
      async (event, ack) => {
        await this.bridgeAgentEvent(event);
        ack();
      },
    );

    // Bridge workflow events to WebSocket
    await this.nats.subscribe<WorkflowEvent>(
      'AGENT_EVENTS',
      'workflow.>',
      'ws-workflow-bridge',
      async (event, ack) => {
        await this.bridgeWorkflowEvent(event);
        ack();
      },
    );

    // Bridge task events to WebSocket
    await this.nats.subscribe<TaskEvent>(
      'TASK_EVENTS',
      'task.>',
      'ws-task-bridge',
      async (event, ack) => {
        await this.bridgeTaskEvent(event);
        ack();
      },
    );

    this.logger.log('Event bridge initialized');
  }

  private async bridgeAgentEvent(event: AgentEvent): Promise<void> {
    const rooms = [
      `tenant:${event.tenantId}`,
      `agent:${event.tenantId}:${event.agentId}`,
    ];

    const wsEvent: WebSocketEvent = {
      type: `agent.${event.type.split('.').pop()}`,
      room: rooms[1],
      data: {
        agentId: event.agentId,
        agentType: event.agentType,
        payload: event.payload,
        correlationId: event.correlationId,
      },
      timestamp: event.timestamp,
    };

    this.broadcastToRooms(rooms, wsEvent, event);
  }

  private async bridgeWorkflowEvent(event: WorkflowEvent): Promise<void> {
    const rooms = [
      `tenant:${event.tenantId}`,
      `workflow:${event.tenantId}:${event.workflowId}`,
    ];

    const wsEvent: WebSocketEvent = {
      type: `workflow.${event.type.split('.').pop()}`,
      room: rooms[1],
      data: {
        workflowId: event.workflowId,
        stepId: event.stepId,
        payload: event.payload,
        correlationId: event.correlationId,
      },
      timestamp: event.timestamp,
    };

    this.broadcastToRooms(rooms, wsEvent, event);
  }

  private async bridgeTaskEvent(event: TaskEvent): Promise<void> {
    const rooms = [
      `tenant:${event.tenantId}`,
      `task:${event.tenantId}:${event.taskId}`,
    ];

    const wsEvent: WebSocketEvent = {
      type: `task.${event.type.split('.').pop()}`,
      room: rooms[1],
      data: {
        taskId: event.taskId,
        taskType: event.taskType,
        payload: event.payload,
        correlationId: event.correlationId,
      },
      timestamp: event.timestamp,
    };

    this.broadcastToRooms(rooms, wsEvent, event);
  }

  private broadcastToRooms(
    rooms: string[],
    wsEvent: WebSocketEvent,
    originalEvent: { tenantId: string },
  ): void {
    const sentConnectionIds = new Set<string>();

    for (const room of rooms) {
      // Get filtered members (respects subscription filters)
      const memberIds = this.roomManager.getFilteredMembers(room, {
        ...wsEvent.data as Record<string, unknown>,
      });

      for (const connectionId of memberIds) {
        // Avoid sending duplicate to same connection
        if (sentConnectionIds.has(connectionId)) continue;

        const sent = this.connectionManager.sendToConnection(connectionId, wsEvent);
        if (sent) {
          sentConnectionIds.add(connectionId);
        }
      }
    }

    this.logger.debug(`Bridged ${wsEvent.type} to ${sentConnectionIds.size} connections`);
  }
}
```

### 36.6 WebSocket Service

```typescript
// packages/messaging/src/websocket/websocket.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConnectionManager } from './connection-manager';
import { RoomManager } from './room-manager';

interface BroadcastOptions {
  room?: string;
  tenantId?: string;
  userId?: string;
  filter?: Record<string, unknown>;
}

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly roomManager: RoomManager,
  ) {}

  /**
   * Send message to specific connection
   */
  sendToConnection(connectionId: string, type: string, data: unknown): boolean {
    return this.connectionManager.sendToConnection(connectionId, {
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send message to all connections of a user
   */
  sendToUser(userId: string, type: string, data: unknown): number {
    return this.connectionManager.sendToUser(userId, {
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send message to all connections in a tenant
   */
  sendToTenant(tenantId: string, type: string, data: unknown): number {
    return this.connectionManager.sendToTenant(tenantId, {
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send message to a room
   */
  sendToRoom(room: string, type: string, data: unknown): number {
    const memberIds = this.roomManager.getRoomMemberIds(room);
    let sent = 0;

    const message = {
      type,
      room,
      data,
      timestamp: new Date().toISOString(),
    };

    for (const connectionId of memberIds) {
      if (this.connectionManager.sendToConnection(connectionId, message)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * Send message with flexible targeting
   */
  broadcast(type: string, data: unknown, options: BroadcastOptions = {}): number {
    const { room, tenantId, userId, filter } = options;

    if (room) {
      const memberIds = filter
        ? this.roomManager.getFilteredMembers(room, filter)
        : this.roomManager.getRoomMemberIds(room);

      return this.sendToMembers(memberIds, type, data, room);
    }

    if (userId) {
      return this.sendToUser(userId, type, data);
    }

    if (tenantId) {
      return this.sendToTenant(tenantId, type, data);
    }

    // Broadcast to all (use with caution)
    this.connectionManager.broadcast({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    return this.connectionManager.getStats().totalConnections;
  }

  private sendToMembers(
    memberIds: string[],
    type: string,
    data: unknown,
    room: string,
  ): number {
    const message = {
      type,
      room,
      data,
      timestamp: new Date().toISOString(),
    };

    let sent = 0;
    for (const connectionId of memberIds) {
      if (this.connectionManager.sendToConnection(connectionId, message)) {
        sent++;
      }
    }
    return sent;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    connections: { total: number; users: number; tenants: number };
    rooms: Map<string, number>;
  } {
    return {
      connections: this.connectionManager.getStats(),
      rooms: this.roomManager.getRoomStats(),
    };
  }
}
```

### 36.7 WebSocket Auth Guard

```typescript
// packages/messaging/src/websocket/guards/ws-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

interface AuthenticatedSocket {
  userId: string;
  tenantId: string;
  connectionId: string;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    if (!client.userId || !client.tenantId) {
      throw new WsException('Unauthorized');
    }

    return true;
  }
}
```

### 36.8 Client SDK (TypeScript)

```typescript
// packages/sdk/src/websocket-client.ts
export interface WebSocketClientOptions {
  url: string;
  token: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface WebSocketMessage {
  type: string;
  room?: string;
  data: unknown;
  timestamp: string;
}

type MessageHandler = (message: WebSocketMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;

export class AigentflowWebSocket {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectAttempts = 0;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private subscriptions: Set<string> = new Set();

  constructor(options: WebSocketClientOptions) {
    this.options = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...options,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.options.url}?token=${encodeURIComponent(this.options.token)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.resubscribe();
        this.connectionHandlers.forEach((handler) => handler());
        resolve();
      };

      this.ws.onclose = () => {
        this.disconnectionHandlers.forEach((handler) => handler());
        if (this.options.reconnect) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (event) => {
        const error = new Error('WebSocket error');
        this.errorHandlers.forEach((handler) => handler(error));
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message', error);
        }
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
      this.connect().catch(() => {
        // Will retry in onclose handler
      });
    }, this.options.reconnectInterval);
  }

  private resubscribe(): void {
    this.subscriptions.forEach((room) => {
      this.send('subscribe', { room });
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    // Call specific type handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Call wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  subscribe(room: string, filter?: Record<string, unknown>): void {
    this.subscriptions.add(room);
    this.send('subscribe', { room, filter });
  }

  unsubscribe(room: string): void {
    this.subscriptions.delete(room);
    this.send('unsubscribe', { room });
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => this.disconnectionHandlers.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  private send(type: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: type, data }));
    }
  }

  disconnect(): void {
    this.options.reconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

---

## Configuration

```env
# .env
WS_PORT=3001
WS_CORS_ORIGINS=http://localhost:5173,http://localhost:3000
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS_PER_USER=5
```

---

## Testing

```typescript
// packages/messaging/src/websocket/__tests__/websocket.service.spec.ts
import { Test } from '@nestjs/testing';
import { WebSocketService } from '../websocket.service';
import { ConnectionManager } from '../connection-manager';
import { RoomManager } from '../room-manager';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let connectionManager: jest.Mocked<ConnectionManager>;
  let roomManager: jest.Mocked<RoomManager>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebSocketService,
        {
          provide: ConnectionManager,
          useValue: {
            sendToConnection: jest.fn().mockReturnValue(true),
            sendToUser: jest.fn().mockReturnValue(2),
            sendToTenant: jest.fn().mockReturnValue(5),
            broadcast: jest.fn(),
            getStats: jest.fn().mockReturnValue({
              totalConnections: 10,
              uniqueUsers: 5,
              tenants: 2,
            }),
          },
        },
        {
          provide: RoomManager,
          useValue: {
            getRoomMemberIds: jest.fn().mockReturnValue(['conn-1', 'conn-2']),
            getFilteredMembers: jest.fn().mockReturnValue(['conn-1']),
            getRoomStats: jest.fn().mockReturnValue(new Map([['room1', 5]])),
          },
        },
      ],
    }).compile();

    service = module.get<WebSocketService>(WebSocketService);
    connectionManager = module.get(ConnectionManager);
    roomManager = module.get(RoomManager);
  });

  describe('sendToRoom', () => {
    it('should send message to all room members', () => {
      const sent = service.sendToRoom('test-room', 'test.event', { foo: 'bar' });

      expect(roomManager.getRoomMemberIds).toHaveBeenCalledWith('test-room');
      expect(connectionManager.sendToConnection).toHaveBeenCalledTimes(2);
      expect(sent).toBe(2);
    });
  });
});
```

---

## Acceptance Criteria

- [ ] WebSocket gateway accepting authenticated connections
- [ ] Room-based subscriptions working
- [ ] NATS events bridged to WebSocket clients
- [ ] Tenant isolation enforced on subscriptions
- [ ] Reconnection handling in client SDK
- [ ] Connection and room statistics available
- [ ] 90%+ test coverage

---

## Security Considerations

1. **Authentication**: JWT token required for connection
2. **Authorization**: Room access validated against tenant
3. **Rate Limiting**: Limit messages per connection
4. **Connection Limits**: Max connections per user/tenant
5. **Message Validation**: Validate all incoming messages

---

## References

- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
- [ws Library](https://github.com/websockets/ws)
- [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js)
