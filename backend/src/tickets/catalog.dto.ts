import { IsBoolean, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTicketCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateSlaPolicyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(525_600)
  responseTargetMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(525_600)
  resolutionTargetMinutes!: number;
}
