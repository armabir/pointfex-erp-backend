import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { EmployeesService } from './employees.service'
import { UpdateEmployeeDto } from './dto/update-employee.dto'
import { DemoIdentityGuard } from '../common/demo-identity.guard'

@Controller('employees')
@UseGuards(DemoIdentityGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(
    @Query('role') roleCategory?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.employeesService.findAll(roleCategory, teamId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeesService.update(id, updateEmployeeDto)
  }
}

