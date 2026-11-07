import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, IncidentSeverity, Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateChangeRequestDto,
  CreateProblemDto,
  CreateServiceIncidentDto,
  DecideApprovalDto,
  UpdateProblemDto,
  UpdateServiceIncidentDto,
} from './operations.dto.js';

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  incidents(organizationId: string) {
    return this.prisma.incident.findMany({
      where: { organizationId },
      include: {
        reporter: { select: { id: true, displayName: true } },
        ticket: { select: { id: true, ticketNumber: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createIncident(dto: CreateServiceIncidentDto, actor: AuthPrincipal) {
    if (dto.ticketId) await this.assertTicket(dto.ticketId, actor.organizationId);
    const incident = await this.prisma.incident.create({
      data: {
        organizationId: actor.organizationId,
        reporterId: actor.userId,
        ticketId: dto.ticketId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity ?? IncidentSeverity.MEDIUM,
      },
    });
    await this.audit(actor, 'incident.created', incident.id);
    return incident;
  }

  async updateIncident(
    id: string,
    dto: UpdateServiceIncidentDto,
    actor: AuthPrincipal,
  ) {
    const existing = await this.prisma.incident.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Incident not found.');
    const transitions: Record<string, string[]> = {
      OPEN: ['INVESTIGATING', 'RESOLVED'],
      INVESTIGATING: ['OPEN', 'RESOLVED'],
      RESOLVED: ['OPEN'],
    };
    if (
      existing.status !== dto.status &&
      !transitions[existing.status]?.includes(dto.status)
    ) {
      throw new BadRequestException(
        `Incident cannot transition from ${existing.status} to ${dto.status}.`,
      );
    }
    const incident = await this.prisma.incident.update({
      where: { id },
      data: {
        status: dto.status,
        rootCause: dto.rootCause?.trim(),
      },
    });
    await this.audit(actor, 'incident.updated', id, { status: dto.status });
    return incident;
  }

  problems(organizationId: string) {
    return this.prisma.problem.findMany({
      where: { organizationId },
      include: {
        reporter: { select: { id: true, displayName: true } },
        tickets: { select: { id: true, ticketNumber: true, subject: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async createProblem(dto: CreateProblemDto, actor: AuthPrincipal) {
    const problem = await this.prisma.problem.create({
      data: {
        organizationId: actor.organizationId,
        reporterId: actor.userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        rootCause: dto.rootCause?.trim(),
      },
    });
    await this.audit(actor, 'problem.created', problem.id);
    return problem;
  }

  async updateProblem(id: string, dto: UpdateProblemDto, actor: AuthPrincipal) {
    await this.assertExists('problem', id, actor.organizationId);
    const updated = await this.prisma.problem.update({
      where: { id },
      data: { status: dto.status.trim().toUpperCase(), rootCause: dto.rootCause?.trim() },
    });
    await this.audit(actor, 'problem.updated', id, { status: updated.status });
    return updated;
  }

  async linkProblemTicket(
    id: string,
    ticketId: string,
    actor: AuthPrincipal,
  ) {
    await this.assertExists('problem', id, actor.organizationId);
    const ticket = await this.assertTicket(ticketId, actor.organizationId);
    if (ticket.problemId && ticket.problemId !== id) {
      throw new ConflictException('The ticket is already linked to another problem.');
    }
    try {
      const updatedTicket = await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { problemId: id },
      });
      await this.audit(actor, 'problem.ticket_linked', id, { ticketId });
      return updatedTicket;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('The ticket could not be linked to this problem.');
      }
      throw error;
    }
  }

  changeRequests(organizationId: string) {
    return this.prisma.changeRequest.findMany({
      where: { organizationId },
      include: {
        requester: { select: { id: true, displayName: true } },
        approvals: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async createChangeRequest(dto: CreateChangeRequestDto, actor: AuthPrincipal) {
    if (
      dto.plannedStart &&
      dto.plannedEnd &&
      new Date(dto.plannedEnd) <= new Date(dto.plannedStart)
    ) {
      throw new BadRequestException('Planned end must be after planned start.');
    }
    const request = await this.prisma.changeRequest.create({
      data: {
        organizationId: actor.organizationId,
        requesterId: actor.userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        risk: dto.risk.trim(),
        plannedStart: dto.plannedStart ? new Date(dto.plannedStart) : null,
        plannedEnd: dto.plannedEnd ? new Date(dto.plannedEnd) : null,
      },
    });
    await this.audit(actor, 'change_request.created', request.id);
    return request;
  }

  async submitChangeRequest(id: string, actor: AuthPrincipal) {
    const request = await this.prisma.changeRequest.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException('Change request not found.');
    if (!['DRAFT', 'REJECTED'].includes(request.status)) {
      throw new ConflictException('Only draft or rejected change requests can be submitted.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.changeRequest.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL' },
      });
      await transaction.approval.create({
        data: {
          organizationId: actor.organizationId,
          changeRequestId: id,
          requestedById: actor.userId,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'change_request.submitted',
          targetType: 'ChangeRequest',
          targetId: id,
        },
      });
      return updated;
    });
  }

  approvals(organizationId: string) {
    return this.prisma.approval.findMany({
      where: { organizationId },
      include: {
        requestedBy: { select: { id: true, displayName: true } },
        approver: { select: { id: true, displayName: true } },
        changeRequest: { select: { id: true, title: true, risk: true, status: true } },
        ticket: { select: { id: true, ticketNumber: true, subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async decideApproval(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    dto: DecideApprovalDto,
    actor: AuthPrincipal,
  ) {
    const approval = await this.prisma.approval.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        changeRequest: { select: { id: true, requesterId: true, status: true } },
      },
    });
    if (!approval) throw new NotFoundException('Approval not found.');
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new ConflictException('This approval has already been decided.');
    }
    if (approval.requestedById === actor.userId) {
      throw new BadRequestException('You cannot approve your own request.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.approval.update({
        where: { id },
        data: {
          status,
          approverId: actor.userId,
          decisionNote: dto.decisionNote.trim(),
          decidedAt: new Date(),
        },
      });
      if (approval.changeRequest) {
        await transaction.changeRequest.update({
          where: { id: approval.changeRequest.id },
          data: { status: status === ApprovalStatus.APPROVED ? 'APPROVED' : 'REJECTED' },
        });
      }
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: `approval.${status.toLowerCase()}`,
          targetType: 'Approval',
          targetId: id,
        },
      });
      return updated;
    });
  }

  private async assertTicket(id: string, organizationId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, organizationId },
      select: { id: true, problemId: true },
    });
    if (!ticket) throw new BadRequestException('Ticket is unavailable.');
    return ticket;
  }

  private async assertExists(
    model: 'problem',
    id: string,
    organizationId: string,
  ) {
    const record = await this.prisma.problem.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!record) throw new NotFoundException('Problem record not found.');
  }

  private audit(
    actor: AuthPrincipal,
    action: string,
    targetId: string,
    metadata?: Prisma.InputJsonObject,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        action,
        targetType: 'ServiceRecord',
        targetId,
        metadata,
      },
    });
  }
}
