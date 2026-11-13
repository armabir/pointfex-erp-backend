import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { isEmployeeCeo, loadEmployeeWithSecurityContext } from '../common/security-policy.util'
import { DecisionMode, ProjectRequestStatus, VoteChoice } from '@prisma/client'

export interface CreateProjectRequestInput {
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
}

@Injectable()
export class ProjectRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  async create(input: CreateProjectRequestInput, actor: AuthenticatedUser) {
    if (!input.title?.trim()) {
      throw new BadRequestException('Project title is required.')
    }
    if (!input.initialBudgetBDT || Number(input.initialBudgetBDT) <= 0) {
      throw new BadRequestException('Initial budget in BDT must be a positive amount.')
    }
    if (!input.justification || input.justification.trim().length < 10) {
      throw new BadRequestException('Justification must be at least 10 characters.')
    }

    const voteDeadlineDays = Number(process.env.VOTE_DEADLINE_DAYS) || 7
    const voteDeadline = new Date(Date.now() + voteDeadlineDays * 24 * 60 * 60 * 1000)

    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    const isCeo = isEmployeeCeo(actorEmployee) || (actor.roles?.includes('system:root') ?? false)

    // Check policy
    const policy = await this.prisma.decisionPolicy.findUnique({
      where: { requestType: 'project_request' },
    })
    const decisionMode = policy?.mode || DecisionMode.EXECUTIVE_VOTE

    const created = await this.prisma.projectCreationRequest.create({
      data: {
        title: input.title.trim(),
        code: input.code?.trim() || `PRJ-${Date.now().toString().slice(-4)}`,
        requesterId: actor.id,
        proposedPmId: input.proposedPmId,
        scopeDeliverables: input.scopeDeliverables?.trim() || '',
        timeline: input.timeline?.trim() || '',
        teamDetails: input.teamDetails ?? {},
        initialBudgetBDT: input.initialBudgetBDT,
        risks: input.risks?.trim() || '',
        successCriteria: input.successCriteria?.trim() || '',
        justification: input.justification.trim(),
        creditedDeveloperId: input.creditedDeveloperId,
        proposalId: input.proposalId,
        status: isCeo ? ProjectRequestStatus.APPROVED : ProjectRequestStatus.IN_VOTE,
        decisionMode: isCeo ? DecisionMode.CEO_ONLY : decisionMode,
        voteDeadline: isCeo ? null : voteDeadline,
        decidedById: isCeo ? actor.id : null,
        decidedAt: isCeo ? new Date() : null,
        decisionReason: isCeo ? 'Approved immediately by Chief Executive Officer' : null,
      },
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
    })

    if (isCeo) {
      // Automatically create project in Planning
      const project = await this.prisma.project.create({
        data: {
          id: `proj_${Date.now()}`,
          name: created.title,
          code: created.code || `PRJ-${Date.now().toString().slice(-4)}`,
          description: created.scopeDeliverables,
          status: 'planning',
          startDate: new Date(),
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          budget: created.initialBudgetBDT,
          allocatedBudget: 0,
          priority: 'High Priority',
        },
      })
      await this.prisma.projectCreationRequest.update({
        where: { id: created.id },
        data: { approvedProjectId: project.id },
      })
    }

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actor.id,
        actorName: actorEmployee.name,
        actorEmail: actorEmployee.email,
        actorRole: actor.role.toUpperCase(),
        action: isCeo ? 'PROJECT_REQUEST_DIRECT_APPROVED' : 'PROJECT_REQUEST_CREATED',
        actionCode: isCeo ? 'PROJECT_APPROVED_IMMEDIATE' : 'PROJECT_REQUEST_SUBMITTED',
        severity: 'INFO',
        entityType: 'project_request',
        entityId: created.id,
        entityTitle: created.title,
        description: `Project request "${created.title}" with initial budget ৳${input.initialBudgetBDT} submitted by ${actorEmployee.name}.`,
        category: 'governance',
        badgeColor: isCeo ? 'emerald' : 'sky',
      })
    }

    return created
  }

  async list(actor: AuthenticatedUser) {
    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    const isCeo = isEmployeeCeo(actorEmployee) || (actor.roles?.includes('system:root') ?? false)

    const requests = await this.prisma.projectCreationRequest.findMany({
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch votes for each request
    const votes = await this.prisma.executiveVote.findMany({
      where: { targetType: 'PROJECT_REQUEST' },
      include: {
        voter: { select: { id: true, name: true, email: true, title: true } },
      },
    })

    const votesByRequest = new Map<string, typeof votes>()
    for (const v of votes) {
      const list = votesByRequest.get(v.requestId) || []
      list.push(v)
      votesByRequest.set(v.requestId, list)
    }

    // Get total eligible voters holding votes:cast
    const eligibleVoters = await this.prisma.employeeRole.findMany({
      where: {
        isActive: true,
        role: {
          rolePermissions: {
            some: { permission: { code: { in: ['votes:cast', 'system:root'] } } },
          },
        },
      },
      select: { employeeId: true },
    })
    const uniqueVoterIds = Array.from(new Set(eligibleVoters.map((v) => v.employeeId)))

    return requests.map((req) => {
      const reqVotes = votesByRequest.get(req.id) || []
      const approves = reqVotes.filter((v) => v.choice === VoteChoice.APPROVE).length
      const rejects = reqVotes.filter((v) => v.choice === VoteChoice.REJECT).length
      const voterIdsExcludingRequester = uniqueVoterIds.filter((id) => id !== req.requesterId)
      const totalEligible = Math.max(1, voterIdsExcludingRequester.length)
      const requiredToApprove = Math.floor(totalEligible / 2) + 1

      return {
        ...req,
        votes: reqVotes,
        tally: {
          approves,
          rejects,
          totalEligible,
          requiredToApprove,
          percentApproved: Math.round((approves / totalEligible) * 100),
        },
        hasVoted: reqVotes.some((v) => v.voterId === actor.id),
        myVote: reqVotes.find((v) => v.voterId === actor.id)?.choice || null,
        canVote: req.status === ProjectRequestStatus.IN_VOTE && req.requesterId !== actor.id,
        canCeoOverride: isCeo && req.status === ProjectRequestStatus.IN_VOTE,
      }
    })
  }

  async vote(
    requestId: string,
    choice: 'APPROVE' | 'REJECT',
    reason: string | undefined,
    actor: AuthenticatedUser,
  ) {
    const request = await this.prisma.projectCreationRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    })
    if (!request) {
      throw new NotFoundException(`Project request "${requestId}" not found.`)
    }

    if (request.requesterId === actor.id) {
      throw new ForbiddenException('The requester cannot vote on their own request.')
    }

    if (request.status !== ProjectRequestStatus.IN_VOTE) {
      throw new BadRequestException(`Voting is closed for this request (status: ${request.status}).`)
    }

    const now = new Date()
    if (request.voteDeadline && request.voteDeadline <= now) {
      await this.prisma.projectCreationRequest.update({
        where: { id: requestId },
        data: { status: ProjectRequestStatus.EXPIRED, decidedAt: now },
      })
      throw new BadRequestException('Voting deadline has passed. This request has expired.')
    }

    const voteChoice = choice === 'APPROVE' ? VoteChoice.APPROVE : VoteChoice.REJECT

    await this.prisma.executiveVote.upsert({
      where: {
        requestId_voterId: {
          requestId,
          voterId: actor.id,
        },
      },
      update: {
        choice: voteChoice,
        reason: reason?.trim() || null,
        mfaVerified: true,
        updatedAt: now,
      },
      create: {
        requestId,
        targetType: 'PROJECT_REQUEST',
        voterId: actor.id,
        choice: voteChoice,
        reason: reason?.trim() || null,
        mfaVerified: true,
      },
    })

    // Recompute tally
    return this.evaluateVoteOutcome(requestId)
  }

  async ceoOverride(
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    reason: string,
    actor: AuthenticatedUser,
  ) {
    const request = await this.prisma.projectCreationRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    })
    if (!request) {
      throw new NotFoundException(`Project request "${requestId}" not found.`)
    }

    if (request.status !== ProjectRequestStatus.IN_VOTE && request.status !== ProjectRequestStatus.SUBMITTED) {
      throw new BadRequestException(`Request cannot be decided (current status: ${request.status}).`)
    }

    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('CEO decision reason must be at least 10 characters.')
    }

    const now = new Date()
    let approvedProjectId: string | undefined

    if (decision === 'APPROVE') {
      const project = await this.prisma.project.create({
        data: {
          id: `proj_${Date.now()}`,
          name: request.title,
          code: request.code || `PRJ-${Date.now().toString().slice(-4)}`,
          description: request.scopeDeliverables,
          status: 'planning',
          startDate: now,
          deadline: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
          budget: request.initialBudgetBDT,
          allocatedBudget: 0,
          priority: 'High Priority',
        },
      })
      approvedProjectId = project.id
    }

    const updated = await this.prisma.projectCreationRequest.update({
      where: { id: requestId },
      data: {
        status: decision === 'APPROVE' ? ProjectRequestStatus.APPROVED : ProjectRequestStatus.REJECTED,
        approvedProjectId,
        decidedById: actor.id,
        decidedAt: now,
        decisionReason: reason.trim(),
      },
    })

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actor.id,
        actorName: actor.name || 'Chief Executive Officer',
        actorEmail: actor.email || 'ceo@pointfex.com',
        actorRole: 'CEO',
        action: `PROJECT_REQUEST_CEO_${decision}`,
        actionCode: 'CEO_DIRECT_DECISION',
        severity: 'CRITICAL',
        entityType: 'project_request',
        entityId: requestId,
        entityTitle: request.title,
        description: `CEO directly ${decision}d project request "${request.title}" with reason: ${reason}.`,
        category: 'governance',
        badgeColor: decision === 'APPROVE' ? 'emerald' : 'rose',
        outcome: decision,
        mfaVerified: true,
      })
    }

    return updated
  }

  async evaluateVoteOutcome(requestId: string) {
    const request = await this.prisma.projectCreationRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    })
    if (!request || request.status !== ProjectRequestStatus.IN_VOTE) return request

    const votes = await this.prisma.executiveVote.findMany({
      where: { requestId, targetType: 'PROJECT_REQUEST' },
    })

    const eligibleVoters = await this.prisma.employeeRole.findMany({
      where: {
        isActive: true,
        role: {
          rolePermissions: {
            some: { permission: { code: { in: ['votes:cast', 'system:root'] } } },
          },
        },
      },
      select: { employeeId: true },
    })
    const uniqueVoterIds = Array.from(new Set(eligibleVoters.map((v) => v.employeeId)))
    const voterIdsExcludingRequester = uniqueVoterIds.filter((id) => id !== request.requesterId)
    const totalEligible = Math.max(1, voterIdsExcludingRequester.length)
    const requiredToApprove = Math.floor(totalEligible / 2) + 1

    const approves = votes.filter((v) => v.choice === VoteChoice.APPROVE).length
    const rejects = votes.filter((v) => v.choice === VoteChoice.REJECT).length

    const now = new Date()

    if (approves >= requiredToApprove) {
      // Approved by majority
      const project = await this.prisma.project.create({
        data: {
          id: `proj_${Date.now()}`,
          name: request.title,
          code: request.code || `PRJ-${Date.now().toString().slice(-4)}`,
          description: request.scopeDeliverables,
          status: 'planning',
          startDate: now,
          deadline: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
          budget: request.initialBudgetBDT,
          allocatedBudget: 0,
          priority: 'High Priority',
        },
      })

      return this.prisma.projectCreationRequest.update({
        where: { id: requestId },
        data: {
          status: ProjectRequestStatus.APPROVED,
          approvedProjectId: project.id,
          decidedAt: now,
          decisionReason: `Approved by executive majority vote (${approves}/${totalEligible})`,
        },
      })
    } else if (rejects > totalEligible - requiredToApprove) {
      // Impossible to pass
      return this.prisma.projectCreationRequest.update({
        where: { id: requestId },
        data: {
          status: ProjectRequestStatus.REJECTED,
          decidedAt: now,
          decisionReason: `Rejected: approval impossible (${rejects}/${totalEligible} against)`,
        },
      })
    }

    return request
  }

  async sweepExpiredVotes() {
    const now = new Date()
    const expired = await this.prisma.projectCreationRequest.updateMany({
      where: {
        status: ProjectRequestStatus.IN_VOTE,
        voteDeadline: { lte: now },
      },
      data: {
        status: ProjectRequestStatus.EXPIRED,
        decidedAt: now,
        decisionReason: 'Voting deadline elapsed without achieving majority approval.',
      },
    })
    return { expiredCount: expired.count }
  }
}

