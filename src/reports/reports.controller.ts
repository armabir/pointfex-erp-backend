import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ReportsService } from './reports.service'
import {
  CreateReportDto,
  UpdateReportStatusDto,
  ForwardReportDto,
  AdjudicateConfidentialGrievanceDto,
} from './dto/report.dto'
import { DemoIdentityGuard, DemoUser } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('reports')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('teamId') teamId?: string,
    @Query('isConfidential') isConfidential?: string,
    @CurrentUser() actor?: DemoUser,
  ) {
    const isConfBool = isConfidential !== undefined ? isConfidential === 'true' : undefined
    return this.reportsService.findAll({ type, status, projectId, teamId, isConfidential: isConfBool }, actor)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: DemoUser) {
    return this.reportsService.findOne(id, actor)
  }

  @Post()
  create(@Body() dto: CreateReportDto, @CurrentUser() actor: DemoUser) {
    return this.reportsService.create(dto, actor)
  }

  @Patch(':id/status')
  @Roles('pm', 'cto', 'cfo', 'chro', 'ceo')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.reportsService.updateStatus(id, dto, actor)
  }

  @Post(':id/forward')
  @Roles('pm', 'cto', 'ceo')
  forwardToCLevel(
    @Param('id') id: string,
    @Body() dto: ForwardReportDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.reportsService.forwardToCLevel(id, dto, actor)
  }

  @Patch(':id/confidential')
  @Roles('chro', 'ceo')
  adjudicateConfidential(
    @Param('id') id: string,
    @Body() dto: AdjudicateConfidentialGrievanceDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.reportsService.adjudicateConfidential(id, dto, actor)
  }
}

