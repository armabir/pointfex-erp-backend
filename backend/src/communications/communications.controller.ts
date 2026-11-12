import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common'
import { CommunicationsService } from './communications.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { CurrentUser } from '../common/current-user.decorator'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'

@Controller()
@UseGuards(PermissionsGuard)
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get('announcements')
  @RequirePermissions('announcements:read')
  getAnnouncements() {
    return this.communicationsService.getAnnouncements()
  }

  @Get('notifications')
  @RequirePermissions('notifications:read_own')
  getNotifications(@CurrentUser() actor: AuthenticatedUser) {
    return this.communicationsService.getNotifications(actor.id)
  }

  @Patch('notifications/read-all')
  @RequirePermissions('notifications:read_own')
  markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.communicationsService.markAllNotificationsRead(actor.id)
  }

  @Patch('notifications/:id/read')
  @RequirePermissions('notifications:read_own')
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.communicationsService.markNotificationRead(id, actor.id)
  }
}
