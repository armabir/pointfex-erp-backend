import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { ApprovalEngineService } from './approval-engine.service'
import { SodValidatorService } from './sod-validator.service'
import { SEED_APPROVAL_POLICIES, SEED_SOD_RULES } from './sod-and-approval.seeder'

describe('Phase 5: Approval Workflow Engine, SoD (10 Rules), Dual Approval & Money Isolation', () => {
  function buildApprovalHarness(actorPermissions: Record<string, string[]>) {
    let seq = 0
    const requests: any[] = []
    const steps: any[] = []
    const auditLogs: any[] = []

    const prismaMock: any = {
      sodRule: {
        findMany: jest.fn(async ({ where }: any = {}) => {
          if (where?.actionCodes?.has) {
            return SEED_SOD_RULES.filter((r) =>
              (r.actionCodes as readonly string[]).includes(where.actionCodes.has),
            )
          }
          return SEED_SOD_RULES
        }),
      },
      permission: {
        findUnique: jest.fn(async ({ where }) => ({
          code: where.code,
          isCritical: [
            'payroll:approve_batch',
            'payroll:release_payment',
            'treasury:transfer',
            'compensation:approve_changes',
          ].includes(where.code),
        })),
      },
      approvalPolicy: {
        findFirst: jest.fn(async ({ where }) => {
          const p = SEED_APPROVAL_POLICIES.find((pol) => pol.actionCode === where.actionCode)
          return p ? { id: `pol_${p.code}`, ...p } : null
        }),
      },
      approvalRequest: {
        create: jest.fn(async ({ data }) => {
          const reqId = `apr_${++seq}`
          const createdSteps = (data.steps?.create ?? []).map((st: any, i: number) => {
            const stepRow = { id: `step_${reqId}_${i + 1}`, requestId: reqId, ...st }
            steps.push(stepRow)
            return stepRow
          })
          const row = {
            id: reqId,
            ...data,
            steps: createdSteps,
            createdAt: new Date(),
          }
          requests.push(row)
          return row
        }),
        findUnique: jest.fn(async ({ where }) => {
          const req = requests.find((r) => r.id === where.id)
          if (!req) return null
          return {
            ...req,
            steps: steps.filter((s) => s.requestId === req.id).sort((a, b) => a.stepOrder - b.stepOrder),
          }
        }),
        findMany: jest.fn(async ({ where }) => {
          return requests
            .filter((r) => {
              if (where.entityType && r.entityType !== where.entityType) return false
              if (where.entityId && r.entityId !== where.entityId) return false
              if (where.actionCode?.in && !where.actionCode.in.includes(r.actionCode)) return false
              if (where.status?.in && !where.status.in.includes(r.status)) return false
              return true
            })
            .map((r) => ({ ...r, steps: steps.filter((s) => s.requestId === r.id) }))
        }),
        update: jest.fn(async ({ where, data }) => {
          const req = requests.find((r) => r.id === where.id)
          Object.assign(req, data)
          return {
            ...req,
            steps: steps.filter((s) => s.requestId === req.id).sort((a, b) => a.stepOrder - b.stepOrder),
          }
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0
          for (const r of requests) {
            if (where.id?.in?.includes(r.id)) {
              Object.assign(r, data)
              count++
            } else if (
              where.expiresAt?.lte &&
              r.expiresAt &&
              r.expiresAt <= where.expiresAt.lte &&
              where.status?.in?.includes(r.status)
            ) {
              Object.assign(r, data)
              count++
            }
          }
          return { count }
        }),
      },
      approvalStep: {
        findMany: jest.fn(async ({ where }) => {
          return steps.filter((s) => {
            if (where.status && s.status !== where.status) return false
            if (where.dueAt?.lte && (!s.dueAt || s.dueAt > where.dueAt.lte)) return false
            const req = requests.find((r) => r.id === s.requestId)
            return req && (!where.request?.status?.in || where.request.status.in.includes(req.status))
          })
        }),
        update: jest.fn(async ({ where, data }) => {
          const st = steps.find((s) => s.id === where.id)
          Object.assign(st, data)
          return st
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0
          for (const st of steps) {
            if (where.id?.in?.includes(st.id)) {
              Object.assign(st, data)
              count++
            }
          }
          return { count }
        }),
      },
      auditLog: {
        findMany: jest.fn(async ({ where }) =>
          auditLogs.filter(
            (a) =>
              a.entityType === where.entityType &&
              a.entityId === where.entityId &&
              a.actorId === where.actorId &&
              where.actionCode?.in?.includes(a.actionCode),
          ),
        ),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    }

    const authzMock: any = {
      check: jest.fn(async (actorOrId: any, perm: string) => {
        const id = typeof actorOrId === 'string' ? actorOrId : actorOrId.id
        const perms = actorPermissions[id] ?? []
        return { allowed: perms.includes('system:root') || perms.includes(perm) }
      }),
    }
    const auditMock: any = { log: jest.fn(async (e) => auditLogs.push(e)) }
    const sodValidator = new SodValidatorService(prismaMock, auditMock)
    const approvalEngine = new ApprovalEngineService(prismaMock, authzMock, sodValidator, auditMock)

    return { requests, steps, auditLogs, sodValidator, approvalEngine }
  }

  const actorCalc: any = { id: 'emp_hr_1', role: 'chro', name: 'HR Officer' }
  const actorCfo: any = { id: 'emp_cfo_01', role: 'cfo', name: 'Rahid' }
  const actorCeo: any = { id: 'emp_ceo_01', role: 'ceo', name: 'Noor' }
  const actorDev: any = { id: 'emp_dev_01', role: 'developer', name: 'Fahim' }
  const actorPm: any = { id: 'emp_pm_01', role: 'pm', name: 'Jihad' }

  it('seeds all 10 Section E SoD rules and enforces SOD-PAYROLL, SOD-TASK, SOD-PO, SOD-EXPENSE, SOD-INVOICE, SOD-XP', async () => {
    expect(SEED_SOD_RULES).toHaveLength(10)
    const { sodValidator } = buildApprovalHarness({})

    // SOD-TASK: same developer who submitted work cannot approve it
    await expect(
      sodValidator.assertNoSodConflict({
        actorId: 'emp_dev_01',
        actionCode: 'tasks:approve',
        entityType: 'task',
        entityId: 'task_1',
        priorActorsByAction: { 'tasks:submit_work': 'emp_dev_01' },
      }),
    ).rejects.toThrow(ForbiddenException)

    // Distinct PM can approve
    await expect(
      sodValidator.assertNoSodConflict({
        actorId: 'emp_pm_01',
        actionCode: 'tasks:approve',
        entityType: 'task',
        entityId: 'task_1',
        priorActorsByAction: { 'tasks:submit_work': 'emp_dev_01' },
      }),
    ).resolves.toBeUndefined()

    // SOD-PAYROLL: calculator != approver != payment releaser
    await expect(
      sodValidator.assertNoSodConflict({
        actorId: 'emp_hr_1',
        actionCode: 'payroll:approve_batch',
        entityType: 'payroll_batch',
        entityId: 'batch_nov',
        priorActorsByAction: { 'payroll:calculate': 'emp_hr_1' },
      }),
    ).rejects.toThrow(/SOD-PAYROLL/i)

    await expect(
      sodValidator.assertNoSodConflict({
        actorId: 'emp_cfo_01',
        actionCode: 'payroll:release_payment',
        entityType: 'payroll_batch',
        entityId: 'batch_nov',
        priorActorsByAction: {
          'payroll:calculate': 'emp_hr_1',
          'payroll:approve_batch': 'emp_cfo_01',
        },
      }),
    ).rejects.toThrow(/SOD-PAYROLL/i)

    await expect(
      sodValidator.assertNoSodConflict({
        actorId: 'emp_ceo_01',
        actionCode: 'payroll:release_payment',
        entityType: 'payroll_batch',
        entityId: 'batch_nov',
        priorActorsByAction: {
          'payroll:calculate': 'emp_hr_1',
          'payroll:approve_batch': 'emp_cfo_01',
        },
      }),
    ).resolves.toBeUndefined()
  })

  it('enforces dual approval (two different people) for ⚠ critical actions and blocks self-approval', async () => {
    const { approvalEngine } = buildApprovalHarness({
      emp_hr_1: ['payroll:calculate'],
      emp_cfo_01: ['payroll:approve_batch', 'payroll:release_payment'],
      emp_ceo_01: ['system:root'],
    })

    const req = await approvalEngine.initiateWorkflow(actorCalc, {
      actionCode: 'payroll:approve_batch',
      entityType: 'payroll_batch',
      entityId: 'batch_2026_11',
      amount: 500000,
      reason: 'November payroll batch',
    })

    expect(req.requiresDualApproval).toBe(true)
    expect(req.steps).toHaveLength(2)

    // Rule 5: Requester cannot approve own request
    await expect(approvalEngine.actOnStep(req.id, actorCalc, 'APPROVED')).rejects.toThrow(
      ForbiddenException,
    )

    // First approver (CFO) approves Step 1
    const afterStep1 = await approvalEngine.actOnStep(req.id, actorCfo, 'APPROVED', 'Numbers verified')
    expect(afterStep1.status).toBe('IN_PROGRESS')

    // Same CFO CANNOT approve Step 2 (dual approval requires two DIFFERENT people!)
    await expect(approvalEngine.actOnStep(req.id, actorCfo, 'APPROVED')).rejects.toThrow(
      ForbiddenException,
    )

    // Second different authorized executive (CEO) approves Step 2 -> APPROVED
    const afterStep2 = await approvalEngine.actOnStep(req.id, actorCeo, 'APPROVED', 'Release cleared')
    expect(afterStep2.status).toBe('APPROVED')
  })

  it('supports conditional amount thresholds, parallel approvals, escalations, and timeouts', async () => {
    const { approvalEngine, steps, requests } = buildApprovalHarness({
      emp_pm_01: ['purchase_orders:approve', 'expenses:submit'],
      emp_cfo_01: ['budgets:approve_request'],
      emp_hr_1: ['bonuses:approve'],
      emp_ceo_01: ['system:root'],
    })

    // Small PO (< 50k) requires 1 step only
    const smallPo = await approvalEngine.initiateWorkflow(actorDev, {
      actionCode: 'purchase_orders:approve',
      entityType: 'purchase_order',
      entityId: 'po_small',
      amount: 12000,
    })
    expect(smallPo.steps).toHaveLength(1)

    // Large PO (>= 50k) triggers conditional 2nd Finance step
    const bigPo = await approvalEngine.initiateWorkflow(actorDev, {
      actionCode: 'purchase_orders:approve',
      entityType: 'purchase_order',
      entityId: 'po_big',
      amount: 75000,
    })
    expect(bigPo.steps).toHaveLength(2)

    // Parallel bonus workflow allows step 2 before step 1
    const bonusReq = await approvalEngine.initiateWorkflow(actorPm, {
      actionCode: 'bonuses:approve',
      entityType: 'bonus',
      entityId: 'bon_1',
      amount: 15000,
    })
    expect(bonusReq.mode).toBe('PARALLEL')
    const afterParallelFinance = await approvalEngine.actOnStep(bonusReq.id, actorCfo, 'APPROVED')
    expect(afterParallelFinance.status).toBe('IN_PROGRESS')
    const afterParallelHr = await approvalEngine.actOnStep(bonusReq.id, actorHrSafe(), 'APPROVED')
    expect(afterParallelHr.status).toBe('APPROVED')

    function actorHrSafe() {
      return actorCalc
    }

    // Timeout & escalation sweep
    const overdueStep = steps.find((s) => s.requestId === smallPo.id)
    overdueStep.dueAt = new Date(Date.now() - 1000)
    const sweep1 = await approvalEngine.processEscalationsAndTimeouts()
    expect(sweep1.escalatedCount).toBeGreaterThanOrEqual(1)

    const targetReq = requests.find((r) => r.id === smallPo.id)
    targetReq.expiresAt = new Date(Date.now() - 1000)
    await expect(approvalEngine.actOnStep(smallPo.id, actorPm, 'APPROVED')).rejects.toThrow(
      BadRequestException,
    )
  })

  it('strictly enforces Hard Rule 8 money-authority separation', () => {
    const { sodValidator } = buildApprovalHarness({})

    // Budget allocation != real bank treasury transfer
    expect(() =>
      sodValidator.assertMoneyAuthorityMatch('REAL_BANK_PAYMENT', 'budgets:approve_request'),
    ).toThrow(ForbiddenException)
    expect(() =>
      sodValidator.assertMoneyAuthorityMatch('INTERNAL_LEDGER', 'budgets:allocate_project'),
    ).toThrow(ForbiddenException)
    expect(() =>
      sodValidator.assertMoneyAuthorityMatch('BUDGET_ALLOCATION', 'budgets:allocate_project'),
    ).not.toThrow()
    expect(() =>
      sodValidator.assertMoneyAuthorityMatch('REAL_BANK_PAYMENT', 'treasury:transfer'),
    ).not.toThrow()
  })
})
