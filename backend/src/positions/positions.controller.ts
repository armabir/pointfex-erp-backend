import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { PositionsService } from './positions.service'
import { AssignPositionDto } from './dto/assign-position.dto'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'

@Controller('positions')
@UseGuards(PermissionsGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @RequirePermissions('positions:read')
  findAll() {
    return this.positionsService.findAll()
  }

  @Get(':id')
  @RequirePermissions('positions:read')
  findOne(@Param('id') id: string) {
    return this.positionsService.findOne(id)
  }

  @Post('assignments')
  @RequirePermissions('positions:assign')
  @RequiresFreshMfa('positions:assign')
  assignPosition(
    @Body() dto: AssignPositionDto & { reason?: string },
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.positionsService.assignPosition(dto, actor?.id, dto.reason)
  }

  @Post('assignments/:employeeId/remove')
  @RequirePermissions('positions:assign')
  @RequiresFreshMfa('positions:remove')
  removePosition(
    @Param('employeeId') employeeId: string,
    @Body() body: { positionId?: string; reason: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.positionsService.removePosition(employeeId, actor.id, body.reason, body.positionId)
  }
}
