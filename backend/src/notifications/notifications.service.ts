import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { AuthPrincipal } from '../auth/auth.types.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthPrincipal) {
    return this.prisma.notification.findMany({
      where: {
        organizationId: actor.organizationId,
        userId: actor.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string, actor: AuthPrincipal) {
    const updated = await this.prisma.notification.updateMany({
      where: {
        id,
        organizationId: actor.organizationId,
        userId: actor.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    if (updated.count !== 1) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, organizationId: actor.organizationId, userId: actor.userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Notification not found.');
    }
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async markAllRead(actor: AuthPrincipal) {
    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
