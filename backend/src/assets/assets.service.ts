import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { AssetStatus } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AssetAssignmentDto,
  AssetDisposalDto,
  AssetMaintenanceDto,
  AssetStateDto,
  AssetTransferDto,
  CreateAssetDto,
} from './assets.dto.js';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthPrincipal, search?: string) {
    const canReadAll =
      actor.permissions.includes('asset.read') ||
      actor.permissions.includes('asset.manage');
    if (!canReadAll && !actor.permissions.includes('asset.read.own')) {
      throw new ForbiddenException('You do not have permission to read assets.');
    }
    return this.prisma.asset.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(canReadAll
          ? {}
          : { assignments: { some: { userId: actor.userId, returnedAt: null } } }),
        ...(search
          ? {
              OR: [
                { assetTag: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { serialNumber: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        assignments: {
          where: { returnedAt: null },
          include: { user: { select: { id: true, displayName: true } } },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  listCategories(actor: AuthPrincipal) {
    if (
      !actor.permissions.includes('asset.read') &&
      !actor.permissions.includes('asset.manage') &&
      !actor.permissions.includes('asset.read.own')
    ) {
      throw new ForbiddenException('You do not have permission to read asset categories.');
    }
    return this.prisma.assetCategory.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(name: string, actor: AuthPrincipal) {
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) {
      throw new BadRequestException('Category name must contain letters or numbers.');
    }
    try {
      return await this.prisma.assetCategory.create({
        data: { organizationId: actor.organizationId, name: name.trim(), slug },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An asset category with that name already exists.');
      }
      throw error;
    }
  }

  async get(id: string, actor: AuthPrincipal) {
    const canReadAll =
      actor.permissions.includes('asset.read') ||
      actor.permissions.includes('asset.manage');
    if (!canReadAll && !actor.permissions.includes('asset.read.own')) {
      throw new ForbiddenException('You do not have permission to read assets.');
    }
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        ...(canReadAll
          ? {}
          : { assignments: { some: { userId: actor.userId, returnedAt: null } } }),
      },
      include: {
        category: true,
        department: true,
        location: true,
        assignments: {
          where: canReadAll ? {} : { userId: actor.userId },
          include: {
            user: { select: { id: true, displayName: true } },
            assignedBy: { select: { id: true, displayName: true } },
          },
          orderBy: { assignedAt: 'desc' },
        },
        transfers: { orderBy: { createdAt: 'desc' } },
        maintenance: { orderBy: { createdAt: 'desc' } },
        disposal: true,
      },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    return asset;
  }

  async create(dto: CreateAssetDto, actor: AuthPrincipal) {
    if (dto.categoryId) await this.assertCategory(dto.categoryId, actor.organizationId);
    const assetTag =
      dto.assetTag?.trim() ||
      `IT-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const asset = await transaction.asset.create({
          data: {
            organizationId: actor.organizationId,
            assetTag,
            name: dto.name.trim(),
            categoryId: dto.categoryId,
            serialNumber: dto.serialNumber?.trim(),
            manufacturer: dto.manufacturer?.trim(),
            model: dto.model?.trim(),
            specifications: dto.specifications,
            purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
            purchaseCost:
              dto.purchaseCost === undefined
                ? null
                : new Prisma.Decimal(dto.purchaseCost),
            supplier: dto.supplier?.trim(),
            warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorId: actor.userId,
            action: 'asset.registered',
            targetType: 'Asset',
            targetId: asset.id,
          },
        });
        return asset;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An asset with that tag already exists.');
      }
      throw error;
    }
  }

  async updateState(id: string, dto: AssetStateDto, actor: AuthPrincipal) {
    if (!dto.status && !dto.condition) {
      throw new BadRequestException('Specify an asset status or condition.');
    }
    const asset = await this.requireAsset(id, actor.organizationId);
    if (
      dto.status === AssetStatus.ASSIGNED ||
      dto.status === AssetStatus.DISPOSED ||
      dto.status === AssetStatus.RETIRED
    ) {
      throw new BadRequestException('Use the assignment or disposal workflow for this status.');
    }
    if (
      asset.status === AssetStatus.DISPOSED ||
      asset.status === AssetStatus.RETIRED
    ) {
      throw new BadRequestException('Disposed or retired assets cannot be changed.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const asset = await transaction.asset.update({
        where: { id },
        data: {
          ...(dto.condition ? { condition: dto.condition } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });
      if (dto.status === AssetStatus.IN_STOCK) {
        await transaction.assetAssignment.updateMany({
          where: { assetId: id, returnedAt: null },
          data: { returnedAt: new Date() },
        });
      }
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'asset.condition_updated',
          targetType: 'Asset',
          targetId: id,
          metadata: {
            condition: dto.condition ?? null,
            status: dto.status ?? null,
            note: dto.note ?? null,
          },
        },
      });
      return asset;
    });
  }

  async assign(id: string, dto: AssetAssignmentDto, actor: AuthPrincipal) {
    const [asset, user] = await Promise.all([
      this.requireAsset(id, actor.organizationId),
      this.prisma.user.findFirst({
        where: { id: dto.userId, organizationId: actor.organizationId, isActive: true },
        select: { id: true, departmentId: true, locationId: true },
      }),
    ]);
    if (!user) throw new BadRequestException('The selected user is unavailable.');
    if (
      asset.status === AssetStatus.LOST ||
      asset.status === AssetStatus.DAMAGED ||
      asset.status === AssetStatus.UNDER_REPAIR ||
      asset.status === AssetStatus.DISPOSED ||
      asset.status === AssetStatus.RETIRED
    ) {
      throw new BadRequestException('Lost, damaged, or unavailable assets cannot be assigned.');
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.assetAssignment.updateMany({
        where: { assetId: id, returnedAt: null },
        data: { returnedAt: new Date() },
      });
      await transaction.assetAssignment.create({
        data: {
          assetId: id,
          userId: user.id,
          assignedById: actor.userId,
          note: dto.note?.trim(),
        },
      });
      const updated = await transaction.asset.update({
        where: { id },
        data: {
          status: AssetStatus.ASSIGNED,
          departmentId: user.departmentId,
          locationId: user.locationId,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'asset.assigned',
          targetType: 'Asset',
          targetId: id,
          metadata: { userId: user.id },
        },
      });
      return updated;
    });
  }

  async transfer(id: string, dto: AssetTransferDto, actor: AuthPrincipal) {
    const asset = await this.requireAsset(id, actor.organizationId);
    if (dto.departmentId === undefined && dto.locationId === undefined) {
      throw new BadRequestException('Specify a department or location to transfer.');
    }
    await this.assertOrgRecords(
      actor.organizationId,
      dto.departmentId,
      dto.locationId,
    );
    return this.prisma.$transaction(async (transaction) => {
      await transaction.assetTransfer.create({
        data: {
          assetId: id,
          fromDepartmentId: asset.departmentId,
          toDepartmentId:
            dto.departmentId !== undefined ? dto.departmentId : asset.departmentId,
          fromLocationId: asset.locationId,
          toLocationId:
            dto.locationId !== undefined ? dto.locationId : asset.locationId,
          actorId: actor.userId,
          note: dto.note?.trim(),
        },
      });
      const updated = await transaction.asset.update({
        where: { id },
        data: {
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'asset.transferred',
          targetType: 'Asset',
          targetId: id,
        },
      });
      return updated;
    });
  }

  async recordMaintenance(
    id: string,
    dto: AssetMaintenanceDto,
    actor: AuthPrincipal,
  ) {
    const asset = await this.requireAsset(id, actor.organizationId);
    if (
      asset.status === AssetStatus.DISPOSED ||
      asset.status === AssetStatus.RETIRED
    ) {
      throw new BadRequestException('Disposed or retired assets cannot receive maintenance records.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const maintenance = await transaction.assetMaintenance.create({
        data: {
          assetId: id,
          actorId: actor.userId,
          description: dto.description.trim(),
          cost:
            dto.cost === undefined ? null : new Prisma.Decimal(dto.cost),
          vendor: dto.vendor?.trim(),
          startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
          completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
        },
      });
      await transaction.asset.update({
        where: { id },
        data: {
          status: dto.completedAt ? AssetStatus.IN_STOCK : AssetStatus.UNDER_REPAIR,
        },
      });
      if (dto.completedAt) {
        await transaction.assetAssignment.updateMany({
          where: { assetId: id, returnedAt: null },
          data: { returnedAt: new Date() },
        });
      }
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'asset.maintenance_recorded',
          targetType: 'Asset',
          targetId: id,
        },
      });
      return maintenance;
    });
  }

  async dispose(id: string, dto: AssetDisposalDto, actor: AuthPrincipal) {
    const asset = await this.requireAsset(id, actor.organizationId);
    if (asset.status === AssetStatus.DISPOSED) {
      throw new BadRequestException('Asset is already disposed.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const disposal = await transaction.assetDisposal.create({
        data: {
          assetId: id,
          actorId: actor.userId,
          method: dto.method.trim(),
          notes: dto.notes?.trim(),
        },
      });
      await transaction.asset.update({
        where: { id },
        data: { status: AssetStatus.DISPOSED },
      });
      await transaction.assetAssignment.updateMany({
        where: { assetId: id, returnedAt: null },
        data: { returnedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'asset.disposed',
          targetType: 'Asset',
          targetId: id,
        },
      });
      return disposal;
    });
  }

  private requireAsset(id: string, organizationId: string) {
    return this.prisma.asset.findFirst({
      where: { id, organizationId },
    }).then((asset) => {
      if (!asset) throw new NotFoundException('Asset not found.');
      return asset;
    });
  }

  private async assertCategory(categoryId: string, organizationId: string) {
    const category = await this.prisma.assetCategory.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true },
    });
    if (!category) throw new BadRequestException('Asset category is unavailable.');
  }

  private async assertOrgRecords(
    organizationId: string,
    departmentId?: string | null,
    locationId?: string | null,
  ) {
    const checks: Promise<unknown>[] = [];
    if (departmentId) {
      checks.push(
        this.prisma.department
          .findFirst({ where: { id: departmentId, organizationId, isActive: true } })
          .then((record) => {
            if (!record) throw new BadRequestException('Department is unavailable.');
          }),
      );
    }
    if (locationId) {
      checks.push(
        this.prisma.location
          .findFirst({ where: { id: locationId, organizationId, isActive: true } })
          .then((record) => {
            if (!record) throw new BadRequestException('Location is unavailable.');
          }),
      );
    }
    await Promise.all(checks);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
