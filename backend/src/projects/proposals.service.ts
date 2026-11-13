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
import { ProjectRequestsService } from './project-requests.service'

export interface CreateProposalInput {
  title: string
  description: string
  suggestedPmId?: string
  type?: 'PROPOSAL' | 'SUGGESTION' | 'GENERAL_COMPLAINT' | 'GRIEVANCE'
  isConfidential?: boolean
}

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectRequestsService: ProjectRequestsService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  async create(input: CreateProposalInput, actor: AuthenticatedUser) {
    if (!input.title?.trim() || !input.description?.trim()) {
      throw new BadRequestException('Title and description are required.')
    }

    const type = input.type || 'PROPOSAL'

    // Confidential grievances bypass PM and go directly to HR/Management
    if (type === 'GRIEVANCE' || input.isConfidential) {
      const report = await this.prisma.report.create({
        data: {
          id: `rep_grievance_${Date.now()}`,
          authorId: actor.id,
          title: `Confidential Grievance: ${input.title.trim()}`,
          description: input.description.trim(),
          type: 'grievance',
          status: 'pending',
          confidentialTo: 'chro',
          isConfidential: true,
          category: 'hr',
        },
      })
      return {
        id: report.id,
        status: 'SUBMITTED_TO_HR',
        type: 'GRIEVANCE',
        message: 'Your confidential grievance has bypassed PM and been delivered directly to HR for adjudication.',
      }
    }

    const proposal = await this.prisma.projectProposal.create({
      data: {
        requesterId: actor.id,
        title: input.title.trim(),
        description: input.description.trim(),
        suggestedPmId: input.suggestedPmId,
        type,
        status: 'PENDING',
      },
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
    })

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actor.id,
        actorName: actor.name || actor.id,
        actorEmail: actor.email || '',
        actorRole: actor.role.toUpperCase(),
        action: 'DEVELOPER_PROPOSAL_SUBMITTED',
        actionCode: 'PROPOSAL_SUBMITTED',
        severity: 'INFO',
        entityType: 'project_proposal',
        entityId: proposal.id,
        entityTitle: proposal.title,
        description: `Developer ${actor.name || actor.id} submitted proposal "${proposal.title}" for PM review.`,
        category: 'communications',
        badgeColor: 'sky',
      })
    }

    return proposal
  }

  async list(actor: AuthenticatedUser) {
    // PM sees proposals assigned to them or unassigned; Developer sees own proposals; CEO/Executives see all
    const roles = actor.roles || []
    const isLeadership =
      roles.includes('system:root') ||
      roles.some((r) => ['ceo', 'coo', 'cto', 'cpo', 'chro'].includes(r.toLowerCase()))

    let where: any = {}
    if (!isLeadership) {
      if (roles.includes('pm') || roles.includes('squad_lead')) {
        where = {
          OR: [{ suggestedPmId: actor.id }, { suggestedPmId: null }],
        }
      } else {
        where = { requesterId: actor.id }
      }
    }

    return this.prisma.projectProposal.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async forward(
    proposalId: string,
    forwardData: {
      initialBudgetBDT: number
      timeline: string
      scopeDeliverables?: string
      justification?: string
      risks?: string
      successCriteria?: string
    },
    actor: AuthenticatedUser,
  ) {
    const proposal = await this.prisma.projectProposal.findUnique({
      where: { id: proposalId },
      include: { requester: true },
    })
    if (!proposal) throw new NotFoundException(`Proposal "${proposalId}" not found.`)

    if (proposal.status !== 'PENDING') {
      throw new BadRequestException(`Proposal is already ${proposal.status}.`)
    }

    // Create the Project Creation Request crediting the developer
    const projectRequest = await this.projectRequestsService.create(
      {
        title: proposal.title,
        scopeDeliverables: forwardData.scopeDeliverables || proposal.description,
        timeline: forwardData.timeline || 'Sprint 4-6 (6 weeks)',
        initialBudgetBDT: forwardData.initialBudgetBDT,
        risks: forwardData.risks || 'Standard technical delivery risks',
        successCriteria: forwardData.successCriteria || 'Deliverables verified by QA and accepted',
        justification:
          forwardData.justification ||
          `Forwarded by PM from developer proposal by ${proposal.requester.name}`,
        creditedDeveloperId: proposal.requesterId,
        proposalId: proposal.id,
        proposedPmId: actor.id,
      },
      actor,
    )

    await this.prisma.projectProposal.update({
      where: { id: proposalId },
      data: {
        status: 'FORWARDED',
        forwardedRequestId: projectRequest.id,
        comments: `Forwarded to executive vote by PM ${actor.name || actor.id}`,
      },
    })

    return {
      proposalStatus: 'FORWARDED',
      projectRequest,
    }
  }

  async returnProposal(proposalId: string, comments: string, actor: AuthenticatedUser) {
    const proposal = await this.prisma.projectProposal.findUnique({
      where: { id: proposalId },
    })
    if (!proposal) throw new NotFoundException(`Proposal "${proposalId}" not found.`)

    return this.prisma.projectProposal.update({
      where: { id: proposalId },
      data: {
        status: 'RETURNED',
        comments: comments.trim(),
      },
    })
  }

  async declineProposal(proposalId: string, reason: string, actor: AuthenticatedUser) {
    const proposal = await this.prisma.projectProposal.findUnique({
      where: { id: proposalId },
    })
    if (!proposal) throw new NotFoundException(`Proposal "${proposalId}" not found.`)

    return this.prisma.projectProposal.update({
      where: { id: proposalId },
      data: {
        status: 'DECLINED',
        comments: reason.trim(),
      },
    })
  }
}

