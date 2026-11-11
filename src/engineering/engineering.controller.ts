import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { EngineeringService } from './engineering.service'
import { CreateSecurityAlertDto, UpdateSecurityAlertStatusDto } from './dto/engineering.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('engineering')
@UseGuards(PermissionsGuard)
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
  @RequirePermissions('security_alerts:create')
  createSecurityAlert(
    @Body() dto: CreateSecurityAlertDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.engineeringService.createSecurityAlert(dto, actor)
  }

  @Patch('security-alerts/:id/status')
  @RequirePermissions('security_alerts:update_status')
  updateSecurityAlertStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSecurityAlertStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.engineeringService.updateSecurityAlertStatus(id, dto, actor)
  }

  @Get('test-runs')
  getTestRuns(@Query('projectId') projectId?: string) {
    return this.engineeringService.getTestRuns(projectId)
  }
}
