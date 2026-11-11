import { Controller, Post, Param, Body, Headers, UseGuards } from '@nestjs/common'
import { EmployeeLifecycleService } from './employee-lifecycle.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import { LifecycleActionDto } from './dto/rbac.dto'

@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersLifecycleController {
  constructor(private readonly lifecycleService: EmployeeLifecycleService) {}

  @Post(':employeeId/suspend')
  @RequirePermissions('employees:suspend')
  suspendEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @Headers() headers: Record<string, string>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.suspendEmployee(employeeId, actor, dto, headers)
  }

  @Post(':employeeId/unsuspend')
  @RequirePermissions('employees:suspend')
  unsuspendEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.unsuspendEmployee(employeeId, actor, dto?.reason)
  }

  @Post(':employeeId/demote')
  @RequirePermissions('employees:suspend')
  demoteEmployee(
    @Param('employeeId') employeeId: string,
    @Body() dto: LifecycleActionDto,
    @Headers() headers: Record<string, string>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.lifecycleService.demoteEmployee(employeeId, actor, dto, headers)
  }
}
