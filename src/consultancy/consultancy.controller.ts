import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ConsultancyService } from './consultancy.service'
import { CreateConsultancyDto, UpdateConsultancyDto } from './dto/consultancy.dto'
import { DemoIdentityGuard, DemoUser } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('consultancy')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class ConsultancyController {
  constructor(private readonly consultancyService: ConsultancyService) {}

  @Get()
  findAll(
    @Query('teamId') teamId?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.consultancyService.findAll(teamId, projectId, status)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consultancyService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateConsultancyDto, @CurrentUser() actor: DemoUser) {
    return this.consultancyService.create(dto, actor)
  }

  @Patch(':id')
  @Roles('cto', 'ceo')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConsultancyDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.consultancyService.update(id, dto, actor)
  }
}

