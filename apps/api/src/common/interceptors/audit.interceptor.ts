/**
 * Audit Logging Interceptor
 *
 * Logs all API requests and responses for audit trail.
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import type { TenantContext } from '../guards';

interface HttpError extends Error {
  status?: number;
}

interface AuditLogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  tenantId?: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const requestId = crypto.randomUUID();

    const tenantContext = (request as unknown as Record<string, unknown>)
      .tenantContext as TenantContext | undefined;

    const baseEntry: Omit<AuditLogEntry, 'statusCode' | 'duration' | 'error'> =
      {
        timestamp: new Date().toISOString(),
        requestId,
        method: request.method,
        path: request.url,
        tenantId: tenantContext?.tenantId,
        userId: tenantContext?.userId,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<FastifyReply>();
        const duration = Date.now() - startTime;

        const entry: AuditLogEntry = {
          ...baseEntry,
          statusCode: response.statusCode,
          duration,
        };

        this.logEntry(entry);
      }),
      catchError((error: HttpError) => {
        const duration = Date.now() - startTime;

        const entry: AuditLogEntry = {
          ...baseEntry,
          statusCode: error.status ?? 500,
          duration,
          error: error.message,
        };

        this.logEntry(entry);
        throw error;
      })
    );
  }

  private logEntry(entry: AuditLogEntry): void {
    // Format for structured logging
    const logMessage = `${entry.method} ${entry.path} ${entry.statusCode} ${entry.duration}ms`;
    const logContext = {
      requestId: entry.requestId,
      tenantId: entry.tenantId,
      userId: entry.userId,
      ip: entry.ip,
    };

    if (entry.statusCode && entry.statusCode >= 400) {
      this.logger.warn(logMessage, logContext);
    } else {
      this.logger.log(logMessage, logContext);
    }
  }
}
