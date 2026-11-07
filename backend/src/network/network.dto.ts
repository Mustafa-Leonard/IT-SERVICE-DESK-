import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DeviceStatus,
  DeviceType,
  IncidentSeverity,
  IpAssignmentType,
} from '../generated/prisma/client.js';

export class CreateNetworkDeviceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEnum(DeviceType)
  type!: DeviceType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @IsOptional()
  @IsIP()
  managementIp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(17)
  macAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firmwareVersion?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  administratorId?: string;
}

export class UpdateDeviceStatusDto {
  @IsEnum(DeviceStatus)
  status!: DeviceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  note?: string;
}

export class CreateSubnetDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  cidr!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIP()
  gateway?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsIP(undefined, { each: true })
  dnsServers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class CreateIpAddressDto {
  @IsIP()
  address!: string;

  @IsEnum(IpAssignmentType)
  assignmentType!: IpAssignmentType;

  @IsOptional()
  @IsUUID()
  subnetId?: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class CreateVlanDto {
  @IsInt()
  @Min(1)
  @Max(4094)
  vlanId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}

export class LinkNetworkRecordDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsOptional()
  @IsUUID()
  subnetId?: string;
}

export class CreateConnectionDto {
  @IsUUID()
  deviceAId!: string;

  @IsUUID()
  deviceBId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreateConfigurationDto {
  @IsOptional()
  @IsUUID()
  backupAttachmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  version?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2_000)
  changeDescription!: string;
}

export class CreateNetworkIncidentDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5_000)
  description!: string;

  @IsEnum(IncidentSeverity)
  severity!: IncidentSeverity;
}

export class UpdateNetworkIncidentDto {
  @IsIn(['OPEN', 'INVESTIGATING', 'RESOLVED'])
  status!: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  resolutionNote?: string;
}

export class CreateNetworkMaintenanceDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateNetworkMaintenanceDto {
  @IsIn(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status!: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
