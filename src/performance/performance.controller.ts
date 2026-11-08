import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { PerformanceService } from './performance.service'
import {
  RecordEvaluationDto,
  IssueRecognitionDto,
  IssueDisciplinaryDto,
} from './dto/performance.dto'
import { DemoIdentityGuard, DemoUser } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('performance')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get()
  findAll() {
    return this.performanceService.findAll()
  }

  @Get(':employeeId')
  findOne(@Param('employeeId') employeeId: string) {
    return this.performanceService.findOne(employeeId)
  }

  @Post('evaluations')
  @Roles('chro', 'ceo')
  recordEvaluation(@Body() dto: RecordEvaluationDto, @CurrentUser() actor: DemoUser) {
    return this.performanceService.recordEvaluation(dto, actor)
  }

  @Post('recognition')
  @Roles('chro', 'ceo')
  issueRecognition(@Body() dto: IssueRecognitionDto, @CurrentUser() actor: DemoUser) {
    return this.performanceService.issueRecognition(dto, actor)
  }

  @Post('discipline')
  @Roles('chro', 'ceo')
  issueDisciplinary(@Body() dto: IssueDisciplinaryDto, @CurrentUser() actor: DemoUser) {
    return this.performanceService.issueDisciplinary(dto, actor)
  }
}

