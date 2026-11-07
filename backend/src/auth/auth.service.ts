import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import { SignJWT } from 'jose';
import { PrismaService } from '../database/prisma.service.js';
import { EmailService } from './email.service.js';

const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_TIME_TOKEN_LIFETIME_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly signingKey: Uint8Array;
  private readonly publicAppUrl: string;
  private readonly dummyPasswordHash = argon2.hash(
    randomBytes(32).toString('base64url'),
    { type: argon2.argon2id },
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    this.signingKey = new TextEncoder().encode(
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    );
    this.publicAppUrl =
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.getOrThrow<string>('FRONTEND_ORIGIN');
  }

  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });
    const now = new Date();
    if (
      !user ||
      !user.isActive ||
      (user.lockedUntil && user.lockedUntil > now)
    ) {
      await argon2.verify(await this.dummyPasswordHash, password);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      const attempts = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          ...(attempts >= 5
            ? { lockedUntil: new Date(now.getTime() + 15 * 60 * 1000) }
            : {}),
        },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const refreshSecret = randomBytes(32).toString('base64url');
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshSecret),
        userAgent: userAgent?.slice(0, 512),
        ipAddress: ipAddress?.slice(0, 64),
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
      },
    });

    return {
      accessToken: await this.issueAccessToken(user.id, session.id),
      refreshToken: `${session.id}.${refreshSecret}`,
      expiresIn: 600,
    };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const [sessionId, secret, ...extra] = refreshToken.split('.');
    if (!sessionId || !secret || extra.length) {
      throw new UnauthorizedException('Invalid refresh token.');
    }
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(sessionId)) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.user.isActive ||
      !this.safeHashMatches(session.tokenHash, secret)
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const nextSecret = randomBytes(32).toString('base64url');
    const rotated = await this.prisma.refreshSession.updateMany({
      where: {
        id: session.id,
        tokenHash: session.tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        tokenHash: this.hashToken(nextSecret),
        lastUsedAt: now,
      },
    });
    if (rotated.count !== 1) {
      throw new UnauthorizedException('Refresh token has already been used.');
    }

    return {
      accessToken: await this.issueAccessToken(session.userId, session.id),
      refreshToken: `${session.id}.${nextSecret}`,
      expiresIn: 600,
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const [sessionId, secret, ...extra] = refreshToken.split('.');
    if (!sessionId || !secret || extra.length) return;

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || !this.safeHashMatches(session.tokenHash, secret)) return;

    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, tokenHash: session.tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    this.email.assertConfigured();
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), isActive: true },
    });
    if (!user) return { message: 'If the account exists, reset instructions will be sent.' };

    const token = randomBytes(32).toString('base64url');
    const reset = await this.prisma.$transaction(async (transaction) => {
      await transaction.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      return transaction.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + ONE_TIME_TOKEN_LIFETIME_MS),
        },
      });
    });

    try {
      await this.email.send(
        user.email,
        'Reset your IT Service Desk password',
        `Use this one-time link within 30 minutes: ${this.publicAppUrl}/reset-password?token=${encodeURIComponent(token)}`,
      );
    } catch (error) {
      await this.prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      });
      throw error;
    }
    return { message: 'If the account exists, reset instructions will be sent.' };
  }

  async completePasswordReset(token: string, password: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    const now = new Date();
    if (!reset || reset.usedAt || reset.expiresAt <= now) {
      throw new BadRequestException('The reset link is invalid or expired.');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('The reset link is invalid or expired.');
      }
      await transaction.passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: now },
      });
      await transaction.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await transaction.refreshSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: reset.userId },
        select: { organizationId: true },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorId: reset.userId,
          action: 'account.password_reset_completed',
          targetType: 'User',
          targetId: reset.userId,
        },
      });
    });
  }

  async completeActivation(
    token: string,
    password: string,
  ): Promise<void> {
    const activation = await this.prisma.accountActivationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: { select: { isActive: true, emailVerifiedAt: true } } },
    });
    const now = new Date();
    if (
      !activation ||
      activation.usedAt ||
      activation.expiresAt <= now ||
      activation.user.isActive ||
      activation.user.emailVerifiedAt
    ) {
      throw new BadRequestException('The activation link is invalid or expired.');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.accountActivationToken.updateMany({
        where: { id: activation.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException('The activation link is invalid or expired.');
      }
      const activated = await transaction.user.updateMany({
        where: {
          id: activation.userId,
          isActive: false,
          emailVerifiedAt: null,
        },
        data: {
          passwordHash,
          isActive: true,
          emailVerifiedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      if (activated.count !== 1) {
        throw new BadRequestException('The activation link is invalid or expired.');
      }
      await transaction.accountActivationToken.updateMany({
        where: { userId: activation.userId, usedAt: null },
        data: { usedAt: now },
      });
      const user = await transaction.user.findUniqueOrThrow({
        where: { id: activation.userId },
        select: { organizationId: true },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorId: activation.userId,
          action: 'account.activated',
          targetType: 'User',
          targetId: activation.userId,
        },
      });
    });
  }

  async createActivationToken(
    transaction: Prisma.TransactionClient,
    userId: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await transaction.accountActivationToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + ONE_TIME_TOKEN_LIFETIME_MS),
      },
    });
    return token;
  }

  async sendActivationLink(email: string, token: string): Promise<void> {
    await this.email.send(
      email,
      'Activate your IT Service Desk account',
      `Set your password and activate your account within 30 minutes: ${this.publicAppUrl}/activate?token=${encodeURIComponent(token)}`,
    );
  }

  private async issueAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<string> {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('it-service-desk')
      .setAudience('it-service-desk-client')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(this.signingKey);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private safeHashMatches(expectedHash: string, token: string): boolean {
    const expected = Buffer.from(expectedHash, 'hex');
    const actual = Buffer.from(this.hashToken(token), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
