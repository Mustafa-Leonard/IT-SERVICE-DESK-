import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { CreateSlaPolicyDto, SetActiveDto } from './catalog.dto.js';
import { SlaPoliciesService } from './sla-policies.service.js';

@ApiTags('SLA policies')
@ApiBearerAuth()
@Controller('sla-policies')
@RequirePermissions('report.read')
export class SlaPoliciesController {
  constructor(private readonly policies: SlaPoliciesService) {}

  @Get()
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.policies.list(actor.organizationId);
  }

  @Post()
  @RequirePermissions('system.manage')
  create(@Body() dto: CreateSlaPolicyDto, @CurrentUser() actor: AuthPrincipal) {
    return this.policies.create(dto, actor);
  }

  @Patch(':id/active')
  @RequirePermissions('system.manage')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.policies.setActive(id, dto, actor);
  }
}
