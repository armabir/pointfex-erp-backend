import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
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

import { VoteEngineService } from './vote-engine.service'

@Controller('governance')
@UseGuards(PermissionsGuard)
export class GovernanceController {
  constructor(
    private readonly governanceService: GovernanceService,
    private readonly voteEngine: VoteEngineService,
  ) {}

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
    if (process.env.CEO_TRANSFER_ENABLED !== 'true') {
      throw new NotFoundException('CEO transfer is disabled in this deployment.')
    }
    return this.governanceService.transferCeo(dto, actor, headers)
  }

  @Get('access-requests')
  @RequiresPermission('governance:read')
  listAccessRequests(
    @Query('status') status?: string,
    @Query('targetEmployeeId') targetEmployeeId?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    return this.governanceService.listAccessRequests(status, targetEmployeeId, actor)
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

  // --------------------------------------------------------------------------
  // Phase 7: Decision Policies, Votes, Project Requests & Proposals
  // --------------------------------------------------------------------------

  @Get('decision-policies')
  @RequiresPermission('governance:read')
  listPolicies() {
    return this.governanceService.listDecisionPolicies()
  }

  @Patch('decision-policies/:requestType')
  @RequiresPermission('roles:update')
  @RequiresFreshMfa('roles:update')
  updatePolicy(
    @Param('requestType') requestType: string,
    @Body() body: { mode: 'CEO_ONLY' | 'EXECUTIVE_VOTE'; reason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.updateDecisionPolicy(requestType, body.mode, actor)
  }

  @Post('project-requests')
  @RequiresPermission('projects:request')
  createProjectRequest(@Body() dto: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.createProjectCreationRequest(dto, actor)
  }

  @Get('project-requests')
  @RequiresPermission('projects:read_own')
  listProjectRequests(@Query('status') status?: string, @CurrentUser() actor?: AuthenticatedUser) {
    return this.governanceService.listProjectCreationRequests(status, actor)
  }

  @Get('project-requests/:id')
  @RequiresPermission('projects:read_own')
  getProjectRequest(@Param('id') id: string) {
    return this.governanceService.getProjectCreationRequest(id)
  }

  @Post('project-requests/:id/vote')
  @RequiresPermission('votes:cast')
  @RequiresFreshMfa('votes:cast')
  voteProjectRequest(
    @Param('id') id: string,
    @Body() body: { choice: 'APPROVE' | 'REJECT'; reason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.voteEngine.castVote(id, 'PROJECT_REQUEST', actor, body.choice, body.reason)
  }

  @Post('project-requests/:id/override')
  @RequiresPermission('roles:update')
  @RequiresFreshMfa('roles:update')
  overrideProjectRequest(
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVE' | 'REJECT'; reason: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.voteEngine.ceoOverride(id, 'PROJECT_REQUEST', actor, body.decision, body.reason)
  }

  @Post('budget-requests/:id/vote')
  @RequiresPermission('votes:cast')
  @RequiresFreshMfa('votes:cast')
  voteBudgetRequest(
    @Param('id') id: string,
    @Body() body: { choice: 'APPROVE' | 'REJECT'; reason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.voteEngine.castVote(id, 'BUDGET_REQUEST', actor, body.choice, body.reason)
  }

  @Post('budget-requests/:id/override')
  @RequiresPermission('roles:update')
  @RequiresFreshMfa('roles:update')
  overrideBudgetRequest(
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVE' | 'REJECT'; reason: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.voteEngine.ceoOverride(id, 'BUDGET_REQUEST', actor, body.decision, body.reason)
  }

  @Post('proposals')
  @RequiresPermission('projects:propose')
  createProposal(@Body() dto: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.createProjectProposal(dto, actor)
  }

  @Get('proposals')
  @RequiresPermission('projects:propose')
  listProposals(@CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.listProjectProposals(actor)
  }

  @Post('proposals/:id/forward')
  @RequiresPermission('suggestions:forward')
  forwardProposal(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.forwardProjectProposal(id, actor, body)
  }

  @Post('proposals/:id/return')
  @RequiresPermission('suggestions:forward')
  returnProposal(
    @Param('id') id: string,
    @Body() body: { comments: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.returnProjectProposal(id, actor, body.comments)
  }

  @Post('proposals/:id/decline')
  @RequiresPermission('suggestions:forward')
  declineProposal(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.governanceService.declineProjectProposal(id, actor, body.reason)
  }

  @Get('my-requests')
  @RequiresPermission('employees:read_basic')
  listMyRequests(@CurrentUser() actor: AuthenticatedUser) {
    return this.governanceService.listMyRequests(actor)
  }
}
