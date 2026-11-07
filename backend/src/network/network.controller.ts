import {
  Body,
  Controller,
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
import {
  CreateConfigurationDto,
  CreateConnectionDto,
  CreateIpAddressDto,
  CreateNetworkDeviceDto,
  CreateNetworkIncidentDto,
  CreateNetworkMaintenanceDto,
  CreateSubnetDto,
  CreateVlanDto,
  LinkNetworkRecordDto,
  UpdateDeviceStatusDto,
  UpdateNetworkIncidentDto,
  UpdateNetworkMaintenanceDto,
} from './network.dto.js';
import { NetworkService } from './network.service.js';

@ApiTags('network')
@ApiBearerAuth()
@Controller('network')
@RequirePermissions('network.read')
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Get('devices')
  devices(@CurrentUser() actor: AuthPrincipal) {
    return this.network.devices(actor.organizationId);
  }

  @Get('devices/:id')
  device(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.device(id, actor);
  }

  @Post('devices')
  @RequirePermissions('network.manage')
  createDevice(
    @Body() dto: CreateNetworkDeviceDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.createDevice(dto, actor);
  }

  @Patch('devices/:id/status')
  @RequirePermissions('network.manage')
  updateDeviceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceStatusDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.updateDeviceStatus(id, dto, actor);
  }

  @Get('topology')
  topology(@CurrentUser() actor: AuthPrincipal) {
    return this.network.topology(actor.organizationId);
  }

  @Post('connections')
  @RequirePermissions('network.manage')
  createConnection(
    @Body() dto: CreateConnectionDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.createConnection(dto, actor);
  }

  @Get('subnets')
  subnets(@CurrentUser() actor: AuthPrincipal) {
    return this.network.subnets(actor.organizationId);
  }

  @Post('subnets')
  @RequirePermissions('network.manage')
  createSubnet(
    @Body() dto: CreateSubnetDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.createSubnet(dto, actor);
  }

  @Get('ip-addresses')
  ipAddresses(@CurrentUser() actor: AuthPrincipal) {
    return this.network.ipAddresses(actor.organizationId);
  }

  @Post('ip-addresses')
  @RequirePermissions('network.manage')
  createIpAddress(
    @Body() dto: CreateIpAddressDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.createIpAddress(dto, actor);
  }

  @Get('vlans')
  vlans(@CurrentUser() actor: AuthPrincipal) {
    return this.network.vlans(actor.organizationId);
  }

  @Post('vlans')
  @RequirePermissions('network.manage')
  createVlan(@Body() dto: CreateVlanDto, @CurrentUser() actor: AuthPrincipal) {
    return this.network.createVlan(dto, actor);
  }

  @Post('vlans/:id/links')
  @RequirePermissions('network.manage')
  linkVlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkNetworkRecordDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.linkVlan(id, dto, actor);
  }

  @Post('devices/:id/configurations')
  @RequirePermissions('network.manage')
  createConfiguration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateConfigurationDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.createConfiguration(id, dto, actor);
  }

  @Get('incidents')
  incidents(@CurrentUser() actor: AuthPrincipal) {
    return this.network.networkIncidents(actor.organizationId);
  }

  @Post('incidents')
  @RequirePermissions('network.incident.manage')
  createIncident(
    @Body() dto: CreateNetworkIncidentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.createNetworkIncident(dto, actor);
  }

  @Patch('incidents/:id')
  @RequirePermissions('network.incident.manage')
  updateIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNetworkIncidentDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.updateNetworkIncident(id, dto, actor);
  }

  @Get('maintenance')
  maintenance(@CurrentUser() actor: AuthPrincipal) {
    return this.network.networkMaintenance(actor.organizationId);
  }

  @Post('maintenance')
  @RequirePermissions('network.maintenance.manage')
  createMaintenance(
    @Body() dto: CreateNetworkMaintenanceDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.createNetworkMaintenance(dto, actor);
  }

  @Patch('maintenance/:id')
  @RequirePermissions('network.maintenance.manage')
  updateMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNetworkMaintenanceDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.network.updateNetworkMaintenance(id, dto, actor);
  }
}
