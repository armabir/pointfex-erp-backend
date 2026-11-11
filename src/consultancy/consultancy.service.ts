import { getCurrentRequestIp } from '../common/ip-address.util'
import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { CreateConsultancyDto, UpdateConsultancyDto } from './dto/consultancy.dto'
import { Prisma } from '@prisma/client'
import { AuthenticatedUser } from '../common/auth-user.interface'

@Injectable()
export class ConsultancyService {
  constructor(private prisma: PrismaService) {}

  async findAll(teamId?: string, projectId?: string, status?: string) {
    const where: any = {}
    if (teamId) where.teamId = teamId
    if (projectId) where.projectId = projectId
    if (status) where.status = status

    return this.prisma.consultancyRequest.findMany({
      where,
      include: {
        requester: true,
        consultant: true,
        project: true,
        team: true,
      },
      orderBy: { requestedAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const req = await this.prisma.consultancyRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        consultant: true,
        project: true,
        team: true,
      },
    })
    if (!req) {
      throw new NotFoundException(`Consultancy request "${id}" not found`)
    }
    return req
  }

  async create(dto: CreateConsultancyDto, actor: AuthenticatedUser) {
    const id = `cst_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.consultancyRequest.create({
        data: {
          id,
          title: dto.title,
          requesterId: actor.id,
          teamId: dto.teamId,
          projectId: dto.projectId,
          category: dto.category,
          description: dto.description,
          urgency: dto.urgency || 'medium',
          status: 'submitted',
        },
        include: {
          requester: true,
          project: true,
        },
      })

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'CONSULTANCY_REQUESTED',
          actionCode: 'CONSULTANCY_SUBMITTED',
          severity: 'INFO',
          entityType: 'consultancy',
          entityId: id,
          entityTitle: dto.title,
          description: `Submitted technical consultancy request for ${dto.category}`,
          category: 'task',
          badgeColor: 'purple',
        },
      })

      return created
    })
  }

  async update(id: string, dto: UpdateConsultancyDto, actor: AuthenticatedUser) {
    const existing = await this.findOne(id)

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.consultancyRequest.update({
        where: { id },
        data: {
          status: dto.status || existing.status,
          assignedConsultantId: dto.assignedConsultantId,
          assignedConsultantName: dto.assignedConsultantName,
          estimatedHours: dto.estimatedHours ? new Prisma.Decimal(dto.estimatedHours) : undefined,
          feeBDT: dto.feeBDT ? new Prisma.Decimal(dto.feeBDT) : undefined,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
          ctoNotes: dto.ctoNotes,
          completedAt: dto.status === 'completed' ? new Date() : undefined,
        },
      })

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'CONSULTANCY_STATUS_UPDATED',
          actionCode: 'CONSULTANCY_STATUS_CHANGED',
          severity: 'INFO',
          entityType: 'consultancy',
          entityId: id,
          entityTitle: existing.title,
          description: `CTO updated consultancy request status to "${dto.status || existing.status}"`,
          category: 'task',
          badgeColor: 'purple',
        },
      })

      return updated
    })
  }
}
