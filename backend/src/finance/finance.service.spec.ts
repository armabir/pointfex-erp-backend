import { Test, TestingModule } from '@nestjs/testing'
import { FinanceService } from './finance.service'
import { PrismaService } from '../common/prisma.service'
import { BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

describe('FinanceService - Financial Constraints & Ledger Integrity', () => {
  let service: FinanceService
  let prisma: any

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      companyTreasury: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
      },
      employeeWallet: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      financialTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      budgetRequest: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [FinanceService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<FinanceService>(FinanceService)
  })

  describe('PM Developer Budget Allocation Constraint', () => {
    it('should reject allocation if amount exceeds remaining project budget', async () => {
      // Project budget ৳45,000, already allocated ৳40,000 => Remaining is ৳5,000
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj_01',
        budget: new Prisma.Decimal(45000),
        allocatedBudget: new Prisma.Decimal(40000),
      })
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp_dev_01',
        name: 'Arifur Rahman',
      })

      // PM attempts to allocate ৳6,000 (exceeds remaining ৳5,000)
      await expect(
        service.allocateDeveloperBudget(
          {
            developerId: 'emp_dev_01',
            projectId: 'proj_01',
            amount: 6000,
          },
          { id: 'emp_pm_01', role: 'pm' },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should succeed and disburse if amount is within remaining project budget', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj_01',
        budget: new Prisma.Decimal(45000),
        allocatedBudget: new Prisma.Decimal(35000),
      })
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp_dev_01',
        name: 'Arifur Rahman',
      })
      prisma.project.update.mockResolvedValue({
        id: 'proj_01',
        allocatedBudget: new Prisma.Decimal(40000),
      })
      prisma.employeeWallet.upsert.mockResolvedValue({
        id: 'wal_01',
        balance: new Prisma.Decimal(15000),
      })
      prisma.financialTransaction.create.mockResolvedValue({
        id: 'tx_01',
        amount: new Prisma.Decimal(5000),
      })

      const result = await service.allocateDeveloperBudget(
        {
          developerId: 'emp_dev_01',
          projectId: 'proj_01',
          amount: 5000,
        },
        { id: 'emp_pm_01', role: 'pm' },
      )

      expect(result.message).toContain('Successfully allocated')
      expect(prisma.project.update).toHaveBeenCalled()
      expect(prisma.employeeWallet.upsert).toHaveBeenCalled()
      expect(prisma.financialTransaction.create).toHaveBeenCalled()
    })
  })

  describe('CFO Project Budget Pool Constraint', () => {
    it('should reject budget adjustment if delta exceeds unallocated liquid reserves', async () => {
      // Project budget ৳30,000, target new budget ৳60,000 (delta +৳30,000)
      // Treasury unallocated reserves: ৳20,000 (less than ৳30,000 delta)
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj_01',
        name: 'Unseen Bangladesh',
        budget: new Prisma.Decimal(30000),
      })
      prisma.companyTreasury.findUnique.mockResolvedValue({
        id: 'singleton',
        unallocatedReserves: new Prisma.Decimal(20000),
      })

      await expect(
        service.allocateProjectBudget(
          {
            projectId: 'proj_01',
            newBudget: 60000,
          },
          { id: 'emp_cfo_01', role: 'cfo' },
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('Discretionary Bonus & Penalty Bounds', () => {
    it('should disburse bonus, decrement liquid reserves and credit wallet', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp_dev_01',
        name: 'Arifur Rahman',
      })
      prisma.employeeWallet.findUnique.mockResolvedValue({
        employeeId: 'emp_dev_01',
        balance: new Prisma.Decimal(10000),
      })
      prisma.companyTreasury.findUnique.mockResolvedValue({
        id: 'singleton',
        unallocatedReserves: new Prisma.Decimal(50000),
      })
      prisma.financialTransaction.create.mockResolvedValue({
        id: 'tx_bonus',
      })

      const res = await service.issueAdjustment(
        {
          userId: 'emp_dev_01',
          amount: 5000,
          type: 'bonus',
          reason: 'Outstanding Performance Accolade',
        },
        { id: 'emp_cfo_01', role: 'cfo' },
      )

      expect(res.message).toContain('bonus to Arifur Rahman')
      expect(prisma.employeeWallet.upsert).toHaveBeenCalled()
      expect(prisma.companyTreasury.update).toHaveBeenCalled()
    })

    it('should prevent negative wallet balances on penalty deductions', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp_dev_01',
        name: 'Arifur Rahman',
      })
      // Developer has ৳1,000 balance, penalty is ৳3,000 => balance cannot drop below 0
      prisma.employeeWallet.findUnique.mockResolvedValue({
        employeeId: 'emp_dev_01',
        balance: new Prisma.Decimal(1000),
      })
      prisma.financialTransaction.create.mockResolvedValue({
        id: 'tx_pen',
      })

      await service.issueAdjustment(
        {
          userId: 'emp_dev_01',
          amount: 3000,
          type: 'penalty',
          reason: 'SLA Breach',
        },
        { id: 'emp_chro_01', role: 'chro' },
      )

      expect(prisma.employeeWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            balance: { decrement: new Prisma.Decimal(1000) }, // Deducts at most current balance
            totalPenalties: { increment: new Prisma.Decimal(3000) },
          }),
        }),
      )
    })
  })
})
