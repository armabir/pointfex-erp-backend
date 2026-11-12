import * as fs from 'fs'
import * as path from 'path'

export interface ParsedPermissionCategory {
  code: string
  slug: string
  name: string
  domains: string[]
  displayOrder: number
}

export interface ParsedMasterPermission {
  code: string
  resource: string
  action: string
  name: string
  categoryCode: string
  categorySlug: string
  domains: string[]
  isCritical: boolean
  isDelegable: boolean
  isSystemRoot: boolean
}

export interface ParsedPermissionCatalog {
  categories: ParsedPermissionCategory[]
  permissions: ParsedMasterPermission[]
  stats: {
    categoryCount: number
    permissionCount: number
    criticalCount: number
    delegableCount: number
  }
}

export interface LegacyPermissionDefinition {
  code: string
  resource: string
  action: string
  module: string
  name: string
  description: string
  isSensitive: boolean
}

export interface LegacyPermissionAliasDef {
  legacyCode: string
  targetCode: string
  reason: string
}

/**
 * 21 active master codes that were marked `isSensitive: true` in the original 80-code
 * RBAC baseline (`seed-rbac.ts`) and do NOT carry `⚠` (`isCritical`) in `docs/permissions_master.md`.
 * They must keep `isSensitive = true` so audit + step-up re-auth protection is never silently downgraded.
 */
export const LEGACY_SENSITIVE_NON_CRITICAL_CODES: readonly string[] = [
  'employees:create',
  'employees:update_any',
  'positions:assign',
  'tasks:approve',
  'treasury:read',
  'wallets:read_all',
  'transactions:read_all',
  'budgets:allocate_developer',
  'budgets:allocate_project',
  'budgets:approve_request',
  'finance:issue_adjustment',
  'performance:read_all',
  'performance:evaluate',
  'performance:recognize',
  'directives:dispatch',
  'decisions:ratify',
  'audit_logs:read',
  'roles:create',
  'roles:update',
  'roles:delete',
  'users:assign_role',
] as const

/**
 * 5 codes from the original 80-code baseline that carry BOTH `isSensitive: true` and `⚠` (`isCritical`).
 */
export const LEGACY_SENSITIVE_CRITICAL_CODES: readonly string[] = [
  'revenue_share:process',
  'performance:discipline',
  'grievances:read_confidential',
  'grievances:adjudicate_confidential',
  'audit_logs:read_confidential',
] as const

/**
 * 2 legacy codes absent from `docs/permissions_master.md` that are preserved as deprecated
 * (`isDeprecated = true`, `isSensitive = true`, `isDelegable = false`) and bridged via `permission_aliases`.
 */
export const LEGACY_DEPRECATED_PERMISSIONS: readonly LegacyPermissionDefinition[] = [
  {
    code: 'employees:suspend',
    resource: 'employees',
    action: 'suspend',
    module: 'employees',
    name: 'Suspend / Reactivate / Demote Employee (Deprecated Alias)',
    description:
      'Legacy alias preserved for backward compatibility; replaced by users:suspend, users:reactivate, and users:demote.',
    isSensitive: true,
  },
  {
    code: 'permissions:delegate',
    resource: 'permissions',
    action: 'delegate',
    module: 'rbac',
    name: 'Delegate or Grant Permissions (Deprecated Alias)',
    description:
      'Legacy alias preserved for backward compatibility; replaced by delegations:create, permissions:grant_direct, and delegations:revoke.',
    isSensitive: true,
  },
] as const

export const LEGACY_SENSITIVE_CODE_SET: ReadonlySet<string> = new Set([
  ...LEGACY_SENSITIVE_NON_CRITICAL_CODES,
  ...LEGACY_SENSITIVE_CRITICAL_CODES,
  ...LEGACY_DEPRECATED_PERMISSIONS.map((p) => p.code),
])

export const LEGACY_PERMISSION_ALIASES: readonly LegacyPermissionAliasDef[] = [
  {
    legacyCode: 'employees:suspend',
    targetCode: 'users:suspend',
    reason: 'Split legacy employees:suspend into granular identity lifecycle permission users:suspend',
  },
  {
    legacyCode: 'employees:suspend',
    targetCode: 'users:reactivate',
    reason: 'Split legacy employees:suspend into granular identity lifecycle permission users:reactivate',
  },
  {
    legacyCode: 'employees:suspend',
    targetCode: 'users:demote',
    reason: 'Split legacy employees:suspend into granular identity lifecycle permission users:demote',
  },
  {
    legacyCode: 'permissions:delegate',
    targetCode: 'delegations:create',
    reason: 'Map legacy permissions:delegate to Delegation Engine permission delegations:create',
  },
  {
    legacyCode: 'permissions:delegate',
    targetCode: 'permissions:grant_direct',
    reason: 'Map legacy permissions:delegate direct override usage to permissions:grant_direct',
  },
  {
    legacyCode: 'permissions:delegate',
    targetCode: 'delegations:revoke',
    reason: 'Map legacy permissions:delegate revocation usage to delegations:revoke',
  },
] as const

export function slugifyCategoryTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Splits a permission code on the LAST colon so multi-segment codes like
 * `qa:test_plans:read` or `support:tickets:create` map losslessly to `(resource, action)`.
 */
export function splitPermissionCode(code: string): { resource: string; action: string } {
  const trimmed = code.trim()
  const idx = trimmed.lastIndexOf(':')
  if (idx <= 0 || idx === trimmed.length - 1) {
    throw new Error(`Invalid permission code format "${code}": expected "<resource>:<action>"`)
  }
  return {
    resource: trimmed.slice(0, idx),
    action: trimmed.slice(idx + 1),
  }
}

export function resolvePermissionsMasterPath(customPath?: string): string {
  if (customPath) {
    if (!fs.existsSync(customPath)) {
      throw new Error(`Permissions master file not found at custom path: ${customPath}`)
    }
    return customPath
  }

  const envPath = process.env.PERMISSIONS_MASTER_PATH?.trim()
  const candidates = [
    envPath,
    path.resolve(__dirname, '../../docs/permissions_master.md'),
    path.resolve(__dirname, '../../../docs/permissions_master.md'),
    path.resolve(process.cwd(), 'docs/permissions_master.md'),
    path.resolve(process.cwd(), '../docs/permissions_master.md'),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Unable to locate docs/permissions_master.md. Searched: ${candidates.join(', ')}`,
  )
}

export function parsePermissionsMasterMarkdown(markdown: string): ParsedPermissionCatalog {
  const lines = markdown.split(/\r?\n/)
  const categories: ParsedPermissionCategory[] = []
  const permissions: ParsedMasterPermission[] = []

  const seenCategoryCodes = new Set<string>()
  const seenCategorySlugs = new Set<string>()
  const seenPermissionCodes = new Set<string>()
  const seenResourceActions = new Set<string>()

  let currentCategory: ParsedPermissionCategory | null = null
  let inPermissionTable = false

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx]
    const line = rawLine.trim()

    const moduleMatch = line.match(/^##\s+(\d{2})\.\s+(.+)$/)
    if (moduleMatch) {
      const code = moduleMatch[1]
      const name = moduleMatch[2].trim()
      const slug = slugifyCategoryTitle(name)
      const displayOrder = parseInt(code, 10)

      if (seenCategoryCodes.has(code)) {
        throw new Error(`Duplicate module category code "${code}" at line ${lineIdx + 1}`)
      }
      if (seenCategorySlugs.has(slug)) {
        throw new Error(`Duplicate module category slug "${slug}" at line ${lineIdx + 1}`)
      }

      currentCategory = {
        code,
        slug,
        name,
        domains: [],
        displayOrder,
      }
      inPermissionTable = false
      seenCategoryCodes.add(code)
      seenCategorySlugs.add(slug)
      categories.push(currentCategory)
      continue
    }

    // Any non-module `##` section (e.g. ## B., ## C., ## D., ## E., ## F.) closes active module context.
    if (/^##\s+/.test(line)) {
      currentCategory = null
      inPermissionTable = false
      continue
    }

    if (!currentCategory) {
      continue
    }

    if (/^###\s+/.test(line) || line === '---') {
      inPermissionTable = false
      continue
    }

    if (line.startsWith('Domains:')) {
      const domains = line
        .slice('Domains:'.length)
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)

      if (domains.length === 0) {
        throw new Error(
          `Empty Domains declaration for module ${currentCategory.code} at line ${lineIdx + 1}`,
        )
      }
      currentCategory.domains = domains
      continue
    }

    if (/^\|\s*Code\s*\|\s*Name\s*\|\s*Critical\s*\|/i.test(line)) {
      if (currentCategory.domains.length === 0) {
        throw new Error(
          `Permission table encountered before "Domains:" declaration in module ${currentCategory.code} at line ${lineIdx + 1}`,
        )
      }
      inPermissionTable = true
      continue
    }

    if (!line.startsWith('|')) {
      inPermissionTable = false
      continue
    }

    if (inPermissionTable && /^\|\s*`([^`]+)`\s*\|/.test(line)) {
      if (currentCategory.domains.length === 0) {
        throw new Error(
          `Permission row encountered before "Domains:" declaration in module ${currentCategory.code} at line ${lineIdx + 1}`,
        )
      }

      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())

      if (cells.length < 3) {
        throw new Error(
          `Malformed permission table row in module ${currentCategory.code} at line ${lineIdx + 1}: ${line}`,
        )
      }

      const code = cells[0].replace(/^`|`$/g, '').trim()
      const name = cells[1].trim()
      const criticalCell = cells[2].trim()

      if (seenPermissionCodes.has(code)) {
        throw new Error(`Duplicate permission code "${code}" at line ${lineIdx + 1}`)
      }

      const { resource, action } = splitPermissionCode(code)
      const resourceActionKey = `${resource}\0${action}`
      if (seenResourceActions.has(resourceActionKey)) {
        throw new Error(
          `Duplicate (resource, action) pair (${resource}, ${action}) for code "${code}" at line ${lineIdx + 1}`,
        )
      }

      const isCritical = criticalCell.includes('⚠')
      const isSystemRoot = code === 'system:root'

      seenPermissionCodes.add(code)
      seenResourceActions.add(resourceActionKey)

      permissions.push({
        code,
        resource,
        action,
        name,
        categoryCode: currentCategory.code,
        categorySlug: currentCategory.slug,
        domains: [...currentCategory.domains],
        isCritical,
        isDelegable: !isCritical,
        isSystemRoot,
      })
    }
  }

  for (const cat of categories) {
    if (cat.domains.length === 0) {
      throw new Error(`Module ${cat.code} (${cat.name}) is missing a "Domains:" line`)
    }
  }

  const criticalCount = permissions.filter((p) => p.isCritical).length

  return {
    categories,
    permissions,
    stats: {
      categoryCount: categories.length,
      permissionCount: permissions.length,
      criticalCount,
      delegableCount: permissions.length - criticalCount,
    },
  }
}

export function loadPermissionsMasterCatalog(customPath?: string): ParsedPermissionCatalog {
  const filePath = resolvePermissionsMasterPath(customPath)
  const markdown = fs.readFileSync(filePath, 'utf8')
  return parsePermissionsMasterMarkdown(markdown)
}
