import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import {
  RecordEvaluationDto,
  IssueRecognitionDto,
  IssueDisciplinaryDto,
} from './dto/performance.dto'
import { Prisma } from '@prisma/client'
import { DemoUser } from '../common/demo-identity.guard'
import { FinanceService } from '../finance/finance.service'

@Injectable()
export class PerformanceService {
  constructor(
    private prisma: PrismaService,
    private financeService: FinanceService,
  ) {}

  async findAll() {
    return this.prisma.performanceRecord.findMany({
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

  async findOne(employeeId: string) {
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

  async recordEvaluation(dto: RecordEvaluationDto, actor: DemoUser) {
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

  async issueRecognition(dto: IssueRecognitionDto, actor: DemoUser) {
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

  async issueDisciplinary(dto: IssueDisciplinaryDto, actor: DemoUser) {
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

