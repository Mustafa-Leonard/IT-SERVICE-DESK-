import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { errors as joseErrors, jwtVerify } from 'jose';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly secret: Uint8Array;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    this.secret = new TextEncoder().encode(
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();

    let subject: string;
    let sessionId: string;
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: 'it-service-desk',
        audience: 'it-service-desk-client',
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new UnauthorizedException();
      }
      subject = payload.sub;
      sessionId = payload.sid;
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) {
        throw new UnauthorizedException('Invalid or expired access token.');
      }
      throw error;
    }

    const session = await this.prisma.refreshSession.findFirst({
      where: {
        id: sessionId,
        userId: subject,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) throw new UnauthorizedException('Session is no longer active.');

    const roles = session.user.roles.map(({ role }) => role.key);
    const permissions = new Set(
      session.user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    );
    request.user = {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      email: session.user.email,
      displayName: session.user.displayName,
      roles,
      permissions: [...permissions],
    };
    return true;
  }
}
