import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { CreateDirectiveDto, RatifyDecisionDto } from './dto/governance.dto'
import { DemoUser } from '../common/demo-identity.guard'
import { Prisma } from '@prisma/client'

@Injectable()
export class GovernanceService {
  constructor(private prisma: PrismaService) {}

  async getDirectives() {
    return this.prisma.executiveDirective.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async getDecisions() {
    return this.prisma.executiveDecision.findMany({
      orderBy: { ratifiedAt: 'desc' },
    })
  }

  async dispatchDirective(dto: CreateDirectiveDto, actor: DemoUser) {
    const directiveId = `dir_${Date.now()}`
    const taskId = `tsk_exec_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      // 1. Create ExecutiveDirective
      const directive = await tx.executiveDirective.create({
        data: {
          id: directiveId,
          title: dto.title,
          description: dto.description,
          assigneeRole: dto.assigneeRole,
          assigneeId: dto.assigneeId,
          priority: dto.priority || 'urgent',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 14 * 86400000),
          tags: dto.tags || ['Executive Directive', dto.assigneeRole.toUpperCase()],
          projectId: dto.projectId,
          status: 'active',
          issuedById: actor.id,
        },
      })

      // 2. Resolve target employee for the task
      let targetEmpId = dto.assigneeId
      if (!targetEmpId) {
        const matchingPosition = await tx.position.findFirst({
          where: { roleCategory: dto.assigneeRole.toLowerCase() },
          include: {
            assignments: {
              where: { isActive: true },
              take: 1,
            },
          },
        })
        targetEmpId = matchingPosition?.assignments[0]?.employeeId || actor.id
      }

      const defaultProject = await tx.project.findFirst({ select: { id: true } })

      // Create Task linked to directive
      await tx.task.create({
        data: {
          id: taskId,
          title: dto.title,
          description: dto.description || 'Executive strategic directive dispatched from leadership.',
          projectId: dto.projectId || defaultProject?.id || 'proj_01',
          creatorId: actor.id,
          assigneeId: targetEmpId,
          status: 'todo',
          priority: dto.priority || 'urgent',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 14 * 86400000),
          estimatedHours: new Prisma.Decimal(24),
          loggedHours: new Prisma.Decimal(0),
          tags: dto.tags || ['Executive Directive', dto.assigneeRole.toUpperCase()],
          checklist: {
            create: [
              { text: 'Executive brief and stakeholder alignment', completed: false },
              { text: 'Milestone execution and telemetry validation', completed: false },
              { text: 'C-Suite sign-off and retrospective documentation', completed: false },
            ],
          },
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'EXECUTIVE_DIRECTIVE_ISSUED',
          actionCode: 'EXECUTIVE_DIRECTIVE_DISPATCHED',
          severity: 'INFO',
          entityType: 'task',
          entityId: taskId,
          entityTitle: dto.title,
          description: `Dispatched strategic directive to ${dto.assigneeRole.toUpperCase()}: "${dto.title}"`,
          category: 'governance',
          badgeColor: 'sky',
        },
      })

      return directive
    })
  }

  async ratifyDecision(dto: RatifyDecisionDto, actor: DemoUser) {
    const decisionId = `dec_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const decision = await tx.executiveDecision.create({
        data: {
          id: decisionId,
          actionType: dto.actionType,
          entityId: dto.entityId,
          notes: dto.notes,
          ratifiedById: actor.id,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'CEO_DECISION_RATIFIED',
          actionCode: 'CEO_DECISION_AUTHORIZED',
          severity: 'SUCCESS',
          entityType: 'governance',
          entityId: dto.entityId,
          description: `CEO formally ratified ${dto.actionType.replace(/_/g, ' ')}${dto.notes ? `: ${dto.notes}` : ''}`,
          category: 'governance',
          badgeColor: 'emerald',
        },
      })

      return decision
    })
  }
}

