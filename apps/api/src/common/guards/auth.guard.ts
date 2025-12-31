/**
 * Authentication Guard
 *
 * Verifies JWT tokens and extracts tenant context.
 * Uses proper cryptographic verification (not just base64 decode).
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';

import { ConfigService } from '../../config';
import { UnauthorizedError } from '../../errors';

/**
 * JWT payload schema with validation
 */
const jwtPayloadSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID in token'),
  userId: z.string().uuid('Invalid user ID in token'),
  email: z.string().email().optional(),
  roles: z.array(z.string()).optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

/**
 * Tenant context attached to request
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  email?: string;
  roles?: string[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    try {
      const payload = await this.verifyToken(token);
      const tenantContext: TenantContext = {
        tenantId: payload.tenantId,
        userId: payload.userId,
        email: payload.email,
        roles: payload.roles,
      };

      // Attach tenant context to request
      (request as unknown as Record<string, unknown>).tenantContext =
        tenantContext;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      this.logger.warn(`Token verification failed: ${String(error)}`);
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractToken(request: FastifyRequest): string | null {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return null;
    }

    // Must be Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7).trim();

    if (!token || token.length === 0) {
      return null;
    }

    return token;
  }

  /**
   * Verify JWT token with cryptographic signature validation
   */
  private async verifyToken(token: string): Promise<JwtPayload> {
    const secret = this.configService.jwtSecret;

    return new Promise((resolve, reject) => {
      jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            reject(new UnauthorizedError('Token has expired'));
            return;
          }
          if (err.name === 'JsonWebTokenError') {
            reject(new UnauthorizedError('Invalid token'));
            return;
          }
          reject(new UnauthorizedError('Token verification failed'));
          return;
        }

        // Validate payload structure
        const result = jwtPayloadSchema.safeParse(decoded);
        if (!result.success) {
          const errors = result.error.errors.map((e) => e.message).join(', ');
          reject(new UnauthorizedError(`Invalid token payload: ${errors}`));
          return;
        }

        resolve(result.data);
      });
    });
  }
}
