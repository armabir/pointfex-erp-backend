import { PrismaClient } from '@prisma/client'
import {
  LEGACY_DEPRECATED_PERMISSIONS,
  LEGACY_PERMISSION_ALIASES,
  LEGACY_SENSITIVE_CODE_SET,
  loadPermissionsMasterCatalog,
} from './permission-catalog.parser'

export interface SeedPermissionCatalogOptions {
  masterPath?: string
  now?: Date
}

export interface SeedPermissionCatalogResult {
  categoryCount: number
  masterPermissionCount: number
  criticalCount: number
  delegableCount: number
  deprecatedCount: number
  sensitiveCount: number
  sensitiveNonCriticalActiveCount: number
  aliasCount: number
  permissionIdByCode: Map<string, string>
}

export async function seedPermissionCatalog(
  prisma: PrismaClient,
  options?: SeedPermissionCatalogOptions,
): Promise<SeedPermissionCatalogResult> {
  const catalog = loadPermissionsMasterCatalog(options?.masterPath)
  const now = options?.now ?? new Date()

  // 1. Seed 21 permission_categories (modules 00-20 + domain wildcard mappings)
  const categoryIdByCode = new Map<string, string>()
  for (const cat of catalog.categories) {
    const category = await prisma.permissionCategory.upsert({
      where: { code: cat.code },
      update: {
        slug: cat.slug,
        name: cat.name,
        domains: cat.domains,
        displayOrder: cat.displayOrder,
      },
      create: {
        code: cat.code,
        slug: cat.slug,
        name: cat.name,
        domains: cat.domains,
        displayOrder: cat.displayOrder,
      },
    })
    categoryIdByCode.set(cat.code, category.id)
  }

  // 2. Load existing permissions once to preserve existing descriptions, sensitive flags, and deprecation timestamps
  const existingRows = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
      description: true,
      isSensitive: true,
      deprecatedAt: true,
    },
  })
  const existingByCode = new Map(existingRows.map((row) => [row.code, row]))

  const permissionIdByCode = new Map<string, string>()
  let sensitiveCount = 0
  let sensitiveNonCriticalActiveCount = 0

  // 3. Upsert all 606 master permissions verbatim from docs/permissions_master.md
  for (const perm of catalog.permissions) {
    const categoryId = categoryIdByCode.get(perm.categoryCode) ?? null
    const existing = existingByCode.get(perm.code)
    const isSensitive = (existing?.isSensitive ?? false) || LEGACY_SENSITIVE_CODE_SET.has(perm.code)
    const description =
      existing?.description && existing.description.trim().length > 0
        ? existing.description
        : perm.name

    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        resource: perm.resource,
        action: perm.action,
        module: perm.categorySlug,
        name: perm.name,
        description,
        categoryId,
        isSensitive,
        isCritical: perm.isCritical,
        isDelegable: perm.isDelegable,
        isDeprecated: false,
        deprecatedAt: null,
        isSystemRoot: perm.isSystemRoot,
      },
      create: {
        code: perm.code,
        resource: perm.resource,
        action: perm.action,
        module: perm.categorySlug,
        name: perm.name,
        description,
        categoryId,
        isSensitive,
        isCritical: perm.isCritical,
        isDelegable: perm.isDelegable,
        isDeprecated: false,
        deprecatedAt: null,
        isSystemRoot: perm.isSystemRoot,
      },
    })

    permissionIdByCode.set(record.code, record.id)
    if (isSensitive) {
      sensitiveCount++
      if (!perm.isCritical) {
        sensitiveNonCriticalActiveCount++
      }
    }
  }

  // 4. Deprecate (never delete) legacy permissions missing from master catalog
  for (const legacyPerm of LEGACY_DEPRECATED_PERMISSIONS) {
    const existing = existingByCode.get(legacyPerm.code)
    const isSensitive = (existing?.isSensitive ?? false) || legacyPerm.isSensitive
    const deprecatedAt = existing?.deprecatedAt ?? now
    const description =
      existing?.description && existing.description.trim().length > 0
        ? existing.description
        : legacyPerm.description

    const record = await prisma.permission.upsert({
      where: { code: legacyPerm.code },
      update: {
        resource: legacyPerm.resource,
        action: legacyPerm.action,
        module: legacyPerm.module,
        name: legacyPerm.name,
        description,
        categoryId: null,
        isSensitive,
        isCritical: false,
        isDelegable: false,
        isDeprecated: true,
        deprecatedAt,
        isSystemRoot: false,
      },
      create: {
        code: legacyPerm.code,
        resource: legacyPerm.resource,
        action: legacyPerm.action,
        module: legacyPerm.module,
        name: legacyPerm.name,
        description,
        categoryId: null,
        isSensitive,
        isCritical: false,
        isDelegable: false,
        isDeprecated: true,
        deprecatedAt,
        isSystemRoot: false,
      },
    })

    permissionIdByCode.set(record.code, record.id)
    if (isSensitive) {
      sensitiveCount++
    }
  }

  // 5. Upsert permission_aliases for deprecated codes so existing grants/roles stay compatible
  for (const alias of LEGACY_PERMISSION_ALIASES) {
    const legacyPermissionId = permissionIdByCode.get(alias.legacyCode) ?? null
    const targetPermissionId = permissionIdByCode.get(alias.targetCode) ?? null

    await prisma.permissionAlias.upsert({
      where: {
        legacyCode_targetCode: {
          legacyCode: alias.legacyCode,
          targetCode: alias.targetCode,
        },
      },
      update: {
        legacyPermissionId,
        targetPermissionId,
        reason: alias.reason,
      },
      create: {
        legacyCode: alias.legacyCode,
        targetCode: alias.targetCode,
        legacyPermissionId,
        targetPermissionId,
        reason: alias.reason,
      },
    })
  }

  return {
    categoryCount: catalog.stats.categoryCount,
    masterPermissionCount: catalog.stats.permissionCount,
    criticalCount: catalog.stats.criticalCount,
    delegableCount: catalog.stats.delegableCount,
    deprecatedCount: LEGACY_DEPRECATED_PERMISSIONS.length,
    sensitiveCount,
    sensitiveNonCriticalActiveCount,
    aliasCount: LEGACY_PERMISSION_ALIASES.length,
    permissionIdByCode,
  }
}
