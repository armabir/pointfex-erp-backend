import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { PerformanceService } from './performance.service'
import {
  RecordEvaluationDto,
  IssueRecognitionDto,
  IssueDisciplinaryDto,
} from './dto/performance.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission, RequirePermissions } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('performance')
@UseGuards(PermissionsGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  @RequireAnyPermission('performance:read_all', 'performance:read_team', 'performance:read_own')
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.performanceService.findAll(actor)
  }

  @Get(':employeeId')
  @RequireAnyPermission('performance:read_all', 'performance:read_team', 'performance:read_own')
  findOne(@Param('employeeId') employeeId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.performanceService.findOne(employeeId, actor)
  }

  @Post('evaluations')
  @RequirePermissions('performance:evaluate')
  recordEvaluation(@Body() dto: RecordEvaluationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.performanceService.recordEvaluation(dto, actor)
  }

  @Post('recognition')
  @RequirePermissions('performance:recognize')
  issueRecognition(@Body() dto: IssueRecognitionDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.performanceService.issueRecognition(dto, actor)
  }

  @Post('discipline')
  @RequirePermissions('performance:discipline')
  issueDisciplinary(@Body() dto: IssueDisciplinaryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.performanceService.issueDisciplinary(dto, actor)
  }
}
