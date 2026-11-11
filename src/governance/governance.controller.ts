import { Controller, Get, Post, Body, Param, Query, Headers, UseGuards } from '@nestjs/common'
import { GovernanceService } from './governance.service'
import {
  CreateAccessRequestDto,
  CreateDirectiveDto,
  RatifyDecisionDto,
  ReviewAccessRequestDto,
  TransferCeoDto,
} from './dto/governance.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('governance')
@UseGuards(RolesGuard)
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('directives')
  getDirectives() {
    return this.governanceService.getDirectives()
  }

  @Get('decisions')
  getDecisions() {
    return this.governanceService.getDecisions()
  }

  @Post('directives')
  @Roles('ceo', 'cto')
  dispatchDirective(@Body() dto: CreateDirectiveDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.dispatchDirective(dto, actor)
  }

  @Post('ratify')
  @Roles('ceo')
  ratifyDecision(@Body() dto: RatifyDecisionDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.ratifyDecision(dto, actor)
  }

  @Post('transfer-ceo')
  @Roles('ceo')
  transferCeo(
    @Body() dto: TransferCeoDto,
    @Headers() headers: Record<string, string>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.transferCeo(dto, actor, headers)
  }

  @Get('access-requests')
  @Roles('cto', 'cfo', 'chro', 'ceo')
  listAccessRequests(
    @Query('status') status?: string,
    @Query('targetEmployeeId') targetEmployeeId?: string,
  ) {
    return this.governanceService.listAccessRequests(status, targetEmployeeId)
  }

  @Post('access-requests')
  @Roles('cto', 'cfo', 'chro', 'ceo')
  createAccessRequest(
    @Body() dto: CreateAccessRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.createAccessRequest(dto, actor)
  }

  @Post('access-requests/:id/approve')
  @Roles('ceo', 'chro')
  approveAccessRequest(
    @Param('id') id: string,
    @Body() dto: ReviewAccessRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.approveAccessRequest(id, dto, actor)
  }

  @Post('access-requests/:id/reject')
  @Roles('ceo', 'chro')
  rejectAccessRequest(
    @Param('id') id: string,
    @Body() dto: ReviewAccessRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.rejectAccessRequest(id, dto, actor)
  }
}
