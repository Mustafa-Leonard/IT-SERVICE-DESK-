import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  AssetAssignmentDto,
  CreateAssetCategoryDto,
  AssetDisposalDto,
  AssetMaintenanceDto,
  AssetStateDto,
  AssetTransferDto,
  CreateAssetDto,
} from './assets.dto.js';
import { AssetsService } from './assets.service.js';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('categories')
  categories(@CurrentUser() actor: AuthPrincipal) {
    return this.assets.listCategories(actor);
  }

  @Post('categories')
  @RequirePermissions('asset.manage')
  createCategory(
    @Body() dto: CreateAssetCategoryDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.assets.createCategory(dto.name, actor);
  }

  @Get()
  list(@CurrentUser() actor: AuthPrincipal, @Query('search') search?: string) {
    return this.assets.list(actor, search);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthPrincipal) {
    return this.assets.get(id, actor);
  }

  @Post()
  @RequirePermissions('asset.manage')
  create(@Body() dto: CreateAssetDto, @CurrentUser() actor: AuthPrincipal) {
    return this.assets.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('asset.manage')
  updateState(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssetStateDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.assets.updateState(id, dto, actor);
  }

  @Post(':id/assign')
  @RequirePermissions('asset.manage')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssetAssignmentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.assets.assign(id, dto, actor);
  }

  @Post(':id/transfers')
  @RequirePermissions('asset.manage')
  transfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssetTransferDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.assets.transfer(id, dto, actor);
  }

  @Post(':id/maintenance')
  @RequirePermissions('asset.manage')
  maintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssetMaintenanceDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.assets.recordMaintenance(id, dto, actor);
  }

  @Post(':id/dispose')
  @RequirePermissions('asset.manage')
  dispose(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssetDisposalDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.assets.dispose(id, dto, actor);
  }
}
