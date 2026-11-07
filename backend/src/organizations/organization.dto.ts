import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DepartmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class LocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(24)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
