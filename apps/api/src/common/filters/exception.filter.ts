/**
 * Global Exception Filter
 *
 * Handles all exceptions and returns consistent error responses.
 * Never exposes stack traces in production.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { DomainError } from '../../errors';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const errorResponse = this.buildErrorResponse(exception, request);

    // Log error (with full details including stack trace)
    this.logError(exception, request, errorResponse);

    void response.status(errorResponse.statusCode).send(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: FastifyRequest
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle DomainError (our custom errors)
    if (exception instanceof DomainError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        timestamp,
        path,
        details: this.isProduction ? undefined : exception.context,
      };
    }

    // Handle ZodError (validation errors)
    if (exception instanceof ZodError) {
      const details = exception.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        timestamp,
        path,
        details: this.isProduction ? undefined : { errors: details },
      };
    }

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      return {
        statusCode: status,
        code: this.statusToCode(status),
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : ((
                exceptionResponse as Record<string, unknown>
              ).message?.toString() ?? exception.message),
        timestamp,
        path,
      };
    }

    // Handle unknown errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: this.isProduction
        ? 'An unexpected error occurred'
        : exception instanceof Error
          ? exception.message
          : 'Unknown error',
      timestamp,
      path,
    };
  }

  private statusToCode(status: number): string {
    const statusCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return statusCodes[status] ?? 'ERROR';
  }

  private logError(
    exception: unknown,
    request: FastifyRequest,
    errorResponse: ErrorResponse
  ): void {
    const logContext = {
      statusCode: errorResponse.statusCode,
      code: errorResponse.code,
      path: request.url,
      method: request.method,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `${errorResponse.message} - ${JSON.stringify(logContext)}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `${errorResponse.message} - ${JSON.stringify(logContext)}`
      );
    }
  }
}
