import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateSlaPolicyDto, SetActiveDto } from './catalog.dto.js';

@Injectable()
export class SlaPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.slaPolicy.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(dto: CreateSlaPolicyDto, actor: AuthPrincipal) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.slaPolicy.updateMany({
        where: { organizationId: actor.organizationId, isActive: true },
        data: { isActive: false },
      });
      const policy = await transaction.slaPolicy.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          responseTargetMinutes: dto.responseTargetMinutes,
          resolutionTargetMinutes: dto.resolutionTargetMinutes,
          isActive: true,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'sla_policy.created',
          targetType: 'SlaPolicy',
          targetId: policy.id,
        },
      });
      return policy;
    });
  }

  async setActive(id: string, dto: SetActiveDto, actor: AuthPrincipal) {
    const policy = await this.prisma.slaPolicy.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!policy) throw new NotFoundException('SLA policy not found.');
    if (!dto.isActive) {
      const activeCount = await this.prisma.slaPolicy.count({
        where: { organizationId: actor.organizationId, isActive: true },
      });
      if (activeCount === 1) {
        throw new BadRequestException('At least one SLA policy must remain active.');
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      if (dto.isActive) {
        await transaction.slaPolicy.updateMany({
          where: {
            organizationId: actor.organizationId,
            isActive: true,
            id: { not: id },
          },
          data: { isActive: false },
        });
      }
      const updated = await transaction.slaPolicy.update({
        where: { id },
        data: { isActive: dto.isActive },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'sla_policy.activation_changed',
          targetType: 'SlaPolicy',
          targetId: id,
          metadata: { isActive: dto.isActive },
        },
      });
      return updated;
    });
  }
}
