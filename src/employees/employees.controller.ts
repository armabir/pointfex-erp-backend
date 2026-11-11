import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { EmployeesService } from './employees.service'
import { UpdateEmployeeDto } from './dto/update-employee.dto'
import { CreateEmployeeDto } from './dto/create-employee.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { CurrentUser } from '../common/current-user.decorator'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission } from '../common/require-permissions.decorator'

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequireAnyPermission('employees:create', 'users:assign_role')
  create(@Body() createEmployeeDto: CreateEmployeeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.employeesService.create(createEmployeeDto, actor)
  }

  @Get()
  findAll(@Query('role') roleCategory?: string, @Query('teamId') teamId?: string) {
    return this.employeesService.findAll(roleCategory, teamId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.employeesService.update(id, updateEmployeeDto, actor)
  }
}
