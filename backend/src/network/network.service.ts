import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IncidentSeverity, Prisma, StatusSource } from '../generated/prisma/client.js';
import * as ipaddr from 'ipaddr.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
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

@Injectable()
export class NetworkService {
  constructor(private readonly prisma: PrismaService) {}

  devices(organizationId: string) {
    return this.prisma.networkDevice.findMany({
      where: { organizationId },
      include: {
        location: { select: { id: true, name: true } },
        administrator: { select: { id: true, displayName: true } },
        _count: { select: { ipAddresses: true, connectionsA: true, connectionsB: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDevice(dto: CreateNetworkDeviceDto, actor: AuthPrincipal) {
    await this.assertLocationAndUser(
      actor.organizationId,
      dto.locationId,
      dto.administratorId,
    );
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const device = await transaction.networkDevice.create({
          data: {
            organizationId: actor.organizationId,
            name: dto.name.trim(),
            type: dto.type,
            manufacturer: dto.manufacturer?.trim(),
            model: dto.model?.trim(),
            serialNumber: dto.serialNumber?.trim(),
            managementIp: dto.managementIp,
            macAddress: dto.macAddress?.trim().toLowerCase(),
            firmwareVersion: dto.firmwareVersion?.trim(),
            locationId: dto.locationId,
            administratorId: dto.administratorId,
            statusSource: StatusSource.MANUAL,
          },
        });
        await transaction.deviceStatusHistory.create({
          data: {
            deviceId: device.id,
            actorId: actor.userId,
            status: device.status,
            source: StatusSource.MANUAL,
            note: 'Initial status recorded manually.',
          },
        });
        await this.audit(transaction, actor, 'network.device_registered', device.id);
        return device;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A device with that name already exists.');
      }
      throw error;
    }
  }

  async updateDeviceStatus(
    id: string,
    dto: UpdateDeviceStatusDto,
    actor: AuthPrincipal,
  ) {
    await this.requireDevice(id, actor.organizationId);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.networkDevice.update({
        where: { id },
        data: {
          status: dto.status,
          statusSource: StatusSource.MANUAL,
          statusUpdatedAt: new Date(),
        },
      });
      await transaction.deviceStatusHistory.create({
        data: {
          deviceId: id,
          actorId: actor.userId,
          status: dto.status,
          source: StatusSource.MANUAL,
          note: dto.note?.trim(),
        },
      });
      await this.audit(transaction, actor, 'network.device_status_updated', id, {
        source: StatusSource.MANUAL,
        status: dto.status,
      });
      return updated;
    });
  }

  async device(id: string, actor: AuthPrincipal) {
    const device = await this.prisma.networkDevice.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: {
        location: true,
        administrator: { select: { id: true, displayName: true } },
        statusHistory: {
          include: { actor: { select: { id: true, displayName: true } } },
          orderBy: { observedAt: 'desc' },
          take: 100,
        },
        ipAddresses: { include: { subnet: true } },
        vlanDevices: { include: { vlan: true } },
        configurations: {
          include: { backupAttachment: { select: { id: true, originalName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        incidents: { orderBy: { createdAt: 'desc' } },
        maintenanceRecords: { orderBy: { scheduledAt: 'desc' } },
      },
    });
    if (!device) throw new NotFoundException('Network device not found.');
    return device;
  }

  async topology(organizationId: string) {
    const [devices, connections] = await Promise.all([
      this.prisma.networkDevice.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          statusSource: true,
          statusUpdatedAt: true,
          location: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.networkConnection.findMany({
        where: { organizationId },
        include: {
          deviceA: { select: { id: true, name: true } },
          deviceB: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { devices, connections };
  }

  async createConnection(dto: CreateConnectionDto, actor: AuthPrincipal) {
    if (dto.deviceAId === dto.deviceBId) {
      throw new BadRequestException('A device cannot be connected to itself.');
    }
    const devices = await this.prisma.networkDevice.findMany({
      where: {
        organizationId: actor.organizationId,
        id: { in: [dto.deviceAId, dto.deviceBId] },
      },
      select: { id: true },
    });
    if (devices.length !== 2) throw new BadRequestException('Both devices must belong to this organization.');
    const [deviceAId, deviceBId] = [dto.deviceAId, dto.deviceBId].sort();
    try {
      const connection = await this.prisma.networkConnection.create({
        data: {
          organizationId: actor.organizationId,
          deviceAId,
          deviceBId,
          description: dto.description?.trim(),
        },
      });
      await this.auditStandalone(actor, 'network.topology_connection_created', connection.id);
      return connection;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This device connection already exists.');
      }
      throw error;
    }
  }

  subnets(organizationId: string) {
    return this.prisma.subnet.findMany({
      where: { organizationId },
      include: { location: true, addresses: true, vlanSubnets: { include: { vlan: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSubnet(dto: CreateSubnetDto, actor: AuthPrincipal) {
    const [network, prefix] = this.parseCidr(dto.cidr);
    for (const address of [...(dto.gateway ? [dto.gateway] : []), ...(dto.dnsServers ?? [])]) {
      this.assertAddressInNetwork(address, network, prefix);
    }
    if (dto.locationId) {
      await this.assertLocationAndUser(actor.organizationId, dto.locationId);
    }
    try {
      return await this.prisma.subnet.create({
        data: {
          organizationId: actor.organizationId,
          locationId: dto.locationId,
          cidr: `${network.toString()}/${prefix}`,
          gateway: dto.gateway,
          dnsServers: dto.dnsServers ?? [],
          name: dto.name.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('That subnet is already documented.');
      }
      throw error;
    }
  }

  ipAddresses(organizationId: string) {
    return this.prisma.ipAddress.findMany({
      where: { organizationId },
      include: {
        subnet: { select: { id: true, name: true, cidr: true } },
        device: { select: { id: true, name: true, type: true } },
      },
      orderBy: { address: 'asc' },
    });
  }

  async createIpAddress(dto: CreateIpAddressDto, actor: AuthPrincipal) {
    let subnet: { id: string; cidr: string } | null = null;
    if (dto.subnetId) {
      subnet = await this.prisma.subnet.findFirst({
        where: { id: dto.subnetId, organizationId: actor.organizationId },
        select: { id: true, cidr: true },
      });
      if (!subnet) throw new BadRequestException('Subnet is unavailable.');
      const [network, prefix] = this.parseCidr(subnet.cidr);
      this.assertAddressInNetwork(dto.address, network, prefix);
    }
    if (dto.deviceId) await this.requireDevice(dto.deviceId, actor.organizationId);
    try {
      const address = await this.prisma.ipAddress.create({
        data: {
          organizationId: actor.organizationId,
          address: ipaddr.parse(dto.address).toString(),
          assignmentType: dto.assignmentType,
          subnetId: subnet?.id,
          deviceId: dto.deviceId,
          description: dto.description?.trim(),
        },
      });
      await this.auditStandalone(actor, 'network.ip_address_registered', address.id);
      return address;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('That IP address is already registered.');
      }
      throw error;
    }
  }

  vlans(organizationId: string) {
    return this.prisma.vlan.findMany({
      where: { organizationId },
      include: {
        subnets: { include: { subnet: { select: { id: true, name: true, cidr: true } } } },
        devices: { include: { device: { select: { id: true, name: true, type: true } } } },
      },
      orderBy: { vlanId: 'asc' },
    });
  }

  async createVlan(dto: CreateVlanDto, actor: AuthPrincipal) {
    try {
      const vlan = await this.prisma.vlan.create({
        data: {
          organizationId: actor.organizationId,
          vlanId: dto.vlanId,
          name: dto.name.trim(),
          purpose: dto.purpose?.trim(),
        },
      });
      await this.auditStandalone(actor, 'network.vlan_created', vlan.id);
      return vlan;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('That VLAN ID is already in use.');
      }
      throw error;
    }
  }

  async linkVlan(id: string, dto: LinkNetworkRecordDto, actor: AuthPrincipal) {
    if (Boolean(dto.deviceId) === Boolean(dto.subnetId)) {
      throw new BadRequestException('Specify exactly one device or subnet.');
    }
    const vlan = await this.prisma.vlan.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!vlan) throw new NotFoundException('VLAN not found.');
    if (dto.deviceId) {
      await this.requireDevice(dto.deviceId, actor.organizationId);
        try {
          await this.prisma.vlanDevice.create({
            data: { vlanId: id, deviceId: dto.deviceId },
          });
        } catch (error) {
          if (this.isUniqueViolation(error)) {
            throw new ConflictException('This device is already linked to the VLAN.');
          }
          throw error;
        }
    } else if (dto.subnetId) {
      const subnet = await this.prisma.subnet.findFirst({
        where: { id: dto.subnetId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!subnet) throw new BadRequestException('Subnet is unavailable.');
      try {
        await this.prisma.vlanSubnet.create({
          data: { vlanId: id, subnetId: dto.subnetId },
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException('This subnet is already linked to the VLAN.');
        }
        throw error;
      }
    }
    await this.auditStandalone(actor, 'network.vlan_linked', id);
    return this.prisma.vlan.findUnique({
      where: { id },
      include: { devices: true, subnets: true },
    });
  }

  async createConfiguration(
    deviceId: string,
    dto: CreateConfigurationDto,
    actor: AuthPrincipal,
  ) {
    await this.requireDevice(deviceId, actor.organizationId);
    if (dto.backupAttachmentId) {
      const attachment = await this.prisma.attachment.findFirst({
        where: { id: dto.backupAttachmentId, organizationId: actor.organizationId },
        select: { id: true },
      });
      if (!attachment) throw new BadRequestException('Configuration attachment is unavailable.');
    }
    const configuration = await this.prisma.deviceConfiguration.create({
      data: {
        deviceId,
        authorId: actor.userId,
        backupAttachmentId: dto.backupAttachmentId,
        version: dto.version?.trim(),
        changeDescription: dto.changeDescription.trim(),
      },
    });
    await this.auditStandalone(actor, 'network.configuration_recorded', configuration.id);
    return configuration;
  }

  networkIncidents(organizationId: string) {
    return this.prisma.networkIncident.findMany({
      where: { organizationId },
      include: { device: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createNetworkIncident(dto: CreateNetworkIncidentDto, actor: AuthPrincipal) {
    if (dto.deviceId) await this.requireDevice(dto.deviceId, actor.organizationId);
    const incident = await this.prisma.networkIncident.create({
      data: {
        organizationId: actor.organizationId,
        deviceId: dto.deviceId,
        reporterId: actor.userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        severity: dto.severity ?? IncidentSeverity.MEDIUM,
      },
    });
    await this.auditStandalone(actor, 'network.incident_reported', incident.id);
    return incident;
  }

  async updateNetworkIncident(
    id: string,
    dto: UpdateNetworkIncidentDto,
    actor: AuthPrincipal,
  ) {
    const existing = await this.prisma.networkIncident.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Network incident not found.');
    const allowedTransitions: Record<string, string[]> = {
      OPEN: ['INVESTIGATING', 'RESOLVED'],
      INVESTIGATING: ['OPEN', 'RESOLVED'],
      RESOLVED: ['OPEN'],
    };
    if (
      existing.status !== dto.status &&
      !allowedTransitions[existing.status]?.includes(dto.status)
    ) {
      throw new BadRequestException(
        `Network incident cannot transition from ${existing.status} to ${dto.status}.`,
      );
    }
    const incident = await this.prisma.networkIncident.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedAt: dto.status === 'RESOLVED' ? new Date() : null,
      },
    });
    await this.auditStandalone(actor, 'network.incident_status_updated', id, {
      status: dto.status,
      resolutionNote: dto.resolutionNote?.trim() ?? null,
    });
    return incident;
  }

  networkMaintenance(organizationId: string) {
    return this.prisma.networkMaintenance.findMany({
      where: { organizationId },
      include: { device: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    });
  }

  async createNetworkMaintenance(dto: CreateNetworkMaintenanceDto, actor: AuthPrincipal) {
    if (dto.deviceId) await this.requireDevice(dto.deviceId, actor.organizationId);
    const record = await this.prisma.networkMaintenance.create({
      data: {
        organizationId: actor.organizationId,
        deviceId: dto.deviceId,
        actorId: actor.userId,
        title: dto.title.trim(),
        description: dto.description?.trim(),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });
    await this.auditStandalone(actor, 'network.maintenance_scheduled', record.id);
    return record;
  }

  async updateNetworkMaintenance(
    id: string,
    dto: UpdateNetworkMaintenanceDto,
    actor: AuthPrincipal,
  ) {
    const existing = await this.prisma.networkMaintenance.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Network maintenance record not found.');
    const allowedTransitions: Record<string, string[]> = {
      PLANNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (
      existing.status !== dto.status &&
      !allowedTransitions[existing.status]?.includes(dto.status)
    ) {
      throw new BadRequestException(
        `Network maintenance cannot transition from ${existing.status} to ${dto.status}.`,
      );
    }
    const record = await this.prisma.networkMaintenance.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt:
          dto.status === 'COMPLETED'
            ? dto.completedAt
              ? new Date(dto.completedAt)
              : new Date()
            : null,
      },
    });
    await this.auditStandalone(actor, 'network.maintenance_status_updated', id, {
      status: dto.status,
    });
    return record;
  }

  private async assertLocationAndUser(
    organizationId: string,
    locationId?: string,
    administratorId?: string,
  ) {
    if (locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: locationId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!location) throw new BadRequestException('Location is unavailable.');
    }
    if (administratorId) {
      const user = await this.prisma.user.findFirst({
        where: { id: administratorId, organizationId, isActive: true },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('Administrator is unavailable.');
    }
  }

  private async requireDevice(id: string, organizationId: string) {
    const device = await this.prisma.networkDevice.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!device) throw new BadRequestException('Network device is unavailable.');
    return device;
  }

  private parseCidr(cidr: string): [ipaddr.IPv4 | ipaddr.IPv6, number] {
    try {
      const [network, prefix] = ipaddr.parseCIDR(cidr.trim());
      return [network, prefix];
    } catch {
      throw new BadRequestException('CIDR must be a valid IPv4 or IPv6 network.');
    }
  }

  private assertAddressInNetwork(
    address: string,
    network: ipaddr.IPv4 | ipaddr.IPv6,
    prefix: number,
  ) {
    if (!ipaddr.isValid(address)) {
      throw new BadRequestException('IP address is invalid.');
    }
    const parsed = ipaddr.parse(address);
    if (parsed.kind() !== network.kind() || !parsed.match([network, prefix])) {
      throw new BadRequestException('IP address must belong to the selected subnet.');
    }
  }

  private async audit(
    transaction: Prisma.TransactionClient,
    actor: AuthPrincipal,
    action: string,
    targetId: string,
    metadata?: Prisma.InputJsonObject,
  ) {
    await transaction.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        action,
        targetType: 'NetworkRecord',
        targetId,
        metadata,
      },
    });
  }

  private async auditStandalone(
    actor: AuthPrincipal,
    action: string,
    targetId: string,
    metadata?: Prisma.InputJsonObject,
  ) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        action,
        targetType: 'NetworkRecord',
        targetId,
        metadata,
      },
    });
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
