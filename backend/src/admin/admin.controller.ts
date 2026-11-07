import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { UpsertSettingDto } from './admin.dto.js';
import { AdminService } from './admin.service.js';

@ApiTags('administration')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('audit-logs')
  @RequirePermissions('audit.read')
  auditLogs(
    @CurrentUser() actor: AuthPrincipal,
    @Query('page') page?: string,
    @Query('action') action?: string,
  ) {
    return this.admin.auditLogs(actor, page, action);
  }

  @Get('settings')
  @RequirePermissions('system.manage')
  settings(@CurrentUser() actor: AuthPrincipal) {
    return this.admin.settings(actor.organizationId);
  }

  @Post('settings')
  @RequirePermissions('system.manage')
  upsertSetting(
    @Body() dto: UpsertSettingDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.admin.upsertSetting(dto, actor);
  }
}
