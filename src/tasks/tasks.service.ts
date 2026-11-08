import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import {
  CreateTaskDto,
  UpdateTaskStatusDto,
  ApproveTaskDto,
  RejectTaskDto,
  ReassignTaskDto,
  SubmitTaskWorkDto,
  AddTaskCommentDto,
} from './dto/task.dto'
import { Prisma } from '@prisma/client'
import { DemoUser } from '../common/demo-identity.guard'

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    projectId?: string
    assigneeId?: string
    creatorId?: string
    status?: string
    teamId?: string
  }) {
    const where: any = {}

    if (filters.projectId) where.projectId = filters.projectId
    if (filters.assigneeId) where.assigneeId = filters.assigneeId
    if (filters.creatorId) where.creatorId = filters.creatorId
    if (filters.status) where.status = filters.status
    if (filters.teamId) {
      where.project = {
        teamProjects: {
          some: {
            teamId: filters.teamId,
            isActive: true,
          },
        },
      }
    }

    return this.prisma.task.findMany({
      where,
      include: {
        assignee: true,
        creator: true,
        project: true,
        milestone: true,
        checklist: true,
        submissions: {
          orderBy: { submittedAt: 'desc' },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        creator: true,
        project: true,
        milestone: true,
        checklist: true,
        submissions: {
          include: { employee: true },
          orderBy: { submittedAt: 'desc' },
        },
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`)
    }

    return task
  }

  async create(dto: CreateTaskDto, actor: DemoUser) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } })
    if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`)

    const assignee = await this.prisma.employee.findUnique({ where: { id: dto.assigneeId } })
    if (!assignee) throw new NotFoundException(`Assignee "${dto.assigneeId}" not found`)

    const taskId = `task_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          id: taskId,
          title: dto.title,
          description: dto.description || '',
          projectId: dto.projectId,
          assigneeId: dto.assigneeId,
          creatorId: actor.id,
          milestoneId: dto.milestoneId || null,
          status: 'todo',
          priority: dto.priority || 'medium',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 7 * 86400000),
          estimatedHours: dto.estimatedHours ? new Prisma.Decimal(dto.estimatedHours) : new Prisma.Decimal(8),
          loggedHours: new Prisma.Decimal(0),
          tags: dto.tags || [],
          checklist: dto.checklist
            ? {
                create: dto.checklist.map((item) => ({
                  text: item.text,
                  completed: item.completed || false,
                })),
              }
            : undefined,
        },
        include: {
          assignee: true,
          creator: true,
          project: true,
          checklist: true,
        },
      })

      // Log Audit
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'TASK_CREATED',
          actionCode: 'TASK_CREATED',
          severity: 'INFO',
          entityType: 'task',
          entityId: taskId,
          entityTitle: dto.title,
          description: `Task created and assigned to ${assignee.name}`,
          category: 'task',
          badgeColor: 'sky',
        },
      })

      return task
    })
  }

  async updateStatus(id: string, dto: UpdateTaskStatusDto, actor: DemoUser) {
    const task = await this.findOne(id)

    // Permission constraint: Regular developers cannot mark tasks as Completed
    if (actor.role === 'developer' && dto.status === 'completed') {
      throw new ForbiddenException(
        'Permission denied: Only Project Managers (PM), CTO, or CEO can mark tasks as Completed',
      )
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
      include: {
        assignee: true,
        project: true,
        checklist: true,
      },
    })

    // Log Activity
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.id,
        actorEmail: `${actor.id}@pointfex.internal`,
        actorRole: actor.role.toUpperCase(),
        action: 'TASK_STATUS_CHANGED',
        actionCode: 'TASK_STATUS_CHANGED',
        severity: dto.status === 'completed' ? 'SUCCESS' : 'INFO',
        entityType: 'task',
        entityId: id,
        entityTitle: task.title,
        description: `Status changed from "${task.status}" to "${dto.status}"`,
        category: 'task',
        badgeColor: dto.status === 'completed' ? 'emerald' : 'sky',
      },
    })

    return updatedTask
  }

  async approve(id: string, dto: ApproveTaskDto, actor: DemoUser) {
    const task = await this.findOne(id)

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark task completed
      const updatedTask = await tx.task.update({
        where: { id },
        data: { status: 'completed' },
        include: {
          assignee: true,
          project: true,
          milestone: true,
        },
      })

      // 2. Add approval comment if feedback provided
      if (dto.feedback) {
        await tx.taskComment.create({
          data: {
            taskId: id,
            authorId: actor.id,
            content: `[Approval]: ${dto.feedback}`,
          },
        })
      }

      // 3. Check for deliverable payout (milestone payout or specified payout)
      const payout = dto.payoutAmount || (task.milestone?.payoutAmount ? Number(task.milestone.payoutAmount) : 0)

      if (payout > 0) {
        // Prevent duplicate payout for same task approval
        const existingTx = await tx.financialTransaction.findFirst({
          where: {
            employeeId: task.assigneeId,
            description: { contains: task.id },
            type: 'milestone_payout',
          },
        })

        if (!existingTx) {
          const payoutDecimal = new Prisma.Decimal(payout)

          // Update developer wallet
          await tx.employeeWallet.upsert({
            where: { employeeId: task.assigneeId },
            update: {
              balance: { increment: payoutDecimal },
              totalEarnedToDate: { increment: payoutDecimal },
              lastPayoutDate: new Date(),
            },
            create: {
              employeeId: task.assigneeId,
              balance: payoutDecimal,
              totalEarnedToDate: payoutDecimal,
              currency: 'BDT',
              currencySymbol: '৳',
              lastPayoutDate: new Date(),
            },
          })

          // Record in double-entry transaction ledger
          await tx.financialTransaction.create({
            data: {
              employeeId: task.assigneeId,
              projectId: task.projectId,
              milestoneId: task.milestoneId || undefined,
              amount: payoutDecimal,
              type: 'milestone_payout',
              description: `Task Payout [${task.id}]: ${task.title}`,
              status: 'completed',
            },
          })

          // Update treasury totalDistributedToDevs
          await tx.companyTreasury.update({
            where: { id: 'singleton' },
            data: {
              totalDistributedToDevs: { increment: payoutDecimal },
            },
          })
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'TASK_APPROVED',
          actionCode: 'TASK_APPROVED',
          severity: 'SUCCESS',
          entityType: 'task',
          entityId: id,
          entityTitle: task.title,
          description: `Verified deliverable and marked task as Completed${payout > 0 ? ` (Disbursed ৳${payout.toLocaleString()})` : ''}`,
          category: 'task',
          badgeColor: 'emerald',
        },
      })

      return updatedTask
    })
  }

  async reject(id: string, dto: RejectTaskDto, actor: DemoUser) {
    const task = await this.findOne(id)

    return this.prisma.$transaction(async (tx) => {
      // 1. Return task to in_progress
      const updatedTask = await tx.task.update({
        where: { id },
        data: { status: 'in_progress' },
      })

      // 2. Mandatory review feedback comment
      await tx.taskComment.create({
        data: {
          taskId: id,
          authorId: actor.id,
          content: `[Review Feedback - Revisions Requested]: ${dto.feedback}`,
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'TASK_REJECTED',
          actionCode: 'TASK_REJECTED',
          severity: 'WARNING',
          entityType: 'task',
          entityId: id,
          entityTitle: task.title,
          description: `Returned task to In Progress with review feedback: "${dto.feedback}"`,
          category: 'task',
          badgeColor: 'amber',
        },
      })

      return updatedTask
    })
  }

  async reassign(id: string, dto: ReassignTaskDto, actor: DemoUser) {
    const task = await this.findOne(id)
    const newDev = await this.prisma.employee.findUnique({ where: { id: dto.newAssigneeId } })
    if (!newDev) throw new NotFoundException(`Developer "${dto.newAssigneeId}" not found`)

    return this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id },
        data: { assigneeId: dto.newAssigneeId },
        include: { assignee: true },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'TASK_REASSIGNED',
          actionCode: 'TASK_REASSIGNED',
          severity: 'INFO',
          entityType: 'task',
          entityId: id,
          entityTitle: task.title,
          description: `Reassigned task to ${newDev.name}`,
          category: 'task',
          badgeColor: 'sky',
        },
      })

      return updatedTask
    })
  }

  async toggleChecklistItem(taskId: string, itemId: string, completed?: boolean) {
    const item = await this.prisma.taskChecklistItem.findFirst({
      where: { id: itemId, taskId },
    })
    if (!item) throw new NotFoundException(`Checklist item "${itemId}" not found for task "${taskId}"`)

    const newCompleted = completed !== undefined ? completed : !item.completed

    return this.prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: { completed: newCompleted },
    })
  }

  async submitWork(taskId: string, dto: SubmitTaskWorkDto, actor: DemoUser) {
    await this.findOne(taskId)

    return this.prisma.taskSubmission.create({
      data: {
        taskId,
        employeeId: actor.id,
        prUrl: dto.prUrl,
        demoUrl: dto.demoUrl,
        notes: dto.notes,
        status: 'submitted',
      },
      include: {
        employee: true,
      },
    })
  }

  async addComment(taskId: string, dto: AddTaskCommentDto, actor: DemoUser) {
    await this.findOne(taskId)

    return this.prisma.taskComment.create({
      data: {
        taskId,
        authorId: actor.id,
        content: dto.content,
      },
      include: {
        author: true,
      },
    })
  }
}

