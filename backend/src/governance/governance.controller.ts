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
import { PermissionsGuard } from '../common/permissions.guard'
import { RequiresPermission } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('governance')
@UseGuards(PermissionsGuard)
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('directives')
  @RequiresPermission('directives:read')
  getDirectives() {
    return this.governanceService.getDirectives()
  }

  @Get('decisions')
  @RequiresPermission('decisions:read')
  getDecisions() {
    return this.governanceService.getDecisions()
  }

  @Post('directives')
  @RequiresPermission('directives:dispatch')
  dispatchDirective(@Body() dto: CreateDirectiveDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.dispatchDirective(dto, actor)
  }

  @Post('ratify')
  @RequiresPermission('decisions:ratify')
  ratifyDecision(@Body() dto: RatifyDecisionDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.ratifyDecision(dto, actor)
  }

  @Post('transfer-ceo')
  @RequiresPermission('governance:transfer_ceo')
  @RequiresFreshMfa('governance:transfer_ceo')
  transferCeo(
    @Body() dto: TransferCeoDto,
    @Headers() headers: Record<string, string>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.transferCeo(dto, actor, headers)
  }

  @Get('access-requests')
  @RequiresPermission('governance:read')
  listAccessRequests(
    @Query('status') status?: string,
    @Query('targetEmployeeId') targetEmployeeId?: string,
  ) {
    return this.governanceService.listAccessRequests(status, targetEmployeeId)
  }

  @Post('access-requests')
  @RequiresPermission('access_requests:submit')
  createAccessRequest(
    @Body() dto: CreateAccessRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.createAccessRequest(dto, actor)
  }

  @Post('access-requests/:id/approve')
  @RequiresPermission('governance:approve_request')
  @RequiresFreshMfa('governance:approve_request')
  approveAccessRequest(
    @Param('id') id: string,
    @Body() dto: ReviewAccessRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.approveAccessRequest(id, dto, actor)
  }

  @Post('access-requests/:id/reject')
  @RequiresPermission('governance:approve_request')
  @RequiresFreshMfa('governance:approve_request')
  rejectAccessRequest(
    @Param('id') id: string,
    @Body() dto: ReviewAccessRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.rejectAccessRequest(id, dto, actor)
  }
}
