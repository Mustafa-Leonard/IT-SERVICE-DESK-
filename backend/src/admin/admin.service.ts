import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { UpsertSettingDto } from './admin.dto.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  auditLogs(
    actor: AuthPrincipal,
    pageValue?: string,
    action?: string,
  ) {
    if (!actor.permissions.includes('audit.read')) {
      throw new ForbiddenException('You do not have permission to read audit logs.');
    }
    const page = pageValue ? Number(pageValue) : 1;
    if (!Number.isInteger(page) || page < 1 || page > 10_000) {
      throw new BadRequestException('Page must be an integer from 1 to 10000.');
    }
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(action ? { action: { contains: action, mode: 'insensitive' } } : {}),
      },
      include: { actor: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50,
    });
  }

  settings(organizationId: string) {
    return this.prisma.systemSetting.findMany({
      where: { organizationId },
      orderBy: { key: 'asc' },
    });
  }

  async upsertSetting(dto: UpsertSettingDto, actor: AuthPrincipal) {
    const key = dto.key.trim().toLowerCase();
    if (!/^[a-z][a-z0-9._-]{1,63}$/.test(key)) {
      throw new BadRequestException('Setting key must use lowercase letters, digits, dots, or hyphens.');
    }
    if (/(password|secret|token|credential|smtp|s3|access.?key)/i.test(key)) {
      throw new BadRequestException('Credentials and integration settings must use environment variables.');
    }
    if (!this.isJsonObject(dto.value)) {
      throw new BadRequestException('Setting value must be valid JSON with a maximum nesting depth of 8.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const setting = await transaction.systemSetting.upsert({
        where: {
          organizationId_key: {
            organizationId: actor.organizationId,
            key,
          },
        },
        create: {
          organizationId: actor.organizationId,
          key,
          value: dto.value as Prisma.InputJsonObject,
        },
        update: { value: dto.value as Prisma.InputJsonObject },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'system_setting.updated',
          targetType: 'SystemSetting',
          targetId: setting.id,
          metadata: { key },
        },
      });
      return setting;
    });
  }

  private isJsonObject(
    value: unknown,
    depth = 0,
  ): value is Prisma.InputJsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 8) {
      return false;
    }
    return Object.values(value).every((item) => this.isJsonValue(item, depth + 1));
  }

  private isJsonValue(value: unknown, depth: number): value is Prisma.InputJsonValue {
    if (depth > 8) return false;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every((item) => this.isJsonValue(item, depth + 1));
    }
    if (typeof value === 'object') {
      return Object.values(value).every((item) => this.isJsonValue(item, depth + 1));
    }
    return false;
  }
}
