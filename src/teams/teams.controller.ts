import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { TeamsService } from './teams.service'
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'

@Controller('teams')
@UseGuards(PermissionsGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  findAll() {
    return this.teamsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id)
  }

  @Post()
  @RequirePermissions('teams:create')
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('teams:update')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto)
  }

  @Post(':id/members')
  @RequirePermissions('teams:manage_members')
  addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teamsService.addMember(id, dto)
  }

  @Delete(':id/members/:employeeId')
  @RequirePermissions('teams:manage_members')
  removeMember(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.teamsService.removeMember(id, employeeId)
  }
}
