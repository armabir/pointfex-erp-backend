import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { AuthorizationService } from './authorization.service'
import { DelegationService } from './delegation.service'
import { PermissionCacheService } from './permission-cache.service'
import { loadPermissionsMasterCatalog } from './permission-catalog.parser'

describe('Phase 4: Delegation Engine (Rules 1-10, Negative ⚠ Tests & CTO->SeniorDev E2E)', () => {
  const catalog = loadPermissionsMasterCatalog()
  const catalogByCode = new Map(catalog.permissions.map((p) => [p.code, p]))

  function buildDelegationHarness() {
    let seq = 0
    const employees = new Map<string, any>([
      ['emp_ceo_01', { id: 'emp_ceo_01', name: 'Noor', email: 'noor@pointfex.com', isSuspended: false, authVersion: 1 }],
      ['emp_cto_01', { id: 'emp_cto_01', name: 'Abir', email: 'abir@pointfex.com', isSuspended: false, authVersion: 1 }],
      ['emp_dev_01', { id: 'emp_dev_01', name: 'Fahim', email: 'fahim@pointfex.com', isSuspended: false, authVersion: 1 }],
      ['emp_dev_02', { id: 'emp_dev_02', name: 'Tariq', email: 'tariq@pointfex.com', isSuspended: false, authVersion: 1 }],
      ['emp_chro_01', { id: 'emp_chro_01', name: 'Naim', email: 'naim@pointfex.com', isSuspended: false, authVersion: 1 }],
    ])

    const roleAssignments = new Map<string, any[]>([
      [
        'emp_ceo_01',
        [
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
      ],
      [
        'emp_cto_01',
        [
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
              rolePermissions: [
                { permission: { code: 'deployments:approve' } },
                { permission: { code: 'tasks:approve' } },
                { permission: { code: 'roles:update' } },
              ],
            },
          },
        ],
      ],
      [
        'emp_dev_01',
        [
          {
            id: 'ura_dev_1',
            scope: 'SELF',
            scopeIds: [],
            expiresAt: null,
            role: {
              slug: 'developer',
              isRootRole: false,
              wildcards: [],
              includeCritical: false,
              rolePermissions: [{ permission: { code: 'tasks:submit_work' } }],
            },
          },
        ],
      ],
      [
        'emp_dev_02',
        [
          {
            id: 'ura_dev_2',
            scope: 'SELF',
            scopeIds: [],
            expiresAt: null,
            role: {
              slug: 'developer',
              isRootRole: false,
              wildcards: [],
              includeCritical: false,
              rolePermissions: [{ permission: { code: 'tasks:submit_work' } }],
            },
          },
        ],
      ],
      [
        'emp_chro_01',
        [
          {
            id: 'ura_chro',
            scope: 'ORG',
            scopeIds: [],
            expiresAt: null,
            role: {
              slug: 'chro',
              isRootRole: false,
              wildcards: ['hr:*'],
              includeCritical: false,
              rolePermissions: [{ permission: { code: 'delegations:approve' } }],
            },
          },
        ],
      ],
    ])

    const policies = new Map<string, any>([
      ['max_delegation_days', 30],
      ['allow_redelegation_depth', 1],
    ])
    const delegations: any[] = []
    const audits: any[] = []

    const enrichPerm = (p: any) => ({
      id: `perm_${p.code}`,
      code: p.code,
      resource: p.resource,
      action: p.action,
      module: p.categorySlug,
      name: p.name,
      description: p.name,
      isCritical: p.isCritical,
      isDelegable: p.isDelegable,
      isDeprecated: false,
      isSystemRoot: p.isSystemRoot,
      isSensitive: p.code === 'roles:update',
      category: { domains: p.domains },
    })

    const prismaMock: any = {
      employee: {
        findUnique: jest.fn(async ({ where }) => employees.get(where.id) ?? null),
        update: jest.fn(async ({ where, data }) => {
          const emp = employees.get(where.id)
          if (emp && data.authVersion?.increment) emp.authVersion += data.authVersion.increment
          return emp
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          for (const id of where.id.in) {
            const emp = employees.get(id)
            if (emp && data.authVersion?.increment) emp.authVersion += data.authVersion.increment
          }
          return { count: where.id.in.length }
        }),
      },
      userRoleAssignment: {
        findMany: jest.fn(async ({ where }) => roleAssignments.get(where.employeeId) ?? []),
      },
      employeeRole: { findMany: jest.fn(async () => []) },
      userPermissionGrant: { findMany: jest.fn(async () => []) },
      employeePermission: { findMany: jest.fn(async () => []) },
      userPermissionDenial: { findMany: jest.fn(async () => []) },
      permissionAlias: { findMany: jest.fn(async () => []) },
      authorizationPolicy: {
        findUnique: jest.fn(async ({ where }) =>
          policies.has(where.key) ? { key: where.key, value: policies.get(where.key) } : null,
        ),
      },
      permission: {
        findMany: jest.fn(async (args?: any) => {
          if (args?.where?.code?.in) {
            return args.where.code.in
              .map((c: string) => catalogByCode.get(c))
              .filter(Boolean)
              .map(enrichPerm)
          }
          return catalog.permissions.map(enrichPerm)
        }),
        findUnique: jest.fn(async ({ where }) => {
          const p = catalogByCode.get(where.code)
          return p ? enrichPerm(p) : null
        }),
      },
      delegation: {
        create: jest.fn(async ({ data }) => {
          const id = `del_${++seq}`
          const perms = data.permissions.create.map((pc: any) => {
            const code = pc.permissionId.replace(/^perm_/, '')
            return { permission: enrichPerm(catalogByCode.get(code)) }
          })
          const row = {
            id,
            delegatorId: data.delegatorId,
            delegateeId: data.delegateeId,
            status: data.status,
            reason: data.reason,
            startsAt: data.startsAt,
            expiresAt: data.expiresAt,
            depth: data.depth,
            requiresApproval: data.requiresApproval,
            permissions: perms,
            scopes: data.scopes.create,
            createdAt: new Date(),
          }
          delegations.push(row)
          return row
        }),
        findUnique: jest.fn(async ({ where }) => delegations.find((d) => d.id === where.id) ?? null),
        findMany: jest.fn(async ({ where }) => {
          return delegations.filter((d) => {
            if (where.delegateeId && d.delegateeId !== where.delegateeId) return false
            if (where.delegatorId && d.delegatorId !== where.delegatorId) return false
            if (where.status) {
              if (typeof where.status === 'string' && d.status !== where.status) return false
              if (where.status.in && !where.status.in.includes(d.status)) return false
            }
            if (where.startsAt?.lte && d.startsAt > where.startsAt.lte) return false
            if (where.expiresAt?.gt && d.expiresAt <= where.expiresAt.gt) return false
            if (where.expiresAt?.lte && d.expiresAt > where.expiresAt.lte) return false
            if (where.delegator?.isSuspended === false) {
              if (employees.get(d.delegatorId)?.isSuspended) return false
            }
            return true
          })
        }),
        update: jest.fn(async ({ where, data }) => {
          const row = delegations.find((d) => d.id === where.id)
          Object.assign(row, data)
          return row
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0
          for (const d of delegations) {
            if (where.id?.in?.includes(d.id)) {
              Object.assign(d, data)
              count++
            }
          }
          return { count }
        }),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    }

    const configMock: any = {
      get: jest.fn((k: string) => (k === 'AUTHZ_MODE' ? 'enforce' : undefined)),
    }
    const cache = new PermissionCacheService(configMock)
    const authz = new AuthorizationService(prismaMock, cache, configMock)
    const auditMock: any = { log: jest.fn(async (entry) => audits.push(entry)) }
    const delegationService = new DelegationService(prismaMock, authz, auditMock)
    authz.registerDelegationProvider(delegationService)

    return { employees, delegations, audits, authz, delegationService }
  }

  const ctoActor: any = { id: 'emp_cto_01', role: 'cto', name: 'Abir', email: 'abir@pointfex.com' }
  const ceoActor: any = { id: 'emp_ceo_01', role: 'ceo', name: 'Noor', email: 'noor@pointfex.com' }
  const dev1Actor: any = { id: 'emp_dev_01', role: 'developer', name: 'Fahim', email: 'fahim@pointfex.com' }
  const chroActor: any = { id: 'emp_chro_01', role: 'chro', name: 'Naim', email: 'naim@pointfex.com' }

  it('END-TO-END: CTO delegates deployments:approve for Project A to Senior Dev; allowed in A, denied in B, lost on expiry & revocation', async () => {
    const { authz, delegationService, delegations } = buildDelegationHarness()
    const now = Date.now()

    const created = await delegationService.createDelegation(ctoActor, {
      delegateeId: 'emp_dev_01',
      permissionCodes: ['deployments:approve'],
      scope: 'PROJECT',
      scopeIds: ['proj_A'],
      reason: 'Emergency release weekend cover for Project A',
      startsAt: new Date(now - 60_000),
      expiresAt: new Date(now + 400),
    })

    expect(created.status).toBe('ACTIVE')

    // Senior Dev can approve in Project A
    const checkA = await authz.check('emp_dev_01', 'deployments:approve', { projectId: 'proj_A' })
    expect(checkA.allowed).toBe(true)
    expect(checkA.source).toBe('delegation')

    // Senior Dev CANNOT approve in Project B
    const checkB = await authz.check('emp_dev_01', 'deployments:approve', { projectId: 'proj_B' })
    expect(checkB.allowed).toBe(false)

    // Rule 10: Immediate check-time expiry (without waiting for scheduler sweep!)
    await new Promise((resolve) => setTimeout(resolve, 450))
    const afterExpiry = await authz.check('emp_dev_01', 'deployments:approve', {
      projectId: 'proj_A',
    })
    expect(afterExpiry.allowed).toBe(false)

    // Renew and verify Rule 8 explicit revocation works and preserves immutable history
    const renewed = await delegationService.createDelegation(ctoActor, {
      delegateeId: 'emp_dev_01',
      permissionCodes: ['deployments:approve'],
      scope: 'PROJECT',
      scopeIds: ['proj_A'],
      reason: 'Extended cover',
      startsAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 3600_000),
    })
    expect((await authz.check('emp_dev_01', 'deployments:approve', { projectId: 'proj_A' })).allowed).toBe(
      true,
    )

    await delegationService.revokeDelegation(renewed.id, ctoActor, 'Release finished early')
    expect((await authz.check('emp_dev_01', 'deployments:approve', { projectId: 'proj_A' })).allowed).toBe(
      false,
    )
    expect(delegations).toHaveLength(2) // Rule 9: immutable history preserved
  })

  it('NEGATIVE TESTS: Rejects delegating EVERY single one of the 57 ⚠ critical codes (even by CEO)', async () => {
    const { delegationService } = buildDelegationHarness()
    const criticalCodes = catalog.permissions.filter((p) => p.isCritical).map((p) => p.code)
    expect(criticalCodes).toHaveLength(57)

    const expiresAt = new Date(Date.now() + 3600_000)
    for (const code of criticalCodes) {
      await expect(
        delegationService.createDelegation(ceoActor, {
          delegateeId: 'emp_dev_01',
          permissionCodes: [code],
          scope: 'ORG',
          reason: `Attempt delegating critical code ${code}`,
          expiresAt,
        }),
      ).rejects.toThrow(ForbiddenException)
    }
  })

  it('Enforces Rules 1, 2, 3, 5, 7, 8: hold check, max 30d duration, no re-delegation, approval flow, & cascade revoke on suspension', async () => {
    const { authz, delegationService, employees } = buildDelegationHarness()
    const now = Date.now()

    // Rule 1: Cannot delegate unheld permission (CTO doesn't hold payroll:calculate)
    await expect(
      delegationService.createDelegation(ctoActor, {
        delegateeId: 'emp_dev_01',
        permissionCodes: ['payroll:calculate'],
        scope: 'ORG',
        reason: 'Privilege escalation attempt',
        expiresAt: new Date(now + 3600_000),
      }),
    ).rejects.toThrow(ForbiddenException)

    // Rule 2: Cannot exceed 30-day max duration
    await expect(
      delegationService.createDelegation(ctoActor, {
        delegateeId: 'emp_dev_01',
        permissionCodes: ['tasks:approve'],
        scope: 'PROJECT',
        scopeIds: ['proj_A'],
        reason: 'Too long delegation',
        startsAt: new Date(now),
        expiresAt: new Date(now + 31 * 24 * 60 * 60 * 1000),
      }),
    ).rejects.toThrow(BadRequestException)

    // Rule 3: Senior Dev gets tasks:approve via delegation -> CANNOT re-delegate it to Dev 2
    await delegationService.createDelegation(ctoActor, {
      delegateeId: 'emp_dev_01',
      permissionCodes: ['tasks:approve'],
      scope: 'PROJECT',
      scopeIds: ['proj_A'],
      reason: 'Delegation depth 1',
      startsAt: new Date(now - 1000),
      expiresAt: new Date(now + 7 * 24 * 3600_000),
    })

    await expect(
      delegationService.createDelegation(dev1Actor, {
        delegateeId: 'emp_dev_02',
        permissionCodes: ['tasks:approve'],
        scope: 'PROJECT',
        scopeIds: ['proj_A'],
        reason: 'Illegal depth-2 re-delegation',
        expiresAt: new Date(now + 3600_000),
      }),
    ).rejects.toThrow(ForbiddenException)

    // Rule 7: Sensitive permission (`roles:update`) requires approval & blocks self/delegatee approval
    const sensitiveDel = await delegationService.createDelegation(ctoActor, {
      delegateeId: 'emp_dev_01',
      permissionCodes: ['roles:update'],
      scope: 'ORG',
      reason: 'Need temp role editor',
      startsAt: new Date(now - 1000),
      expiresAt: new Date(now + 3600_000),
    })
    expect(sensitiveDel.status).toBe('PENDING_APPROVAL')
    expect((await authz.check('emp_dev_01', 'roles:update')).allowed).toBe(false)

    await expect(delegationService.approveDelegation(sensitiveDel.id, ctoActor)).rejects.toThrow(
      ForbiddenException,
    )
    await expect(delegationService.approveDelegation(sensitiveDel.id, dev1Actor)).rejects.toThrow(
      ForbiddenException,
    )
    await delegationService.approveDelegation(sensitiveDel.id, chroActor)
    expect((await authz.check('emp_dev_01', 'roles:update')).allowed).toBe(true)

    // Rule 5: Suspending CTO cascades immediate revocation of CTO's active delegations
    employees.get('emp_cto_01').isSuspended = true
    const cascade = await delegationService.cascadeRevokeForDelegator(
      'emp_cto_01',
      'DELEGATOR_SUSPENDED',
    )
    expect(cascade.revokedCount).toBe(2)
    expect(
      (await authz.check('emp_dev_01', 'tasks:approve', { projectId: 'proj_A' })).allowed,
    ).toBe(false)
    expect((await authz.check('emp_dev_01', 'roles:update')).allowed).toBe(false)
  })
})
