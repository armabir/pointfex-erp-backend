jest.mock('@nestjs/jwt', () => ({
  JwtService: class {},
}))
jest.mock('@nestjs/passport', () => ({
  PassportStrategy: () => class {},
  AuthGuard: () => class {},
}))
jest.mock('passport-jwt', () => ({
  ExtractJwt: { fromExtractors: () => () => null, fromAuthHeaderAsBearerToken: () => () => null },
  Strategy: class {},
}))

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as bcrypt from 'bcrypt'
import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { FreshMfaService } from './fresh-mfa.service'
import {
  isPermissionSensitiveMfaRequired,
  resolveSensitiveActionForPermission,
  SENSITIVE_ACTION_REGISTRY,
} from './sensitive-actions'
import { generateTotpCode } from '../common/security-policy.util'
import { AuthorizationService } from './authorization.service'
import { EmployeeLifecycleService } from './employee-lifecycle.service'
import { AuthService } from '../auth/auth.service'

describe('Phase 4B: Always-MFA for Sensitive & Executive Actions', () => {
  const secretHex = crypto.randomBytes(20).toString('hex')

  function createMockPrisma(overrides?: {
    mfaEnabled?: boolean
    mfaLastUsedStep?: number | null
    mfaFailureCount?: number
    mfaLockedUntil?: Date | null
    mfaRecoveryCodes?: string[]
  }) {
    const state = {
      employee: {
        id: 'emp_test_01',
        name: 'Test Manager',
        email: 'mgr@pointfex.internal',
        isSuspended: false,
        mfaEnabled: overrides?.mfaEnabled ?? true,
        mfaSecret: (overrides?.mfaEnabled ?? true) ? secretHex : null,
        mfaLastUsedStep: overrides?.mfaLastUsedStep ?? null,
        mfaFailureCount: overrides?.mfaFailureCount ?? 0,
        mfaFailureWindowStart: null as Date | null,
        mfaLockedUntil: overrides?.mfaLockedUntil ?? null,
        mfaRecoveryCodes: overrides?.mfaRecoveryCodes ?? [],
        passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
      },
      bindings: [] as Array<{ actorId: string; timeStep: number; actionKey: string; targetId: string }>,
      audits: [] as any[],
      notifications: [] as any[],
      viewTokens: [] as Array<{ tokenHash: string; actorId: string; targetEmployeeId: string; expiresAt: Date }>,
      history: [] as any[],
      revokedTokens: 0,
      revokedSessions: 0,
    }

    const prisma: any = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id && where.id !== state.employee.id) return null
          return { ...state.employee }
        }),
        update: jest.fn(async ({ data }: any) => {
          Object.assign(state.employee, data)
          return { ...state.employee }
        }),
      },
      employeeRole: {
        findMany: jest.fn(async () => [{ employeeId: 'emp_ceo_01' }]),
      },
      notification: {
        createMany: jest.fn(async ({ data }: any) => {
          state.notifications.push(...data)
          return { count: data.length }
        }),
      },
      mfaActionBinding: {
        findUnique: jest.fn(async ({ where }: any) => {
          const { actorId, timeStep } = where.actorId_timeStep
          return state.bindings.find((b) => b.actorId === actorId && b.timeStep === timeStep) || null
        }),
        create: jest.fn(async ({ data }: any) => {
          state.bindings.push(data)
          return data
        }),
      },
      auditLog: {
        create: jest.fn(async ({ data }: any) => {
          state.audits.push(data)
          return data
        }),
      },
      sensitiveProfileViewToken: {
        create: jest.fn(async ({ data }: any) => {
          state.viewTokens.push(data)
          return data
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          return state.viewTokens.find((t) => t.tokenHash === where.tokenHash) || null
        }),
      },
      refreshToken: {
        updateMany: jest.fn(async () => {
          state.revokedTokens++
          return { count: 1 }
        }),
      },
      securitySession: {
        updateMany: jest.fn(async () => {
          state.revokedSessions++
          return { count: 1 }
        }),
      },
      employeeChangeHistory: {
        create: jest.fn(async ({ data }: any) => {
          state.history.push(data)
          return data
        }),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      _state: state,
    }

    return prisma
  }

  it('rejects missing code, wrong code, replayed code, wrong action/target binding, and recovery code; accepts valid fresh code once and audits without code', async () => {
    const recoveryPlain = 'ABCD1234EF'
    const recoveryHash = await bcrypt.hash(recoveryPlain, 10)
    const prisma = createMockPrisma({ mfaRecoveryCodes: [recoveryHash] })
    const service = new FreshMfaService(prisma)

    // 1. Missing code
    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'users:assign_role',
        targetId: 'emp_dev_01',
        reason: 'Assigning squad lead role for Q4 delivery',
      }),
    ).rejects.toThrow(ForbiddenException)

    // 2. Recovery code rejected on sensitive action
    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'users:assign_role',
        targetId: 'emp_dev_01',
        code: recoveryPlain,
        reason: 'Assigning squad lead role for Q4 delivery',
      }),
    ).rejects.toThrow(ForbiddenException)

    // 3. Action binding mismatch rejected
    const liveCode = generateTotpCode(secretHex, 0)
    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'users:assign_role',
        targetId: 'emp_dev_01',
        code: liveCode,
        boundActionHeader: 'roles:delete',
        reason: 'Assigning squad lead role for Q4 delivery',
      }),
    ).rejects.toThrow(ForbiddenException)

    // 4. Target binding mismatch rejected
    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'users:assign_role',
        targetId: 'emp_dev_01',
        code: liveCode,
        boundTargetHeader: 'emp_dev_99',
        reason: 'Assigning squad lead role for Q4 delivery',
      }),
    ).rejects.toThrow(ForbiddenException)

    // 5. Missing written reason (<10 chars) rejected
    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'users:assign_role',
        targetId: 'emp_dev_01',
        code: liveCode,
        reason: 'short',
      }),
    ).rejects.toThrow(BadRequestException)

    // 6. Valid fresh code succeeds once
    const verified = await service.verifyFreshMfa({
      actorId: 'emp_test_01',
      actionKey: 'users:assign_role',
      targetId: 'emp_dev_01',
      code: liveCode,
      boundActionHeader: 'users:assign_role',
      boundTargetHeader: 'emp_dev_01',
      reason: 'Assigning squad lead role for Q4 delivery',
      ipAddress: '103.10.1.5',
      device: 'Chrome/130',
    })
    expect(verified.actionKey).toBe('users:assign_role')
    expect(verified.targetId).toBe('emp_dev_01')

    const successAudit = prisma._state.audits.find((a: any) => a.outcome === 'SUCCESS')
    expect(successAudit).toBeDefined()
    expect(successAudit.mfaVerified).toBe(true)
    expect(successAudit.actionKey).toBe('users:assign_role')
    expect(successAudit.entityId).toBe('emp_dev_01')
    expect(JSON.stringify(successAudit)).not.toContain(liveCode)

    // 7. Replaying same code is rejected
    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'roles:update',
        targetId: 'role_01',
        code: liveCode,
        reason: 'Updating role permissions',
      }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('blocks user without MFA enabled and triggers enrollment error', async () => {
    const prisma = createMockPrisma({ mfaEnabled: false })
    const service = new FreshMfaService(prisma)

    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'roles:create',
        targetId: 'global',
        code: '123456',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MFA_ENROLLMENT_REQUIRED' }),
    })
  })

  it('locks sensitive actions for 15 minutes after 5 failed MFA codes and alerts admins', async () => {
    const prisma = createMockPrisma()
    const service = new FreshMfaService(prisma)

    for (let i = 0; i < 4; i++) {
      await expect(
        service.verifyFreshMfa({
          actorId: 'emp_test_01',
          actionKey: 'roles:create',
          targetId: 'global',
          code: '000000',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_MFA_CODE' }),
      })
    }

    await expect(
      service.verifyFreshMfa({
        actorId: 'emp_test_01',
        actionKey: 'roles:create',
        targetId: 'global',
        code: '000000',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MFA_LOCKED' }),
    })

    expect(prisma._state.employee.mfaLockedUntil).toBeInstanceOf(Date)
    expect(prisma._state.notifications.length).toBeGreaterThan(0)
  })

  it('profile view token expires after 5 minutes and is bound only to that actor and target profile', async () => {
    const prisma = createMockPrisma()
    const service = new FreshMfaService(prisma)

    const issued = await service.issueProfileViewToken('emp_test_01', 'emp_target_01')
    expect(
      await service.validateProfileViewToken(issued.viewToken, 'emp_test_01', 'emp_target_01'),
    ).toBe(true)
    expect(
      await service.validateProfileViewToken(issued.viewToken, 'emp_test_01', 'emp_target_99'),
    ).toBe(false)
    expect(
      await service.validateProfileViewToken(issued.viewToken, 'emp_other_02', 'emp_target_01'),
    ).toBe(false)

    // Expire token
    prisma._state.viewTokens[0].expiresAt = new Date(Date.now() - 1000)
    expect(
      await service.validateProfileViewToken(issued.viewToken, 'emp_test_01', 'emp_target_01'),
    ).toBe(false)
  })

  it('delegated user without MFA cannot use delegated sensitive permissions', async () => {
    const prisma: any = {
      employee: {
        findUnique: jest.fn(async () => ({
          id: 'emp_delegatee',
          isSuspended: false,
          authVersion: 1,
          mfaEnabled: false,
        })),
      },
      userRoleAssignment: { findMany: jest.fn(async () => []) },
      employeeRole: { findMany: jest.fn(async () => []) },
      userPermissionGrant: { findMany: jest.fn(async () => []) },
      employeePermission: { findMany: jest.fn(async () => []) },
      userPermissionDenial: { findMany: jest.fn(async () => []) },
      permission: {
        findMany: jest.fn(async () => [
          { code: 'users:assign_role', isCritical: false },
          { code: 'tasks:read_own', isCritical: false },
        ]),
      },
      permissionAlias: { findMany: jest.fn(async () => []) },
    }
    const cache: any = {
      getVersionedAuthz: jest.fn(async () => null),
      setVersionedAuthz: jest.fn(async () => undefined),
    }
    const config: any = { get: jest.fn(() => 'enforce') }
    const authz = new AuthorizationService(prisma, cache, config)
    authz.registerDelegationProvider({
      getActiveDelegationsForUser: async () => [
        {
          code: 'users:assign_role',
          scope: 'ORG',
          scopeIds: [],
          sourceType: 'delegation',
          sourceId: 'del_1',
          expiresAt: null,
        },
        {
          code: 'tasks:read_own',
          scope: 'ORG',
          scopeIds: [],
          sourceType: 'delegation',
          sourceId: 'del_2',
          expiresAt: null,
        },
      ],
    })

    const snap = await authz.resolveEffectiveAuthz('emp_delegatee')
    expect(snap.effectiveCodes).toContain('tasks:read_own')
    expect(snap.effectiveCodes).not.toContain('users:assign_role')
  })

  it('forgot-password for an MFA user requires fresh MFA code before saving new password', async () => {
    const prisma = createMockPrisma({ mfaEnabled: true })
    const jwt: any = {
      sign: jest.fn(() => 'reset_tok'),
      verify: jest.fn(() => ({ sub: 'emp_test_01', purpose: 'password_reset' })),
    }
    const freshMfa = new FreshMfaService(prisma)
    const auth = new AuthService(prisma, jwt, undefined, undefined, undefined, freshMfa)

    await expect(
      auth.resetPasswordWithToken({ token: 'reset_tok', newPassword: 'NewStrongPassword1!' }),
    ).rejects.toThrow(ForbiddenException)

    const liveCode = generateTotpCode(secretHex, 0)
    const res = await auth.resetPasswordWithToken({
      token: 'reset_tok',
      newPassword: 'NewStrongPassword1!',
      mfaCode: liveCode,
    })
    expect(res).toEqual({ reset: true })
    expect(prisma._state.revokedTokens).toBeGreaterThan(0)
  })

  it('admin reset password revokes sessions and never exposes temporary password in response', async () => {
    const prisma: any = createMockPrisma()
    prisma.employee.findUnique = jest.fn(async ({ where }: any) => {
      if (where.id === 'emp_target') {
        return {
          id: 'emp_target',
          name: 'Target Dev',
          email: 'target@pointfex.internal',
          isSuspended: false,
          employeeRoles: [{ role: { id: 'r_dev', slug: 'developer', name: 'Developer' } }],
          positionAssignments: [],
        }
      }
      return {
        id: 'emp_admin',
        name: 'CTO Admin',
        email: 'cto@pointfex.internal',
        isSuspended: false,
        employeeRoles: [{ role: { id: 'r_cto', slug: 'cto', name: 'CTO' } }],
        positionAssignments: [],
      }
    })
    const lifecycle = new EmployeeLifecycleService(
      prisma,
      { invalidateUser: jest.fn() } as any,
      { log: jest.fn() } as any,
    )

    const result = await lifecycle.adminResetPassword(
      'emp_target',
      { id: 'emp_admin', role: 'cto', email: 'cto@pointfex.internal' } as any,
      'User lost access and requested password reset',
    )

    expect(result).toMatchObject({
      reset: true,
      employeeId: 'emp_target',
      mustChangePassword: true,
      sessionsRevoked: true,
      delivery: 'email',
    })
    expect(typeof result.expiresAt).toBe('string')
    expect(JSON.stringify(result)).not.toContain('passwordHash')
    expect(prisma._state.revokedTokens).toBe(1)
    expect(prisma._state.revokedSessions).toBe(1)
  })

  it('automatically covers every critical permission and every governance:* code from permissions_master.md', () => {
    expect(SENSITIVE_ACTION_REGISTRY.length).toBeGreaterThanOrEqual(30)
    const mdPath = path.resolve(process.cwd(), '../docs/permissions_master.md')
    const md = fs.readFileSync(mdPath, 'utf8')
    const criticalCodes: string[] = []
    for (const line of md.split('\n')) {
      if (!line.startsWith('|')) continue
      const m =
        line.match(/\|\s*`([a-z0-9_]+:[a-z0-9_]+)`\s*\|/i) ||
        line.match(/\|\s*([a-z0-9_]+:[a-z0-9_]+)\s*\|/)
      if (m && (line.includes('⚠') || m[1].startsWith('governance:'))) {
        criticalCodes.push(m[1])
      }
    }

    expect(criticalCodes.length).toBeGreaterThan(50)
    for (const code of criticalCodes) {
      expect(isPermissionSensitiveMfaRequired(code, true)).toBe(true)
      const entry = resolveSensitiveActionForPermission(code, true)
      expect(entry?.mfaRequired).toBe(true)
    }
  })

  it('POST /rbac/roles/from-template/:code requires fresh MFA for roles:create', () => {
    const { RbacController } = require('./rbac.controller')
    const { FRESH_MFA_ACTION_KEY } = require('../common/requires-fresh-mfa.decorator')
    const meta = Reflect.getMetadata(
      FRESH_MFA_ACTION_KEY,
      RbacController.prototype.createRoleFromTemplate,
    )
    expect(meta).toBe('roles:create')
  })
})
