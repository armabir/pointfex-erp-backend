import { AuthorizationScope } from '@prisma/client'

export const DOMAIN_WILDCARDS = [
  'admin:*',
  'hr:*',
  'finance:*',
  'engineering:*',
  'product:*',
  'sales:*',
  'ops:*',
] as const

export type DomainWildcard = (typeof DOMAIN_WILDCARDS)[number]

export const DOMAIN_WILDCARD_SET: ReadonlySet<string> = new Set(DOMAIN_WILDCARDS)

export const SCOPE_RANK: Record<AuthorizationScope, number> = {
  SELF: 1,
  ASSIGNED: 2,
  SQUAD: 3,
  DEPARTMENT: 4,
  PROJECT: 5,
  ORG: 6,
  GLOBAL: 7,
}

export interface ExpandablePermissionRecord {
  code: string
  isCritical: boolean
  isDeprecated?: boolean
  isSystemRoot?: boolean
  category?: {
    domains: string[]
  } | null
}

/**
 * Validates and normalizes wildcard entries.
 * Only domain-scoped wildcards from `docs/permissions_master.md` are valid
 * (`admin:*`, `hr:*`, `finance:*`, `engineering:*`, `product:*`, `sales:*`, `ops:*`).
 */
export function normalizeDomainWildcards(wildcards?: string[]): string[] {
  if (!wildcards || wildcards.length === 0) return []
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const raw of wildcards) {
    const w = raw.trim().toLowerCase()
    if (!w) continue
    if (!DOMAIN_WILDCARD_SET.has(w)) {
      throw new Error(
        `Invalid wildcard "${raw}". Allowed domain wildcards: ${DOMAIN_WILDCARDS.join(', ')}`,
      )
    }
    if (!seen.has(w)) {
      seen.add(w)
      normalized.push(w)
    }
  }
  return normalized
}

/**
 * Expands domain wildcards against permission_categories.domains.
 * Rules from docs/permissions_master.md Section B:
 * - Wildcard never crosses its domain (e.g. `engineering:*` matches only categories containing `engineering`).
 * - Wildcard NEVER expands `system:root` or deprecated codes.
 * - Wildcard EXCLUDES all critical (`⚠`) permissions unless `includeCritical === true`.
 */
export function expandDomainWildcards(
  wildcards: string[],
  includeCritical: boolean,
  permissions: ExpandablePermissionRecord[],
): string[] {
  if (!wildcards || wildcards.length === 0) return []

  const domains = new Set(
    wildcards
      .map((w) => w.trim().toLowerCase())
      .filter((w) => DOMAIN_WILDCARD_SET.has(w))
      .map((w) => w.slice(0, -2)),
  )
  if (domains.size === 0) return []

  const expanded: string[] = []
  for (const perm of permissions) {
    if (perm.isDeprecated) continue
    if (perm.isSystemRoot || perm.code === 'system:root') continue
    if (perm.isCritical && !includeCritical) continue

    const permDomains = perm.category?.domains ?? []
    const matchesDomain = permDomains.some((d) => domains.has(d.toLowerCase()))
    if (matchesDomain) {
      expanded.push(perm.code)
    }
  }
  return expanded
}

/**
 * Checks whether a granted scope + scopeIds satisfies a required scope and optional target resource scope ID.
 * - `GLOBAL` and `ORG` satisfy org-wide checks and subsume narrower scopes.
 * - `PROJECT` / `DEPARTMENT` / `SQUAD` require `targetScopeId` to be in `heldScopeIds` when `heldScopeIds` is non-empty and the check targets a specific container.
 */
export function scopeSatisfies(
  heldScope: AuthorizationScope,
  heldScopeIds: string[],
  requiredScope: AuthorizationScope,
  targetScopeId?: string,
): boolean {
  if (heldScope === 'GLOBAL' || heldScope === 'ORG') {
    if (requiredScope === 'GLOBAL' && heldScope !== 'GLOBAL') {
      return false
    }
    return true
  }

  if (SCOPE_RANK[heldScope] < SCOPE_RANK[requiredScope]) {
    return false
  }

  // If checking within a container scope (SQUAD/DEPARTMENT/PROJECT) and a specific container ID is supplied,
  // verify membership in heldScopeIds when heldScope is bounded to specific IDs.
  if (
    targetScopeId &&
    (heldScope === 'SQUAD' || heldScope === 'DEPARTMENT' || heldScope === 'PROJECT') &&
    heldScopeIds.length > 0
  ) {
    return heldScopeIds.includes(targetScopeId)
  }

  return true
}

/**
 * Infers legacy compatibility scope from `_own`, `_team`, `_dept`, `_all` suffixes
 * per docs/permissions_master.md Section A.
 */
export function inferScopeFromPermissionCode(code: string): AuthorizationScope {
  if (code.endsWith('_own')) return 'SELF'
  if (code.endsWith('_team')) return 'SQUAD'
  if (code.endsWith('_dept')) return 'DEPARTMENT'
  if (code.endsWith('_all')) return 'ORG'
  return 'ORG'
}

