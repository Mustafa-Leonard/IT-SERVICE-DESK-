import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';
import { EmailService } from '../auth/email.service.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateRoleDto,
  CreateUserDto,
  UpdateRolePermissionsDto,
  UpdateUserDto,
} from './users.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
  ) {}

  async list(organizationId: string, search?: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { displayName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        roles: { select: { role: { select: { id: true, key: true, name: true } } } },
      },
      orderBy: { displayName: 'asc' },
      take: 100,
    });
  }

  async create(dto: CreateUserDto, actor: AuthPrincipal) {
    this.email.assertConfigured();
    const email = dto.email.trim().toLowerCase();
    const roleKeys = [...new Set(dto.roleKeys)];
    if (roleKeys.includes('super_admin') && !actor.roles.includes('super_admin')) {
      throw new ForbiddenException('Only a Super Administrator can assign that role.');
    }

    const [existing, roles] = await Promise.all([
      this.prisma.user.findFirst({
        where: { organizationId: actor.organizationId, email },
        select: { id: true },
      }),
      this.prisma.role.findMany({
        where: { organizationId: actor.organizationId, key: { in: roleKeys } },
        select: { id: true, key: true },
      }),
    ]);
    if (existing) throw new ConflictException('An account with that email already exists.');
    if (roles.length !== roleKeys.length) {
      throw new BadRequestException('One or more selected roles are unavailable.');
    }
    await this.assertOrgRecords(actor.organizationId, dto.departmentId, dto.locationId);

    const passwordHash = await argon2.hash(
      randomBytes(32).toString('base64url'),
      { type: argon2.argon2id },
    );
    const created = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          organizationId: actor.organizationId,
          email,
          displayName: dto.displayName.trim(),
          passwordHash,
          departmentId: dto.departmentId,
          locationId: dto.locationId,
          roles: {
            create: roles.map((role) => ({
              roleId: role.id,
              assignedById: actor.userId,
            })),
          },
        },
        select: { id: true, email: true, displayName: true },
      });
      const token = await this.auth.createActivationToken(transaction, user.id);
      await this.audit(transaction, actor, 'user.created', 'User', user.id);
      return { user, token };
    });

    try {
      await this.auth.sendActivationLink(created.user.email, created.token);
    } catch (error) {
      await this.prisma.accountActivationToken.updateMany({
        where: { userId: created.user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      throw error;
    }
    return { ...created.user, activationEmailSent: true };
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthPrincipal) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    await this.assertOrgRecords(actor.organizationId, dto.departmentId, dto.locationId);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id },
        data: {
          ...(dto.displayName !== undefined
            ? { displayName: dto.displayName.trim() }
            : {}),
          ...(dto.departmentId !== undefined
            ? { departmentId: dto.departmentId }
            : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          isActive: true,
          departmentId: true,
          locationId: true,
        },
      });
      await this.audit(transaction, actor, 'user.updated', 'User', id);
      return updated;
    });
  }

  async deactivate(id: string, actor: AuthPrincipal) {
    if (id === actor.userId) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    const target = await this.prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found.');

    const isSuperAdmin = target.roles.some(({ role }) => role.key === 'super_admin');
    if (target.isActive && isSuperAdmin) {
      const activeAdministrators = await this.prisma.user.count({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          roles: { some: { role: { key: 'super_admin' } } },
        },
      });
      if (activeAdministrators <= 1) {
        throw new BadRequestException('The last active Super Administrator cannot be deactivated.');
      }
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id }, data: { isActive: false } });
      await transaction.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.accountActivationToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await transaction.passwordResetToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.audit(transaction, actor, 'user.deactivated', 'User', id);
    });
    return { id, isActive: false };
  }

  async resendActivation(id: string, actor: AuthPrincipal) {
    this.email.assertConfigured();
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        isActive: false,
        emailVerifiedAt: null,
      },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('Pending user account not found.');
    const now = new Date();
    const token = await this.prisma.$transaction(async (transaction) => {
      await transaction.accountActivationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      const nextToken = await this.auth.createActivationToken(transaction, user.id);
      await this.audit(transaction, actor, 'user.activation_resent', 'User', user.id);
      return nextToken;
    });
    await this.auth.sendActivationLink(user.email, token);
    return { message: 'Activation email sent.' };
  }

  async updateRoles(
    id: string,
    roleKeys: string[],
    actor: AuthPrincipal,
  ) {
    const target = await this.prisma.user.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { roles: { include: { role: true } } },
    });
    if (!target) throw new NotFoundException('User not found.');
    const uniqueKeys = [...new Set(roleKeys)];
    if (
      (uniqueKeys.includes('super_admin') ||
        target.roles.some(({ role }) => role.key === 'super_admin')) &&
      !actor.roles.includes('super_admin')
    ) {
      throw new ForbiddenException('Only a Super Administrator can change that role.');
    }
    const roles = await this.prisma.role.findMany({
      where: { organizationId: actor.organizationId, key: { in: uniqueKeys } },
      select: { id: true, key: true },
    });
    if (!uniqueKeys.length || roles.length !== uniqueKeys.length) {
      throw new BadRequestException('One or more selected roles are unavailable.');
    }

    const removesSuperAdmin =
      target.roles.some(({ role }) => role.key === 'super_admin') &&
      !uniqueKeys.includes('super_admin');
    if (target.isActive && removesSuperAdmin) {
      const activeAdministrators = await this.prisma.user.count({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          roles: { some: { role: { key: 'super_admin' } } },
        },
      });
      if (activeAdministrators <= 1) {
        throw new BadRequestException('The last active Super Administrator role cannot be removed.');
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({ where: { userId: id } });
      await transaction.userRole.createMany({
        data: roles.map((role) => ({
          userId: id,
          roleId: role.id,
          assignedById: actor.userId,
        })),
      });
      await this.audit(transaction, actor, 'user.roles_updated', 'User', id);
      return roles.map(({ key }) => key);
    });
  }

  listRoles(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async createRole(dto: CreateRoleDto, actor: AuthPrincipal) {
    const permissionKeys = [...new Set(dto.permissionKeys)];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== permissionKeys.length) {
      throw new BadRequestException('One or more selected permissions are unavailable.');
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const role = await transaction.role.create({
          data: {
            organizationId: actor.organizationId,
            key: dto.key,
            name: dto.name.trim(),
            description: dto.description?.trim(),
            permissions: {
              create: permissions.map(({ id }) => ({
                permissionId: id,
              })),
            },
          },
          include: { permissions: { include: { permission: true } } },
        });
        await this.audit(transaction, actor, 'role.created', 'Role', role.id);
        return role;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A role with that key already exists.');
      }
      throw error;
    }
  }

  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
    actor: AuthPrincipal,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: actor.organizationId },
    });
    if (!role) throw new NotFoundException('Role not found.');
    if (role.isSystem) {
      throw new BadRequestException('Built-in roles cannot be modified; create a custom role instead.');
    }
    const permissionKeys = [...new Set(dto.permissionKeys)];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });
    if (permissions.length !== permissionKeys.length) {
      throw new BadRequestException('One or more selected permissions are unavailable.');
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length) {
        await transaction.rolePermission.createMany({
          data: permissions.map(({ id }) => ({ roleId, permissionId: id })),
        });
      }
      await this.audit(transaction, actor, 'role.permissions_updated', 'Role', roleId);
    });
    return { roleId, permissionKeys };
  }

  private async assertOrgRecords(
    organizationId: string,
    departmentId?: string | null,
    locationId?: string | null,
  ): Promise<void> {
    const checks: Promise<unknown>[] = [];
    if (departmentId) {
      checks.push(
        this.prisma.department
          .findFirst({ where: { id: departmentId, organizationId }, select: { id: true } })
          .then((record) => {
            if (!record) throw new BadRequestException('Department is not available.');
          }),
      );
    }
    if (locationId) {
      checks.push(
        this.prisma.location
          .findFirst({ where: { id: locationId, organizationId }, select: { id: true } })
          .then((record) => {
            if (!record) throw new BadRequestException('Location is not available.');
          }),
      );
    }
    await Promise.all(checks);
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
