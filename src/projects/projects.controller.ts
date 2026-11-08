import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateMilestoneDto,
  UpdateMilestoneStatusDto,
  AssignProjectTeamDto,
} from './dto/project.dto'
import { DemoIdentityGuard } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'

@Controller('projects')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
  ) {
    return this.projectsService.findAll(teamId, status)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id)
  }

  @Post()
  @Roles('cto', 'ceo')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto)
  }

  @Patch(':id')
  @Roles('cto', 'pm', 'ceo')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto)
  }

  @Post(':id/milestones')
  @Roles('cto', 'pm', 'ceo')
  addMilestone(@Param('id') id: string, @Body() dto: CreateMilestoneDto) {
    return this.projectsService.addMilestone(id, dto)
  }

  @Patch(':id/milestones/:milestoneId')
  @Roles('cto', 'pm', 'ceo')
  updateMilestoneStatus(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneStatusDto,
  ) {
    return this.projectsService.updateMilestoneStatus(id, milestoneId, dto)
  }

  @Post(':id/assign-team')
  @Roles('cto', 'ceo')
  assignTeam(@Param('id') id: string, @Body() dto: AssignProjectTeamDto) {
    return this.projectsService.assignTeam(id, dto)
  }
}

