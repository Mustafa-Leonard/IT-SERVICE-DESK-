import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateArticleDto,
  CreateArticleRevisionDto,
  PublishArticleDto,
} from './knowledge.dto.js';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthPrincipal, search?: string) {
    if (
      !actor.permissions.includes('knowledge.read') &&
      !actor.permissions.includes('knowledge.manage')
    ) {
      throw new ForbiddenException('You do not have permission to read knowledge articles.');
    }
    const canManage = actor.permissions.includes('knowledge.manage');
    return this.prisma.knowledgeArticle.findMany({
      where: {
        organizationId: actor.organizationId,
        ...(canManage ? {} : { publishedAt: { not: null } }),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        author: { select: { id: true, displayName: true } },
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, createdAt: true },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });
  }

  async get(id: string, actor: AuthPrincipal) {
    if (
      !actor.permissions.includes('knowledge.read') &&
      !actor.permissions.includes('knowledge.manage')
    ) {
      throw new ForbiddenException('You do not have permission to read knowledge articles.');
    }
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        ...(actor.permissions.includes('knowledge.manage')
          ? {}
          : { publishedAt: { not: null } }),
      },
      include: {
        author: { select: { id: true, displayName: true } },
        revisions: {
          include: { author: { select: { id: true, displayName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!article) throw new NotFoundException('Knowledge article not found.');
    return article;
  }

  async create(dto: CreateArticleDto, actor: AuthPrincipal) {
    const slug = this.slugify(dto.title);
    if (!slug) throw new BadRequestException('Article title must contain letters or numbers.');
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const article = await transaction.knowledgeArticle.create({
          data: {
            organizationId: actor.organizationId,
            authorId: actor.userId,
            title: dto.title.trim(),
            summary: dto.summary?.trim(),
            slug,
            revisions: {
              create: { authorId: actor.userId, body: dto.body.trim() },
            },
          },
          include: { revisions: true },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorId: actor.userId,
            action: 'knowledge.article_created',
            targetType: 'KnowledgeArticle',
            targetId: article.id,
          },
        });
        return article;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An article with a similar title already exists.');
      }
      throw error;
    }
  }

  async addRevision(
    id: string,
    dto: CreateArticleRevisionDto,
    actor: AuthPrincipal,
  ) {
    this.requireManagePermission(actor);
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Knowledge article not found.');
    return this.prisma.$transaction(async (transaction) => {
      const revision = await transaction.knowledgeRevision.create({
        data: { articleId: id, authorId: actor.userId, body: dto.body.trim() },
      });
      await transaction.knowledgeArticle.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: 'knowledge.article_revision_added',
          targetType: 'KnowledgeArticle',
          targetId: id,
        },
      });
      return revision;
    });
  }

  async publish(id: string, dto: PublishArticleDto, actor: AuthPrincipal) {
    this.requireManagePermission(actor);
    const article = await this.prisma.knowledgeArticle.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Knowledge article not found.');
    const revisionCount = await this.prisma.knowledgeRevision.count({
      where: { articleId: id },
    });
    if (dto.published && !revisionCount) {
      throw new BadRequestException('Add article content before publishing.');
    }
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.knowledgeArticle.update({
        where: { id },
        data: { publishedAt: dto.published ? new Date() : null },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.userId,
          action: dto.published
            ? 'knowledge.article_published'
            : 'knowledge.article_unpublished',
          targetType: 'KnowledgeArticle',
          targetId: id,
        },
      });
      return updated;
    });
  }

  private requireManagePermission(actor: AuthPrincipal) {
    if (!actor.permissions.includes('knowledge.manage')) {
      throw new ForbiddenException('You cannot manage knowledge articles.');
    }
  }

  private slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
