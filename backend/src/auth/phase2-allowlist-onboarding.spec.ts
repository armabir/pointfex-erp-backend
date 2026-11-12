jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }))
jest.mock('@nestjs/passport', () => ({ PassportStrategy: () => class {} }))
jest.mock('passport-jwt', () => ({ Strategy: class {}, ExtractJwt: { fromExtractors: () => () => null } }))

import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { LoginAllowlistService } from './login-allowlist.service'
import { EmployeesService } from '../employees/employees.service'
import { DelegationService } from '../rbac/delegation.service'

describe('Phase 2: CEO-only Allowlist, Delegation Block & Allowlist-Driven Onboarding', () => {
  it('enforces CEO-only allowlist writes, blocks CEO email removal, revokes sessions on removal, and blocks delegation of login_allowlist:manage', async () => {
    const entries: any[] = [
      { id: 'allow_ceo', pattern: 'ceo@pointfex.internal', isDomain: false, isActive: true },
      { id: 'allow_user', pattern: 'alex@gmail.com', isDomain: false, isActive: true },
    ]
    let revokedTokens = 0
    let revokedSessions = 0

    const prisma: any = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === 'emp_ceo') {
            return {
              id: 'emp_ceo',
              name: 'CEO',
              email: 'ceo@pointfex.internal',
              employeeRoles: [{ isActive: true, role: { slug: 'ceo', isSystem: true, isSystemDefault: true, isActive: true } }],
              positionAssignments: [],
            }
          }
          return {
            id: 'emp_hr',
            name: 'HR',
            email: 'hr@pointfex.internal',
            employeeRoles: [{ isActive: true, role: { slug: 'chro', isSystem: false, isSystemDefault: false, isActive: true } }],
            positionAssignments: [],
          }
        }),
        findFirst: jest.fn(async () => ({ id: 'emp_alex' })),
        update: jest.fn(async () => ({})),
        findMany: jest.fn(async () => [{ email: 'ceo@pointfex.internal' }]),
      },
      loginAllowlistEntry: {
        findUnique: jest.fn(async ({ where }: any) => entries.find((e) => e.id === where.id) || null),
        findMany: jest.fn(async () => entries),
        upsert: jest.fn(async ({ where, create }: any) => {
          const row = { id: `allow_${entries.length + 1}`, ...create, pattern: where.pattern }
          entries.push(row)
          return row
        }),
        delete: jest.fn(async ({ where }: any) => {
          const idx = entries.findIndex((e) => e.id === where.id)
          if (idx >= 0) entries.splice(idx, 1)
          return {}
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
      $transaction: jest.fn(async (ops: any) => Promise.all(ops)),
    }

    const config: any = {
      get: (k: string) =>
        k === 'LOGIN_ALLOWLIST_REQUIRED' ? 'true' : k === 'ALLOW_DOMAIN_RULES' ? 'false' : undefined,
    }
    const allowlist = new LoginAllowlistService(prisma, config)

    // Non-CEO cannot add/remove
    await expect(
      allowlist.addEntry(
        { id: 'emp_hr', role: 'chro', email: 'hr@pointfex.internal' } as any,
        'new@outlook.com',
        undefined,
        'Need to add new hire',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    // Short reason rejected
    await expect(
      allowlist.addEntry(
        { id: 'emp_ceo', role: 'ceo', email: 'ceo@pointfex.internal' } as any,
        'new@outlook.com',
        undefined,
        'short',
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    // CEO can add outlook.com / gmail.com / company email
    await allowlist.addEntry(
      { id: 'emp_ceo', role: 'ceo', email: 'ceo@pointfex.internal' } as any,
      'new@outlook.com',
      'New hire',
      'Approved onboarding for new engineer',
    )

    // Ready-to-onboard picker returns only un-onboarded active emails (no notes leaked)
    const ready = await allowlist.listReadyToOnboardEmails()
    expect(ready).toEqual([
      { email: 'alex@gmail.com' },
      { email: 'new@outlook.com' },
    ])

    // CEO email cannot be removed or disabled
    await expect(
      allowlist.removeEntry(
        { id: 'emp_ceo', role: 'ceo', email: 'ceo@pointfex.internal' } as any,
        'allow_ceo',
        'Attempting to remove CEO email',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    // Removing another email revokes sessions & tokens
    await allowlist.removeEntry(
      { id: 'emp_ceo', role: 'ceo', email: 'ceo@pointfex.internal' } as any,
      'allow_user',
      'Employee offboarded and access revoked',
    )
    expect(revokedTokens).toBe(1)
    expect(revokedSessions).toBe(1)

    // Delegation of login_allowlist:manage rejected
    const delegation = new DelegationService(prisma, {} as any, {} as any)
    await expect(
      delegation.createDelegation({ id: 'emp_ceo' } as any, {
        delegateeId: 'emp_hr',
        permissionCodes: ['login_allowlist:manage'],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        reason: 'Trying to delegate allowlist management',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects onboarding for non-allowlisted email, never returns temp password, and supports resend-invite rate limit', async () => {
    let createdCount = 0
    const mailCalls: string[] = []
    let failNextMail = false
    let resendCount = 0
    let resendWindowStart: Date | null = null

    const prisma: any = {
      loginAllowlistEntry: {
        findFirst: jest.fn(async ({ where }: any) =>
          where.pattern === 'approved@gmail.com' ? { id: 'allow_1' } : null,
        ),
      },
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === 'emp_hr') {
            return {
              id: 'emp_hr',
              name: 'HR',
              email: 'hr@pointfex.internal',
              employeeRoles: [{ isActive: true, role: { slug: 'chro', isSystemDefault: false } }],
              positionAssignments: [],
            }
          }
          return {
            id: 'emp_new_1',
            name: 'New Dev',
            email: 'approved@gmail.com',
            isSuspended: false,
            inviteResendCount: resendCount,
            inviteResendWindowStart: resendWindowStart,
          }
        }),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => {
          createdCount++
          return { id: 'emp_new_1', ...data }
        }),
        update: jest.fn(async ({ data }: any) => {
          if (typeof data.inviteResendCount === 'number') resendCount = data.inviteResendCount
          if (data.inviteResendWindowStart) resendWindowStart = data.inviteResendWindowStart
          return { id: 'emp_new_1', ...data }
        }),
      },
      role: { findUnique: jest.fn(async () => ({ id: 'role_dev', slug: 'developer', name: 'Developer', isActive: true })) },
      employeeRole: { create: jest.fn(async () => ({})) },
      userRoleAssignment: { create: jest.fn(async () => ({})) },
      employeeWallet: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          ...prisma,
          employee: {
            ...prisma.employee,
            findUnique: jest.fn(async () => ({ id: 'emp_new_1', name: 'New Dev', email: 'approved@gmail.com' })),
          },
        }),
      ),
    }

    const mailService: any = {
      tempPasswordTtlHours: 24,
      sendWelcomeTempPassword: jest.fn(async ({ to }: any) => {
        mailCalls.push(to)
        if (failNextMail) {
          return { sent: false, provider: 'resend', error: 'Resend test sender restricted' }
        }
        return { sent: true, provider: 'resend' }
      }),
    }

    const employees = new EmployeesService(prisma, undefined, undefined, undefined, mailService)

    // Non-allowlisted email rejected before creating employee or sending email
    await expect(
      employees.create(
        { name: 'Blocked', email: 'notallowed@gmail.com', title: 'Dev', roleSlug: 'developer' } as any,
        { id: 'emp_hr', role: 'chro', email: 'hr@pointfex.internal' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(createdCount).toBe(0)
    expect(mailCalls).toHaveLength(0)

    // Allowlisted email succeeds and never returns temporaryPassword
    const res = await employees.create(
      { name: 'New Dev', email: 'approved@gmail.com', title: 'Dev', roleSlug: 'developer' } as any,
      { id: 'emp_hr', role: 'chro', email: 'hr@pointfex.internal' } as any,
    )
    expect((res as any).temporaryPassword).toBeUndefined()
    expect(res.deliveryStatus).toBe('sent')

    // Failed delivery + resend rate-limit (3/hr)
    failNextMail = true
    const r1 = await employees.resendInvite('emp_new_1', { id: 'emp_hr', role: 'chro', email: 'hr@pointfex.internal' } as any)
    expect(r1.deliveryStatus).toBe('failed')
    await employees.resendInvite('emp_new_1', { id: 'emp_hr', role: 'chro', email: 'hr@pointfex.internal' } as any)
    await employees.resendInvite('emp_new_1', { id: 'emp_hr', role: 'chro', email: 'hr@pointfex.internal' } as any)
    await expect(
      employees.resendInvite('emp_new_1', { id: 'emp_hr', role: 'chro', email: 'hr@pointfex.internal' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('activates account with 24h one-time link once, logs usage, and rejects reuse or expired link', async () => {
    const { AuthService } = require('./auth.service')
    const { UnauthorizedException } = require('@nestjs/common')
    const crypto = require('crypto')

    const rawToken = 'one_time_setup_token_24h'
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    let usedAt: Date | null = null
    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    let auditLogs = 0
    let historyLogs = 0

    const prisma: any = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.inviteTokenHash === tokenHash && !usedAt) {
            return {
              id: 'emp_invite_1',
              name: 'Invited User',
              email: 'invited@gmail.com',
              isSuspended: false,
              mfaEnabled: false,
              inviteTokenExpiresAt: expiresAt,
              inviteTokenUsedAt: usedAt,
            }
          }
          return null
        }),
        update: jest.fn(async ({ data }: any) => {
          if (data.inviteTokenUsedAt) usedAt = data.inviteTokenUsedAt
          return {}
        }),
      },
      refreshToken: { updateMany: jest.fn(async () => ({ count: 0 })) },
      employeeChangeHistory: {
        create: jest.fn(async () => {
          historyLogs++
          return {}
        }),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    }
    const auditLogger: any = {
      log: jest.fn(async () => {
        auditLogs++
      }),
    }
    const jwt: any = {
      verify: jest.fn(() => {
        throw new Error('not jwt')
      }),
    }
    const auth = new AuthService(prisma, jwt, undefined, auditLogger)

    // First use succeeds
    const res = await auth.resetPasswordWithToken({
      token: rawToken,
      newPassword: 'StrongNewPassword123!',
    })
    expect(res.activated).toBe(true)
    expect(usedAt).toBeInstanceOf(Date)
    expect(auditLogs).toBe(1)
    expect(historyLogs).toBe(1)

    // Reuse fails
    await expect(
      auth.resetPasswordWithToken({
        token: rawToken,
        newPassword: 'AnotherPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    // Expired link fails
    usedAt = null
    expiresAt = new Date(Date.now() - 1000)
    await expect(
      auth.resetPasswordWithToken({
        token: rawToken,
        newPassword: 'AnotherPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  }, 15000)

  it('enforces max 2 forgot-password requests per week, max 5 per month, and requires MFA enabled', async () => {
    const { AuthService } = require('./auth.service')
    const { HttpException, ForbiddenException } = require('@nestjs/common')

    let mfaEnabled = false
    const auditTimestamps: Date[] = []
    const prisma: any = {
      employee: {
        findUnique: jest.fn(async () => ({
          id: 'emp_dev_1',
          name: 'Dev User',
          email: 'dev@pointfex.com',
          isSuspended: false,
          mfaEnabled,
        })),
      },
      auditLog: {
        count: jest.fn(async ({ where }: any) => {
          const gte: Date = where.timestamp.gte
          return auditTimestamps.filter((d) => d.getTime() >= gte.getTime()).length
        }),
      },
    }
    const jwt: any = { sign: jest.fn(() => 'reset-jwt') }
    const mail: any = { sendPasswordResetLink: jest.fn(async () => ({ sent: true })) }
    const auditLogger: any = {
      log: jest.fn(async () => {
        auditTimestamps.push(new Date())
      }),
    }

    const auth = new AuthService(prisma, jwt, undefined, auditLogger, undefined, undefined, mail)

    // Blocked when MFA is disabled
    await expect(auth.forgotPassword('dev@pointfex.com')).rejects.toBeInstanceOf(ForbiddenException)
    expect(mail.sendPasswordResetLink).not.toHaveBeenCalled()

    // 1st and 2nd requests in the same week succeed once MFA is enabled
    mfaEnabled = true
    await expect(auth.forgotPassword('dev@pointfex.com')).resolves.toMatchObject({ sent: true })
    await expect(auth.forgotPassword('dev@pointfex.com')).resolves.toMatchObject({ sent: true })

    // 3rd request within 7 days is blocked (max 2/week)
    await expect(auth.forgotPassword('dev@pointfex.com')).rejects.toMatchObject({
      status: 429,
    })
    await expect(auth.forgotPassword('dev@pointfex.com')).rejects.toBeInstanceOf(HttpException)

    // Simulate 4 requests spread across earlier weeks in the last 30 days (+1 this week = 5 total)
    auditTimestamps.length = 0
    const now = Date.now()
    auditTimestamps.push(
      new Date(now - 25 * 24 * 60 * 60 * 1000),
      new Date(now - 20 * 24 * 60 * 60 * 1000),
      new Date(now - 14 * 24 * 60 * 60 * 1000),
      new Date(now - 10 * 24 * 60 * 60 * 1000),
      new Date(now - 1 * 24 * 60 * 60 * 1000),
    )

    // 6th request within 30 days is blocked (max 5/month) even though weekly count is only 1
    await expect(auth.forgotPassword('dev@pointfex.com')).rejects.toMatchObject({
      status: 429,
    })
  })

  it('enforces single-device session (revokes prior sessions/tokens and increments authVersion on login)', async () => {
    const { AuthService } = require('./auth.service')
    const bcrypt = require('bcrypt')
    const passwordHash = await bcrypt.hash('StrongPass123!', 4)

    let authVersion = 1
    const refreshUpdateMany = jest.fn(async () => ({ count: 1 }))
    const sessionUpdateMany = jest.fn(async () => ({ count: 1 }))
    const prisma: any = {
      employee: {
        findFirst: jest.fn(async () => ({
          id: 'emp_dev_1',
          email: 'dev@pointfex.com',
          name: 'Dev User',
          title: 'Developer',
          initials: 'DU',
          avatarUrl: null,
          status: 'online',
          isSuspended: false,
          mustChangePassword: false,
          mustEnrollMfa: false,
          mfaEnabled: false,
          passwordHash,
          tempPasswordHash: null,
          tempPasswordExpiresAt: null,
          employeeRoles: [{ role: { id: 'r1', slug: 'developer', name: 'Developer', isSystemDefault: false } }],
          positionAssignments: [],
        })),
        update: jest.fn(async ({ data }: any) => {
          if (data?.authVersion?.increment) authVersion += data.authVersion.increment
          return { authVersion }
        }),
      },
      refreshToken: {
        updateMany: refreshUpdateMany,
        create: jest.fn(async () => ({})),
      },
      securitySession: {
        updateMany: sessionUpdateMany,
        create: jest.fn(async () => ({})),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    }
    const jwt: any = { signAsync: jest.fn(async (p: any) => JSON.stringify(p)) }
    const auth = new AuthService(prisma, jwt)
    const req: any = { headers: {} }
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() }

    await auth.login({ email: 'dev@pointfex.com', password: 'StrongPass123!' }, req, res)

    expect(refreshUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp_dev_1', revokedAt: null } }),
    )
    expect(sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp_dev_1', isRevoked: false } }),
    )
    expect(authVersion).toBe(2)
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ authVersion: 2 }))
  })
})

