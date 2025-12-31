/**
 * Tenant Context Decorator
 *
 * Extracts tenant context from request (set by AuthGuard).
 */

import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { TenantContext } from '../guards';

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const tenantContext = (request as unknown as Record<string, unknown>)
      .tenantContext as TenantContext | undefined;

    if (!tenantContext) {
      throw new Error(
        'TenantContext not found. Make sure AuthGuard is applied.'
      );
    }

    return tenantContext;
  }
);
