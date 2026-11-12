import { getCurrentRequestIp } from '../common/ip-address.util'
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuthorizationService } from '../rbac/authorization.service'
import { SodValidatorService } from '../rbac/sod-validator.service'
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
import { AuthenticatedUser } from '../common/auth-user.interface'

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly authz?: AuthorizationService,
    @Optional() private readonly sodValidator?: SodValidatorService,
  ) {}

  async getTreasury() {
    const treasury = await this.prisma.companyTreasury.findUnique({
      where: { id: 'singleton' },
    })
    if (!treasury) {
      throw new NotFoundException('Company treasury record not initialized')
    }
    return treasury
  }

  async getWallet(employeeId: string, actor?: AuthenticatedUser) {
    let canReadAll = !actor || employeeId === actor.id
    if (!canReadAll && actor) {
      if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
        canReadAll = (await this.authz.check(actor, 'wallets:read_all')).allowed
      } else {
        canReadAll =
          Boolean(actor.permissions?.includes('wallets:read_all')) ||
          ['cfo', 'ceo'].includes(actor.role.toLowerCase())
      }
    }

    if (!canReadAll) {
      throw new ForbiddenException('Access denied: You can only view your own compensation wallet.')
    }

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

  async getTransactions(
    filters: { employeeId?: string; projectId?: string; type?: string },
    actor?: AuthenticatedUser,
  ) {
    const where: Prisma.FinancialTransactionWhereInput = {}
    let canReadAll = !actor
    if (actor) {
      if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
        canReadAll = (await this.authz.check(actor, 'transactions:read_all')).allowed
      } else {
        canReadAll =
          Boolean(actor.permissions?.includes('transactions:read_all')) ||
          ['cfo', 'ceo'].includes(actor.role.toLowerCase())
      }
    }

    if (!canReadAll && actor) {
      where.employeeId = actor.id
    } else if (filters.employeeId) {
      where.employeeId = filters.employeeId
    }

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
    const where: Prisma.BudgetRequestWhereInput = {}
    if (projectId) where.projectId = projectId
    if (status) where.status = status

    return this.prisma.budgetRequest.findMany({
      where,
      include: { project: true },
      orderBy: { requestedAt: 'desc' },
    })
  }

  // PM distributes project funds to developer (Rule 12 & 13)
  async allocateDeveloperBudget(dto: AllocateDeveloperBudgetDto, actor: AuthenticatedUser) {
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
          description:
            dto.description || `Week ${dto.week || 3} sprint developer budget allocation`,
          status: 'allocated',
        },
      })

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
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
  async allocateProjectBudget(dto: AllocateProjectBudgetDto, actor: AuthenticatedUser) {
    const newBudgetDecimal = new Prisma.Decimal(dto.newBudget)

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: dto.projectId } })
      if (!project) throw new NotFoundException(`Project "${dto.projectId}" not found`)

      if (
        project.allocatedBudget !== undefined &&
        newBudgetDecimal.lessThan(project.allocatedBudget)
      ) {
        throw new BadRequestException(
          `New budget (৳${newBudgetDecimal.toNumber().toLocaleString()}) cannot be lower than already allocated amount (৳${new Prisma.Decimal(project.allocatedBudget).toNumber().toLocaleString()})`,
        )
      }

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
          ipAddress: getCurrentRequestIp(),
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
  async requestBudgetIncrease(dto: RequestBudgetIncreaseDto, actor: AuthenticatedUser) {
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
          ipAddress: getCurrentRequestIp(),
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
  async approveBudgetRequest(
    requestId: string,
    dto: AdjudicateBudgetRequestDto,
    actor: AuthenticatedUser,
  ) {
    const approvedAmount = new Prisma.Decimal(dto.approvedAmount)

    return this.prisma.$transaction(async (tx) => {
      const req = await tx.budgetRequest.findUnique({
        where: { id: requestId },
        include: { project: true },
      })
      if (!req) throw new NotFoundException(`Budget request "${requestId}" not found`)
      if (req.status && req.status !== 'pending') {
        throw new BadRequestException(
          `Budget request "${requestId}" has already been ${req.status}`,
        )
      }
      if (req.requesterId && req.requesterId === actor.id) {
        throw new ForbiddenException(
          'Separation of duties: You cannot approve your own budget increase request.',
        )
      }
      this.sodValidator?.assertMoneyAuthorityMatch('BUDGET_ALLOCATION', 'budgets:approve_request')

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
          feedback:
            dto.feedback ||
            `Approved in full by CFO: +৳${approvedAmount.toNumber().toLocaleString()} added to project budget.`,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      })

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
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
  async rejectBudgetRequest(
    requestId: string,
    dto: RejectBudgetRequestDto,
    actor: AuthenticatedUser,
  ) {
    const req = await this.prisma.budgetRequest.findUnique({ where: { id: requestId } })
    if (!req) throw new NotFoundException(`Budget request "${requestId}" not found`)
    if (req.status && req.status !== 'pending') {
      throw new BadRequestException(`Budget request "${requestId}" has already been ${req.status}`)
    }

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
          ipAddress: getCurrentRequestIp(),
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
  async issueAdjustment(dto: IssueFinancialAdjustmentDto, actor: AuthenticatedUser) {
    const amountDecimal = new Prisma.Decimal(dto.amount)

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.employee.findUnique({ where: { id: dto.userId } })
      if (!user) throw new NotFoundException(`Employee "${dto.userId}" not found`)

      const wallet = await tx.employeeWallet.findUnique({ where: { employeeId: dto.userId } })

      let updatedWallet: any = wallet
      if (dto.type === 'bonus') {
        const treasury = await tx.companyTreasury.findUnique({ where: { id: 'singleton' } })
        if (treasury && amountDecimal.greaterThan(treasury.unallocatedReserves)) {
          throw new BadRequestException(
            `Bonus exceeds available unallocated reserves (৳${treasury.unallocatedReserves.toNumber().toLocaleString()} available)`,
          )
        }

        // Increment wallet
        updatedWallet = await tx.employeeWallet.upsert({
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

        updatedWallet = await tx.employeeWallet.upsert({
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
          walletId: updatedWallet?.id || wallet?.id,
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
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: dto.type === 'bonus' ? 'BONUS_ISSUED' : 'PENALTY_ISSUED',
          actionCode:
            dto.type === 'bonus' ? 'PERFORMANCE_BONUS_DISBURSED' : 'DISCIPLINARY_DEDUCTION_APPLIED',
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
  async processClientRevenueShare(dto: ClientRevenueShareDto, actor: AuthenticatedUser) {
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
      const acqWallet = await tx.employeeWallet.upsert({
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
          walletId: acqWallet?.id,
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
          const devWallet = await tx.employeeWallet.upsert({
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
              walletId: devWallet?.id,
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
          ipAddress: getCurrentRequestIp(),
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

  /**
   * Append-only financial ledger reversal (Hard Rule 9):
   * Corrections are recorded as a new offsetting reversal entry, never updating/deleting existing rows.
   */
  async reverseTransaction(transactionId: string, reason: string, actor: AuthenticatedUser) {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A reversal reason (at least 3 characters) is required')
    }
    this.sodValidator?.assertMoneyAuthorityMatch('INTERNAL_LEDGER', 'transactions:reverse')

    return this.prisma.$transaction(async (tx) => {
      const original = await tx.financialTransaction.findUnique({ where: { id: transactionId } })
      if (!original) {
        throw new NotFoundException(`Financial transaction "${transactionId}" not found`)
      }
      if (original.type === 'reversal') {
        throw new BadRequestException('Cannot reverse a transaction that is already a reversal')
      }

      const existingReversal = await tx.financialTransaction.findFirst({
        where: { reversalOfId: transactionId },
      })
      if (existingReversal) {
        throw new BadRequestException(
          `Transaction "${transactionId}" has already been reversed by "${existingReversal.id}"`,
        )
      }

      const reverseAmount = new Prisma.Decimal(original.amount).negated()
      if (original.walletId) {
        await tx.employeeWallet.update({
          where: { id: original.walletId },
          data: { balance: { increment: reverseAmount } },
        })
      }

      const reversalTx = await tx.financialTransaction.create({
        data: {
          walletId: original.walletId,
          employeeId: original.employeeId,
          projectId: original.projectId,
          milestoneId: original.milestoneId,
          amount: reverseAmount,
          type: 'reversal',
          description: `Reversal of [${original.id}] (${original.type}): ${reason.trim()}`,
          status: 'completed',
          reason: reason.trim(),
          reversalOfId: original.id,
        },
      })

      return { reversed: true, originalTransactionId: original.id, reversalTransaction: reversalTx }
    })
  }
}
