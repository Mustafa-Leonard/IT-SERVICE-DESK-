import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IncidentSeverity } from '../generated/prisma/client.js';

export class CreateServiceIncidentDto {
  @IsOptional()
  @IsUUID()
  ticketId?: string;

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

export class CreateProblemDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5_000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  rootCause?: string;
}

export class UpdateProblemDto {
  @IsIn(['OPEN', 'INVESTIGATING', 'KNOWN_ERROR', 'RESOLVED'])
  status!: 'OPEN' | 'INVESTIGATING' | 'KNOWN_ERROR' | 'RESOLVED';

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  rootCause?: string;
}

export class UpdateServiceIncidentDto {
  @IsIn(['OPEN', 'INVESTIGATING', 'RESOLVED'])
  status!: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  rootCause?: string;
}

export class LinkProblemTicketDto {
  @IsUUID()
  ticketId!: string;
}

export class CreateChangeRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  description!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2_000)
  risk!: string;

  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @IsOptional()
  @IsDateString()
  plannedEnd?: string;
}

export class DecideApprovalDto {
  @IsString()
  @MaxLength(2_000)
  decisionNote!: string;
}
