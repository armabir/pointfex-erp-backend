import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateMilestoneDto,
  UpdateMilestoneStatusDto,
  AssignProjectTeamDto,
} from './dto/project.dto'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'

@Controller('projects')
@UseGuards(PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Query('teamId') teamId?: string, @Query('status') status?: string) {
    return this.projectsService.findAll(teamId, status)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id)
  }

  @Post()
  @RequirePermissions('projects:create')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto)
  }

  @Post(':id/milestones')
  @RequirePermissions('milestones:create')
  addMilestone(@Param('id') id: string, @Body() dto: CreateMilestoneDto) {
    return this.projectsService.addMilestone(id, dto)
  }

  @Patch(':id/milestones/:milestoneId')
  @RequirePermissions('milestones:update')
  updateMilestoneStatus(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneStatusDto,
  ) {
    return this.projectsService.updateMilestoneStatus(id, milestoneId, dto)
  }

  @Post(':id/assign-team')
  @RequirePermissions('projects:assign_team')
  assignTeam(@Param('id') id: string, @Body() dto: AssignProjectTeamDto) {
    return this.projectsService.assignTeam(id, dto)
  }
}
