import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import {
  CreateArticleDto,
  CreateArticleRevisionDto,
  PublishArticleDto,
} from './knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@CurrentUser() actor: AuthPrincipal, @Query('search') search?: string) {
    return this.knowledge.list(actor, search);
  }

  @Get(':id')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.knowledge.get(id, actor);
  }

  @Post()
  @RequirePermissions('knowledge.manage')
  create(@Body() dto: CreateArticleDto, @CurrentUser() actor: AuthPrincipal) {
    return this.knowledge.create(dto, actor);
  }

  @Post(':id/revisions')
  @RequirePermissions('knowledge.manage')
  addRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateArticleRevisionDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.knowledge.addRevision(id, dto, actor);
  }

  @Patch(':id/publish')
  @RequirePermissions('knowledge.manage')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishArticleDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.knowledge.publish(id, dto, actor);
  }
}
