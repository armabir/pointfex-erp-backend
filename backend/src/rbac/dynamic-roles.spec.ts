import { ForbiddenException, BadRequestException } from '@nestjs/common'
import { CeoBootstrapService } from './ceo-bootstrap.service'
import { RbacService } from './rbac.service'
import {
  expandDomainWildcards,
  normalizeDomainWildcards,
  scopeSatisfies,
} from './wildcard-resolver.util'
import { DEFAULT_ROLE_TEMPLATES } from './dynamic-roles.seeder'

describe('Phase 2: Dynamic Roles, Wildcards, Templates, Versioning & CEO Bootstrap', () => {
  describe('Domain Wildcards & Scopes', () => {
    const sampleCatalog = [
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
        code: 'payroll:calculate',
        isCritical: false,
        isDeprecated: false,
        isSystemRoot: false,
        category: { domains: ['hr', 'finance'] },
      },
      {
        code: 'treasury:transfer',
        isCritical: true,
        isDeprecated: false,
        isSystemRoot: false,
        category: { domains: ['finance'] },
      },
      {
        code: 'employees:suspend',
        isCritical: false,
        isDeprecated: true,
        isSystemRoot: false,
        category: null,
      },
    ]

    it('isolates domain wildcards strictly and excludes ⚠ critical codes unless includeCritical=true', () => {
      const ctoExpanded = expandDomainWildcards(['engineering:*'], false, sampleCatalog)
      expect(ctoExpanded).toEqual(['tasks:approve'])
      expect(ctoExpanded).not.toContain('deployments:approve')
      expect(ctoExpanded).not.toContain('payroll:calculate')
      expect(ctoExpanded).not.toContain('treasury:transfer')
      expect(ctoExpanded).not.toContain('system:root')
      expect(ctoExpanded).not.toContain('employees:suspend')

      const withCritical = expandDomainWildcards(['engineering:*'], true, sampleCatalog)
      expect(withCritical).toEqual(['tasks:approve', 'deployments:approve'])
      expect(withCritical).not.toContain('system:root')

      const financeExpanded = expandDomainWildcards(['finance:*'], false, sampleCatalog)
      expect(financeExpanded).toEqual(['payroll:calculate'])
      expect(financeExpanded).not.toContain('treasury:transfer')
    })

    it('validates allowed domain wildcards and rejects arbitrary/cross-domain wildcards', () => {
      expect(normalizeDomainWildcards(['Engineering:*', 'ops:*', 'engineering:*'])).toEqual([
        'engineering:*',
        'ops:*',
      ])
      expect(() => normalizeDomainWildcards(['*:*'])).toThrow(/Invalid wildcard/i)
      expect(() => normalizeDomainWildcards(['payments:*'])).toThrow(/Invalid wildcard/i)
    })

    it('enforces scope hierarchy and container scopeIds accurately', () => {
      expect(scopeSatisfies('GLOBAL', [], 'ORG')).toBe(true)
      expect(scopeSatisfies('ORG', [], 'GLOBAL')).toBe(false)
      expect(scopeSatisfies('ORG', [], 'PROJECT', 'proj_01')).toBe(true)
      expect(scopeSatisfies('PROJECT', ['proj_01'], 'PROJECT', 'proj_01')).toBe(true)
      expect(scopeSatisfies('PROJECT', ['proj_01'], 'PROJECT', 'proj_02')).toBe(false)
      expect(scopeSatisfies('SQUAD', ['team_a'], 'PROJECT', 'proj_01')).toBe(false)
      expect(scopeSatisfies('PROJECT', ['proj_01'], 'SELF')).toBe(true)
      expect(scopeSatisfies('SELF', [], 'SQUAD')).toBe(false)
    })

    it('defines all Section C default authority templates', () => {
      const codes = new Set(DEFAULT_ROLE_TEMPLATES.map((t) => t.code))
      expect(codes.has('CEO')).toBe(true)
      expect(codes.has('COO')).toBe(true)
      expect(codes.has('CTO')).toBe(true)
      expect(codes.has('CFO')).toBe(true)
      expect(codes.has('CHRO')).toBe(true)
      expect(codes.has('CPO')).toBe(true)
      expect(codes.has('CRO')).toBe(true)
      expect(codes.has('PM')).toBe(true)
      expect(codes.has('DEVELOPER')).toBe(true)
      expect(codes.has('EMPLOYEE_BASELINE')).toBe(true)
    })
  })

  describe('CeoBootstrapService Invariant & Lockout Recovery', () => {
    it('recovers automatically when zero active holders of system:root exist', async () => {
      const assignments: any[] = []
      const audits: any[] = []
      const empRoles: any[] = []
      const txMock = {
        employee: { update: jest.fn(async ({ data }) => ({ id: 'emp_ceo_01', ...data })) },
        userRoleAssignment: {
          create: jest.fn(async ({ data }) => {
            const row = { id: 'ura_1', ...data }
            assignments.push(row)
            return row
          }),
        },
        employeeRole: {
          upsert: jest.fn(async ({ create }) => {
            empRoles.push(create)
            return create
          }),
        },
      }
      const prismaMock: any = {
        permission: {
          findUnique: jest.fn(async () => ({ id: 'perm_root', code: 'system:root' })),
        },
        role: {
          findFirst: jest.fn(async () => ({
            id: 'role_ceo',
            slug: 'ceo',
            isActive: true,
            isRootRole: true,
            includeCritical: true,
          })),
        },
        rolePermission: { upsert: jest.fn(async () => ({})) },
        userRoleAssignment: {
          findMany: jest.fn(async () => []),
        },
        employee: {
          findUnique: jest.fn(async () => ({
            id: 'emp_ceo_01',
            name: 'Noor',
            email: 'noor@pointfex.com',
            isSuspended: true,
          })),
        },
        $transaction: jest.fn(async (cb) => cb(txMock)),
      }
      const cacheMock: any = { invalidateUser: jest.fn(async () => undefined) }
      const auditMock: any = { log: jest.fn(async (entry) => audits.push(entry)) }

      const service = new CeoBootstrapService(prismaMock, cacheMock, auditMock)
      const res = await service.ensureSingleRootCeo()

      expect(res.healthy).toBe(true)
      expect(res.recovered).toBe(true)
      expect(res.activeHolderIds).toEqual(['emp_ceo_01'])
      expect(assignments[0].scope).toBe('GLOBAL')
      expect(txMock.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp_ceo_01' },
        data: { isSuspended: false },
      })
      expect(audits[0].action).toBe('CEO_LOCKOUT_RECOVERY')
      expect(cacheMock.invalidateUser).toHaveBeenCalledWith('emp_ceo_01')
    })

    it('enforces strictly one active holder by revoking duplicate root assignments', async () => {
      const updates: any[] = []
      const prismaMock: any = {
        permission: { findUnique: jest.fn(async () => ({ id: 'perm_root', code: 'system:root' })) },
        role: {
          findFirst: jest.fn(async () => ({
            id: 'role_ceo',
            slug: 'ceo',
            isActive: true,
            isRootRole: true,
            includeCritical: true,
          })),
        },
        rolePermission: { upsert: jest.fn(async () => ({})) },
        userRoleAssignment: {
          findMany: jest.fn(async () => [
            {
              id: 'ura_ceo',
              employeeId: 'emp_ceo_01',
              employee: { id: 'emp_ceo_01', isSuspended: false },
            },
            {
              id: 'ura_rogue',
              employeeId: 'emp_rogue',
              employee: { id: 'emp_rogue', isSuspended: false },
            },
          ]),
          update: jest.fn(async (args) => updates.push(args)),
        },
        employeeRole: { updateMany: jest.fn(async () => ({ count: 1 })) },
      }
      const cacheMock: any = { invalidateUser: jest.fn(async () => undefined) }
      const auditMock: any = { log: jest.fn() }

      const service = new CeoBootstrapService(prismaMock, cacheMock, auditMock)
      const res = await service.ensureSingleRootCeo()

      expect(res.deduplicated).toBe(true)
      expect(res.activeHolderIds).toEqual(['emp_ceo_01'])
      expect(updates).toHaveLength(1)
      expect(updates[0].where.id).toBe('ura_rogue')
      expect(cacheMock.invalidateUser).toHaveBeenCalledWith('emp_rogue')
    })
  })

  describe('RbacService Dynamic Role Guards & Cloning', () => {
    const ceoActor: any = { id: 'emp_ceo_01', role: 'ceo', name: 'Noor', email: 'noor@pointfex.com' }

    it('hides system:root from normal role editor list and rejects attaching/cloning/deactivating root role', async () => {
      const prismaMock: any = {
        permission: {
          findMany: jest.fn(async () => [{ id: 'p1', code: 'tasks:read_own', module: 'work' }]),
          findFirst: jest.fn(async () => ({ id: 'p_root', code: 'system:root', isSystemRoot: true })),
        },
        role: {
          findUnique: jest.fn(async ({ where }) =>
            where.id === 'role_ceo'
              ? { id: 'role_ceo', slug: 'ceo', name: 'CEO', isRootRole: true, isActive: true, version: 1, rolePermissions: [] }
              : { id: 'role_custom', slug: 'lead', name: 'Lead', isRootRole: false, isActive: true, version: 1, rolePermissions: [] },
          ),
        },
      }
      const service = new RbacService(
        prismaMock,
        { invalidateUsers: jest.fn() } as any,
        { log: jest.fn() } as any,
      )

      await service.listPermissions()
      expect(prismaMock.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSystemRoot: false, isDeprecated: false }),
        }),
      )

      await expect(
        service.attachPermission('role_custom', { permissionCode: 'system:root' }, ceoActor),
      ).rejects.toThrow(ForbiddenException)

      await expect(service.cloneRole('role_ceo', { name: 'CEO Clone' }, ceoActor)).rejects.toThrow(
        ForbiddenException,
      )

      await expect(service.setRoleActiveState('role_ceo', false, ceoActor)).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('clones non-root role with v1 snapshot while stripping any system:root permission', async () => {
      const createdRoles: any[] = []
      const versions: any[] = []
      const prismaMock: any = {
        role: {
          findUnique: jest.fn(async () => ({
            id: 'role_eng',
            slug: 'eng-lead',
            name: 'Eng Lead',
            description: 'Leads squad',
            wildcards: ['engineering:*'],
            includeCritical: false,
            isRootRole: false,
            templateCode: 'SQUAD_LEAD',
            version: 2,
            rolePermissions: [
              { permissionId: 'p1', permission: { id: 'p1', code: 'tasks:approve', isSystemRoot: false } },
              { permissionId: 'p_root', permission: { id: 'p_root', code: 'system:root', isSystemRoot: true } },
            ],
          })),
          findFirst: jest.fn(async () => null),
        },
        $transaction: jest.fn(async (cb) =>
          cb({
            role: {
              create: jest.fn(async ({ data }) => {
                const r = { id: 'role_clone_1', ...data }
                createdRoles.push(r)
                return r
              }),
              findUnique: jest.fn(async () => ({
                id: 'role_clone_1',
                name: 'Eng Lead Copy',
                description: 'Leads squad',
                wildcards: ['engineering:*'],
                includeCritical: false,
                isActive: true,
                rolePermissions: [{ permission: { code: 'tasks:approve' } }],
              })),
            },
            roleVersion: {
              upsert: jest.fn(async ({ create }) => {
                versions.push(create)
                return create
              }),
            },
          }),
        ),
      }
      const service = new RbacService(
        prismaMock,
        { invalidateUsers: jest.fn() } as any,
        { log: jest.fn() } as any,
      )

      const cloned = await service.cloneRole('role_eng', { name: 'Eng Lead Copy' }, ceoActor)
      expect(cloned.id).toBe('role_clone_1')
      expect(createdRoles[0].rolePermissions.create).toEqual([
        { permissionId: 'p1', grantedById: 'emp_ceo_01' },
      ])
      expect(versions[0].version).toBe(1)
      expect(versions[0].permissionCodes).toEqual(['tasks:approve'])
    })

    it('rejects invalid wildcards in createRole cleanly', async () => {
      const prismaMock: any = {
        role: { findFirst: jest.fn(async () => null) },
      }
      const service = new RbacService(
        prismaMock,
        { invalidateUsers: jest.fn() } as any,
        { log: jest.fn() } as any,
      )

      await expect(
        service.createRole({ name: 'Bad Role', wildcards: ['everything:*'] }, ceoActor),
      ).rejects.toThrow(BadRequestException)
    })
  })
})

