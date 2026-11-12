import {
  LEGACY_DEPRECATED_PERMISSIONS,
  LEGACY_PERMISSION_ALIASES,
  LEGACY_SENSITIVE_CRITICAL_CODES,
  LEGACY_SENSITIVE_NON_CRITICAL_CODES,
  loadPermissionsMasterCatalog,
  parsePermissionsMasterMarkdown,
  splitPermissionCode,
} from './permission-catalog.parser'
import { seedPermissionCatalog } from './permission-catalog.seeder'

function createInMemoryPrismaMock() {
  const categories = new Map<string, any>()
  const permissions = new Map<string, any>()
  const aliases = new Map<string, any>()
  let seq = 0

  const prisma = {
    permissionCategory: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const existing = categories.get(where.code)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          categories.set(where.code, updated)
          return updated
        }
        const created = {
          id: `cat_${++seq}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        categories.set(where.code, created)
        return created
      }),
    },
    permission: {
      findMany: jest.fn(async () => Array.from(permissions.values())),
      upsert: jest.fn(async ({ where, create, update }) => {
        const existing = permissions.get(where.code)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          permissions.set(where.code, updated)
          return updated
        }
        const created = {
          id: `perm_${++seq}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        permissions.set(where.code, created)
        return created
      }),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    permissionAlias: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const key = `${where.legacyCode_targetCode.legacyCode}->${where.legacyCode_targetCode.targetCode}`
        const existing = aliases.get(key)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          aliases.set(key, updated)
          return updated
        }
        const created = {
          id: `alias_${++seq}`,
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        aliases.set(key, created)
        return created
      }),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  }

  return { prisma, categories, permissions, aliases }
}

describe('Phase 1: Master Permission Catalog Parser & Idempotent Seeder', () => {
  it('parses docs/permissions_master.md verbatim: 21 modules, 606 codes, 57 critical ⚠', () => {
    const catalog = loadPermissionsMasterCatalog()

    expect(catalog.stats.categoryCount).toBe(21)
    expect(catalog.stats.permissionCount).toBe(606)
    expect(catalog.stats.criticalCount).toBe(57)
    expect(catalog.stats.delegableCount).toBe(549)

    expect(catalog.categories.map((c) => c.code)).toEqual([
      '00',
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
    ])

    const byCode = new Map(catalog.permissions.map((p) => [p.code, p]))
    const root = byCode.get('system:root')
    expect(root).toBeDefined()
    expect(root?.categoryCode).toBe('00')
    expect(root?.domains).toEqual(['all'])
    expect(root?.isCritical).toBe(true)
    expect(root?.isDelegable).toBe(false)
    expect(root?.isSystemRoot).toBe(true)

    const catMap = new Map(catalog.categories.map((c) => [c.code, c]))
    expect(catMap.get('06')?.domains).toEqual(['hr', 'finance'])
    expect(catMap.get('08')?.domains).toEqual(['finance', 'ops'])
    expect(catMap.get('10')?.domains).toEqual(['ops', 'engineering'])
    expect(catMap.get('20')?.domains).toEqual(['admin', 'ops'])
  })

  it('splits 2-part and 3-part permission codes losslessly into unique (resource, action)', () => {
    expect(splitPermissionCode('roles:create')).toEqual({ resource: 'roles', action: 'create' })
    expect(splitPermissionCode('qa:test_plans:read')).toEqual({
      resource: 'qa:test_plans',
      action: 'read',
    })
    expect(splitPermissionCode('support:tickets:resolve')).toEqual({
      resource: 'support:tickets',
      action: 'resolve',
    })
    expect(splitPermissionCode('sales:reports:read')).toEqual({
      resource: 'sales:reports',
      action: 'read',
    })

    const catalog = loadPermissionsMasterCatalog()
    const pairs = new Set(catalog.permissions.map((p) => `${p.resource}::${p.action}`))
    expect(pairs.size).toBe(606)
  })

  it('preserves all 21 sensitive non-critical codes and maps deprecated legacy aliases cleanly', () => {
    const catalog = loadPermissionsMasterCatalog()
    const byCode = new Map(catalog.permissions.map((p) => [p.code, p]))

    expect(LEGACY_SENSITIVE_NON_CRITICAL_CODES).toHaveLength(21)
    expect(LEGACY_SENSITIVE_CRITICAL_CODES).toHaveLength(5)
    expect(LEGACY_DEPRECATED_PERMISSIONS).toHaveLength(2)

    for (const code of LEGACY_SENSITIVE_NON_CRITICAL_CODES) {
      const parsed = byCode.get(code)
      expect(parsed).toBeDefined()
      expect(parsed?.isCritical).toBe(false)
    }

    for (const code of LEGACY_SENSITIVE_CRITICAL_CODES) {
      const parsed = byCode.get(code)
      expect(parsed).toBeDefined()
      expect(parsed?.isCritical).toBe(true)
    }

    expect(LEGACY_PERMISSION_ALIASES).toHaveLength(6)
    for (const alias of LEGACY_PERMISSION_ALIASES) {
      expect(byCode.has(alias.targetCode)).toBe(true)
      expect(LEGACY_DEPRECATED_PERMISSIONS.some((d) => d.code === alias.legacyCode)).toBe(true)
    }
  })

  it('ignores non-module sections and rejects malformed or duplicate markdown entries', () => {
    const sample = [
      '## 01. Identity & Access',
      'Domains: admin',
      '| Code | Name | Critical |',
      '| --- | --- | --- |',
      '| `roles:read` | View Roles | |',
      '## E. Separation-of-duties seed rules',
      '| Rule | Conflicting actions | Note |',
      '| --- | --- | --- |',
      '| `SOD-PAYROLL` | `a` | `b` |',
    ].join('\n')

    const parsed = parsePermissionsMasterMarkdown(sample)
    expect(parsed.categories).toHaveLength(1)
    expect(parsed.permissions).toHaveLength(1)
    expect(parsed.permissions[0].code).toBe('roles:read')

    expect(() =>
      parsePermissionsMasterMarkdown(
        '## 01. Identity\n| Code | Name | Critical |\n| --- | --- | --- |\n| `roles:read` | View | |',
      ),
    ).toThrow(/Domains/i)

    expect(() =>
      parsePermissionsMasterMarkdown(
        '## 01. Identity\nDomains: admin\n| Code | Name | Critical |\n| --- | --- | --- |\n| `roles:read` | A | |\n| `roles:read` | B | |',
      ),
    ).toThrow(/Duplicate permission code/i)
  })

  it('seeds idempotently across repeated runs without deleting codes or downgrading isSensitive', async () => {
    const { prisma, categories, permissions, aliases } = createInMemoryPrismaMock()

    // Pre-populate legacy records as they exist before Phase 1 migration backfill
    permissions.set('employees:create', {
      id: 'legacy_perm_1',
      code: 'employees:create',
      resource: 'employees',
      action: 'create',
      module: 'employees',
      description: 'Onboard and provision new employee accounts with initial role and squad',
      isSensitive: true,
      deprecatedAt: null,
    })
    permissions.set('employees:suspend', {
      id: 'legacy_perm_2',
      code: 'employees:suspend',
      resource: 'employees',
      action: 'suspend',
      module: 'employees',
      description: 'Suspend, reactivate, and reset access levels for employee accounts',
      isSensitive: true,
      deprecatedAt: null,
    })
    permissions.set('custom:extra_perm', {
      id: 'custom_perm_1',
      code: 'custom:extra_perm',
      resource: 'custom',
      action: 'extra_perm',
      module: 'custom',
      description: 'Custom operator permission added at runtime',
      isSensitive: true,
      deprecatedAt: null,
    })

    const fixedDate = new Date('2026-11-12T00:00:00.000Z')
    const firstRun = await seedPermissionCatalog(prisma as any, { now: fixedDate })

    expect(firstRun.categoryCount).toBe(21)
    expect(firstRun.masterPermissionCount).toBe(606)
    expect(firstRun.criticalCount).toBe(57)
    expect(firstRun.delegableCount).toBe(549)
    expect(firstRun.deprecatedCount).toBe(2)
    expect(firstRun.sensitiveCount).toBe(28)
    expect(firstRun.sensitiveNonCriticalActiveCount).toBe(21)
    expect(firstRun.aliasCount).toBe(6)

    // Verify existing descriptions, sensitive flags, deprecation flags, and custom records
    const empCreate = permissions.get('employees:create')
    expect(empCreate.description).toBe(
      'Onboard and provision new employee accounts with initial role and squad',
    )
    expect(empCreate.name).toBe('Onboard Employees')
    expect(empCreate.isSensitive).toBe(true)
    expect(empCreate.isCritical).toBe(false)
    expect(empCreate.isDelegable).toBe(true)
    expect(empCreate.isDeprecated).toBe(false)

    const empSuspend = permissions.get('employees:suspend')
    expect(empSuspend.isSensitive).toBe(true)
    expect(empSuspend.isCritical).toBe(false)
    expect(empSuspend.isDelegable).toBe(false)
    expect(empSuspend.isDeprecated).toBe(true)
    expect(empSuspend.deprecatedAt).toEqual(fixedDate)

    const root = permissions.get('system:root')
    expect(root.isCritical).toBe(true)
    expect(root.isDelegable).toBe(false)
    expect(root.isSystemRoot).toBe(true)

    // Custom runtime permission must never be deleted
    expect(permissions.has('custom:extra_perm')).toBe(true)
    expect(prisma.permission.delete).not.toHaveBeenCalled()
    expect(prisma.permission.deleteMany).not.toHaveBeenCalled()
    expect(prisma.permissionAlias.delete).not.toHaveBeenCalled()
    expect(prisma.permissionAlias.deleteMany).not.toHaveBeenCalled()

    // Run a second time to verify strict idempotency
    const secondRun = await seedPermissionCatalog(prisma as any, {
      now: new Date('2026-11-13T00:00:00.000Z'),
    })

    expect(secondRun.masterPermissionCount).toBe(606)
    expect(categories.size).toBe(21)
    expect(permissions.size).toBe(609) // 606 master + 2 deprecated + 1 custom
    expect(aliases.size).toBe(6)
    // Original deprecatedAt timestamp must remain stable across re-runs
    expect(permissions.get('employees:suspend').deprecatedAt).toEqual(fixedDate)
    expect(permissions.get('employees:create').isSensitive).toBe(true)
  })
})
