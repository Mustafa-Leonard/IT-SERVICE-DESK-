import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApprovalStatus } from '../generated/prisma/client.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CreateChangeRequestDto,
  CreateProblemDto,
  CreateServiceIncidentDto,
  DecideApprovalDto,
  LinkProblemTicketDto,
  UpdateServiceIncidentDto,
  UpdateProblemDto,
} from './operations.dto.js';
import { OperationsService } from './operations.service.js';

@ApiTags('service operations')
@ApiBearerAuth()
@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('incidents')
  @RequirePermissions('incident.manage')
  incidents(@CurrentUser() actor: AuthPrincipal) {
    return this.operations.incidents(actor.organizationId);
  }

  @Post('incidents')
  @RequirePermissions('incident.manage')
  createIncident(
    @Body() dto: CreateServiceIncidentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.operations.createIncident(dto, actor);
  }

  @Patch('incidents/:id')
  @RequirePermissions('incident.manage')
  updateIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceIncidentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.operations.updateIncident(id, dto, actor);
  }

  @Get('problems')
  @RequirePermissions('problem.manage')
  problems(@CurrentUser() actor: AuthPrincipal) {
    return this.operations.problems(actor.organizationId);
  }

  @Post('problems')
  @RequirePermissions('problem.manage')
  createProblem(@Body() dto: CreateProblemDto, @CurrentUser() actor: AuthPrincipal) {
    return this.operations.createProblem(dto, actor);
  }

  @Patch('problems/:id')
  @RequirePermissions('problem.manage')
  updateProblem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.operations.updateProblem(id, dto, actor);
  }

  @Post('problems/:id/tickets')
  @RequirePermissions('problem.manage')
  linkProblemTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkProblemTicketDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.operations.linkProblemTicket(id, dto.ticketId, actor);
  }

  @Get('changes')
  @RequirePermissions('change.manage')
  changes(@CurrentUser() actor: AuthPrincipal) {
    return this.operations.changeRequests(actor.organizationId);
  }

  @Post('changes')
  @RequirePermissions('change.manage')
  createChange(@Body() dto: CreateChangeRequestDto, @CurrentUser() actor: AuthPrincipal) {
    return this.operations.createChangeRequest(dto, actor);
  }

  @Post('changes/:id/submit')
  @RequirePermissions('change.manage')
  submitChange(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.operations.submitChangeRequest(id, actor);
  }

  @Get('approvals')
  @RequirePermissions('approval.manage')
  approvals(@CurrentUser() actor: AuthPrincipal) {
    return this.operations.approvals(actor.organizationId);
  }

  @Post('approvals/:id/approve')
  @RequirePermissions('approval.manage')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.operations.decideApproval(id, ApprovalStatus.APPROVED, dto, actor);
  }

  @Post('approvals/:id/reject')
  @RequirePermissions('approval.manage')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.operations.decideApproval(id, ApprovalStatus.REJECTED, dto, actor);
  }
}
