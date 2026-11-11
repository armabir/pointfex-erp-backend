import { Controller, Get, Patch, Param } from '@nestjs/common'
import { CommunicationsService } from './communications.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { CurrentUser } from '../common/current-user.decorator'

@Controller()
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get('announcements')
  getAnnouncements() {
    return this.communicationsService.getAnnouncements()
  }

  @Get('notifications')
  getNotifications(@CurrentUser() actor: AuthenticatedUser) {
    return this.communicationsService.getNotifications(actor.id)
  }

  @Patch('notifications/read-all')
  markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.communicationsService.markAllNotificationsRead(actor.id)
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.communicationsService.markNotificationRead(id, actor.id)
  }
}
