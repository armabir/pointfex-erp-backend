import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EmployeeLifecycleService } from './employee-lifecycle.service'

describe('Phase B: CEO & Admin MFA Reset Governance', () => {
  function setup(options: { actorRole: 'ceo' | 'cto' | 'hr'; targetRole: 'ceo' | 'cto' | 'developer' }) {
    let revokedTokens = 0
    let revokedSessions = 0
    let historyCreated = 0
    let auditCreated = 0
    let updatedData: any = null

    const makeEmp = (id: string, role: string, isSystemDefault = false, includeCritical = false) => ({
      id,
      name: id,
      email: `${id}@pointfex.internal`,
      isSuspended: false,
      mustEnrollMfa: role !== 'developer',
      mfaEnabled: true,
      mfaSecret: 'SECRET_SHOULD_NEVER_LEAK',
      employeeRoles: [
        {
          isActive: true,
          role: {
            slug: role,
            isSystemDefault,
            isRootRole: isSystemDefault,
            includeCritical,
            rolePermissions: [],
          },
        },
      ],
      positionAssignments: [],
    })

    const actorEmp = makeEmp(
      `emp_${options.actorRole}`,
      options.actorRole,
      options.actorRole === 'ceo',
      options.actorRole !== 'hr',
    )
    const targetEmp = makeEmp(
      `emp_${options.targetRole}`,
      options.targetRole,
      options.targetRole === 'ceo',
      options.targetRole !== 'developer',
    )

    const prisma: any = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === actorEmp.id) return actorEmp
          if (where.id === targetEmp.id) return targetEmp
          return null
        }),
        update: jest.fn(async ({ data }: any) => {
          updatedData = data
          return { id: targetEmp.id, ...data }
        }),
      },
      refreshToken: {
        updateMany: jest.fn(async () => {
          revokedTokens++
          return { count: 1 }
        }),
      },
      securitySession: {
        updateMany: jest.fn(async () => {
          revokedSessions++
          return { count: 1 }
        }),
      },
      employeeChangeHistory: {
        create: jest.fn(async () => {
          historyCreated++
          return {}
        }),
      },
      $transaction: jest.fn(async (cb: any) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb))),
    }

    const auditLogger: any = {
      log: jest.fn(async () => {
        auditCreated++
      }),
    }
    const mailService: any = {
      sendMfaResetNotice: jest.fn(async () => ({ sent: true, provider: 'resend' })),
    }
    const cache: any = { invalidateEmployee: jest.fn() }
    const service = new EmployeeLifecycleService(
      prisma,
      cache,
      auditLogger,
      undefined,
      undefined,
      mailService,
    )

    return {
      service,
      actor: { id: actorEmp.id, role: options.actorRole, email: actorEmp.email } as any,
      targetId: targetEmp.id,
      getState: () => ({
        revokedTokens,
        revokedSessions,
        historyCreated,
        auditCreated,
        updatedData,
        auditLogger,
        mailService,
      }),
    }
  }

  it('blocks self-reset, blocks anyone resetting CEO MFA, and blocks non-CEO from resetting privileged user MFA', async () => {
    const selfCtx = setup({ actorRole: 'cto', targetRole: 'cto' })
    await expect(
      selfCtx.service.adminResetMfa('emp_cto', selfCtx.actor, 'Lost my own authenticator device'),
    ).rejects.toBeInstanceOf(ForbiddenException)

    const targetCeoCtx = setup({ actorRole: 'cto', targetRole: 'ceo' })
    await expect(
      targetCeoCtx.service.adminResetMfa(targetCeoCtx.targetId, targetCeoCtx.actor, 'Trying to reset CEO MFA'),
    ).rejects.toThrow(/CEO|root/i)

    const nonCeoVsExec = setup({ actorRole: 'hr', targetRole: 'cto' })
    await expect(
      nonCeoVsExec.service.adminResetMfa(nonCeoVsExec.targetId, nonCeoVsExec.actor, 'HR trying to reset CTO MFA'),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('requires >= 10 char reason and allows CEO to reset privileged user MFA, revoking sessions, emailing, and auditing without secrets', async () => {
    const ctx = setup({ actorRole: 'ceo', targetRole: 'cto' })

    await expect(
      ctx.service.adminResetMfa(ctx.targetId, ctx.actor, 'short'),
    ).rejects.toBeInstanceOf(BadRequestException)

    const res = await ctx.service.adminResetMfa(
      ctx.targetId,
      ctx.actor,
      'User replaced their hardware phone and lost TOTP',
    )
    expect(res).toMatchObject({
      reset: true,
      employeeId: ctx.targetId,
      mustEnrollMfa: true,
      sessionsRevoked: true,
      emailSent: true,
    })

    const s = ctx.getState()
    expect(s.updatedData.mfaEnabled).toBe(false)
    expect(s.updatedData.mfaSecret).toBeNull()
    expect(s.updatedData.mfaRecoveryCodes).toEqual([])
    expect(s.revokedTokens).toBe(1)
    expect(s.revokedSessions).toBe(1)
    expect(s.historyCreated).toBe(1)
    expect(s.auditCreated).toBe(1)
    expect(s.mailService.sendMfaResetNotice).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(res)).not.toContain('SECRET_SHOULD_NEVER_LEAK')
  })
})
