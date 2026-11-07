import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { DepartmentDto, LocationDto } from './organization.dto.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  listDepartments(organizationId: string) {
    return this.prisma.department.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, tickets: true, assets: true } } },
    });
  }

  async createDepartment(dto: DepartmentDto, actor: AuthPrincipal) {
    const slug = this.slug(dto.name);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const department = await transaction.department.create({
          data: {
            organizationId: actor.organizationId,
            name: dto.name.trim(),
            slug,
          },
        });
        await this.audit(transaction, actor, 'department.created', 'Department', department.id);
        return department;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A department with that name already exists.');
      }
      throw error;
    }
  }

  async updateDepartment(id: string, dto: DepartmentDto, actor: AuthPrincipal) {
    const existing = await this.prisma.department.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Department not found.');
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const department = await transaction.department.update({
          where: { id },
          data: { name: dto.name.trim(), slug: this.slug(dto.name) },
        });
        await this.audit(transaction, actor, 'department.updated', 'Department', id);
        return department;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A department with that name already exists.');
      }
      throw error;
    }
  }

  async deactivateDepartment(id: string, actor: AuthPrincipal) {
    const existing = await this.prisma.department.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Department not found.');
    await this.prisma.$transaction(async (transaction) => {
      await transaction.department.update({ where: { id }, data: { isActive: false } });
      await this.audit(transaction, actor, 'department.deactivated', 'Department', id);
    });
    return { id, isActive: false };
  }

  listLocations(organizationId: string) {
    return this.prisma.location.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, assets: true, devices: true } } },
    });
  }

  async createLocation(dto: LocationDto, actor: AuthPrincipal) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const location = await transaction.location.create({
          data: {
            organizationId: actor.organizationId,
            name: dto.name.trim(),
            code: dto.code.trim().toUpperCase(),
            address: dto.address?.trim(),
          },
        });
        await this.audit(transaction, actor, 'location.created', 'Location', location.id);
        return location;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A location with that code already exists.');
      }
      throw error;
    }
  }

  async updateLocation(id: string, dto: LocationDto, actor: AuthPrincipal) {
    const existing = await this.prisma.location.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Location not found.');
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const location = await transaction.location.update({
          where: { id },
          data: {
            name: dto.name.trim(),
            code: dto.code.trim().toUpperCase(),
            address: dto.address?.trim(),
          },
        });
        await this.audit(transaction, actor, 'location.updated', 'Location', id);
        return location;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A location with that code already exists.');
      }
      throw error;
    }
  }

  async deactivateLocation(id: string, actor: AuthPrincipal) {
    const existing = await this.prisma.location.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Location not found.');
    await this.prisma.$transaction(async (transaction) => {
      await transaction.location.update({ where: { id }, data: { isActive: false } });
      await this.audit(transaction, actor, 'location.deactivated', 'Location', id);
    });
    return { id, isActive: false };
  }

  private slug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private audit(
    transaction: Prisma.TransactionClient,
    actor: AuthPrincipal,
    action: string,
    targetType: string,
    targetId: string,
  ) {
    return transaction.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        action,
        targetType,
        targetId,
      },
    });
  }
}
