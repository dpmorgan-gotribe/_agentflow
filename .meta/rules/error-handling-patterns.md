# Error Handling Patterns

Consistent, typed, actionable error handling throughout the codebase. All errors should be catchable, identifiable, and provide enough context for debugging and user feedback.

## Error Class Hierarchy

### Base Error Class

```typescript
// packages/shared/src/errors/base.error.ts

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp = new Date().toISOString();
  readonly isOperational = true;  // vs programming errors

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}
```

### Specific Error Types

```typescript
// packages/shared/src/errors/index.ts

// =====================================================
// Client Errors (4xx)
// =====================================================

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message = 'Authentication required') {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message = 'Access denied', context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      { resource, id }
    );
  }
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class RateLimitError extends DomainError {
  readonly code = 'RATE_LIMITED';
  readonly statusCode = 429;

  constructor(
    message = 'Rate limit exceeded',
    public readonly retryAfterMs?: number
  ) {
    super(message, { retryAfterMs });
  }
}

// =====================================================
// Server Errors (5xx)
// =====================================================

export class InternalError extends DomainError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class ServiceUnavailableError extends DomainError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly statusCode = 503;

  constructor(service: string) {
    super(`Service unavailable: ${service}`, { service });
  }
}

// =====================================================
// Domain-Specific Errors
// =====================================================

export class AgentExecutionError extends DomainError {
  readonly code = 'AGENT_EXECUTION_ERROR';
  readonly statusCode = 500;

  constructor(agentId: string, cause?: string) {
    super(`Agent execution failed: ${agentId}`, { agentId, cause });
  }
}

export class AgentTimeoutError extends DomainError {
  readonly code = 'AGENT_TIMEOUT';
  readonly statusCode = 504;

  constructor(agentId: string, timeoutMs: number) {
    super(`Agent timed out after ${timeoutMs}ms: ${agentId}`, {
      agentId,
      timeoutMs,
    });
  }
}

export class CheckpointError extends DomainError {
  readonly code = 'CHECKPOINT_ERROR';
  readonly statusCode = 500;

  constructor(message: string, threadId?: string) {
    super(message, { threadId });
  }
}
```

---

## Usage Patterns

### Throwing Errors

```typescript
// ✅ Good - throw typed error with context
async function findAgent(id: string, tenantId: string): Promise<Agent> {
  const agent = await agentRepository.findById(id, tenantId);

  if (!agent) {
    throw new NotFoundError('Agent', id);
  }

  return agent;
}

// ✅ Good - wrap external errors
async function executeAgent(id: string): Promise<AgentOutput> {
  try {
    return await agent.execute();
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;  // Re-throw domain errors
    }
    // Wrap unknown errors
    throw new AgentExecutionError(id, error.message);
  }
}
```

### Catching Errors

```typescript
// ✅ Good - handle specific error types
try {
  await agentService.execute(agentId, tenantId, input);
} catch (error) {
  if (error instanceof AgentTimeoutError) {
    // Handle timeout - maybe retry
    logger.warn('Agent timed out, retrying...', { agentId });
    return await retry(agentId, input);
  }

  if (error instanceof AgentExecutionError) {
    // Handle execution failure
    logger.error('Agent execution failed', { agentId, error });
    throw error;  // Let it bubble up
  }

  if (error instanceof DomainError) {
    // Handle other known errors
    throw error;
  }

  // Unknown error - wrap and rethrow
  logger.error('Unexpected error', { error });
  throw new InternalError('Unexpected error during agent execution');
}
```

### Error Guards

```typescript
// Type guard for domain errors
function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

// Type guard for specific error
function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

// Usage
try {
  await someOperation();
} catch (error) {
  if (isNotFoundError(error)) {
    // TypeScript knows error is NotFoundError
    console.log(error.context?.resource);
  }
}
```

---

## API Error Handling

### Global Exception Filter (NestJS)

```typescript
// apps/api/src/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '@aigentflow/shared/errors';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle domain errors
    if (exception instanceof DomainError) {
      return response.status(exception.statusCode).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          context: exception.context,
          timestamp: exception.timestamp,
        },
      });
    }

    // Handle NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json({
        success: false,
        error: {
          code: 'HTTP_ERROR',
          message: exception.message,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Handle unknown errors
    console.error('Unhandled exception:', exception);

    return response.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

### API Response Format

```typescript
// Success Response
{
  "success": true,
  "data": { /* response data */ }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent not found: agent-123",
    "context": {
      "resource": "Agent",
      "id": "agent-123"
    },
    "timestamp": "2025-12-31T12:00:00.000Z"
  }
}
```

---

## Frontend Error Handling

### Error Boundary

```typescript
// apps/web/src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 bg-red-50 text-red-700 rounded">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### API Error Handling Hook

```typescript
// apps/web/src/hooks/useApiError.ts
import { DomainError } from '@aigentflow/shared/errors';

interface ApiError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export function useApiError() {
  const handleError = (error: unknown): ApiError => {
    // Handle fetch errors
    if (error instanceof Response) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
      };
    }

    // Handle API error responses
    if (isApiError(error)) {
      return error;
    }

    // Handle unknown errors
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    };
  };

  return { handleError };
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}
```

---

## Anti-Patterns

### Throwing Plain Strings

```typescript
// ❌ Bad - plain string
throw 'Something went wrong';

// ❌ Bad - plain Error
throw new Error('Something went wrong');

// ✅ Good - typed error
throw new InternalError('Something went wrong', { operation: 'save' });
```

### Empty Catch Blocks

```typescript
// ❌ Bad - swallowed error
try {
  await riskyOperation();
} catch (error) {
  // Silent failure - DON'T DO THIS
}

// ✅ Good - handle or rethrow
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error });
  throw error;  // Or handle appropriately
}
```

### Catching and Ignoring Type

```typescript
// ❌ Bad - loses error type information
try {
  await operation();
} catch (error) {
  throw new Error(error.message);  // Loses original error type
}

// ✅ Good - preserve or wrap properly
try {
  await operation();
} catch (error) {
  if (error instanceof DomainError) {
    throw error;  // Preserve domain errors
  }
  throw new InternalError('Operation failed', { cause: error.message });
}
```

### Generic Error Messages

```typescript
// ❌ Bad - unhelpful message
throw new Error('Error');
throw new NotFoundError('Not found');

// ✅ Good - specific, actionable message
throw new NotFoundError('Agent', agentId);
throw new ValidationError('Email format invalid', { field: 'email', value: input.email });
```

---

## Logging Errors

```typescript
// ✅ Good - structured logging with context
try {
  await agentService.execute(agentId, input);
} catch (error) {
  if (error instanceof DomainError) {
    logger.error('Agent execution failed', {
      code: error.code,
      message: error.message,
      context: error.context,
      stack: error.stack,
    });
  } else {
    logger.error('Unexpected error', {
      message: error.message,
      stack: error.stack,
    });
  }
  throw error;
}
```

---

## Error Recovery Patterns

### Retry with Backoff

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry client errors
      if (error instanceof DomainError && error.statusCode < 500) {
        throw error;
      }

      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeMs: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure!.getTime() > this.resetTimeMs) {
        this.state = 'half-open';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```
