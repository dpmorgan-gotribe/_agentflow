# API Response Formats

Consistent API response structure across all endpoints. Every response should be predictable, typed, and easy to handle on the client side.

## Standard Response Envelope

All API responses use a consistent envelope format:

```typescript
// packages/shared/src/types/api.types.ts

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

interface ApiError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

interface ResponseMeta {
  requestId: string;
  duration?: number;
  pagination?: PaginationMeta;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

---

## Success Responses

### Single Resource

```typescript
// GET /api/agents/agent-123
{
  "success": true,
  "data": {
    "id": "agent-123",
    "name": "Code Reviewer",
    "type": "reviewer",
    "status": "active",
    "createdAt": "2025-12-31T10:00:00Z",
    "updatedAt": "2025-12-31T10:00:00Z"
  },
  "meta": {
    "requestId": "req-abc-123"
  }
}
```

### Collection (Paginated)

```typescript
// GET /api/agents?page=1&pageSize=20
{
  "success": true,
  "data": [
    {
      "id": "agent-123",
      "name": "Code Reviewer",
      "type": "reviewer",
      "status": "active"
    },
    {
      "id": "agent-456",
      "name": "Backend Developer",
      "type": "specialist",
      "status": "idle"
    }
  ],
  "meta": {
    "requestId": "req-abc-123",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 45,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Created Resource

```typescript
// POST /api/agents
// Status: 201 Created
{
  "success": true,
  "data": {
    "id": "agent-789",
    "name": "New Agent",
    "type": "specialist",
    "status": "idle",
    "createdAt": "2025-12-31T12:00:00Z",
    "updatedAt": "2025-12-31T12:00:00Z"
  },
  "meta": {
    "requestId": "req-def-456"
  }
}
```

### No Content

```typescript
// DELETE /api/agents/agent-123
// Status: 204 No Content
// (No response body)
```

---

## Error Responses

### Client Error (4xx)

```typescript
// GET /api/agents/nonexistent
// Status: 404 Not Found
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent not found: nonexistent",
    "context": {
      "resource": "Agent",
      "id": "nonexistent"
    },
    "timestamp": "2025-12-31T12:00:00Z"
  },
  "meta": {
    "requestId": "req-ghi-789"
  }
}
```

### Validation Error

```typescript
// POST /api/agents (with invalid body)
// Status: 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "context": {
      "errors": [
        {
          "field": "name",
          "message": "Name is required",
          "code": "required"
        },
        {
          "field": "type",
          "message": "Must be one of: orchestrator, specialist, reviewer",
          "code": "invalid_enum",
          "received": "invalid-type"
        }
      ]
    },
    "timestamp": "2025-12-31T12:00:00Z"
  },
  "meta": {
    "requestId": "req-jkl-012"
  }
}
```

### Authentication Error

```typescript
// GET /api/agents (without auth header)
// Status: 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "timestamp": "2025-12-31T12:00:00Z"
  },
  "meta": {
    "requestId": "req-mno-345"
  }
}
```

### Rate Limit Error

```typescript
// Status: 429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "context": {
      "limit": 100,
      "window": "1m",
      "retryAfterMs": 30000
    },
    "timestamp": "2025-12-31T12:00:00Z"
  },
  "meta": {
    "requestId": "req-pqr-678"
  }
}
```

### Server Error (5xx)

```typescript
// Status: 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "timestamp": "2025-12-31T12:00:00Z"
  },
  "meta": {
    "requestId": "req-stu-901"
  }
}
```

---

## Implementation

### Response Helper Functions

```typescript
// packages/api/src/utils/response.utils.ts

export function success<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: getCurrentRequestId(),
      ...meta,
    },
  };
}

export function paginated<T>(
  data: T[],
  pagination: PaginationMeta,
  meta?: Partial<ResponseMeta>
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      requestId: getCurrentRequestId(),
      pagination,
      ...meta,
    },
  };
}

export function error(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      context,
      timestamp: new Date().toISOString(),
    },
    meta: {
      requestId: getCurrentRequestId(),
    },
  };
}
```

### Controller Usage

```typescript
// apps/api/src/controllers/agent.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { success, paginated } from '@/utils/response.utils';

@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get()
  async findAll(@Query() query: PaginationQuery) {
    const { data, pagination } = await this.agentService.findAll(query);
    return paginated(data, pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const agent = await this.agentService.findById(id);
    return success(agent);
  }

  @Post()
  async create(@Body() dto: CreateAgentDto) {
    const agent = await this.agentService.create(dto);
    return success(agent);
  }
}
```

### Response Interceptor

```typescript
// apps/api/src/interceptors/response.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        // If response is already formatted, pass through
        if (data?.success !== undefined) {
          return {
            ...data,
            meta: {
              ...data.meta,
              duration: Date.now() - startTime,
            },
          };
        }

        // Wrap raw data in success envelope
        return {
          success: true,
          data,
          meta: {
            requestId: request.id,
            duration: Date.now() - startTime,
          },
        };
      })
    );
  }
}
```

---

## HTTP Status Codes

### Success Codes

| Code | Usage |
|------|-------|
| `200 OK` | Successful GET, PUT, PATCH |
| `201 Created` | Successful POST that creates resource |
| `204 No Content` | Successful DELETE |

### Client Error Codes

| Code | Usage |
|------|-------|
| `400 Bad Request` | Validation error, malformed request |
| `401 Unauthorized` | Missing or invalid authentication |
| `403 Forbidden` | Authenticated but not authorized |
| `404 Not Found` | Resource doesn't exist |
| `409 Conflict` | Resource state conflict |
| `422 Unprocessable Entity` | Semantic validation error |
| `429 Too Many Requests` | Rate limit exceeded |

### Server Error Codes

| Code | Usage |
|------|-------|
| `500 Internal Server Error` | Unexpected server error |
| `502 Bad Gateway` | Upstream service error |
| `503 Service Unavailable` | Service temporarily down |
| `504 Gateway Timeout` | Upstream service timeout |

---

## Pagination

### Query Parameters

```
GET /api/agents?page=2&pageSize=20&sortBy=createdAt&sortOrder=desc
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `pageSize` | number | 20 | Items per page (max 100) |
| `sortBy` | string | createdAt | Field to sort by |
| `sortOrder` | string | desc | Sort direction (asc/desc) |

### Pagination Schema

```typescript
// packages/shared/src/schemas/pagination.schema.ts
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
```

---

## Streaming Responses

For agent execution and real-time updates, use Server-Sent Events:

```typescript
// GET /api/agents/agent-123/execute (SSE)
// Content-Type: text/event-stream

event: status
data: {"status": "running", "step": "analyzing"}

event: progress
data: {"progress": 50, "message": "Processing input"}

event: output
data: {"content": "Analysis results..."}

event: complete
data: {"success": true, "duration": 5234}
```

---

## Anti-Patterns

### Inconsistent Envelope

```typescript
// ❌ Bad - different structures
{ "agent": { ... } }
{ "data": { ... }, "status": "ok" }
{ "result": { ... }, "success": 1 }

// ✅ Good - consistent envelope
{ "success": true, "data": { ... }, "meta": { ... } }
```

### HTTP Status in Body

```typescript
// ❌ Bad - status code in body
{
  "status": 404,
  "message": "Not found"
}

// ✅ Good - use HTTP status + structured error
// Status: 404
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Agent not found"
  }
}
```

### Exposing Internal Details

```typescript
// ❌ Bad - exposes stack trace
{
  "success": false,
  "error": {
    "message": "Error at AgentService.execute (agent.service.ts:42)",
    "stack": "Error: ...\n    at ..."
  }
}

// ✅ Good - safe error response
{
  "success": false,
  "error": {
    "code": "AGENT_EXECUTION_ERROR",
    "message": "Agent execution failed"
  }
}
```

### Missing Request ID

```typescript
// ❌ Bad - no way to trace request
{
  "success": false,
  "error": { "message": "Error" }
}

// ✅ Good - includes request ID for debugging
{
  "success": false,
  "error": { "message": "Error" },
  "meta": { "requestId": "req-abc-123" }
}
```
