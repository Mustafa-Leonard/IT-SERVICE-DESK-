import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { AttachmentsService } from './attachments.service.js';
import type { UploadedAttachmentFile } from './attachments.service.js';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('tickets/:ticketId')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 52_428_800, files: 1 },
    }),
  )
  uploadTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @UploadedFile() file: UploadedAttachmentFile,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.attachments.upload(file, ticketId, actor);
  }

  @Post('network-backup')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 52_428_800, files: 1 },
    }),
  )
  uploadNetworkBackup(
    @UploadedFile() file: UploadedAttachmentFile,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.attachments.upload(file, undefined, actor);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
    @Res() response: Response,
  ) {
    const file = await this.attachments.download(id, actor);
    const safeAsciiName = file.originalName.replace(/[^\x20-\x7e"]/g, '_').replace(/"/g, '');
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    response.send(file.buffer);
  }
}
