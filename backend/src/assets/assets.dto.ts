import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AssetCondition, AssetStatus } from '../generated/prisma/client.js';

export class CreateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  assetTag?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, string | number | boolean | null>;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999_999_999)
  purchaseCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplier?: string;

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;
}

export class CreateAssetCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class AssetStateDto {
  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  note?: string;
}

export class AssetAssignmentDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssetTransferDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssetMaintenanceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2_000)
  description!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999_999_999)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vendor?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

export class AssetDisposalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  method!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}
