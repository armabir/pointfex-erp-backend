import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ReportsService } from './reports.service'
import {
  CreateReportDto,
  UpdateReportStatusDto,
  ForwardReportDto,
  AdjudicateConfidentialGrievanceDto,
} from './dto/report.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission, RequirePermissions } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('reports')
@UseGuards(PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @RequireAnyPermission('reports:read_standard', 'reports:triage', 'grievances:read_confidential')
  findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('teamId') teamId?: string,
    @Query('isConfidential') isConfidential?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    const isConfBool = isConfidential !== undefined ? isConfidential === 'true' : undefined
    return this.reportsService.findAll(
      { type, status, projectId, teamId, isConfidential: isConfBool },
      actor,
    )
  }

  @Get(':id')
  @RequireAnyPermission('reports:read_standard', 'reports:triage', 'grievances:read_confidential')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.reportsService.findOne(id, actor)
  }

  @Post()
  @RequireAnyPermission('reports:create', 'grievances:submit_confidential')
  create(@Body() dto: CreateReportDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.reportsService.create(dto, actor)
  }

  @Patch(':id/status')
  @RequirePermissions('reports:triage')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reportsService.updateStatus(id, dto, actor)
  }

  @Post(':id/forward')
  @RequirePermissions('reports:forward')
  forwardToCLevel(
    @Param('id') id: string,
    @Body() dto: ForwardReportDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reportsService.forwardToCLevel(id, dto, actor)
  }

  @Patch(':id/confidential')
  @RequirePermissions('grievances:adjudicate_confidential')
  @RequiresFreshMfa('grievances:adjudicate_confidential')
  adjudicateConfidential(
    @Param('id') id: string,
    @Body() dto: AdjudicateConfidentialGrievanceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reportsService.adjudicateConfidential(id, dto, actor)
  }
}
