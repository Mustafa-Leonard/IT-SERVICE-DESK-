import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertSettingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  key!: string;

  @IsObject()
  value!: Record<string, unknown>;
}
