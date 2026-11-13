import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission, RequiresPermission } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { SecurityControlsService } from './security-controls.service'

@Controller('rbac')
@UseGuards(PermissionsGuard)
export class SecurityControlsController {
  constructor(private readonly securityControls: SecurityControlsService) {}

  // --- Access History (CEO & Executives Only) ---
  @Get('access-history')
  @RequiresPermission('access_history:read')
  listAccessHistory(@CurrentUser() actor: AuthenticatedUser) {
    return this.securityControls.listAccessHistory(actor)
  }

  // --- Sessions ---
  @Get('security-sessions/mine')
  @RequireAnyPermission('sessions:read', 'audit_logs:read')
  listMySessions(@CurrentUser() actor: AuthenticatedUser) {
    return this.securityControls.listMySessions(actor.id)
  }

  @Get('security-sessions')
  @RequireAnyPermission('sessions:read', 'audit_logs:read')
  listAllSessions() {
    return this.securityControls.listAllSessions()
  }

  @Post('security-sessions/:id/revoke')
  @RequireAnyPermission('sessions:revoke', 'governance:approve_request')
  @RequiresFreshMfa('sessions:revoke')
  revokeSession(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.securityControls.revokeSession(id, actor)
  }

  // --- Executive MFA ---
  @Post('security/mfa/enroll')
  @RequireAnyPermission('mfa:manage', 'mfa:enforce')
  enrollMfa(@CurrentUser() actor: AuthenticatedUser) {
    return this.securityControls.enrollMfa(actor)
  }

  @Post('security/mfa/verify')
  @RequireAnyPermission('mfa:manage', 'mfa:enforce')
  verifyMfa(@CurrentUser() actor: AuthenticatedUser, @Body() body: { code: string }) {
    return this.securityControls.verifyMfa(actor, body.code)
  }

  // --- Access Reviews ---
  @Get('access-reviews')
  @RequireAnyPermission('access_reviews:read', 'governance:read', 'audit_logs:read')
  listAccessReviews() {
    return this.securityControls.listAccessReviews()
  }

  @Post('access-reviews')
  @RequireAnyPermission('access_reviews:create', 'governance:approve_request')
  @RequiresFreshMfa('governance:approve_request')
  createAccessReview(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { title: string; targetEmployeeId: string; dueAt?: string; notes?: string },
  ) {
    return this.securityControls.createAccessReview(actor, body)
  }

  @Post('access-reviews/:id/decide')
  @RequireAnyPermission('access_reviews:certify', 'governance:approve_request')
  @RequiresFreshMfa('governance:approve_request')
  decideAccessReview(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { status: 'CERTIFIED' | 'REVOKED_EXCESS'; notes?: string },
  ) {
    return this.securityControls.decideAccessReview(id, actor, body.status, body.notes)
  }

  // --- Append-only XP Ledger ---
  @Get('xp-ledger/mine')
  @RequireAnyPermission('xp:read_own', 'xp:read_all', 'xp:read_ledger')
  getMyXp(@CurrentUser() actor: AuthenticatedUser) {
    return this.securityControls.getEmployeeXpSummary(actor.id, actor)
  }

  @Get('xp-ledger/:employeeId')
  @RequireAnyPermission('xp:read_own', 'xp:read_team', 'xp:read_all', 'xp:read_ledger')
  getEmployeeXp(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.securityControls.getEmployeeXpSummary(employeeId, actor)
  }

  @Post('xp-ledger/award')
  @RequireAnyPermission('xp:award', 'xp:adjust')
  awardXp(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { employeeId: string; delta: number; reason: string; entryType?: 'AWARD' | 'ADJUSTMENT' },
  ) {
    return this.securityControls.awardOrAdjustXp(actor, body)
  }

  @Post('xp-ledger/:entryId/reverse')
  @RequiresPermission('xp:adjust')
  reverseXp(
    @Param('entryId') entryId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: { reason: string },
  ) {
    return this.securityControls.reverseXpEntry(entryId, actor, body.reason)
  }
}

