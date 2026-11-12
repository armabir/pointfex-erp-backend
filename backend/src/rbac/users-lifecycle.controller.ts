import { Controller, Get, Post, Param, Body, Headers, UseGuards } from '@nestjs/common'
import { EmployeeLifecycleService } from './employee-lifecycle.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission, RequirePermissions } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import { LifecycleActionDto } from './dto/rbac.dto'

@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersLifecycleController {
  constructor(private readonly lifecycleService: EmployeeLifecycleService) {}

  @Post(':employeeId/suspend')
  @RequireAnyPermission('users:suspend', 'employees:suspend')
  @RequiresFreshMfa('users:suspend')
  suspendEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @Headers() headers: Record<string, string>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.suspendEmployee(employeeId, actor, dto, headers)
  }

  @Post(':employeeId/unsuspend')
  @RequireAnyPermission('users:reactivate', 'employees:suspend')
  @RequiresFreshMfa('users:reactivate')
  unsuspendEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.unsuspendEmployee(employeeId, actor, dto?.reason)
  }

  @Post(':employeeId/demote')
  @RequireAnyPermission('users:demote', 'employees:suspend')
  @RequiresFreshMfa('users:demote')
  demoteEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @Headers() headers: Record<string, string>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.demoteEmployee(employeeId, actor, dto, headers)
  }

  @Post(':employeeId/reset-password')
  @RequirePermissions('users:reset_password')
  @RequiresFreshMfa('users:reset_password')
  adminResetPassword(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.adminResetPassword(employeeId, actor, dto?.reason)
  }

  @Get('security/mfa-overview')
  @RequireAnyPermission('mfa:manage', 'governance:read', 'audit_logs:read')
  getMfaOverview() {
    return this.lifecycleService.getMfaSecurityOverview()
  }

  @Post(':employeeId/mfa/reset')
  @RequirePermissions('mfa:manage')
  @RequiresFreshMfa('mfa:manage')
  adminResetMfa(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.adminResetMfa(employeeId, actor, dto?.reason)
  }

  @Post(':employeeId/sessions/revoke')
  @RequireAnyPermission('sessions:revoke', 'mfa:manage')
  @RequiresFreshMfa('mfa:manage')
  revokeEmployeeSessions(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.revokeAllSessionsForEmployee(employeeId, actor, dto?.reason)
  }
}
