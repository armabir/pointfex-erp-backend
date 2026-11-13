import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { EmployeesService } from './employees.service'
import { UpdateEmployeeDto } from './dto/update-employee.dto'
import { CreateEmployeeDto } from './dto/create-employee.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { CurrentUser } from '../common/current-user.decorator'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission, RequirePermissions } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'

@Controller('employees')
@UseGuards(PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @RequireAnyPermission('employees:create', 'users:assign_role')
  @RequiresFreshMfa('users:assign_role')
  create(@Body() createEmployeeDto: CreateEmployeeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.employeesService.create(createEmployeeDto, actor)
  }

  @Get()
  @RequireAnyPermission('employees:read_directory', 'employees:read_basic', 'employees:read_all')
  findAll(
    @Query('role') roleCategory?: string,
    @Query('teamId') teamId?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.employeesService.findAll(roleCategory, teamId, actor)
  }

  @Get(':id')
  @RequirePermissions('employees:read_directory')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id)
  }

  @Post(':id/sensitive-profile/unlock')
  @RequirePermissions('employees:read_sensitive')
  @RequiresFreshMfa('employees:read_sensitive')
  unlockSensitiveProfile(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.unlockSensitiveProfile(id, actor.id)
  }

  @Get(':id/sensitive-profile')
  @RequirePermissions('employees:read_sensitive')
  getSensitiveProfile(
    @Param('id') id: string,
    @Headers('x-profile-view-token') viewToken: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.employeesService.getSensitiveProfile(id, actor, viewToken || '', request)
  }

  @Get(':id/change-history')
  @RequireAnyPermission('employees:read_directory', 'employees:read_sensitive', 'roles:read')
  getChangeHistory(@Param('id') id: string) {
    return this.employeesService.getChangeHistory(id)
  }

  @Post(':id/promotions/approve')
  @RequirePermissions('promotions:approve')
  @RequiresFreshMfa('promotions:approve')
  promoteEmployee(
    @Param('id') id: string,
    @Body() body: { newTitle: string; reason: string; effectiveDate?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.promoteEmployee(id, body, actor)
  }

  @Post(':id/resend-invite')
  @RequireAnyPermission('employees:create', 'users:reset_password')
  @RequiresFreshMfa('users:reset_password')
  resendInvite(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.resendInvite(id, actor, body?.reason)
  }

  @Patch(':id')
  @RequireAnyPermission('employees:update_own_profile', 'employees:update_any')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto & { reason?: string },
    @Headers() headers: Record<string, string>,
    @Req() request: Request,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.employeesService.update(id, updateEmployeeDto, actor, headers, request)
  }

  @Patch(':id/identity')
  @RequirePermissions('users:edit_identity')
  @RequiresFreshMfa('users:edit_identity')
  updateIdentity(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string
      email?: string
      addToAllowlist?: boolean
      reason: string
    },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.employeesService.updateUserIdentity(id, body, actor)
  }
}
