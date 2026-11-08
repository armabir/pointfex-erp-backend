import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import {
  CreateReportDto,
  UpdateReportStatusDto,
  ForwardReportDto,
  AdjudicateConfidentialGrievanceDto,
} from './dto/report.dto'
import { DemoUser } from '../common/demo-identity.guard'

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    filters: {
      type?: string
      status?: string
      projectId?: string
      teamId?: string
      isConfidential?: boolean
    },
    actor: DemoUser,
  ) {
    const isChroOrCeo = actor.role === 'chro' || actor.role === 'ceo'
    const where: any = {}

    if (filters.type) where.type = filters.type
    if (filters.status) where.status = filters.status
    if (filters.projectId) where.projectId = filters.projectId
    if (filters.teamId) where.teamId = filters.teamId

    // Confidentiality gate:
    // If actor is NOT CHRO or CEO, confidential reports must never be returned!
    if (!isChroOrCeo) {
      where.isConfidential = false
    } else if (filters.isConfidential !== undefined) {
      where.isConfidential = filters.isConfidential
    }

    return this.prisma.report.findMany({
      where,
      include: {
        author: true,
        targetUser: true,
        team: true,
      },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async findOne(id: string, actor: DemoUser) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        author: true,
        targetUser: true,
        team: true,
      },
    })

    if (!report) {
      throw new NotFoundException(`Report with ID "${id}" not found`)
    }

    const isChroOrCeo = actor.role === 'chro' || actor.role === 'ceo'
    const isAuthor = report.authorId === actor.id

    // Confidentiality check:
    if (report.isConfidential && !isChroOrCeo && !isAuthor) {
      throw new ForbiddenException(
        'Access denied: Confidential grievance is restricted to CHRO and CEO',
      )
    }

    return report
  }

  async create(dto: CreateReportDto, actor: DemoUser) {
    const reportId = `rep_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          id: reportId,
          authorId: actor.id,
          teamId: dto.teamId,
          projectId: dto.projectId,
          type: dto.type,
          category: dto.category,
          title: dto.title,
          description: dto.description,
          docsUrl: dto.docsUrl,
          complainTo: dto.complainTo,
          recipient: dto.recipient,
          isConfidential: dto.isConfidential || false,
          confidentialTo: dto.confidentialTo,
          targetUserId: dto.targetUserId,
          status: 'pending',
        },
        include: {
          author: true,
          targetUser: true,
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: dto.isConfidential ? 'CONFIDENTIAL_GRIEVANCE_SUBMITTED' : 'REPORT_SUBMITTED',
          actionCode: dto.isConfidential ? 'HR_CONFIDENTIAL_GRIEVANCE_LOGGED' : 'REPORT_LOGGED',
          severity: dto.isConfidential ? 'WARNING' : 'INFO',
          entityType: 'report',
          entityId: reportId,
          entityTitle: dto.title,
          description: `Submitted ${dto.type}${dto.isConfidential ? ' (Privileged Confidential)' : ''}`,
          category: dto.isConfidential ? 'people' : 'report',
          badgeColor: dto.isConfidential ? 'purple' : 'sky',
        },
      })

      return report
    })
  }

  async updateStatus(id: string, dto: UpdateReportStatusDto, actor: DemoUser) {
    const report = await this.findOne(id, actor)

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id },
        data: {
          status: dto.status,
          feedback: dto.feedback ? `[${actor.role.toUpperCase()} Note]: ${dto.feedback}` : report.feedback,
          resolvedAt: dto.status === 'resolved' || dto.status === 'dismissed' ? new Date() : undefined,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'REPORT_STATUS_UPDATED',
          actionCode: 'REPORT_STATUS_UPDATED',
          severity: dto.status === 'approved' ? 'SUCCESS' : 'INFO',
          entityType: 'report',
          entityId: id,
          entityTitle: report.title,
          description: `${actor.role.toUpperCase()} updated report status to "${dto.status}"`,
          category: 'report',
          badgeColor: dto.status === 'approved' ? 'emerald' : 'sky',
        },
      })

      return updated
    })
  }

  async forwardToCLevel(id: string, dto: ForwardReportDto, actor: DemoUser) {
    const report = await this.findOne(id, actor)

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id },
        data: {
          status: 'forwarded_to_c_level',
          forwardedTo: dto.recipient,
          forwardedBy: actor.id,
          forwardedAt: new Date(),
          pmEndorsement: dto.endorsement,
          feedback: `Forwarded to ${dto.recipient} with PM endorsement: "${dto.endorsement}"`,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'REPORT_FORWARDED_TO_C_LEVEL',
          actionCode: 'REPORT_FORWARDED',
          severity: 'INFO',
          entityType: 'report',
          entityId: id,
          entityTitle: report.title,
          description: `PM forwarded idea "${report.title}" to ${dto.recipient}`,
          category: 'report',
          badgeColor: 'indigo',
        },
      })

      return updated
    })
  }

  async adjudicateConfidential(id: string, dto: AdjudicateConfidentialGrievanceDto, actor: DemoUser) {
    // Only CHRO or CEO can call this
    if (actor.role !== 'chro' && actor.role !== 'ceo') {
      throw new ForbiddenException('Only CHRO or CEO can adjudicate confidential grievances')
    }

    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Grievance "${id}" not found`)

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({
        where: { id },
        data: {
          status: dto.status,
          mediationNotes: dto.mediationNotes,
          resolvedAt: dto.status === 'resolved' || dto.status === 'dismissed' ? new Date() : undefined,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'CONFIDENTIAL_GRIEVANCE_ADJUDICATED',
          actionCode: 'HR_CONFIDENTIAL_GRIEVANCE_UPDATED',
          severity: 'INFO',
          entityType: 'report',
          entityId: id,
          entityTitle: report.title,
          description: `CHRO/CEO adjudicated confidential grievance: status set to "${dto.status}"`,
          category: 'people',
          badgeColor: 'purple',
        },
      })

      return updated
    })
  }
}

