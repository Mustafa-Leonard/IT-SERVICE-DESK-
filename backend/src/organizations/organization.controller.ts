import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { DepartmentDto, LocationDto } from './organization.dto.js';
import { OrganizationService } from './organization.service.js';

@ApiTags('departments and locations')
@ApiBearerAuth()
@Controller()
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get('departments')
  @RequirePermissions('user.read')
  departments(@CurrentUser() actor: AuthPrincipal) {
    return this.organization.listDepartments(actor.organizationId);
  }

  @Post('departments')
  @RequirePermissions('department.manage')
  createDepartment(
    @Body() dto: DepartmentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.organization.createDepartment(dto, actor);
  }

  @Patch('departments/:id')
  @RequirePermissions('department.manage')
  updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DepartmentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.organization.updateDepartment(id, dto, actor);
  }

  @Delete('departments/:id')
  @RequirePermissions('department.manage')
  deactivateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.organization.deactivateDepartment(id, actor);
  }

  @Get('locations')
  @RequirePermissions('user.read')
  locations(@CurrentUser() actor: AuthPrincipal) {
    return this.organization.listLocations(actor.organizationId);
  }

  @Post('locations')
  @RequirePermissions('location.manage')
  createLocation(
    @Body() dto: LocationDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.organization.createLocation(dto, actor);
  }

  @Patch('locations/:id')
  @RequirePermissions('location.manage')
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LocationDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.organization.updateLocation(id, dto, actor);
  }

  @Delete('locations/:id')
  @RequirePermissions('location.manage')
  deactivateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.organization.deactivateLocation(id, actor);
  }
}
