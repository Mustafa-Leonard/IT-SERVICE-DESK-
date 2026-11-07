import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TicketStatus } from '../generated/prisma/client.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  AssignTicketDto,
  CreateTicketDto,
  TicketCommentDto,
  UpdateTicketDto,
} from './tickets.dto.js';
import { CreateTicketCategoryDto } from './catalog.dto.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status', new ParseEnumPipe(TicketStatus, { optional: true }))
    status?: TicketStatus,
  ) {
    return this.tickets.list(actor, status);
  }

  @Post()
  @RequirePermissions('ticket.create')
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.tickets.create(dto, actor);
  }

  @Get('categories')
  categories(@CurrentUser() actor: AuthPrincipal) {
    return this.tickets.listCategories(actor.organizationId);
  }

  @Post('categories')
  @RequirePermissions('system.manage')
  createCategory(
    @Body() dto: CreateTicketCategoryDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.tickets.createCategory(dto, actor);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPrincipal) {
    return this.tickets.get(id, actor);
  }

  @Patch(':id')
  @RequirePermissions('ticket.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.tickets.update(id, dto, actor);
  }

  @Post(':id/assign')
  @RequirePermissions('ticket.assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.tickets.assign(id, dto, actor);
  }

  @Post(':id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TicketCommentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.tickets.addComment(id, dto, actor);
  }
}
