import { Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import type { AuthPrincipal } from '../auth/auth.types.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@RequirePermissions('notification.read.own')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.notifications.list(actor);
  }

  @Patch(':id/read')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.notifications.markRead(id, actor);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() actor: AuthPrincipal) {
    return this.notifications.markAllRead(actor);
  }
}
