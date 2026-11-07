import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@RequirePermissions('report.read')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview(@CurrentUser() actor: AuthPrincipal) {
    return this.reports.overview(actor.organizationId);
  }

  @Get('sla')
  sla(@CurrentUser() actor: AuthPrincipal) {
    return this.reports.sla(actor.organizationId);
  }
}
