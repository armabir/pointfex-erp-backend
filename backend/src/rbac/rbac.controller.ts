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
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'
import { RbacService } from './rbac.service'
import { EmployeeAccessService } from './employee-access.service'
import { CeoBootstrapService } from './ceo-bootstrap.service'
import { AuthorizationService } from './authorization.service'
import { PrismaService } from '../common/prisma.service'
import { getEmployeeEffectiveTier, RoleTier } from '../common/tier.util'
import { AuthorizationScope } from '@prisma/client'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions, RequireAnyPermission } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import {
  CreateRoleDto,
  CloneRoleDto,
  CreateRoleFromTemplateDto,
  ToggleRoleActiveDto,
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
    private readonly ceoBootstrapService: CeoBootstrapService,
    private readonly authzService: AuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me/effective')
  async getMyEffectiveAuthz(@CurrentUser() actor: AuthenticatedUser) {
    const snapshot = await this.authzService.resolveEffectiveAuthz(actor.id)
    return {
      ...snapshot,
      authzMode: this.authzService.getAuthzMode(),
    }
  }

  @Get('me/permissions')
  getMyPermissions(@CurrentUser() actor: AuthenticatedUser) {
    return this.rbacService.getEmployeeAccessProfile(actor.id)
  }

  @Get('delegatable-permissions')
  @RequireAnyPermission('delegations:create', 'permissions:delegate')
  getDelegatablePermissions(@CurrentUser() actor: AuthenticatedUser) {
    return this.rbacService.getDelegatablePermissions(actor.id)
  }

  @Get('permissions')
  @RequirePermissions('permissions:read')
  listPermissions(@Query('includeDeprecated') includeDeprecated?: string) {
    return this.rbacService.listPermissions({
      includeDeprecated: includeDeprecated === 'true',
      includeRoot: false,
    })
  }

  @Get('role-templates')
  @RequireAnyPermission('roles:read', 'roles:manage_templates')
  listRoleTemplates() {
    return this.rbacService.listRoleTemplates()
  }

  @Post('roles/from-template/:code')
  @RequirePermissions('roles:create')
  @RequiresFreshMfa('roles:create')
  createRoleFromTemplate(
    @Param('code') code: string,
    @Body() dto: CreateRoleFromTemplateDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.createRoleFromTemplate(code, dto, actor)
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

  @Get('roles/:id/versions')
  @RequireAnyPermission('roles:read_versions', 'roles:read')
  getRoleVersions(@Param('id') id: string) {
    return this.rbacService.getRoleVersions(id)
  }

  @Post('roles')
  @RequirePermissions('roles:create')
  @RequiresFreshMfa('roles:create')
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rbacService.createRole(dto, actor)
  }

  @Post('roles/:id/clone')
  @RequireAnyPermission('roles:clone', 'roles:create')
  @RequiresFreshMfa('roles:update')
  cloneRole(
    @Param('id') id: string,
    @Body() dto: CloneRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.cloneRole(id, dto, actor)
  }

  @Patch('roles/:id/activate')
  @RequireAnyPermission('roles:activate', 'roles:update')
  @RequiresFreshMfa('roles:update')
  activateRole(
    @Param('id') id: string,
    @Body() dto: ToggleRoleActiveDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.setRoleActiveState(id, true, actor, dto?.reason)
  }

  @Patch('roles/:id/deactivate')
  @RequireAnyPermission('roles:activate', 'roles:update')
  @RequiresFreshMfa('roles:update')
  deactivateRole(
    @Param('id') id: string,
    @Body() dto: ToggleRoleActiveDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.setRoleActiveState(id, false, actor, dto?.reason)
  }

  @Patch('roles/:id/tier')
  @RequireAnyPermission('roles:update', 'system:root')
  @RequiresFreshMfa('roles:update')
  setRoleTier(
    @Param('id') id: string,
    @Body() body: { tier: string; changeReason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.setRoleTier(id, body.tier, actor, body.changeReason)
  }

  @Get('users/:employeeId/role-assignments')
  @RequireAnyPermission('roles:read_assignments', 'users:assign_role')
  listUserRoleAssignments(@Param('employeeId') employeeId: string) {
    return this.employeeAccessService.listScopedRoleAssignments(employeeId)
  }

  @Post('system-root/verify')
  @RequirePermissions('system:root')
  @RequiresFreshMfa('system:root')
  verifySystemRootInvariant() {
    return this.ceoBootstrapService.ensureSingleRootCeo()
  }

  @Patch('roles/:id')
  @RequirePermissions('roles:update')
  @RequiresFreshMfa('roles:update')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.updateRole(id, dto, actor)
  }

  @Delete('roles/:id')
  @RequirePermissions('roles:delete')
  @RequiresFreshMfa('roles:delete')
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
  @RequiresFreshMfa('roles:update')
  replaceRolePermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.replaceRolePermissions(id, dto, actor)
  }

  @Post('roles/:id/permissions')
  @RequirePermissions('roles:update')
  @RequiresFreshMfa('roles:update')
  attachPermission(
    @Param('id') id: string,
    @Body() dto: AttachRolePermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rbacService.attachPermission(id, dto, actor)
  }

  @Delete('roles/:id/permissions/:permissionId')
  @RequirePermissions('roles:update')
  @RequiresFreshMfa('roles:update')
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
  @RequiresFreshMfa('permissions:grant_direct')
  grantDirectPermission(
    @Param('employeeId') employeeId: string,
    @Body() dto: GrantDirectPermissionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.grantDirectPermission(employeeId, dto, actor)
  }

  @Delete('users/:employeeId/direct-permissions/:permissionId')
  @RequireAnyPermission('permissions:delegate', 'users:assign_role')
  @RequiresFreshMfa('permissions:grant_direct')
  revokeDirectPermission(
    @Param('employeeId') employeeId: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.revokeDirectPermission(employeeId, permissionId, actor)
  }

  @Post('users/:employeeId/roles')
  @RequirePermissions('users:assign_role')
  @RequiresFreshMfa('users:assign_role')
  assignRole(
    @Param('employeeId') employeeId: string,
    @Body() dto: AssignEmployeeRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.assignRoleToEmployee(employeeId, dto, actor)
  }

  @Delete('users/:employeeId/roles/:roleId')
  @RequirePermissions('users:assign_role')
  @RequiresFreshMfa('users:assign_role')
  revokeRole(
    @Param('employeeId') employeeId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeeAccessService.revokeRoleFromEmployee(employeeId, roleId, actor)
  }

  @Get('users/:employeeId/effective')
  @RequireAnyPermission('permissions:read', 'users:assign_role', 'audit_logs:read')
  async getEffectiveForUser(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (actor.id === employeeId) {
      return this.authzService.resolveEffectiveAuthz(employeeId)
    }

    const isCeo = actor.roles?.includes('system:root') || (actor.role || '').toLowerCase() === 'ceo'
    if (isCeo) {
      return this.authzService.resolveEffectiveAuthz(employeeId)
    }

    const actorTier = await getEmployeeEffectiveTier(this.prisma, actor.id)
    const targetTier = await getEmployeeEffectiveTier(this.prisma, employeeId)

    if (actorTier === RoleTier.EXECUTIVE) {
      if (targetTier === RoleTier.EXECUTIVE || targetTier === RoleTier.CEO) {
        throw new ForbiddenException(
          'Executives cannot view access details for Executive or CEO accounts.',
        )
      }
      return this.authzService.resolveEffectiveAuthz(employeeId)
    }

    if (actorTier === RoleTier.MANAGER) {
      if (targetTier !== RoleTier.STAFF) {
        throw new ForbiddenException(
          'Managers can only view access details for developers in their squads.',
        )
      }
      const sharedTeam = await this.prisma.teamMembership.findFirst({
        where: {
          employeeId,
          isActive: true,
          team: {
            OR: [
              { memberships: { some: { employeeId: actor.id, isActive: true } } },
              { pmPosition: { assignments: { some: { employeeId: actor.id, isActive: true } } } },
            ],
          },
        },
      })
      if (!sharedTeam) {
        throw new ForbiddenException(
          'Managers can only view access details for developers in their assigned squads.',
        )
      }
      return this.authzService.resolveEffectiveAuthz(employeeId)
    }

    throw new ForbiddenException('Developers can only view their own access details.')
  }

  @Post('users/:employeeId/denials')
  @RequirePermissions('permissions:deny_direct')
  @RequiresFreshMfa('permissions:deny_direct')
  grantDenial(
    @Param('employeeId') employeeId: string,
    @Body()
    body: {
      permissionCode: string
      scope?: AuthorizationScope
      scopeIds?: string[]
      reason?: string
      expiresAt?: string
    },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.authzService.grantDenial({
      employeeId,
      permissionCode: body.permissionCode,
      scope: body.scope,
      scopeIds: body.scopeIds,
      reason: body.reason,
      deniedById: actor.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    })
  }

  @Delete('denials/:denialId')
  @RequirePermissions('permissions:deny_direct')
  @RequiresFreshMfa('permissions:deny_direct')
  revokeDenial(@Param('denialId') denialId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.authzService.revokeDenial(denialId, actor.id)
  }
}
