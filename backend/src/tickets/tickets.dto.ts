import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CommentVisibility, TicketPriority, TicketStatus } from '../generated/prisma/client.js';

export class CreateTicketDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(20_000)
  description!: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  resolutionNote?: string;
}

export class TicketCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  body!: string;

  @IsOptional()
  @IsEnum(CommentVisibility)
  visibility?: CommentVisibility;
}

export class AssignTicketDto {
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
