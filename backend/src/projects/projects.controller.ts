import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { ProjectRequestsService } from './project-requests.service'
import { ProposalsService } from './proposals.service'
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateMilestoneDto,
  UpdateMilestoneStatusDto,
  AssignProjectTeamDto,
} from './dto/project.dto'
import { PermissionsGuard } from '../common/permissions.guard'
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PrismaService } from '../common/prisma.service'

@Controller('projects')
@UseGuards(PermissionsGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectRequestsService: ProjectRequestsService,
    private readonly proposalsService: ProposalsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequireAnyPermission('projects:read_own', 'projects:read_all')
  findAll(@Query('teamId') teamId?: string, @Query('status') status?: string) {
    return this.projectsService.findAll(teamId, status)
  }

  // --- Project Requests & Voting Engine ---

  @Get('requests')
  @RequireAnyPermission('projects:request', 'votes:cast', 'projects:read_own', 'projects:read_all')
  listProjectRequests(@CurrentUser() actor: AuthenticatedUser) {
    return this.projectRequestsService.list(actor)
  }

  @Post('requests')
  @RequirePermissions('projects:request')
  createProjectRequest(
    @Body()
    body: {
      title: string
      code?: string
      scopeDeliverables: string
      timeline: string
      teamDetails?: any
      initialBudgetBDT: number
      risks: string
      successCriteria: string
      justification: string
      creditedDeveloperId?: string
      proposalId?: string
      proposedPmId?: string
    },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.projectRequestsService.create(body, actor)
  }

  @Post('requests/:id/vote')
  @RequirePermissions('votes:cast')
  @RequiresFreshMfa('votes:cast')
  voteProjectRequest(
    @Param('id') id: string,
    @Body() body: { choice: 'APPROVE' | 'REJECT'; reason?: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.projectRequestsService.vote(id, body.choice, body.reason, actor)
  }

  @Post('requests/:id/decide')
  @RequirePermissions('system:root')
  @RequiresFreshMfa('system:root')
  ceoDecideProjectRequest(
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVE' | 'REJECT'; reason: string },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.projectRequestsService.ceoOverride(id, body.decision, body.reason, actor)
  }

  // --- Developer Proposals & Suggestions ---

  @Get('proposals')
  @RequireAnyPermission('projects:propose', 'suggestions:submit', 'suggestions:forward')
  listProposals(@CurrentUser() actor: AuthenticatedUser) {
    return this.proposalsService.list(actor)
  }

  @Post('proposals')
  @RequireAnyPermission('projects:propose', 'suggestions:submit')
  createProposal(
    @Body()
    body: {
      title: string
      description: string
      suggestedPmId?: string
      type?: 'PROPOSAL' | 'SUGGESTION' | 'GENERAL_COMPLAINT' | 'GRIEVANCE'
      isConfidential?: boolean
    },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.proposalsService.create(body, actor)
  }

  @Post('proposals/:id/forward')
  @RequireAnyPermission('suggestions:forward', 'projects:request')
  forwardProposal(
    @Param('id') id: string,
    @Body()
    body: {
      initialBudgetBDT: number
      timeline: string
      scopeDeliverables?: string
      justification?: string
      risks?: string
      successCriteria?: string
    },
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.proposalsService.forward(id, body, actor)
  }

  @Post('proposals/:id/return')
  @RequireAnyPermission('suggestions:forward')
  returnProposal(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.proposalsService.returnProposal(id, comments || '', actor)
  }

  @Post('proposals/:id/decline')
  @RequireAnyPermission('suggestions:forward')
  declineProposal(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.proposalsService.declineProposal(id, reason || '', actor)
  }

  // --- "My Requests" Timeline ---

  @Get('my-requests')
  async listMyRequests(@CurrentUser() actor: AuthenticatedUser) {
    const [projectReqs, budgetReqs, proposals, accessReqs] = await Promise.all([
      this.prisma.projectCreationRequest.findMany({
        where: { requesterId: actor.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.budgetRequest.findMany({
        where: { requesterId: actor.id },
        include: { project: { select: { id: true, name: true, code: true } } },
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.projectProposal.findMany({
        where: { requesterId: actor.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.accessChangeRequest.findMany({
        where: { requesterId: actor.id },
        include: {
          requestedRole: { select: { id: true, name: true, slug: true } },
          targetEmployee: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const items: any[] = []

    for (const pr of projectReqs) {
      items.push({
        id: `prj_req_${pr.id}`,
        type: 'PROJECT_REQUEST',
        title: pr.title,
        subtitle: `Budget ৳${pr.initialBudgetBDT} • ${pr.timeline}`,
        status: pr.status,
        createdAt: pr.createdAt,
        decidedAt: pr.decidedAt,
        decisionReason: pr.decisionReason,
      })
    }

    for (const br of budgetReqs) {
      items.push({
        id: `bgt_req_${br.id}`,
        type: 'BUDGET_INCREASE',
        title: `Budget Increase: ${br.project?.name || br.projectId}`,
        subtitle: `Requested ৳${br.requestedAmount} • ${br.reason}`,
        status: br.status.toUpperCase(),
        createdAt: br.requestedAt,
        decidedAt: br.reviewedAt,
        decisionReason: br.feedback,
      })
    }

    for (const p of proposals) {
      items.push({
        id: `prop_${p.id}`,
        type: p.type,
        title: p.title,
        subtitle: p.description.slice(0, 80),
        status: p.status,
        createdAt: p.createdAt,
        decisionReason: p.comments,
      })
    }

    for (const ar of accessReqs) {
      items.push({
        id: `acc_req_${ar.id}`,
        type: 'ROLE_CHANGE',
        title: `Role Change: ${ar.requestedRole?.name}`,
        subtitle: `For ${ar.targetEmployee?.name} • ${ar.reason || 'Requested'}`,
        status: ar.status,
        createdAt: ar.createdAt,
        decidedAt: ar.reviewedAt,
        decisionReason: ar.reviewNotes,
      })
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  // --- Project CRUD ---

  @Get(':id')
  @RequireAnyPermission('projects:read_own', 'projects:read_all')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id)
  }

  @Post()
  @RequirePermissions('projects:create')
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('projects:update')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto)
  }

  @Post(':id/milestones')
  @RequirePermissions('milestones:create')
  addMilestone(@Param('id') id: string, @Body() dto: CreateMilestoneDto) {
    return this.projectsService.addMilestone(id, dto)
  }

  @Patch(':id/milestones/:milestoneId')
  @RequirePermissions('milestones:update')
  updateMilestoneStatus(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneStatusDto,
  ) {
    return this.projectsService.updateMilestoneStatus(id, milestoneId, dto)
  }

  @Post(':id/assign-team')
  @RequirePermissions('projects:assign_team')
  assignTeam(@Param('id') id: string, @Body() dto: AssignProjectTeamDto) {
    return this.projectsService.assignTeam(id, dto)
  }
}
