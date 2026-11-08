import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { TeamsService } from './teams.service'
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto'
import { DemoIdentityGuard } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'

@Controller('teams')
@UseGuards(DemoIdentityGuard, RolesGuard)
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
  @Roles('cto', 'ceo')
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto)
  }

  @Patch(':id')
  @Roles('cto', 'ceo')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto)
  }

  @Post(':id/members')
  @Roles('cto', 'ceo')
  addMember(@Param('id') id: string, @Body() dto: AddTeamMemberDto) {
    return this.teamsService.addMember(id, dto)
  }

  @Delete(':id/members/:employeeId')
  @Roles('cto', 'ceo')
  removeMember(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.teamsService.removeMember(id, employeeId)
  }
}

