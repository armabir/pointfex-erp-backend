import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import {
  AllocateDeveloperBudgetDto,
  AllocateProjectBudgetDto,
  RequestBudgetIncreaseDto,
  AdjudicateBudgetRequestDto,
  RejectBudgetRequestDto,
  IssueFinancialAdjustmentDto,
  ClientRevenueShareDto,
} from './dto/finance.dto'
import { Prisma } from '@prisma/client'
import { DemoUser } from '../common/demo-identity.guard'

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async getTreasury() {
    const treasury = await this.prisma.companyTreasury.findUnique({
      where: { id: 'singleton' },
    })
    if (!treasury) {
      throw new NotFoundException('Company treasury record not initialized')
    }
    return treasury
  }

  async getWallet(employeeId: string) {
    const wallet = await this.prisma.employeeWallet.findUnique({
      where: { employeeId },
      include: {
        employee: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!wallet) {
      throw new NotFoundException(`Wallet for employee "${employeeId}" not found`)
    }
    return wallet
  }

  async getAllWallets() {
    return this.prisma.employeeWallet.findMany({
      include: { employee: true },
      orderBy: { employeeId: 'asc' },
    })
  }

  async getTransactions(filters: {
    employeeId?: string
    projectId?: string
    type?: string
  }) {
    const where: any = {}
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (filters.projectId) where.projectId = filters.projectId
    if (filters.type) where.type = filters.type

    return this.prisma.financialTransaction.findMany({
      where,
      include: {
        project: true,
        wallet: {
          include: { employee: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getBudgetRequests(projectId?: string, status?: string) {
    const where: any = {}
    if (projectId) where.projectId = projectId
    if (status) where.status = status

    return this.prisma.budgetRequest.findMany({
      where,
      include: { project: true },
      orderBy: { requestedAt: 'desc' },
    })
  }

  // PM distributes project funds to developer (Rule 12 & 13)
  async allocateDeveloperBudget(dto: AllocateDeveloperBudgetDto, actor: DemoUser) {
    const allocAmount = new Prisma.Decimal(dto.amount)

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: dto.projectId } })
      if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`)

      const developer = await tx.employee.findUnique({ where: { id: dto.developerId } })
      if (!developer) throw new NotFoundException(`Developer "${dto.developerId}" not found`)

      // Compute remaining budget: project.budget - project.allocatedBudget
      const remainingBudget = Prisma.Decimal.sub(project.budget, project.allocatedBudget)

      if (allocAmount.greaterThan(remainingBudget)) {
        throw new BadRequestException(
          `Allocation rejected: Project has ৳${remainingBudget.toNumber().toLocaleString()} remaining (৳${allocAmount.toNumber().toLocaleString()} requested)`,
        )
      }

      // 1. Update project allocatedBudget
      const updatedProject = await tx.project.update({
        where: { id: dto.projectId },
        data: {
          allocatedBudget: { increment: allocAmount },
        },
      })

      // 2. Update developer wallet
      const wallet = await tx.employeeWallet.upsert({
        where: { employeeId: dto.developerId },
        update: {
          balance: { increment: allocAmount },
          totalEarnedToDate: { increment: allocAmount },
          lastPayoutDate: new Date(),
        },
        create: {
          employeeId: dto.developerId,
          balance: allocAmount,
          totalEarnedToDate: allocAmount,
          currency: 'BDT',
          currencySymbol: '৳',
          lastPayoutDate: new Date(),
        },
      })

      // 3. Update treasury totalDistributedToDevs
      await tx.companyTreasury.update({
        where: { id: 'singleton' },
        data: {
          totalDistributedToDevs: { increment: allocAmount },
        },
      })

      // 4. Create Transaction Ledger entry
      const txRecord = await tx.financialTransaction.create({
        data: {
          walletId: wallet.id,
          employeeId: dto.developerId,
          projectId: dto.projectId,
          amount: allocAmount,
          type: 'budget_allocation',
          description: dto.description || `Week ${dto.week || 3} sprint developer budget allocation`,
          status: 'allocated',
        },
      })

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'BUDGET_DISBURSED',
          actionCode: 'BUDGET_DISBURSED',
          severity: 'INFO',
          entityType: 'project',
          entityId: dto.projectId,
          entityTitle: project.name,
          description: `Disbursed ৳${allocAmount.toNumber().toLocaleString()} to ${developer.name} for ${project.name}`,
          category: 'finance',
          badgeColor: 'emerald',
        },
      })

      return {
        message: `Successfully allocated ৳${allocAmount.toNumber().toLocaleString()} to ${developer.name}`,
        project: updatedProject,
        transaction: txRecord,
      }
    })
  }

  // CFO allocates project budget pool from reserves (Rule 11 & 14)
  async allocateProjectBudget(dto: AllocateProjectBudgetDto, actor: DemoUser) {
    const newBudgetDecimal = new Prisma.Decimal(dto.newBudget)

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: dto.projectId } })
      if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`)

      const treasury = await tx.companyTreasury.findUnique({ where: { id: 'singleton' } })
      if (!treasury) throw new NotFoundException('Treasury not found')

      const delta = Prisma.Decimal.sub(newBudgetDecimal, project.budget)

      // If increasing budget, verify unallocated liquid reserves
      if (delta.greaterThan(0) && delta.greaterThan(treasury.unallocatedReserves)) {
        throw new BadRequestException(
          `Treasury reserves insufficient: Only ৳${treasury.unallocatedReserves.toNumber().toLocaleString()} unallocated reserves available (৳${delta.toNumber().toLocaleString()} requested)`,
        )
      }

      // 1. Update Project budget
      const updatedProject = await tx.project.update({
        where: { id: dto.projectId },
        data: { budget: newBudgetDecimal },
      })

      // 2. Update Treasury
      await tx.companyTreasury.update({
        where: { id: 'singleton' },
        data: {
          totalApprovedBudgets: { increment: delta },
          unallocatedReserves: { decrement: delta },
        },
      })

      // 3. Create Transaction Ledger entry
      await tx.financialTransaction.create({
        data: {
          projectId: dto.projectId,
          amount: delta,
          type: 'budget_allocation',
          description: dto.reason || `CFO budget pool adjustment for ${project.name}`,
          status: 'completed',
        },
      })

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'PROJECT_BUDGET_ADJUSTED',
          actionCode: 'CAPITAL_ALLOCATION_UPDATED',
          severity: 'INFO',
          entityType: 'project',
          entityId: dto.projectId,
          entityTitle: project.name,
          description: `Adjusted budget pool for ${project.name} to ৳${newBudgetDecimal.toNumber().toLocaleString()} (${delta.greaterThanOrEqualTo(0) ? '+' : ''}৳${delta.toNumber().toLocaleString()})`,
          category: 'finance',
          badgeColor: 'emerald',
        },
      })

      return updatedProject
    })
  }

  // PM requests budget increase from CFO
  async requestBudgetIncrease(dto: RequestBudgetIncreaseDto, actor: DemoUser) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } })
    if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`)

    const requestedAmount = new Prisma.Decimal(dto.amount)

    return this.prisma.$transaction(async (tx) => {
      const budgetReq = await tx.budgetRequest.create({
        data: {
          projectId: dto.projectId,
          requesterId: actor.id,
          requestedAmount,
          reason: dto.reason,
          status: 'pending',
        },
        include: { project: true },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'BUDGET_REQUEST_LOGGED',
          actionCode: 'BUDGET_REQUEST_LOGGED',
          severity: 'INFO',
          entityType: 'project',
          entityId: dto.projectId,
          entityTitle: project.name,
          description: `PM requested budget increase of ৳${requestedAmount.toNumber().toLocaleString()} for ${project.name}`,
          category: 'finance',
          badgeColor: 'amber',
        },
      })

      return budgetReq
    })
  }

  // CFO approves budget request
  async approveBudgetRequest(requestId: string, dto: AdjudicateBudgetRequestDto, actor: DemoUser) {
    const approvedAmount = new Prisma.Decimal(dto.approvedAmount)

    return this.prisma.$transaction(async (tx) => {
      const req = await tx.budgetRequest.findUnique({
        where: { id: requestId },
        include: { project: true },
      })
      if (!req) throw new NotFoundException(`Budget request "${requestId}" not found`)

      const treasury = await tx.companyTreasury.findUnique({ where: { id: 'singleton' } })
      if (!treasury) throw new NotFoundException('Treasury not found')

      if (approvedAmount.greaterThan(treasury.unallocatedReserves)) {
        throw new BadRequestException(
          `Approval exceeds unallocated reserves: Only ৳${treasury.unallocatedReserves.toNumber().toLocaleString()} available`,
        )
      }

      // 1. Update Project budget
      await tx.project.update({
        where: { id: req.projectId },
        data: { budget: { increment: approvedAmount } },
      })

      // 2. Update Treasury
      await tx.companyTreasury.update({
        where: { id: 'singleton' },
        data: {
          totalApprovedBudgets: { increment: approvedAmount },
          unallocatedReserves: { decrement: approvedAmount },
        },
      })

      // 3. Update Request status
      const updatedReq = await tx.budgetRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          approvedAmount,
          feedback: dto.feedback || `Approved in full by CFO: +৳${approvedAmount.toNumber().toLocaleString()} added to project budget.`,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      })

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'BUDGET_REQUEST_APPROVED',
          actionCode: 'BUDGET_REQUEST_GRANTED',
          severity: 'SUCCESS',
          entityType: 'project',
          entityId: req.projectId,
          entityTitle: req.project.name,
          description: `CFO approved +৳${approvedAmount.toNumber().toLocaleString()} budget increase for ${req.project.name}`,
          category: 'finance',
          badgeColor: 'emerald',
        },
      })

      return updatedReq
    })
  }

  // CFO rejects budget request
  async rejectBudgetRequest(requestId: string, dto: RejectBudgetRequestDto, actor: DemoUser) {
    const req = await this.prisma.budgetRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException(`Budget request "${requestId}" not found`)

    return this.prisma.$transaction(async (tx) => {
      const updatedReq = await tx.budgetRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          feedback: dto.feedback,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'BUDGET_REQUEST_REJECTED',
          actionCode: 'BUDGET_REQUEST_DENIED',
          severity: 'WARNING',
          entityType: 'project',
          entityId: req.projectId,
          description: `CFO rejected budget request: "${dto.feedback}"`,
          category: 'finance',
          badgeColor: 'rose',
        },
      })

      return updatedReq
    })
  }

  // Issue bonus or penalty
  async issueAdjustment(dto: IssueFinancialAdjustmentDto, actor: DemoUser) {
    const amountDecimal = new Prisma.Decimal(dto.amount)

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.employee.findUnique({ where: { id: dto.userId } })
      if (!user) throw new NotFoundException(`Employee "${dto.userId}" not found`)

      const wallet = await tx.employeeWallet.findUnique({ where: { employeeId: dto.userId } })

      if (dto.type === 'bonus') {
        const treasury = await tx.companyTreasury.findUnique({ where: { id: 'singleton' } })
        if (treasury && amountDecimal.greaterThan(treasury.unallocatedReserves)) {
          throw new BadRequestException(
            `Bonus exceeds available unallocated reserves (৳${treasury.unallocatedReserves.toNumber().toLocaleString()} available)`,
          )
        }

        // Increment wallet
        await tx.employeeWallet.upsert({
          where: { employeeId: dto.userId },
          update: {
            balance: { increment: amountDecimal },
            totalEarnedToDate: { increment: amountDecimal },
            sprintBonusEarned: { increment: amountDecimal },
          },
          create: {
            employeeId: dto.userId,
            balance: amountDecimal,
            totalEarnedToDate: amountDecimal,
            sprintBonusEarned: amountDecimal,
            currency: 'BDT',
            currencySymbol: '৳',
          },
        })

        // Decrement treasury reserves and increment distributed
        await tx.companyTreasury.update({
          where: { id: 'singleton' },
          data: {
            unallocatedReserves: { decrement: amountDecimal },
            totalDistributedToDevs: { increment: amountDecimal },
          },
        })
      } else {
        // Penalty: deduct from balance down to minimum 0
        const currentBalance = wallet ? wallet.balance : new Prisma.Decimal(0)
        const deduction = Prisma.Decimal.min(currentBalance, amountDecimal)

        await tx.employeeWallet.upsert({
          where: { employeeId: dto.userId },
          update: {
            balance: { decrement: deduction },
            totalPenalties: { increment: amountDecimal },
          },
          create: {
            employeeId: dto.userId,
            balance: new Prisma.Decimal(0),
            totalPenalties: amountDecimal,
            currency: 'BDT',
            currencySymbol: '৳',
          },
        })
      }

      // Ledger entry
      const txRecord = await tx.financialTransaction.create({
        data: {
          employeeId: dto.userId,
          amount: dto.type === 'bonus' ? amountDecimal : Prisma.Decimal.mul(amountDecimal, -1),
          type: dto.type === 'bonus' ? 'bonus' : 'penalty',
          description: dto.reason,
          status: dto.type === 'bonus' ? 'completed' : 'deducted',
          reason: dto.reason,
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: dto.type === 'bonus' ? 'BONUS_ISSUED' : 'PENALTY_ISSUED',
          actionCode: dto.type === 'bonus' ? 'PERFORMANCE_BONUS_DISBURSED' : 'DISCIPLINARY_DEDUCTION_APPLIED',
          severity: dto.type === 'bonus' ? 'SUCCESS' : 'WARNING',
          entityType: 'user',
          entityId: dto.userId,
          entityTitle: user.name,
          description: `${dto.type.toUpperCase()}: ৳${amountDecimal.toNumber().toLocaleString()} to ${user.name} (${dto.reason})`,
          category: 'finance',
          badgeColor: dto.type === 'bonus' ? 'emerald' : 'amber',
        },
      })

      return {
        message: `Issued ৳${amountDecimal.toNumber().toLocaleString()} ${dto.type} to ${user.name}`,
        transaction: txRecord,
      }
    })
  }

  // Commercial Client Revenue Sharing (50% acquirer, 50% squad developers)
  async processClientRevenueShare(dto: ClientRevenueShareDto, actor: DemoUser) {
    const totalRev = new Prisma.Decimal(dto.clientRevenueAmount)

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: dto.projectId },
        include: {
          teamProjects: {
            where: { isActive: true },
            include: {
              team: {
                include: {
                  memberships: {
                    where: { isActive: true },
                    include: { employee: true },
                  },
                },
              },
            },
          },
        },
      })
      if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`)

      const acquirer = await tx.employee.findUnique({ where: { id: dto.acquirerEmployeeId } })
      if (!acquirer) throw new NotFoundException(`Acquirer "${dto.acquirerEmployeeId}" not found`)

      // 50% to Acquirer
      const acquirerShare = Prisma.Decimal.div(totalRev, 2)
      // 50% to Developers
      const squadShareTotal = Prisma.Decimal.div(totalRev, 2)

      const activeTeam = project.teamProjects[0]?.team
      const squadDevelopers = activeTeam?.memberships.map((m) => m.employee) || []

      // 1. Credit Acquirer
      await tx.employeeWallet.upsert({
        where: { employeeId: dto.acquirerEmployeeId },
        update: {
          balance: { increment: acquirerShare },
          totalEarnedToDate: { increment: acquirerShare },
        },
        create: {
          employeeId: dto.acquirerEmployeeId,
          balance: acquirerShare,
          totalEarnedToDate: acquirerShare,
          currency: 'BDT',
          currencySymbol: '৳',
        },
      })

      await tx.financialTransaction.create({
        data: {
          employeeId: dto.acquirerEmployeeId,
          projectId: dto.projectId,
          amount: acquirerShare,
          type: 'client_revenue_share',
          description: `Client Acquisition Revenue Share (50%): ${project.name}`,
          status: 'completed',
        },
      })

      // 2. Disburse evenly among squad developers
      if (squadDevelopers.length > 0) {
        const perDevShare = Prisma.Decimal.div(squadShareTotal, squadDevelopers.length)

        for (const dev of squadDevelopers) {
          await tx.employeeWallet.upsert({
            where: { employeeId: dev.id },
            update: {
              balance: { increment: perDevShare },
              totalEarnedToDate: { increment: perDevShare },
            },
            create: {
              employeeId: dev.id,
              balance: perDevShare,
              totalEarnedToDate: perDevShare,
              currency: 'BDT',
              currencySymbol: '৳',
            },
          })

          await tx.financialTransaction.create({
            data: {
              employeeId: dev.id,
              projectId: dto.projectId,
              amount: perDevShare,
              type: 'client_revenue_share',
              description: `Squad Client Project Revenue Share (50% pool): ${project.name}`,
              status: 'completed',
            },
          })
        }
      }

      // 3. Update project clientRevenue and Treasury clientRevenue
      await tx.project.update({
        where: { id: dto.projectId },
        data: { clientRevenue: { increment: totalRev } },
      })

      await tx.companyTreasury.update({
        where: { id: 'singleton' },
        data: { totalClientRevenue: { increment: totalRev } },
      })

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'CLIENT_REVENUE_SHARED',
          actionCode: 'REVENUE_SHARE_DISBURSED',
          severity: 'SUCCESS',
          entityType: 'project',
          entityId: dto.projectId,
          entityTitle: project.name,
          description: `Disbursed ৳${totalRev.toNumber().toLocaleString()} client revenue: 50% to ${acquirer.name}, 50% to ${squadDevelopers.length} developers`,
          category: 'finance',
          badgeColor: 'emerald',
        },
      })

      return {
        message: `Client revenue share processed successfully for ${project.name}`,
        acquirerShare: acquirerShare.toNumber(),
        squadShareTotal: squadShareTotal.toNumber(),
      }
    })
  }
}

