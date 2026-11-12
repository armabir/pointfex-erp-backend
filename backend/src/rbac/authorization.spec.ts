import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthorizationService } from './authorization.service'
import { PermissionCacheService } from './permission-cache.service'
import { PermissionsGuard } from '../common/permissions.guard'

function createGuardContext(user: any, method = 'POST', url = '/api/tasks/1/approve'): ExecutionContext {
  return {
    getHandler: () => (() => undefined) as any,
    getClass: () => class TestCtrl {} as any,
    switchToHttp: () => ({
      getRequest: () => ({ user, method, url }),
    }),
  } as unknown as ExecutionContext
}

describe('Phase 3: Central AuthorizationService, Cache Invalidation, Shadow Mode & Guard Enforcement', () => {
  const catalogPerms = [
    {
      code: 'system:root',
      isCritical: true,
      isDeprecated: false,
      isSystemRoot: true,
      category: { domains: ['all'] },
    },
    {
      code: 'tasks:approve',
      isCritical: false,
      isDeprecated: false,
      isSystemRoot: false,
      category: { domains: ['engineering'] },
    },
    {
      code: 'deployments:approve',
      isCritical: true,
      isDeprecated: false,
      isSystemRoot: false,
      category: { domains: ['engineering'] },
    },
    {
      code: 'payroll:approve_batch',
      isCritical: true,
      isDeprecated: false,
      isSystemRoot: false,
      category: { domains: ['hr', 'finance'] },
    },
    {
      code: 'wallets:read_all',
      isCritical: false,
      isDeprecated: false,
      isSystemRoot: false,
      category: { domains: ['finance'] },
    },
    {
      code: 'wallets:read_own',
      isCritical: false,
      isDeprecated: false,
      isSystemRoot: false,
      category: { domains: ['finance'] },
    },
    {
      code: 'users:suspend',
      isCritical: false,
      isDeprecated: false,
      isSystemRoot: false,
      category: { domains: ['admin'] },
    },
  ]

  function buildAuthzHarness(opts: {
    authVersion?: number
    isSuspended?: boolean
    assignments?: any[]
    grants?: any[]
    denials?: any[]
    aliases?: Array<{ legacyCode: string; targetCode: string }>
    authzMode?: string
  }) {
    let authVersion = opts.authVersion ?? 1
    const shadowLogs: any[] = []

    const prismaMock: any = {
      employee: {
        findUnique: jest.fn(async () => ({
          id: 'emp_1',
          isSuspended: opts.isSuspended ?? false,
          authVersion,
        })),
        update: jest.fn(async () => {
          authVersion += 1
          return { id: 'emp_1', authVersion }
        }),
      },
      userRoleAssignment: {
        findMany: jest.fn(async () => opts.assignments ?? []),
      },
      employeeRole: { findMany: jest.fn(async () => []) },
      userPermissionGrant: { findMany: jest.fn(async () => opts.grants ?? []) },
      employeePermission: { findMany: jest.fn(async () => []) },
      userPermissionDenial: { findMany: jest.fn(async () => opts.denials ?? []) },
      permission: {
        findMany: jest.fn(async () => catalogPerms),
        findUnique: jest.fn(async ({ where }) => {
          const match = catalogPerms.find((p) => p.code === where.code)
          return match ? { isCritical: match.isCritical, isSensitive: false } : null
        }),
      },
      permissionAlias: {
        findMany: jest.fn(async () => opts.aliases ?? []),
      },
      authzShadowLog: {
        create: jest.fn(async ({ data }) => {
          shadowLogs.push(data)
          return data
        }),
      },
    }

    const configMock: any = {
      get: jest.fn((k: string) => (k === 'AUTHZ_MODE' ? opts.authzMode ?? 'enforce' : undefined)),
    }
    const cache = new PermissionCacheService(configMock)
    const authz = new AuthorizationService(prismaMock, cache, configMock)

    return {
      authz,
      prismaMock,
      cache,
      shadowLogs,
      bumpVersionExternal: () => {
        authVersion += 1
      },
    }
  }

  it('allows system:root holder for any existing or future permission (even ⚠ critical), unless suspended', async () => {
    const { authz } = buildAuthzHarness({
      assignments: [
        {
          id: 'ura_ceo',
          scope: 'GLOBAL',
          scopeIds: [],
          expiresAt: null,
          role: {
            slug: 'ceo',
            isRootRole: true,
            wildcards: [],
            includeCritical: true,
            rolePermissions: [{ permission: { code: 'system:root' } }],
          },
        },
      ],
    })

    const res1 = await authz.check('emp_1', 'payroll:approve_batch')
    expect(res1.allowed).toBe(true)
    expect(res1.source).toBe('root')
    expect(res1.isCritical).toBe(true)

    const resFuture = await authz.check('emp_1', 'future_module:quantum_action')
    expect(resFuture.allowed).toBe(true)
    expect(resFuture.source).toBe('root')

    const suspendedHarness = buildAuthzHarness({
      isSuspended: true,
      assignments: [
        {
          id: 'ura_ceo',
          scope: 'GLOBAL',
          scopeIds: [],
          expiresAt: null,
          role: {
            slug: 'ceo',
            isRootRole: true,
            wildcards: [],
            includeCritical: true,
            rolePermissions: [{ permission: { code: 'system:root' } }],
          },
        },
      ],
    })
    const suspendedRes = await suspendedHarness.authz.check('emp_1', 'system:root')
    expect(suspendedRes.allowed).toBe(false)
    expect(suspendedRes.source).toBe('suspended')
  })

  it('enforces wildcard domain isolation and excludes ⚠ critical codes', async () => {
    const { authz } = buildAuthzHarness({
      assignments: [
        {
          id: 'ura_cto',
          scope: 'ORG',
          scopeIds: [],
          expiresAt: null,
          role: {
            slug: 'cto',
            isRootRole: false,
            wildcards: ['engineering:*'],
            includeCritical: false,
            rolePermissions: [],
          },
        },
      ],
    })

    expect((await authz.check('emp_1', 'tasks:approve')).allowed).toBe(true)
    expect((await authz.check('emp_1', 'deployments:approve')).allowed).toBe(false)
    expect((await authz.check('emp_1', 'wallets:read_all')).allowed).toBe(false)
    expect((await authz.check('emp_1', 'payroll:approve_batch')).allowed).toBe(false)
  })

  it('enforces ABAC scopes (PROJECT, SELF, ORG) and ensures explicit denials override grants', async () => {
    const { authz } = buildAuthzHarness({
      assignments: [
        {
          id: 'ura_pm',
          scope: 'PROJECT',
          scopeIds: ['proj_a'],
          expiresAt: null,
          role: {
            slug: 'pm',
            isRootRole: false,
            wildcards: [],
            includeCritical: false,
            rolePermissions: [{ permission: { code: 'tasks:approve' } }],
          },
        },
      ],
      grants: [
        {
          id: 'grant_wallet',
          scope: 'SELF',
          scopeIds: [],
          expiresAt: null,
          permission: { code: 'wallets:read_own' },
        },
      ],
      denials: [
        {
          id: 'deny_proj_a_approve',
          scope: 'PROJECT',
          scopeIds: ['proj_a'],
          reason: 'Conflict of interest on proj_a',
          expiresAt: null,
          permission: { code: 'tasks:approve' },
        },
      ],
    })

    // Denied even though PM role grants tasks:approve on proj_a
    const deniedDecision = await authz.check('emp_1', 'tasks:approve', { projectId: 'proj_a' })
    expect(deniedDecision.allowed).toBe(false)
    expect(deniedDecision.source).toBe('denied')

    // Wrong project blocked too
    const wrongProj = await authz.check('emp_1', 'tasks:approve', { projectId: 'proj_b' })
    expect(wrongProj.allowed).toBe(false)

    // Own SELF wallet works for own ownerId, blocked for someone else's ownerId
    expect((await authz.check('emp_1', 'wallets:read_own', { ownerId: 'emp_1' })).allowed).toBe(
      true,
    )
    expect((await authz.check('emp_1', 'wallets:read_own', { ownerId: 'emp_2' })).allowed).toBe(
      false,
    )
  })

  it('resolves legacy permission aliases and invalidates versioned cache immediately upon role change', async () => {
    const harness = buildAuthzHarness({
      assignments: [
        {
          id: 'ura_chro',
          scope: 'ORG',
          scopeIds: [],
          expiresAt: null,
          role: {
            slug: 'chro',
            isRootRole: false,
            wildcards: [],
            includeCritical: false,
            rolePermissions: [{ permission: { code: 'employees:suspend' } }],
          },
        },
      ],
      aliases: [{ legacyCode: 'employees:suspend', targetCode: 'users:suspend' }],
    })

    // Legacy code held satisfies new master code via alias
    expect((await harness.authz.check('emp_1', 'users:suspend')).allowed).toBe(true)

    // Populate version 1 cache, then mutate role assignment and invalidate cache
    harness.prismaMock.userRoleAssignment.findMany.mockResolvedValueOnce([])
    // Before invalidation, cached version 1 still serves cached truth until invalidated
    expect((await harness.authz.check('emp_1', 'users:suspend')).allowed).toBe(true)

    await harness.authz.invalidateUserCache('emp_1')
    const afterInvalidation = await harness.authz.check('emp_1', 'users:suspend')
    expect(afterInvalidation.allowed).toBe(false)
  })

  it('logs shadow-mode disagreements cleanly while preserving legacy outcome during shadow rollout', async () => {
    const harness = buildAuthzHarness({
      authzMode: 'shadow',
      assignments: [
        {
          id: 'ura_dev',
          scope: 'SELF',
          scopeIds: [],
          expiresAt: null,
          role: {
            slug: 'developer',
            isRootRole: false,
            wildcards: [],
            includeCritical: false,
            rolePermissions: [{ permission: { code: 'tasks:approve' } }],
          },
        },
      ],
    })
    // Simulate legacy table lacking tasks:approve while new UserRoleAssignment has it
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === 'pbac_permissions_all') return ['tasks:approve']
        return undefined
      }),
    } as unknown as Reflector

    const guard = new PermissionsGuard(
      reflector,
      { get: jest.fn((k: string) => (k === 'AUTHZ_MODE' ? 'shadow' : undefined)) } as any,
      harness.prismaMock,
      harness.cache,
      harness.authz,
    )

    // In shadow mode, legacy (oldAllowed=false) still denies AND logs disagreement with newAllowed=true
    await expect(guard.canActivate(createGuardContext({ id: 'emp_1', role: 'developer' }))).rejects.toThrow(
      ForbiddenException,
    )
    expect(harness.shadowLogs).toHaveLength(1)
    expect(harness.shadowLogs[0]).toMatchObject({
      employeeId: 'emp_1',
      permissionCode: 'tasks:approve',
      oldAllowed: false,
      newAllowed: true,
    })
  })
})
