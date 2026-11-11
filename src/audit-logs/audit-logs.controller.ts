import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { AuditLogsService } from './audit-logs.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('audit-logs')
@UseGuards(PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequireAnyPermission('audit_logs:read', 'audit_logs:read_confidential')
  findAll(
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('actorId') actorId?: string,
    @Query('search') search?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.auditLogsService.findAll({ category, severity, actorId, search }, actor)
  }

  @Get(':id')
  @RequireAnyPermission('audit_logs:read', 'audit_logs:read_confidential')
  findOne(@Param('id') id: string, @CurrentUser() actor?: AuthenticatedUser) {
    return this.auditLogsService.findOne(id, actor)
  }
}
