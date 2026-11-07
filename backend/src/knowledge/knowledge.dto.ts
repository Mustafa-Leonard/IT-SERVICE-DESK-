import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  summary?: string;

  @IsString()
  @MinLength(20)
  @MaxLength(50_000)
  body!: string;
}

export class CreateArticleRevisionDto {
  @IsString()
  @MinLength(20)
  @MaxLength(50_000)
  body!: string;
}

export class PublishArticleDto {
  @IsBoolean()
  published!: boolean;
}
