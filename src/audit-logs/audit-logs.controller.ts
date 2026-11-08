import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { AuditLogsService } from './audit-logs.service'
import { DemoIdentityGuard } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'

@Controller('audit-logs')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles('cto', 'cfo', 'chro', 'ceo')
  findAll(
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('actorId') actorId?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogsService.findAll({ category, severity, actorId, search })
  }

  @Get(':id')
  @Roles('cto', 'cfo', 'chro', 'ceo')
  findOne(@Param('id') id: string) {
    return this.auditLogsService.findOne(id)
  }
}

