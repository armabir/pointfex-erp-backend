import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { AuthorizationScope } from '@prisma/client'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission, RequiresPermission } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { DelegationService } from './delegation.service'

@Controller('rbac/delegations')
@UseGuards(PermissionsGuard)
export class DelegationsController {
  constructor(private readonly delegationService: DelegationService) {}

  @Get('mine')
  @RequireAnyPermission(
    'delegations:read_own',
    'delegations:read_received',
    'delegations:read_all',
    'delegations:create',
    'permissions:delegate',
  )
  listMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.delegationService.listForUser(actor.id)
  }

  @Get()
  @RequireAnyPermission('delegations:read_all', 'permissions:read', 'audit_logs:read')
  listAll() {
    return this.delegationService.listAll()
  }

  @Post()
  @RequireAnyPermission('delegations:create', 'permissions:delegate')
  @RequiresFreshMfa('delegations:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      delegateeId: string
      permissionCodes: string[]
      scope?: AuthorizationScope
      scopeIds?: string[]
      resourceType?: string
      resourceId?: string
      reason: string
      startsAt?: string
      expiresAt: string
      requireApproval?: boolean
    },
  ) {
    return this.delegationService.createDelegation(actor, body)
  }

  @Post(':id/approve')
  @RequiresPermission('delegations:approve')
  @RequiresFreshMfa('delegations:approve')
  approve(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.delegationService.approveDelegation(id, actor)
  }

  @Post(':id/revoke')
  @RequireAnyPermission(
    'delegations:revoke',
    'delegations:create',
    'permissions:delegate',
    'governance:approve_request',
  )
  @RequiresFreshMfa('delegations:revoke')
  revoke(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body?: { reason?: string },
  ) {
    return this.delegationService.revokeDelegation(id, actor, body?.reason)
  }

  @Post('expire-sweep')
  @RequireAnyPermission('delegations:manage_policy', 'delegations:revoke')
  @RequiresFreshMfa('delegations:revoke')
  expireSweep() {
    return this.delegationService.expireStaleDelegations()
  }
}

