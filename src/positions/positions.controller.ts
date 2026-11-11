import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { PositionsService } from './positions.service'
import { AssignPositionDto } from './dto/assign-position.dto'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'

@Controller('positions')
@UseGuards(PermissionsGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  findAll() {
    return this.positionsService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.positionsService.findOne(id)
  }

  @Post('assignments')
  @RequirePermissions('positions:assign')
  assignPosition(@Body() dto: AssignPositionDto) {
    return this.positionsService.assignPosition(dto)
  }
}
