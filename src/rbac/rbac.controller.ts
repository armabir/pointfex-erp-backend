import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common'
import { RbacService } from './rbac.service'
import { EmployeeAccessService } from './employee-access.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions, RequireAnyPermission } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import {
  CreateRoleDto,
  UpdateRoleDto,
  DeleteRoleDto,
  SetRolePermissionsDto,
  AttachRolePermissionDto,
  AssignEmployeeRoleDto,
  GrantDirectPermissionDto,
} from './dto/rbac.dto'

@Controller('rbac')
@UseGuards(PermissionsGuard)
export class RbacController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly employeeAccessService: EmployeeAccessService,
  ) {}

  @Get('me/permissions')
  getMyPermissions(@CurrentUser() actor: AuthenticatedUser) {
    return this.rbacService.getEmployeeAccessProfile(actor.id)
  }

  @Get('delegatable-permissions')
  @RequirePermissions('permissions:delegate')
  getDelegatablePermissions(@CurrentUser() actor: AuthenticatedUser) {
    return this.rbacService.getDelegatablePermissions(actor.id)
  }

  @Get('permissions')
  @RequirePermissions('permissions:read')
  listPermissions() {
    return this.rbacService.listPermissions()
  }

  @Get('roles')
  @RequirePermissions('roles:read')
  listRoles() {
    return this.rbacService.listRoles()
  }

  @Get('roles/:id')
  @RequirePermissions('roles:read')
  getRole(@Param('id') id: string) {
    return this.rbacService.getRole(id)
  }

  @Post('roles')
  @RequirePermissions('roles:create')
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rbacService.createRole(dto, actor)
  }

  @Patch('roles/:id')
  @RequirePermissions('roles:update')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.updateRole(id, dto, actor)
  }

  @Delete('roles/:id')
  @RequirePermissions('roles:delete')
  deleteRole(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto?: DeleteRoleDto,
    @Headers() headers?: Record<string, string>,
  ) {
    return this.rbacService.deleteRole(id, actor, dto, headers)
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('roles:update')
  replaceRolePermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.replaceRolePermissions(id, dto, actor)
  }

  @Post('roles/:id/permissions')
  @RequirePermissions('roles:update')
  attachPermission(
    @Param('id') id: string,
    @Body() dto: AttachRolePermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.attachPermission(id, dto, actor)
  }

  @Delete('roles/:id/permissions/:permissionId')
  @RequirePermissions('roles:update')
  detachPermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.detachPermission(id, permissionId, actor)
  }

  @Get('users/:employeeId/permissions')
  @RequireAnyPermission('users:assign_role', 'permissions:delegate')
  getEmployeePermissions(@Param('employeeId') employeeId: string) {
    return this.rbacService.getEmployeeAccessProfile(employeeId)
  }

  @Post('users/:employeeId/direct-permissions')
  @RequirePermissions('permissions:delegate')
  grantDirectPermission(
    @Param('employeeId') employeeId: string,
    @Body() dto: GrantDirectPermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.grantDirectPermission(employeeId, dto, actor)
  }

  @Delete('users/:employeeId/direct-permissions/:permissionId')
  @RequireAnyPermission('permissions:delegate', 'users:assign_role')
  revokeDirectPermission(
    @Param('employeeId') employeeId: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.revokeDirectPermission(employeeId, permissionId, actor)
  }

  @Post('users/:employeeId/roles')
  @RequirePermissions('users:assign_role')
  assignRole(
    @Param('employeeId') employeeId: string,
    @Body() dto: AssignEmployeeRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.assignRoleToEmployee(employeeId, dto, actor)
  }

  @Delete('users/:employeeId/roles/:roleId')
  @RequirePermissions('users:assign_role')
  revokeRole(
    @Param('employeeId') employeeId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.revokeRoleFromEmployee(employeeId, roleId, actor)
  }
}
