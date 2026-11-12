import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PermissionsGuard } from '../common/permissions.guard'
import { AuthorizationService } from './authorization.service'
import { PermissionCacheService } from './permission-cache.service'
import { RbacService } from './rbac.service'
import { EmployeeAccessService } from './employee-access.service'

describe('Phase 8: Enforce Mode Security, Direct Endpoint Bypass & Privilege Escalation Resistance', () => {
  const catalog = [
    { code: 'system:root', isCritical: true, isDeprecated: false, isSystemRoot: true, category: { domains: ['all'] } },
    { code: 'treasury:read', isCritical: false, isDeprecated: false, isSystemRoot: false, category: { domains: ['finance'] } },
    { code: 'treasury:transfer', isCritical: true, isDeprecated: false, isSystemRoot: false, category: { domains: ['finance'] } },
    { code: 'roles:create', isCritical: false, isDeprecated: false, isSystemRoot: false, category: { domains: ['admin'] } },
    { code: 'tasks:approve', isCritical: false, isDeprecated: false, isSystemRoot: false, category: { domains: ['engineering'] } },
    { code: 'tasks:submit_work', isCritical: false, isDeprecated: false, isSystemRoot: false, category: { domains: ['engineering'] } },
    { code: 'governance:transfer_ceo', isCritical: true, isDeprecated: false, isSystemRoot: false, category: { domains: ['admin'] } },
    { code: 'audit_logs:verify', isCritical: false, isDeprecated: false, isSystemRoot: false, category: { domains: ['admin', 'ops'] } },
    { code: 'employees:update_own_profile', isCritical: false, isDeprecated: false, isSystemRoot: false, category: { domains: ['hr'] } },
  ]

  function buildEnforceGuard(heldPermissions: string[], roleSlug = 'developer') {
    const prismaMock: any = {
      employee: {
        findUnique: jest.fn(async () => ({ id: 'emp_dev_01', isSuspended: false, authVersion: 1 })),
      },
      userRoleAssignment: {
        findMany: jest.fn(async () => [
          {
            id: 'ura_1',
            scope: roleSlug === 'ceo' ? 'GLOBAL' : 'SELF',
            scopeIds: [],
            expiresAt: null,
            role: {
              slug: roleSlug,
              isRootRole: roleSlug === 'ceo',
              wildcards: [],
              includeCritical: roleSlug === 'ceo',
              rolePermissions: heldPermissions.map((c) => ({ permission: { code: c } })),
            },
          },
        ]),
      },
      employeeRole: { findMany: jest.fn(async () => []) },
      userPermissionGrant: { findMany: jest.fn(async () => []) },
      employeePermission: { findMany: jest.fn(async () => []) },
      userPermissionDenial: { findMany: jest.fn(async () => []) },
      permission: {
        findMany: jest.fn(async () => catalog),
        findUnique: jest.fn(async ({ where }) => catalog.find((p) => p.code === where.code) ?? null),
      },
      permissionAlias: { findMany: jest.fn(async () => []) },
    }

    const configMock: any = {
      get: jest.fn((k: string) => (k === 'AUTHZ_MODE' ? 'enforce' : undefined)),
    }
    const cache = new PermissionCacheService(configMock)
    const authz = new AuthorizationService(prismaMock, cache, configMock)

    const createGuard = (requiredAll: string[], requiredAny: string[] = []) => {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'pbac_permissions_all') return requiredAll
          if (key === 'pbac_permissions_any') return requiredAny
          return undefined
        }),
      } as unknown as Reflector
      return new PermissionsGuard(reflector, configMock, prismaMock, cache, authz)
    }

    return { createGuard, authz }
  }

  function mockHttpCtx(user: any, url = '/api/finance/treasury'): ExecutionContext {
    return {
      getHandler: () => (() => undefined) as any,
      getClass: () => class DummyCtrl {} as any,
      switchToHttp: () => ({
        getRequest: () => ({ user, method: 'POST', url }),
      }),
    } as unknown as ExecutionContext
  }

  it('blocks direct backend endpoint invocations when frontend UI is bypassed in enforce mode', async () => {
    const devUser = { id: 'emp_dev_01', role: 'developer', email: 'fahim@pointfex.com' }
    const { createGuard } = buildEnforceGuard(['tasks:submit_work', 'employees:update_own_profile'])

    const protectedEndpoints = [
      { url: '/api/finance/treasury', all: ['treasury:read'] },
      { url: '/api/rbac/roles', all: ['roles:create'] },
      { url: '/api/tasks/1/approve', all: ['tasks:approve'] },
      { url: '/api/governance/transfer-ceo', all: ['governance:transfer_ceo'] },
      { url: '/api/audit-logs/verify', all: ['audit_logs:verify'] },
    ]

    for (const ep of protectedEndpoints) {
      const guard = createGuard(ep.all)
      await expect(guard.canActivate(mockHttpCtx(devUser, ep.url))).rejects.toThrow(
        ForbiddenException,
      )
    }

    // Legitimate developer endpoint succeeds
    const devSubmitGuard = createGuard(['tasks:submit_work'])
    await expect(
      devSubmitGuard.canActivate(mockHttpCtx(devUser, '/api/tasks/1/submissions')),
    ).resolves.toBe(true)
  })

  it('blocks privilege escalation attempts via role creation, CEO role assignment, or C-level targeting', async () => {
    const prismaMock: any = {
      permission: {
        findMany: jest.fn(async () => [
          { id: 'perm_root', code: 'system:root', isSystemRoot: true },
        ]),
      },
      role: {
        findFirst: jest.fn(async ({ where }) => {
          if (where?.slug === 'ceo') {
            return { id: 'role_ceo', slug: 'ceo', isRootRole: true, isActive: true }
          }
          return null
        }),
      },
      employee: {
        findUnique: jest.fn(async ({ where }) => ({
          id: where.id,
          name: where.id,
          email: `${where.id}@pointfex.com`,
          isSuspended: false,
          employeeRoles:
            where.id === 'emp_cto_01'
              ? [{ role: { id: 'r_cto', slug: 'cto', name: 'CTO' } }]
              : [],
          positionAssignments: [],
        })),
      },
    }

    const rbacService = new RbacService(
      prismaMock,
      { invalidateUsers: jest.fn() } as any,
      { log: jest.fn() } as any,
    )
    const accessService = new EmployeeAccessService(
      prismaMock,
      { invalidateUser: jest.fn() } as any,
      rbacService,
      { log: jest.fn() } as any,
    )

    const ctoActor: any = { id: 'emp_cto_01', role: 'cto' }

    // Attempt 1: Create custom role smuggling `system:root`
    await expect(
      rbacService.createRole(
        { name: 'Shadow Root', permissionCodes: ['system:root'] },
        ctoActor,
      ),
    ).rejects.toThrow(ForbiddenException)

    // Attempt 2: Non-CEO trying to assign any role to a C-level peer
    await expect(
      accessService.assignRoleToEmployee('emp_cto_01', { roleSlug: 'pm' }, {
        id: 'emp_pm_01',
        role: 'pm',
      } as any),
    ).rejects.toThrow(ForbiddenException)

    // Attempt 3: Trying to assign CEO role directly
    await expect(
      accessService.assignRoleToEmployee(
        'emp_dev_01',
        { roleSlug: 'ceo' },
        { id: 'emp_ceo_01', role: 'ceo' } as any,
      ),
    ).rejects.toThrow(/CEO role cannot be assigned directly/i)
  })
})

