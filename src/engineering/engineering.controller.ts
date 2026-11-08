import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { EngineeringService } from './engineering.service'
import {
  CreateSecurityAlertDto,
  UpdateSecurityAlertStatusDto,
} from './dto/engineering.dto'
import { DemoIdentityGuard, DemoUser } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('engineering')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class EngineeringController {
  constructor(private readonly engineeringService: EngineeringService) {}

  @Get('quality-gates')
  getQualityGates() {
    return this.engineeringService.getQualityGates()
  }

  @Get('quality-gates/:projectId')
  getQualityGateForProject(@Param('projectId') projectId: string) {
    return this.engineeringService.getQualityGateForProject(projectId)
  }

  @Get('security-alerts')
  getSecurityAlerts(
    @Query('projectId') projectId?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
  ) {
    return this.engineeringService.getSecurityAlerts(projectId, severity, status)
  }

  @Post('security-alerts')
  @Roles('cto', 'pm', 'ceo')
  createSecurityAlert(
    @Body() dto: CreateSecurityAlertDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.engineeringService.createSecurityAlert(dto, actor)
  }

  @Patch('security-alerts/:id/status')
  @Roles('cto', 'pm', 'ceo')
  updateSecurityAlertStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSecurityAlertStatusDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.engineeringService.updateSecurityAlertStatus(id, dto, actor)
  }

  @Get('test-runs')
  getTestRuns(@Query('projectId') projectId?: string) {
    return this.engineeringService.getTestRuns(projectId)
  }
}

