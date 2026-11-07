import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'node:crypto';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { PrismaService } from '../database/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

const allowedTypes = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['text/plain', '.txt'],
  ['text/csv', '.csv'],
]);

export interface UploadedAttachmentFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentsService {
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.maxBytes = config.getOrThrow<number>('MAX_UPLOAD_BYTES');
  }

  async upload(
    file: UploadedAttachmentFile,
    ticketId: string | undefined,
    actor: AuthPrincipal,
  ) {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Choose a file to upload.');
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException(`Attachment exceeds the ${this.maxBytes} byte limit.`);
    }
    const type = this.validateFile(file);
    if (ticketId) {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: ticketId, organizationId: actor.organizationId },
        select: { id: true, requesterId: true, assignedToId: true },
      });
      if (!ticket) throw new NotFoundException('Ticket not found.');
      this.assertTicketAccess(ticket.requesterId, ticket.assignedToId, actor, true);
    } else if (!actor.permissions.includes('network.manage')) {
      throw new ForbiddenException('Network configuration attachments require network access.');
    }

    const id = randomUUID();
    const storageKey = id;
    await this.storage.put(storageKey, type, file.buffer);
    try {
      const attachment = await this.prisma.$transaction(async (transaction) => {
        const record = await transaction.attachment.create({
          data: {
            id,
            organizationId: actor.organizationId,
            uploadedById: actor.userId,
            ticketId,
            originalName: this.sanitizeFilename(file.originalname),
            mediaType: type,
            size: file.size,
            sha256: createHash('sha256').update(file.buffer).digest('hex'),
            storageKey,
          },
        });
        await transaction.auditLog.create({
          data: {
            organizationId: actor.organizationId,
            actorId: actor.userId,
            action: 'attachment.uploaded',
            targetType: 'Attachment',
            targetId: record.id,
            metadata: { mediaType: type, size: file.size, ticketId: ticketId ?? null },
          },
        });
        return record;
      });
      return {
        id: attachment.id,
        originalName: attachment.originalName,
        mediaType: attachment.mediaType,
        size: attachment.size,
        createdAt: attachment.createdAt,
      };
    } catch (error) {
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  async download(id: string, actor: AuthPrincipal) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: {
        id: true,
        ticketId: true,
        originalName: true,
        mediaType: true,
        storageKey: true,
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found.');

    if (attachment.ticketId) {
      const ticket = await this.prisma.ticket.findFirst({
        where: { id: attachment.ticketId, organizationId: actor.organizationId },
        select: { requesterId: true, assignedToId: true },
      });
      if (!ticket) throw new NotFoundException('Attachment not found.');
      this.assertTicketAccess(ticket.requesterId, ticket.assignedToId, actor, false);
    } else {
      const configuration = await this.prisma.deviceConfiguration.findFirst({
        where: {
          backupAttachmentId: id,
          device: { organizationId: actor.organizationId },
        },
        select: { id: true },
      });
      if (
        !configuration ||
        !actor.permissions.includes('network.manage')
      ) {
        throw new NotFoundException('Attachment not found.');
      }
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        action: 'attachment.downloaded',
        targetType: 'Attachment',
        targetId: id,
      },
    });
    return {
      buffer: await this.storage.get(attachment.storageKey),
      originalName: attachment.originalName,
      mediaType: attachment.mediaType,
    };
  }

  private validateFile(file: UploadedAttachmentFile): string {
    const extension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    const expectedType = [...allowedTypes.entries()].find(
      ([, allowedExtension]) =>
        extension === allowedExtension ||
        (extension === '.jpeg' && allowedExtension === '.jpg'),
    );
    if (!expectedType || expectedType[0] !== file.mimetype) {
      throw new BadRequestException('Only PDF, JPEG, PNG, plain text, and CSV files are allowed.');
    }

    const bytes = file.buffer;
    let signatureMatches = false;
    switch (expectedType[0]) {
      case 'application/pdf':
        signatureMatches = bytes.subarray(0, 5).toString('ascii') === '%PDF-';
        break;
      case 'image/png':
        signatureMatches = bytes.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        break;
      case 'image/jpeg':
        signatureMatches = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        break;
      case 'text/plain':
      case 'text/csv':
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          signatureMatches = !Array.from(text).some((character) => {
            const code = character.codePointAt(0);
            return (
              code !== undefined &&
              ((code >= 0 && code <= 8) ||
                code === 11 ||
                code === 12 ||
                (code >= 14 && code <= 31))
            );
          });
        } catch {
          signatureMatches = false;
        }
        break;
    }
    if (!signatureMatches) {
      throw new BadRequestException('The file contents do not match the declared type.');
    }
    return expectedType[0];
  }

  private sanitizeFilename(value: string) {
    return Array.from(value.normalize('NFKC'))
      .map((character) => {
        const code = character.codePointAt(0);
        return character === '/' ||
          character === '\\' ||
          (code !== undefined && code < 32)
          ? '_'
          : character;
      })
      .join('')
      .slice(0, 255);
  }

  private assertTicketAccess(
    requesterId: string,
    assignedToId: string | null,
    actor: AuthPrincipal,
    uploading: boolean,
  ) {
    const canRead =
      actor.permissions.includes('ticket.read.all') ||
      (actor.permissions.includes('ticket.read.own') && requesterId === actor.userId) ||
      (actor.permissions.includes('ticket.read.assigned') &&
        assignedToId === actor.userId);
    const canUpload =
      actor.permissions.includes('ticket.comment.public') ||
      actor.permissions.includes('ticket.comment.internal');
    if (!canRead || (uploading && !canUpload)) {
      throw new ForbiddenException('You cannot access attachments for this ticket.');
    }
  }
}
