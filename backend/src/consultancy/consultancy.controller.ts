import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ConsultancyService } from './consultancy.service'
import { CreateConsultancyDto, UpdateConsultancyDto } from './dto/consultancy.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('consultancy')
@UseGuards(PermissionsGuard)
export class ConsultancyController {
  constructor(private readonly consultancyService: ConsultancyService) {}

  @Get()
  @RequirePermissions('consultancy:read')
  findAll(
    @Query('teamId') teamId?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.consultancyService.findAll(teamId, projectId, status)
  }

  @Get(':id')
  @RequirePermissions('consultancy:read')
  findOne(@Param('id') id: string) {
    return this.consultancyService.findOne(id)
  }

  @Post()
  @RequirePermissions('consultancy:create')
  create(@Body() dto: CreateConsultancyDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.consultancyService.create(dto, actor)
  }

  @Patch(':id')
  @RequirePermissions('consultancy:manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConsultancyDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.consultancyService.update(id, dto, actor)
  }
}
