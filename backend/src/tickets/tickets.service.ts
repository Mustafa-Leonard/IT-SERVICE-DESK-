import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma, TicketStatus } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AssignTicketDto,
  CreateTicketDto,
  TicketCommentDto,
  UpdateTicketDto,
} from './tickets.dto.js';

const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
  OPEN: ['IN_PROGRESS', 'WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_ON_REQUESTER', 'WAITING_ON_VENDOR', 'RESOLVED', 'CLOSED'],
  WAITING_ON_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  WAITING_ON_VENDOR: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthPrincipal, status?: TicketStatus) {
    const where: Prisma.TicketWhereInput = {
      organizationId: actor.organizationId,
      ...(status ? { status } : {}),
    };
    if (!actor.permissions.includes('ticket.read.all')) {
      const scopes: Prisma.TicketWhereInput[] = [];
      if (actor.permissions.includes('ticket.read.own')) {
        scopes.push({ requesterId: actor.userId });
      }
      if (actor.permissions.includes('ticket.read.assigned')) {
        scopes.push({ assignedToId: actor.userId });
      }
      if (!scopes.length) throw new ForbiddenException();
      where.OR = scopes;
    }

    return this.prisma.ticket.findMany({
      where,
      include: {
        requester: { select: { id: true, displayName: true, email: true } },
        assignedTo: { select: { id: true, displayName: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  listCategories(organizationId: string) {
    return this.prisma.ticketCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(
    dto: import('./catalog.dto.js').CreateTicketCategoryDto,
    actor: AuthPrincipal,
  ) {
    const slug = dto.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) {
      throw new BadRequestException('Category name must contain letters or numbers.');
    }
    try {
      return await this.prisma.ticketCategory.create({
        data: {
          organizationId: actor.organizationId,
          name: dto.name.trim(),
          slug,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('A ticket category with that name already exists.');
      }
      throw error;
    }
  }

  async create(dto: CreateTicketDto, actor: AuthPrincipal) {
    if (dto.categoryId) {
      const category = await this.prisma.ticketCategory.findFirst({
        where: {
          id: dto.categoryId,
          organizationId: actor.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Ticket category is unavailable.');
    }

    const slaPolicy = await this.prisma.slaPolicy.findFirst({
      where: { organizationId: actor.organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        responseTargetMinutes: true,
        resolutionTargetMinutes: true,
      },
    });
    const createdAt = new Date();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const ticketNumber = `TKT-${createdAt.getUTCFullYear()}-${suffix}`;
    const ticket = await this.prisma.$transaction(async (transaction) => {
      const record = await transaction.ticket.create({
        data: {
          organizationId: actor.organizationId,
          requesterId: actor.userId,
          ticketNumber,
          subject: dto.subject.trim(),
          description: dto.description.trim(),
          categoryId: dto.categoryId,
          slaPolicyId: slaPolicy?.id,
          responseDueAt: slaPolicy
            ? new Date(createdAt.getTime() + slaPolicy.responseTargetMinutes * 60_000)
            : null,
          resolutionDueAt: slaPolicy
            ? new Date(createdAt.getTime() + slaPolicy.resolutionTargetMinutes * 60_000)
            : null,
        },
        include: {
          requester: { select: { id: true, displayName: true } },
          category: { select: { id: true, name: true } },
        },
      });
      await transaction.ticketStatusHistory.create({
        data: { ticketId: record.id, actorId: actor.userId, to: TicketStatus.NEW },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'ticket.created',
          targetType: 'Ticket',
          targetId: record.id,
        },
      });
      return record;
    });
    return ticket;
  }

  async get(id: string, actor: AuthPrincipal) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        requester: { select: { id: true, displayName: true, email: true } },
        assignedTo: { select: { id: true, displayName: true, email: true } },
        category: { select: { id: true, name: true } },
        comments: {
          where: actor.permissions.includes('ticket.comment.internal')
            ? {}
            : { visibility: 'PUBLIC' },
          include: { author: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { actor: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        assignments: {
          include: {
            assignedTo: { select: { id: true, displayName: true } },
            assignedBy: { select: { id: true, displayName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    this.assertCanRead(ticket.requesterId, ticket.assignedToId, actor);
    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, actor: AuthPrincipal) {
    const ticket = await this.requireTicket(id, actor.organizationId);
    this.assertCanUpdate(ticket.assignedToId, actor);
    if (dto.status && dto.status !== ticket.status) {
      if (!transitions[ticket.status].includes(dto.status)) {
        throw new BadRequestException(
          `Ticket cannot transition from ${ticket.status} to ${dto.status}.`,
        );
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.ticket.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.priority ? { priority: dto.priority } : {}),
          ...(dto.status === TicketStatus.RESOLVED
            ? { resolvedAt: new Date() }
            : dto.status === TicketStatus.OPEN
              ? { resolvedAt: null }
              : {}),
        },
      });
      if (dto.status && dto.status !== ticket.status) {
        await transaction.ticketStatusHistory.create({
          data: {
            ticketId: id,
            actorId: actor.userId,
            from: ticket.status,
            to: dto.status,
            note: dto.resolutionNote,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorId: actor.userId,
            action: 'ticket.status_changed',
            targetType: 'Ticket',
            targetId: id,
            metadata: { from: ticket.status, to: dto.status },
          },
        });
      }
      if (dto.priority && dto.priority !== ticket.priority) {
        await transaction.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorId: actor.userId,
            action: 'ticket.priority_changed',
            targetType: 'Ticket',
            targetId: id,
            metadata: { from: ticket.priority, to: dto.priority },
          },
        });
      }
      return updated;
    });
  }

  async assign(id: string, dto: AssignTicketDto, actor: AuthPrincipal) {
    const ticket = await this.requireTicket(id, actor.organizationId);
    if (
      ticket.assignedToId &&
      ticket.assignedToId !== actor.userId &&
      !actor.permissions.includes('ticket.assign.all')
    ) {
      throw new ForbiddenException("You cannot reassign another technician's ticket.");
    }
    if (
      dto.assigneeId &&
      dto.assigneeId !== actor.userId &&
      !actor.permissions.includes('ticket.assign.all')
    ) {
      throw new ForbiddenException('You may only accept an unassigned ticket for yourself.');
    }
    if (dto.assigneeId) {
      const technician = await this.prisma.user.findFirst({
        where: {
          id: dto.assigneeId,
          organizationId: actor.organizationId,
          isActive: true,
          roles: { some: { role: { key: 'it_technician' } } },
        },
        select: { id: true },
      });
      if (!technician) {
        throw new BadRequestException('Assignee must be an active IT Technician.');
      }
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.ticket.update({
        where: { id },
        data: { assignedToId: dto.assigneeId ?? null },
        include: { assignedTo: { select: { id: true, displayName: true } } },
      });
      if (dto.assigneeId) {
        await transaction.ticketAssignment.create({
          data: {
            ticketId: id,
            assignedToId: dto.assigneeId,
            assignedById: actor.userId,
            note: dto.note?.trim(),
          },
        });
        await transaction.notification.create({
          data: {
            organizationId: actor.organizationId,
            userId: dto.assigneeId,
            title: `Ticket ${updated.ticketNumber} assigned`,
            body: updated.subject,
            link: `/tickets/${id}`,
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'ticket.assignment_changed',
          targetType: 'Ticket',
          targetId: id,
          metadata: { assigneeId: dto.assigneeId ?? null },
        },
      });
      return updated;
    });
  }

  async addComment(id: string, dto: TicketCommentDto, actor: AuthPrincipal) {
    const ticket = await this.requireTicket(id, actor.organizationId);
    this.assertCanRead(ticket.requesterId, ticket.assignedToId, actor);
    const visibility = dto.visibility ?? 'PUBLIC';
    if (
      visibility === 'INTERNAL' &&
      !actor.permissions.includes('ticket.comment.internal')
    ) {
      throw new ForbiddenException('You cannot add internal notes.');
    }
    if (
      visibility === 'PUBLIC' &&
      !actor.permissions.includes('ticket.comment.public')
    ) {
      throw new ForbiddenException('You cannot add ticket comments.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const comment = await transaction.ticketComment.create({
        data: {
          ticketId: id,
          authorId: actor.userId,
          body: dto.body.trim(),
          visibility,
        },
        include: { author: { select: { id: true, displayName: true } } },
      });
      if (
        !ticket.firstResponseAt &&
        actor.userId !== ticket.requesterId &&
        visibility === 'PUBLIC'
      ) {
        await transaction.ticket.update({
          where: { id },
          data: { firstResponseAt: new Date() },
        });
      }
      const recipientId =
        actor.userId === ticket.requesterId ? ticket.assignedToId : ticket.requesterId;
      if (recipientId && visibility === 'PUBLIC') {
        await transaction.notification.create({
          data: {
            organizationId: actor.organizationId,
            userId: recipientId,
            title: `New comment on ${ticket.ticketNumber}`,
            body: dto.body.trim().slice(0, 500),
            link: `/tickets/${id}`,
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action:
            visibility === 'INTERNAL'
              ? 'ticket.internal_note_added'
              : 'ticket.comment_added',
          targetType: 'Ticket',
          targetId: id,
        },
      });
      return comment;
    });
  }

  private requireTicket(id: string, organizationId: string) {
    return this.prisma.ticket.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        ticketNumber: true,
        requesterId: true,
        assignedToId: true,
        status: true,
        priority: true,
        firstResponseAt: true,
      },
    }).then((ticket) => {
      if (!ticket) throw new NotFoundException('Ticket not found.');
      return ticket;
    });
  }

  private assertCanRead(
    requesterId: string,
    assignedToId: string | null,
    actor: AuthPrincipal,
  ): void {
    const allowed =
      actor.permissions.includes('ticket.read.all') ||
      (actor.permissions.includes('ticket.read.own') &&
        requesterId === actor.userId) ||
      (actor.permissions.includes('ticket.read.assigned') &&
        assignedToId === actor.userId);
    if (!allowed) throw new NotFoundException('Ticket not found.');
  }

  private assertCanUpdate(
    assignedToId: string | null,
    actor: AuthPrincipal,
  ): void {
    if (
      !actor.permissions.includes('ticket.update.all') &&
      assignedToId !== actor.userId
    ) {
      throw new ForbiddenException('You can only update tickets assigned to you.');
    }
  }
}
