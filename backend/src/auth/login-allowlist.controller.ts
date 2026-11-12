import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission, RequirePermissions } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { LoginAllowlistService } from './login-allowlist.service'

@Controller('auth/allowlist')
@UseGuards(PermissionsGuard)
export class LoginAllowlistController {
  constructor(private readonly allowlistService: LoginAllowlistService) {}

  @Get()
  @RequireAnyPermission('login_allowlist:manage', 'login_allowlist:read')
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.allowlistService.listEntries(actor)
  }

  @Get('ready-emails')
  @RequireAnyPermission('employees:create', 'login_allowlist:manage', 'login_allowlist:read')
  listReadyEmails() {
    return this.allowlistService.listReadyToOnboardEmails()
  }

  @Post()
  @RequirePermissions('login_allowlist:manage')
  @RequiresFreshMfa('login_allowlist:manage')
  add(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { pattern: string; note?: string; reason?: string },
  ) {
    return this.allowlistService.addEntry(actor, body.pattern, body.note, body.reason)
  }

  @Post('import')
  @RequirePermissions('login_allowlist:manage')
  @RequiresFreshMfa('login_allowlist:manage')
  bulkImport(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { entries: string[] | string; note?: string; reason?: string },
  ) {
    return this.allowlistService.bulkImport(actor, body)
  }

  @Patch(':id')
  @RequirePermissions('login_allowlist:manage')
  @RequiresFreshMfa('login_allowlist:manage')
  toggle(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { isActive: boolean; reason?: string },
  ) {
    return this.allowlistService.setActive(actor, id, Boolean(body.isActive), body.reason)
  }

  @Delete(':id')
  @RequirePermissions('login_allowlist:manage')
  @RequiresFreshMfa('login_allowlist:manage')
  remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.allowlistService.removeEntry(actor, id, body?.reason)
  }

  @Get('requests')
  @RequireAnyPermission('employees:create', 'login_allowlist:manage', 'login_allowlist:read')
  listRequests(@CurrentUser() actor: AuthenticatedUser) {
    return this.allowlistService.listEmailRequests(actor)
  }

  @Post('requests')
  @RequirePermissions('employees:create')
  requestEmail(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { email: string; fullName: string; reason: string },
  ) {
    return this.allowlistService.requestEmail(actor, body)
  }

  @Post('requests/:id/approve')
  @RequirePermissions('login_allowlist:manage')
  @RequiresFreshMfa('login_allowlist:manage')
  approveRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.allowlistService.approveEmailRequest(actor, id, body?.reason)
  }

  @Post('requests/:id/reject')
  @RequirePermissions('login_allowlist:manage')
  @RequiresFreshMfa('login_allowlist:manage')
  rejectRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.allowlistService.rejectEmailRequest(actor, id, body?.reason)
  }
}
