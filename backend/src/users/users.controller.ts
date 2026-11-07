import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CreateRoleDto,
  CreateUserDto,
  UpdateRolePermissionsDto,
  UpdateUserDto,
  UpdateUserRolesDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users and roles')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermissions('user.read')
  listUsers(
    @CurrentUser() actor: AuthPrincipal,
    @Query('search') search?: string,
  ) {
    return this.users.list(actor.organizationId, search);
  }

  @Post('users')
  @RequirePermissions('user.manage')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthPrincipal) {
    return this.users.create(dto, actor);
  }

  @Patch('users/:id')
  @RequirePermissions('user.manage')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Post('users/:id/deactivate')
  @RequirePermissions('user.manage')
  deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.users.deactivate(id, actor);
  }

  @Post('users/:id/activation')
  @RequirePermissions('user.manage')
  resendActivation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.users.resendActivation(id, actor);
  }

  @Put('users/:id/roles')
  @RequirePermissions('role.manage')
  updateUserRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.users.updateRoles(id, dto.roleKeys, actor);
  }

  @Get('roles')
  @RequirePermissions('role.manage')
  listRoles(@CurrentUser() actor: AuthPrincipal) {
    return this.users.listRoles(actor.organizationId);
  }

  @Get('permissions')
  @RequirePermissions('role.manage')
  listPermissions() {
    return this.users.listPermissions();
  }

  @Post('roles')
  @RequirePermissions('role.manage')
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthPrincipal) {
    return this.users.createRole(dto, actor);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('role.manage')
  updateRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.users.updateRolePermissions(id, dto, actor);
  }
}
