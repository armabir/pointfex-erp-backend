import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { PositionsService } from './positions.service'
import { AssignPositionDto } from './dto/assign-position.dto'
import { DemoIdentityGuard } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'

@Controller('positions')
@UseGuards(DemoIdentityGuard, RolesGuard)
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
  @Roles('cto', 'chro', 'ceo')
  assignPosition(@Body() dto: AssignPositionDto) {
    return this.positionsService.assignPosition(dto)
  }
}

