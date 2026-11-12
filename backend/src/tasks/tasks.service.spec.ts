import { Test, TestingModule } from '@nestjs/testing'
import { TasksService } from './tasks.service'
import { PrismaService } from '../common/prisma.service'
import { ForbiddenException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

describe('TasksService - Kanban State Transitions & Approval Gate', () => {
  let service: TasksService
  let prisma: any

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      task: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      taskComment: {
        create: jest.fn(),
      },
      employeeWallet: {
        upsert: jest.fn(),
      },
      financialTransaction: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      companyTreasury: {
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<TasksService>(TasksService)
  })

  describe('Developer Permission Gate on Completed Status', () => {
    it('should throw ForbiddenException if a developer attempts to mark a task as completed', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_01',
        title: 'Build GIS Component',
        status: 'in_review',
        assignee: { id: 'emp_dev_01' },
      })

      // Developer tries to mark completed directly
      await expect(
        service.updateStatus(
          'task_01',
          { status: 'completed' },
          { id: 'emp_dev_01', role: 'developer' },
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('should allow developer to transition task to in_review', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_01',
        title: 'Build GIS Component',
        status: 'in_progress',
      })
      prisma.task.update.mockResolvedValue({
        id: 'task_01',
        status: 'in_review',
      })

      const res = await service.updateStatus(
        'task_01',
        { status: 'in_review' },
        { id: 'emp_dev_01', role: 'developer' },
      )

      expect(res.status).toBe('in_review')
    })
  })

  describe('Task Approval & Milestone Payout Flow', () => {
    it('should complete task, credit developer wallet, and log double-entry transaction', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_01',
        title: 'Build GIS Component',
        projectId: 'proj_01',
        assigneeId: 'emp_dev_01',
        status: 'in_review',
        milestone: {
          id: 'ms_01',
          payoutAmount: new Prisma.Decimal(8000),
        },
      })
      prisma.task.update.mockResolvedValue({
        id: 'task_01',
        status: 'completed',
      })
      prisma.financialTransaction.findFirst.mockResolvedValue(null) // No prior payout

      const res = await service.approve(
        'task_01',
        { feedback: 'Excellent delivery and test coverage' },
        { id: 'emp_pm_01', role: 'pm' },
      )

      expect(res.status).toBe('completed')
      expect(prisma.taskComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: expect.stringContaining('Excellent delivery'),
          }),
        }),
      )
      expect(prisma.employeeWallet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeId: 'emp_dev_01' },
          update: expect.objectContaining({
            balance: { increment: new Prisma.Decimal(8000) },
          }),
        }),
      )
      expect(prisma.financialTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'milestone_payout',
            amount: new Prisma.Decimal(8000),
          }),
        }),
      )
    })
  })

  describe('Task Rejection Flow', () => {
    it('should return task to in_progress and record review feedback', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task_01',
        title: 'Build GIS Component',
        status: 'in_review',
      })
      prisma.task.update.mockResolvedValue({
        id: 'task_01',
        status: 'in_progress',
      })

      const res = await service.reject(
        'task_01',
        { feedback: 'Fix mobile viewport layout shift before approval' },
        { id: 'emp_pm_01', role: 'pm' },
      )

      expect(res.status).toBe('in_progress')
      expect(prisma.taskComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: expect.stringContaining('Fix mobile viewport'),
          }),
        }),
      )
    })
  })
})
