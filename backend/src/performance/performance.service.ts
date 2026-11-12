import { getCurrentRequestIp } from '../common/ip-address.util'
import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import {
  RecordEvaluationDto,
  IssueRecognitionDto,
  IssueDisciplinaryDto,
} from './dto/performance.dto'
import { Prisma } from '@prisma/client'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { FinanceService } from '../finance/finance.service'
import { AuthorizationService } from '../rbac/authorization.service'

@Injectable()
export class PerformanceService {
  constructor(
    private prisma: PrismaService,
    private financeService: FinanceService,
    @Optional() private readonly authz?: AuthorizationService,
  ) {}

  async findAll(actor?: AuthenticatedUser) {
    let canReadAll = !actor
    let canReadTeam = false

    if (actor) {
      if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
        canReadAll = (await this.authz.check(actor, 'performance:read_all')).allowed
        canReadTeam = !canReadAll && (await this.authz.check(actor, 'performance:read_team')).allowed
      } else {
        canReadAll =
          Boolean(actor.permissions?.includes('performance:read_all')) ||
          ['chro', 'cpo', 'ceo', 'cto', 'cfo'].includes(actor.role.toLowerCase())
        canReadTeam =
          Boolean(actor.permissions?.includes('performance:read_team')) ||
          actor.role.toLowerCase() === 'pm'
      }
    }

    let where: Prisma.PerformanceRecordWhereInput = {}

    if (!canReadAll && actor) {
      if (canReadTeam) {
        const managedTeams = await this.prisma.team.findMany({
          where: {
            pmPosition: {
              assignments: { some: { employeeId: actor.id, isActive: true } },
            },
          },
          select: {
            memberships: { where: { isActive: true }, select: { employeeId: true } },
          },
        })
        const teamEmpIds = Array.from(
          new Set([
            actor.id,
            ...managedTeams.flatMap((t) => t.memberships.map((m) => m.employeeId)),
          ]),
        )
        where = { employeeId: { in: teamEmpIds } }
      } else {
        where = { employeeId: actor.id }
      }
    }

    return this.prisma.performanceRecord.findMany({
      where,
      include: {
        employee: {
          include: {
            teamMemberships: {
              where: { isActive: true },
              include: { team: true },
            },
            positionAssignments: {
              where: { isActive: true },
              include: { position: true },
            },
          },
        },
      },
      orderBy: { overallScore: 'desc' },
    })
  }

  async findOne(employeeId: string, actor?: AuthenticatedUser) {
    if (actor && employeeId !== actor.id) {
      let canRead = false
      if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
        canRead = (
          await this.authz.checkAny(actor, ['performance:read_all', 'performance:read_team'])
        ).allowed
      } else {
        canRead =
          Boolean(actor.permissions?.includes('performance:read_all')) ||
          Boolean(actor.permissions?.includes('performance:read_team')) ||
          ['chro', 'cpo', 'ceo', 'cto', 'cfo', 'pm'].includes(actor.role.toLowerCase())
      }
      if (!canRead) {
        throw new ForbiddenException(
          'Access denied: You may only view your own performance record.',
        )
      }
    }

    const record = await this.prisma.performanceRecord.findFirst({
      where: { employeeId },
      include: {
        employee: true,
      },
    })
    if (!record) {
      throw new NotFoundException(`Performance record for employee "${employeeId}" not found`)
    }
    return record
  }

  async recordEvaluation(dto: RecordEvaluationDto, actor: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.userId } })
    if (!employee) throw new NotFoundException(`Employee "${dto.userId}" not found`)

    const scoreDecimal = new Prisma.Decimal(dto.score)
    const existing = await this.prisma.performanceRecord.findFirst({
      where: { employeeId: dto.userId },
    })

    return this.prisma.$transaction(async (tx) => {
      let record
      if (existing) {
        record = await tx.performanceRecord.update({
          where: { id: existing.id },
          data: {
            overallScore: scoreDecimal,
            codeQuality: scoreDecimal,
            performanceTier: dto.tier,
            evaluationNotes: dto.notes,
            strengths: dto.strengths || existing.strengths,
            improvements: dto.improvementAreas || existing.improvements,
            lastEvaluationDate: new Date(),
          },
        })
      } else {
        record = await tx.performanceRecord.create({
          data: {
            employeeId: dto.userId,
            overallScore: scoreDecimal,
            deliverySpeed: new Prisma.Decimal(90),
            codeQuality: scoreDecimal,
            reliability: new Prisma.Decimal(92),
            collaboration: new Prisma.Decimal(94),
            attendanceRate: new Prisma.Decimal(97),
            satisfactionIndex: new Prisma.Decimal(4.8),
            performanceTier: dto.tier,
            evaluationNotes: dto.notes,
            strengths: dto.strengths || ['High velocity', 'Reliable execution'],
            improvements: dto.improvementAreas || ['Cross-team mentorship'],
            weeklyHours: [40, 42, 39, 41],
            lastEvaluationDate: new Date(),
          },
        })
      }

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'PERFORMANCE_EVALUATION_RECORDED',
          actionCode: 'HR_EVALUATION_LOGGED',
          severity: 'INFO',
          entityType: 'user',
          entityId: dto.userId,
          entityTitle: employee.name,
          description: `CHRO recorded performance evaluation: Score ${dto.score}% (${dto.tier.replace(/_/g, ' ')})`,
          category: 'people',
          badgeColor: 'sky',
        },
      })

      return record
    })
  }

  async issueRecognition(dto: IssueRecognitionDto, actor: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.userId } })
    if (!employee) throw new NotFoundException(`Employee "${dto.userId}" not found`)

    // Optional bonus disbursement via finance service
    if (dto.bonusAmount && dto.bonusAmount > 0) {
      await this.financeService.issueAdjustment(
        {
          userId: dto.userId,
          amount: dto.bonusAmount,
          type: 'bonus',
          reason: `Award Citation: ${dto.title}`,
        },
        actor,
      )
    }

    await this.prisma.auditLog.create({
      data: {
        ipAddress: getCurrentRequestIp(),
        actorId: actor.id,
        actorName: actor.id,
        actorEmail: `${actor.id}@pointfex.internal`,
        actorRole: actor.role.toUpperCase(),
        action: 'EMPLOYEE_RECOGNITION_AWARDED',
        actionCode: 'HR_RECOGNITION_AWARDED',
        severity: 'SUCCESS',
        entityType: 'user',
        entityId: dto.userId,
        entityTitle: employee.name,
        description: `Recognized ${employee.name}: "${dto.title}" — ${dto.description}`,
        category: 'people',
        badgeColor: 'emerald',
      },
    })

    return { message: `Recognition "${dto.title}" awarded to ${employee.name}` }
  }

  async issueDisciplinary(dto: IssueDisciplinaryDto, actor: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.userId } })
    if (!employee) throw new NotFoundException(`Employee "${dto.userId}" not found`)

    // Optional penalty deduction via finance service
    if (dto.penaltyAmount && dto.penaltyAmount > 0) {
      await this.financeService.issueAdjustment(
        {
          userId: dto.userId,
          amount: dto.penaltyAmount,
          type: 'penalty',
          reason: `Disciplinary Action: ${dto.title}`,
        },
        actor,
      )
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.performanceRecord.findFirst({ where: { employeeId: dto.userId } })
      if (existing) {
        await tx.performanceRecord.update({
          where: { id: existing.id },
          data: {
            disciplinaryNotes: `${dto.title}: ${dto.description}`,
            performanceTier: 'needs_support',
          },
        })
      }

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'DISCIPLINARY_ACTION_RECORDED',
          actionCode: 'HR_DISCIPLINARY_RECORDED',
          severity: 'CRITICAL',
          entityType: 'user',
          entityId: dto.userId,
          entityTitle: employee.name,
          description: `Formal disciplinary action against ${employee.name}: "${dto.title}"`,
          category: 'people',
          badgeColor: 'rose',
        },
      })
    })

    return { message: `Disciplinary action recorded for ${employee.name}` }
  }
}
