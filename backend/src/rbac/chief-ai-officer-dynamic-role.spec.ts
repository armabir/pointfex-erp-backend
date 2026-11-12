import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthorizationScope } from '@prisma/client'
import { PermissionsGuard } from '../common/permissions.guard'
import { PrismaService } from '../common/prisma.service'
import {
  PERMISSIONS_ALL_KEY,
  PERMISSIONS_ANY_KEY,
} from '../common/require-permissions.decorator'
import { ApprovalsController } from './approvals.controller'
import { AuthorizationService } from './authorization.service'
import { DelegationsController } from './delegations.controller'
import { EmployeeAccessService } from './employee-access.service'
import { PermissionCacheService } from './permission-cache.service'
import { RbacService } from './rbac.service'
import { SecurityControlsController } from './security-controls.controller'

const CHIEF_AI_PERMISSIONS = [
  'projects:read_all',
  'quality_gates:read',
  'security_alerts:read',
  'test_runs:read',
  'consultancy:read',
  'audit_logs:read',
  'employees:read_directory',
  'performance:read_all',
  'reports:triage',
  'budgets:read_requests',
] as const

describe('Verification Suite: Dynamic "Chief AI Officer" Role, Effective Profile, Guard Coverage & Append-Only Prisma Guard', () => {
  const catalogCodes = [
    'tasks:read_own',
    'tasks:submit_work',
    'wallets:read_own',
    'roles:read',
    'treasury:read',
    'governance:read',
    ...CHIEF_AI_PERMISSIONS,
  ]

  const catalog = catalogCodes.map((code, idx) => ({
    id: `perm_${idx + 1}`,
    code,
    module: code.split(':')[0],
    resource: code.split(':')[0],
    action: code.split(':')[1] || 'read',
    description: code,
    isSensitive: false,
    isCritical: false,
    isDelegable: true,
    isDeprecated: false,
    isSystemRoot: false,
    category: { domains: ['engineering'] },
  }))

  function createDynamicEnvironment() {
    const devBasePerms = ['tasks:read_own', 'tasks:submit_work', 'wallets:read_own']
    const employees = new Map<string, any>([
      ['emp_ceo_01', { id: 'emp_ceo_01', name: 'Noor', email: 'noor@pointfex.internal', isSuspended: false, authVersion: 1 }],
      ['emp_dev_05', { id: 'emp_dev_05', name: 'Rashedul', email: 'rashed@pointfex.internal', isSuspended: false, authVersion: 1 }],
    ])
    const roles = new Map<string, any>([
      [
        'role_ceo',
        {
          id: 'role_ceo',
          slug: 'ceo',
          name: 'Chief Executive Officer',
          description: 'CEO role',
          isActive: true,
          isRootRole: true,
          isSystemDefault: true,
          wildcards: [],
          includeCritical: true,
          version: 1,
          rolePermissions: [],
        },
      ],
      [
        'role_dev',
        {
          id: 'role_dev',
          slug: 'developer',
          name: 'Developer',
          description: 'Baseline dev role',
          isActive: true,
          isRootRole: false,
          isSystemDefault: true,
          wildcards: [],
          includeCritical: false,
          version: 1,
          rolePermissions: devBasePerms.map((code) => ({
            id: `rp_dev_${code}`,
            permissionId: catalog.find((p) => p.code === code)!.id,
            permission: catalog.find((p) => p.code === code)!,
          })),
        },
      ],
    ])
    const userRoleAssignments: any[] = [
      {
        id: 'ura_dev_05',
        employeeId: 'emp_dev_05',
        roleId: 'role_dev',
        scope: 'SELF' as AuthorizationScope,
        scopeIds: [],
        startsAt: new Date('2026-01-01'),
        expiresAt: null,
        isActive: true,
        assignedById: 'emp_ceo_01',
      },
    ]
    const employeeRoles: any[] = [
      {
        id: 'er_ceo_01',
        employeeId: 'emp_ceo_01',
        roleId: 'role_ceo',
        isActive: true,
        expiresAt: null,
      },
      {
        id: 'er_dev_05',
        employeeId: 'emp_dev_05',
        roleId: 'role_dev',
        isActive: true,
        expiresAt: null,
      },
    ]
    const delegations: any[] = []
    const denials: any[] = []

    const prismaMock: any = {
      permission: {
        findMany: jest.fn(async ({ where }: any = {}) => {
          if (where?.OR) {
            const codes = new Set<string>()
            const ids = new Set<string>()
            for (const cond of where.OR) {
              if (cond?.code?.in) cond.code.in.forEach((c: string) => codes.add(c))
              if (cond?.id?.in) cond.id.in.forEach((id: string) => ids.add(id))
            }
            return catalog.filter((p) => codes.has(p.code) || ids.has(p.id))
          }
          if (where?.code?.in) {
            return catalog.filter((p) => where.code.in.includes(p.code))
          }
          return catalog
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          return catalog.find((p) => p.code === where?.code || p.id === where?.id) ?? null
        }),
      },
      permissionAlias: { findMany: jest.fn(async () => []) },
      role: {
        findFirst: jest.fn(async ({ where }: any) => {
          for (const r of roles.values()) {
            if (where?.id && r.id === where.id) return r
            if (where?.slug && r.slug === where.slug) return r
            if (where?.name && r.name === where.name) return r
            if (where?.OR) {
              for (const cond of where.OR) {
                if (cond.id && r.id === cond.id) return r
                if (cond.slug && r.slug === cond.slug) return r
                if (cond.name && r.name === cond.name) return r
              }
            }
          }
          return null
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          const r = where?.id ? roles.get(where.id) : Array.from(roles.values()).find((x) => x.slug === where?.slug)
          if (!r) return null
          return {
            ...r,
            employeeRoles: employeeRoles
              .filter((er) => er.roleId === r.id && er.isActive)
              .map((er) => ({ ...er, employee: employees.get(er.employeeId) })),
          }
        }),
        create: jest.fn(async ({ data }: any) => {
          const id = `role_${roles.size + 1}`
          const createdPerms = (data.rolePermissions?.create ?? [])
            .map((rp: any) => {
              const perm = catalog.find((p) => p.id === rp.permissionId)
              return perm ? { id: `rp_${id}_${perm.id}`, permissionId: perm.id, permission: perm } : null
            })
            .filter(Boolean)
          const role = {
            id,
            slug: data.slug,
            name: data.name,
            description: data.description,
            wildcards: data.wildcards ?? [],
            includeCritical: Boolean(data.includeCritical),
            isSystemDefault: Boolean(data.isSystemDefault),
            isRootRole: false,
            isActive: data.isActive ?? true,
            version: 1,
            rolePermissions: createdPerms,
          }
          roles.set(id, role)
          return role
        }),
      },
      rolePermission: {
        createMany: jest.fn(async ({ data }: any) => {
          for (const row of data) {
            const role = roles.get(row.roleId)
            const perm = catalog.find((p) => p.id === row.permissionId)
            if (role && perm && !role.rolePermissions.some((rp: any) => rp.permissionId === perm.id)) {
              role.rolePermissions.push({ id: `rp_${Date.now()}_${perm.id}`, permissionId: perm.id, permission: perm })
            }
          }
        }),
      },
      roleVersion: { upsert: jest.fn(async () => ({})) },
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          const emp = employees.get(where.id)
          if (!emp) return null
          return {
            ...emp,
            employeeRoles: employeeRoles
              .filter((er) => er.employeeId === emp.id && er.isActive)
              .map((er) => ({ ...er, role: roles.get(er.roleId) })),
            positionAssignments: [],
          }
        }),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ where, data }: any) => {
          const emp = employees.get(where.id)
          if (!emp) return null
          if (data?.authVersion?.increment) emp.authVersion += data.authVersion.increment
          return emp
        }),
        updateMany: jest.fn(async () => ({ count: 0 })),
      },
      employeeRole: {
        findMany: jest.fn(async ({ where }: any) =>
          employeeRoles
            .filter((er) => er.employeeId === where.employeeId && er.isActive)
            .map((er) => ({ ...er, role: roles.get(er.roleId) })),
        ),
        upsert: jest.fn(async ({ where, create }: any) => {
          const { employeeId, roleId } = where.employeeId_roleId
          let existing = employeeRoles.find((er) => er.employeeId === employeeId && er.roleId === roleId)
          if (existing) {
            existing.isActive = true
          } else {
            existing = { id: `er_${employeeRoles.length + 1}`, ...create }
            employeeRoles.push(existing)
          }
          return { ...existing, role: roles.get(roleId), employee: employees.get(employeeId) }
        }),
      },
      userRoleAssignment: {
        findMany: jest.fn(async ({ where }: any) =>
          userRoleAssignments
            .filter((ura) => ura.employeeId === where.employeeId && ura.isActive)
            .map((ura) => ({ ...ura, role: roles.get(ura.roleId) })),
        ),
        updateMany: jest.fn(async ({ where, data }: any) => {
          let count = 0
          for (const ura of userRoleAssignments) {
            if (ura.employeeId === where.employeeId && ura.roleId === where.roleId && ura.isActive) {
              Object.assign(ura, data)
              count += 1
            }
          }
          return { count }
        }),
        create: jest.fn(async ({ data }: any) => {
          const created = { id: `ura_${userRoleAssignments.length + 1}`, ...data }
          userRoleAssignments.push(created)
          return { ...created, role: roles.get(data.roleId), employee: employees.get(data.employeeId) }
        }),
        upsert: jest.fn(async ({ where, create }: any) => {
          const { employeeId, roleId } = where.employeeId_roleId
          let existing = userRoleAssignments.find((u) => u.employeeId === employeeId && u.roleId === roleId)
          if (existing) {
            existing.isActive = true
            existing.scope = create.scope
            existing.scopeIds = create.scopeIds
          } else {
            existing = { id: `ura_${userRoleAssignments.length + 1}`, ...create }
            userRoleAssignments.push(existing)
          }
          return { ...existing, role: roles.get(roleId), employee: employees.get(employeeId) }
        }),
      },
      userPermissionGrant: { findMany: jest.fn(async () => []) },
      employeePermission: { findMany: jest.fn(async () => []) },
      userPermissionDenial: {
        findMany: jest.fn(async ({ where }: any) =>
          denials.filter((d) => d.employeeId === where.employeeId && d.isActive),
        ),
      },
      delegation: {
        findMany: jest.fn(async ({ where }: any) =>
          delegations.filter((d) => d.delegateeId === where.delegateeId && d.status === 'ACTIVE'),
        ),
      },
      accessChangeRequest: { findMany: jest.fn(async () => []) },
      auditLog: { create: jest.fn(async (args: any) => args.data) },
    }
    prismaMock.$transaction = jest.fn(async (cb: any) => cb(prismaMock))

    const configMock: any = {
      get: jest.fn((k: string) => (k === 'AUTHZ_MODE' ? 'enforce' : undefined)),
    }
    const cache = new PermissionCacheService(configMock)
    const auditLogger: any = { log: jest.fn(async () => undefined) }
    const authz = new AuthorizationService(prismaMock, cache, configMock)
    authz.registerDelegationProvider({
      getActiveDelegationsForUser: async (empId, now) => {
        const grants: any[] = []
        for (const d of delegations) {
          if (d.delegateeId === empId && d.status === 'ACTIVE' && d.startsAt <= now && d.expiresAt > now) {
            for (const dp of d.permissions) {
              for (const ds of d.scopes) {
                grants.push({
                  code: dp.permission.code,
                  scope: ds.scope,
                  scopeIds: ds.scopeIds ?? [],
                  sourceType: 'delegation',
                  sourceId: d.id,
                  expiresAt: d.expiresAt,
                })
              }
            }
          }
        }
        return grants
      },
    })
    const rbacService = new RbacService(prismaMock, cache, auditLogger, authz)
    const employeeAccessService = new EmployeeAccessService(
      prismaMock,
      cache,
      rbacService,
      auditLogger,
      authz,
    )

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

    return {
      rbacService,
      employeeAccessService,
      authz,
      createGuard,
      delegations,
      denials,
    }
  }

  function mockCtx(userId: string, url: string, method = 'GET'): ExecutionContext {
    return {
      getHandler: () => (() => undefined) as any,
      getClass: () => class DynamicRoleCtrl {} as any,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: userId, role: 'developer', email: 'rashed@pointfex.internal' }, url, method }),
      }),
    } as unknown as ExecutionContext
  }

  it('creates Chief AI Officer role with 10 permissions, assigns it to a user, and verifies API access + effective snapshot with zero code changes', async () => {
    const { rbacService, employeeAccessService, authz, createGuard, delegations, denials } =
      createDynamicEnvironment()

    const ceoActor = { id: 'emp_ceo_01', email: 'noor@pointfex.internal', name: 'Noor', role: 'ceo' }

    // 1. Before role assignment: developer is blocked on all Chief AI Officer API routes
    const profileBefore = await rbacService.getEmployeeAccessProfile('emp_dev_05')
    expect(profileBefore.permissions).toEqual(['tasks:read_own', 'tasks:submit_work', 'wallets:read_own'])

    for (const ep of [
      { url: '/api/audit-logs', perm: 'audit_logs:read' },
      { url: '/api/engineering/quality-gates', perm: 'quality_gates:read' },
      { url: '/api/consultancy', perm: 'consultancy:read' },
      { url: '/api/finance/budget-requests', perm: 'budgets:read_requests' },
    ]) {
      await expect(
        createGuard([ep.perm]).canActivate(mockCtx('emp_dev_05', ep.url)),
      ).rejects.toThrow(ForbiddenException)
    }

    // 2. Dynamically create "Chief AI Officer" with 10 permissions (runtime DB record only)
    const createdRole = await rbacService.createRole(
      {
        name: 'Chief AI Officer',
        description: 'Leads AI engineering, quality gates, consultancy, and audit oversight',
        permissionCodes: [...CHIEF_AI_PERMISSIONS],
      },
      ceoActor,
    )
    expect(createdRole.slug).toBe('chief-ai-officer')
    expect(createdRole.rolePermissions).toHaveLength(10)

    // 3. Assign the brand-new role to emp_dev_05
    await employeeAccessService.assignRoleToEmployee(
      'emp_dev_05',
      { roleId: createdRole.id, scope: 'ORG' },
      ceoActor,
    )

    // 4. Verify effective permissions & profile reflect all 10 new permissions dynamically
    const effectiveAfter = await authz.resolveEffectiveAuthz('emp_dev_05')
    const profileAfter = await rbacService.getEmployeeAccessProfile('emp_dev_05')

    for (const perm of CHIEF_AI_PERMISSIONS) {
      expect(effectiveAfter.effectiveCodes).toContain(perm)
      expect(profileAfter.permissions).toContain(perm)
    }
    expect(profileAfter.permissions).toEqual(effectiveAfter.effectiveCodes)

    // 5. Verify PermissionsGuard allows all 10 newly granted API routes and still blocks ungranted ones
    const routeChecks = [
      { url: '/api/projects', perm: 'projects:read_all' },
      { url: '/api/engineering/quality-gates', perm: 'quality_gates:read' },
      { url: '/api/engineering/security-alerts', perm: 'security_alerts:read' },
      { url: '/api/engineering/test-runs', perm: 'test_runs:read' },
      { url: '/api/consultancy', perm: 'consultancy:read' },
      { url: '/api/audit-logs', perm: 'audit_logs:read' },
      { url: '/api/employees', perm: 'employees:read_directory' },
      { url: '/api/performance', perm: 'performance:read_all' },
      { url: '/api/reports', perm: 'reports:triage' },
      { url: '/api/finance/budget-requests', perm: 'budgets:read_requests' },
    ]
    for (const rc of routeChecks) {
      await expect(
        createGuard([rc.perm]).canActivate(mockCtx('emp_dev_05', rc.url)),
      ).resolves.toBe(true)
    }

    await expect(
      createGuard(['roles:read']).canActivate(mockCtx('emp_dev_05', '/api/rbac/roles')),
    ).rejects.toThrow(ForbiddenException)
    await expect(
      createGuard(['treasury:read']).canActivate(mockCtx('emp_dev_05', '/api/finance/treasury')),
    ).rejects.toThrow(ForbiddenException)

    // 6. Verify active delegations add into & explicit denials subtract out of getEmployeeAccessProfile
    delegations.push({
      id: 'del_1',
      delegatorId: 'emp_ceo_01',
      delegateeId: 'emp_dev_05',
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 3600_000),
      permissions: [{ permission: { code: 'governance:read' } }],
      scopes: [{ scope: 'ORG', scopeIds: [] }],
    })
    denials.push({
      id: 'den_1',
      employeeId: 'emp_dev_05',
      scope: 'ORG',
      scopeIds: [],
      isActive: true,
      expiresAt: null,
      permission: { code: 'reports:triage' },
    })
    await authz.invalidateUserCache('emp_dev_05')

    const profileWithDelegationAndDenial = await rbacService.getEmployeeAccessProfile('emp_dev_05')
    expect(profileWithDelegationAndDenial.permissions).toContain('governance:read')
    expect(profileWithDelegationAndDenial.permissions).not.toContain('reports:triage')

    // 7. Load real frontend resolveVisibleNavigation() from nav-registry.ts and verify sidebar updates dynamically with no frontend code change
    const navPath = path.resolve(__dirname, '../../../frontend/src/config/nav-registry.ts')
    const navSrc = fs.readFileSync(navPath, 'utf8')
    const navJs = ts.transpileModule(navSrc, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText
    const navModule = { exports: {} as any }
    const stubIcons = new Proxy({}, { get: (_, name) => String(name) })
    const loader = new Function('exports', 'require', 'module', navJs)
    loader(
      navModule.exports,
      (id: string) => {
        if (id === 'lucide-react') return stubIcons
        if (id === './workspaces') return { WORKSPACES: [] }
        return require(id)
      },
      navModule,
    )
    const { resolveVisibleNavigation } = navModule.exports

    const sidebarBefore = resolveVisibleNavigation(profileBefore.permissions)
    expect(sidebarBefore.visibleItems.map((i: any) => i.id)).toEqual(
      expect.arrayContaining(['dashboard', 'inbox', 'tasks', 'earnings', 'report', 'settings']),
    )

    const sidebarAfter = resolveVisibleNavigation(profileAfter.permissions)
    const afterIds = sidebarAfter.visibleItems.map((i: any) => i.id)
    expect(afterIds).toEqual(
      expect.arrayContaining([
        'dashboard',
        'tasks',
        'projects-repos',
        'people',
        'budget-finance',
        'performance',
        'code-quality',
        'security-testing',
        'consultancy',
        'earnings',
        'reports',
        'audit-log',
        'settings',
      ]),
    )
    expect(afterIds).not.toContain('access-control')
    expect(afterIds).not.toContain('delegations')

    // With active delegated `governance:read`, Governance & Access immediately appears in sidebar
    const sidebarDelegated = resolveVisibleNavigation(profileWithDelegationAndDenial.permissions)
    expect(sidebarDelegated.visibleItems.map((i: any) => i.id)).toContain('access-control')
    expect(sidebarDelegated.visibleItems.map((i: any) => i.id)).not.toContain('reports') // denied reports:triage!
  })

  it('enforces permission decorators on operational routes across Approvals, Delegations & SecurityControls controllers', () => {
    const reflector = new Reflector()
    const checkDecorated = (ControllerCls: any, methods: string[]) => {
      for (const methodName of methods) {
        const handler = ControllerCls.prototype[methodName]
        const allPerms = reflector.get<string[]>(PERMISSIONS_ALL_KEY, handler) || []
        const anyPerms = reflector.get<string[]>(PERMISSIONS_ANY_KEY, handler) || []
        expect(allPerms.length + anyPerms.length).toBeGreaterThan(0)
      }
    }

    checkDecorated(ApprovalsController, ['getInbox', 'getMine', 'initiate', 'approve', 'reject', 'sweep'])
    checkDecorated(DelegationsController, ['listMine', 'listAll', 'create', 'approve', 'revoke', 'expireSweep'])
    checkDecorated(SecurityControlsController, [
      'listMySessions',
      'listAllSessions',
      'revokeSession',
      'enrollMfa',
      'verifyMfa',
      'listAccessReviews',
      'createAccessReview',
      'decideAccessReview',
      'getMyXp',
      'getEmployeeXp',
      'awardXp',
      'reverseXp',
    ])
  })

  it('blocks runtime delete/update/truncate on append-only audit_logs in PrismaService', async () => {
    const prisma = new PrismaService()
    expect(() => (prisma.auditLog as any).delete({ where: { id: 'act_101' } })).toThrow(/append-only/i)
    expect(() => (prisma.auditLog as any).deleteMany({})).toThrow(/append-only/i)
    expect(() => (prisma.auditLog as any).update({ where: { id: 'act_101' }, data: { action: 'X' } })).toThrow(
      /append-only/i,
    )
    expect(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "audit_logs"')).toThrow(/append-only/i)
    expect(() => prisma.$executeRawUnsafe('DROP TABLE "audit_logs"')).toThrow(/append-only/i)
  })
})
