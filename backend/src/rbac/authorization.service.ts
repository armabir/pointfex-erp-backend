import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthorizationScope, Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionCacheService } from './permission-cache.service'
import { expandDomainWildcards, SCOPE_RANK, scopeSatisfies } from './wildcard-resolver.util'
import { isPermissionSensitiveMfaRequired } from './sensitive-actions'

export type AuthzMode = 'legacy' | 'shadow' | 'enforce'

export interface ScopedGrantEntry {
  code: string
  scope: AuthorizationScope
  scopeIds: string[]
  sourceType: 'role' | 'wildcard' | 'direct' | 'delegation'
  sourceId: string
  roleSlug?: string
  expiresAt: string | null
}

export interface ScopedDenialEntry {
  code: string
  scope: AuthorizationScope
  scopeIds: string[]
  reason?: string | null
  expiresAt: string | null
}

export interface EffectiveAuthzSnapshot {
  employeeId: string
  authVersion: number
  isSuspended: boolean
  isRoot: boolean
  roleSlugs: string[]
  grants: ScopedGrantEntry[]
  denials: ScopedDenialEntry[]
  aliasForward: Record<string, string[]>
  aliasReverse: Record<string, string[]>
  effectiveCodes: string[]
  computedAt: string
}

export interface AuthzCheckContext {
  requiredScope?: AuthorizationScope
  projectId?: string
  squadId?: string
  departmentId?: string
  ownerId?: string
  assignedUserIds?: string[]
  targetScopeId?: string
  resourceType?: string
  resourceId?: string
}

export interface AuthzDecision {
  allowed: boolean
  permissionCode: string
  matchedCode?: string
  source?: 'root' | 'role' | 'wildcard' | 'direct' | 'delegation' | 'denied' | 'suspended' | 'missing'
  sourceId?: string
  matchedScope?: AuthorizationScope
  reason?: string
  isCritical?: boolean
  isSensitive?: boolean
  requiresAudit?: boolean
}

export interface DelegationGrantProvider {
  getActiveDelegationsForUser(employeeId: string, now: Date): Promise<ScopedGrantEntry[]>
}

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name)
  private delegationProvider: DelegationGrantProvider | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  registerDelegationProvider(provider: DelegationGrantProvider): void {
    this.delegationProvider = provider
  }

  getAuthzMode(): AuthzMode {
    const raw = (
      this.configService?.get<string>('AUTHZ_MODE') ||
      process.env.AUTHZ_MODE ||
      'shadow'
    )
      .trim()
      .toLowerCase()
    if (raw === 'legacy' || raw === 'shadow' || raw === 'enforce') {
      return raw
    }
    return 'shadow'
  }

  async resolveEffectiveAuthz(employeeId: string): Promise<EffectiveAuthzSnapshot> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, isSuspended: true, authVersion: true, mfaEnabled: true },
    })

    if (!employee) {
      return {
        employeeId,
        authVersion: 0,
        isSuspended: true,
        isRoot: false,
        roleSlugs: [],
        grants: [],
        denials: [],
        aliasForward: {},
        aliasReverse: {},
        effectiveCodes: [],
        computedAt: new Date().toISOString(),
      }
    }

    const cached = await this.cache.getVersionedAuthz<EffectiveAuthzSnapshot>(
      employeeId,
      employee.authVersion,
    )
    if (cached && !this.hasExpiredEntry(cached)) {
      return cached
    }

    const now = new Date()
    const [
      scopedAssignments,
      legacyRoleRows,
      scopedGrants,
      legacyDirectGrants,
      activeDenials,
      catalogPerms,
      aliases,
      delegatedGrants,
    ] = await Promise.all([
      this.prisma.userRoleAssignment.findMany({
        where: {
          employeeId,
          isActive: true,
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          role: { isActive: true },
        },
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: { select: { code: true } } } },
            },
          },
        },
      }),
      this.prisma.employeeRole.findMany({
        where: {
          employeeId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          role: { isActive: true },
        },
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: { select: { code: true } } } },
            },
          },
        },
      }),
      this.prisma.userPermissionGrant.findMany({
        where: {
          employeeId,
          isActive: true,
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { permission: { select: { code: true } } },
      }),
      this.prisma.employeePermission.findMany({
        where: {
          employeeId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { permission: { select: { code: true } } },
      }),
      this.prisma.userPermissionDenial.findMany({
        where: {
          employeeId,
          isActive: true,
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { permission: { select: { code: true } } },
      }),
      this.prisma.permission.findMany({
        select: {
          code: true,
          isCritical: true,
          isDeprecated: true,
          isSystemRoot: true,
          category: { select: { domains: true } },
        },
      }),
      this.prisma.permissionAlias.findMany({
        select: { legacyCode: true, targetCode: true },
      }),
      this.delegationProvider
        ? this.delegationProvider.getActiveDelegationsForUser(employeeId, now)
        : Promise.resolve([] as ScopedGrantEntry[]),
    ])

    const grants: ScopedGrantEntry[] = []
    let isRoot = false
    const roleSlugs = new Set<string>()

    const effectiveAssignments =
      scopedAssignments.length > 0
        ? scopedAssignments.map((a) => ({
            id: a.id,
            scope: a.scope,
            scopeIds: a.scopeIds,
            expiresAt: a.expiresAt,
            role: a.role,
          }))
        : legacyRoleRows.map((er) => ({
            id: er.id,
            scope: 'ORG' as AuthorizationScope,
            scopeIds: [] as string[],
            expiresAt: er.expiresAt,
            role: er.role,
          }))

    for (const assignment of effectiveAssignments) {
      roleSlugs.add(assignment.role.slug)
      if (assignment.role.isRootRole) {
        isRoot = true
      }

      for (const rp of assignment.role.rolePermissions) {
        if (rp.permission.code === 'system:root') {
          isRoot = true
        }
        grants.push({
          code: rp.permission.code,
          scope: assignment.scope,
          scopeIds: assignment.scopeIds,
          sourceType: 'role',
          sourceId: assignment.id,
          roleSlug: assignment.role.slug,
          expiresAt: assignment.expiresAt ? assignment.expiresAt.toISOString() : null,
        })
      }

      const expandedWildcards = expandDomainWildcards(
        assignment.role.wildcards ?? [],
        assignment.role.includeCritical,
        catalogPerms,
      )
      for (const wCode of expandedWildcards) {
        grants.push({
          code: wCode,
          scope: assignment.scope,
          scopeIds: assignment.scopeIds,
          sourceType: 'wildcard',
          sourceId: assignment.id,
          roleSlug: assignment.role.slug,
          expiresAt: assignment.expiresAt ? assignment.expiresAt.toISOString() : null,
        })
      }
    }

    for (const grant of scopedGrants) {
      if (grant.permission.code === 'system:root') continue // system:root is NEVER granted directly
      grants.push({
        code: grant.permission.code,
        scope: grant.scope,
        scopeIds: grant.scopeIds,
        sourceType: 'direct',
        sourceId: grant.id,
        expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
      })
    }

    for (const legacyDirect of legacyDirectGrants) {
      if (legacyDirect.permission.code === 'system:root') continue
      grants.push({
        code: legacyDirect.permission.code,
        scope: 'ORG',
        scopeIds: [],
        sourceType: 'direct',
        sourceId: legacyDirect.id,
        expiresAt: legacyDirect.expiresAt ? legacyDirect.expiresAt.toISOString() : null,
      })
    }

    const criticalPermSet = new Set(
      catalogPerms.filter((p) => p.isCritical).map((p) => p.code),
    )
    for (const delGrant of delegatedGrants) {
      if (delGrant.code === 'system:root') continue
      if (
        employee.mfaEnabled === false &&
        isPermissionSensitiveMfaRequired(delGrant.code, criticalPermSet.has(delGrant.code))
      ) {
        continue
      }
      grants.push(delGrant)
    }

    const denials: ScopedDenialEntry[] = activeDenials.map((d) => ({
      code: d.permission.code,
      scope: d.scope,
      scopeIds: d.scopeIds,
      reason: d.reason,
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    }))

    const aliasForward: Record<string, string[]> = {}
    const aliasReverse: Record<string, string[]> = {}
    for (const a of aliases) {
      if (!aliasForward[a.legacyCode]) aliasForward[a.legacyCode] = []
      aliasForward[a.legacyCode].push(a.targetCode)
      if (!aliasReverse[a.targetCode]) aliasReverse[a.targetCode] = []
      aliasReverse[a.targetCode].push(a.legacyCode)
    }

    const deniedExactCodes = new Set(
      denials
        .filter((d) => d.scope === 'GLOBAL' || d.scope === 'ORG')
        .map((d) => d.code),
    )

    const effectiveCodesSet = new Set<string>()
    for (const g of grants) {
      if (!deniedExactCodes.has(g.code)) {
        effectiveCodesSet.add(g.code)
        for (const target of aliasForward[g.code] ?? []) {
          if (!deniedExactCodes.has(target)) effectiveCodesSet.add(target)
        }
      }
    }

    if (isRoot) {
      effectiveCodesSet.add('system:root')
    }

    const snapshot: EffectiveAuthzSnapshot = {
      employeeId,
      authVersion: employee.authVersion,
      isSuspended: employee.isSuspended,
      isRoot,
      roleSlugs: Array.from(roleSlugs),
      grants,
      denials,
      aliasForward,
      aliasReverse,
      effectiveCodes: Array.from(effectiveCodesSet).sort(),
      computedAt: now.toISOString(),
    }

    let earliestExpiryMs: number | undefined
    for (const g of grants) {
      if (g.expiresAt) {
        const ms = new Date(g.expiresAt).getTime()
        if (earliestExpiryMs === undefined || ms < earliestExpiryMs) earliestExpiryMs = ms
      }
    }
    for (const d of denials) {
      if (d.expiresAt) {
        const ms = new Date(d.expiresAt).getTime()
        if (earliestExpiryMs === undefined || ms < earliestExpiryMs) earliestExpiryMs = ms
      }
    }
    const ttlOverride =
      earliestExpiryMs !== undefined
        ? Math.max(1, Math.ceil((earliestExpiryMs - now.getTime()) / 1000))
        : undefined

    await this.cache.setVersionedAuthz(employeeId, employee.authVersion, snapshot, ttlOverride)
    return snapshot
  }

  private hasExpiredEntry(snapshot: EffectiveAuthzSnapshot): boolean {
    const nowMs = Date.now()
    for (const g of snapshot.grants) {
      if (g.expiresAt && new Date(g.expiresAt).getTime() <= nowMs) return true
    }
    for (const d of snapshot.denials) {
      if (d.expiresAt && new Date(d.expiresAt).getTime() <= nowMs) return true
    }
    return false
  }

  async check(
    actorOrId: AuthenticatedUser | string,
    permissionCode: string,
    context?: AuthzCheckContext,
  ): Promise<AuthzDecision> {
    const employeeId = typeof actorOrId === 'string' ? actorOrId : actorOrId.id
    if (!employeeId) {
      return {
        allowed: false,
        permissionCode,
        source: 'missing',
        reason: 'Authenticated user identity required',
      }
    }

    const [snapshot, permMeta] = await Promise.all([
      this.resolveEffectiveAuthz(employeeId),
      this.prisma.permission.findUnique({
        where: { code: permissionCode },
        select: { isCritical: true, isSensitive: true },
      }),
    ])

    const isCritical = permMeta?.isCritical ?? false
    const isSensitive = permMeta?.isSensitive ?? false
    const requiresAudit = isCritical || isSensitive

    if (snapshot.isSuspended) {
      return {
        allowed: false,
        permissionCode,
        source: 'suspended',
        reason: 'Account is suspended',
        isCritical,
        isSensitive,
        requiresAudit,
      }
    }

    if (snapshot.isRoot) {
      return {
        allowed: true,
        permissionCode,
        matchedCode: 'system:root',
        source: 'root',
        matchedScope: 'GLOBAL',
        isCritical,
        isSensitive,
        requiresAudit,
      }
    }

    const candidateCodes = this.resolveCandidateCodes(permissionCode, snapshot)
    const { requiredScope, targetScopeId, isOwnResource, isAssignedResource } =
      this.resolveScopeRequirement(employeeId, permissionCode, context)

    // Explicit denials ALWAYS subtract from grants at matching scope
    for (const denial of snapshot.denials) {
      if (!candidateCodes.has(denial.code)) continue
      if (this.denialApplies(denial, requiredScope, targetScopeId)) {
        return {
          allowed: false,
          permissionCode,
          source: 'denied',
          reason: denial.reason || `Explicitly denied (${denial.code} at scope ${denial.scope})`,
          isCritical,
          isSensitive,
          requiresAudit,
        }
      }
    }

    const validGrants = snapshot.grants.filter((g) => candidateCodes.has(g.code))
    for (const grant of validGrants) {
      if (
        this.grantSatisfiesContext(
          grant,
          requiredScope,
          targetScopeId,
          isOwnResource,
          isAssignedResource,
        )
      ) {
        return {
          allowed: true,
          permissionCode,
          matchedCode: grant.code,
          source: grant.sourceType,
          sourceId: grant.sourceId,
          matchedScope: grant.scope,
          isCritical,
          isSensitive,
          requiresAudit,
        }
      }
    }

    return {
      allowed: false,
      permissionCode,
      source: 'missing',
      reason: `Missing permission "${permissionCode}" at required scope "${requiredScope}"`,
      isCritical,
      isSensitive,
      requiresAudit,
    }
  }

  async assert(
    actorOrId: AuthenticatedUser | string,
    permissionCode: string,
    context?: AuthzCheckContext,
  ): Promise<AuthzDecision> {
    const decision = await this.check(actorOrId, permissionCode, context)
    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason || `Access denied for "${permissionCode}"`)
    }
    return decision
  }

  async checkAny(
    actorOrId: AuthenticatedUser | string,
    permissionCodes: string[],
    context?: AuthzCheckContext,
  ): Promise<AuthzDecision> {
    if (permissionCodes.length === 0) {
      return { allowed: true, permissionCode: '' }
    }
    let lastDecision: AuthzDecision = {
      allowed: false,
      permissionCode: permissionCodes[0],
      source: 'missing',
    }
    for (const code of permissionCodes) {
      const decision = await this.check(actorOrId, code, context)
      if (decision.allowed) return decision
      lastDecision = decision
    }
    return lastDecision
  }

  async invalidateUserCache(employeeId: string): Promise<void> {
    await this.prisma.employee
      .update({
        where: { id: employeeId },
        data: { authVersion: { increment: 1 } },
      })
      .catch((err) =>
        this.logger.warn(
          `Failed incrementing authVersion for ${employeeId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
    await this.cache.invalidateUser(employeeId)
  }

  async invalidateUsersCache(employeeIds: string[]): Promise<void> {
    const unique = Array.from(new Set(employeeIds.filter(Boolean)))
    if (unique.length === 0) return
    await this.prisma.employee
      .updateMany({
        where: { id: { in: unique } },
        data: { authVersion: { increment: 1 } },
      })
      .catch(() => undefined)
    await this.cache.invalidateUsers(unique)
  }

  async recordShadowMismatch(params: {
    employeeId: string
    employeeEmail?: string
    actingRole?: string
    permissionCode: string
    routePath?: string
    httpMethod?: string
    resourceType?: string
    resourceId?: string
    oldAllowed: boolean
    newAllowed: boolean
    reason?: string
  }): Promise<void> {
    if (params.oldAllowed === params.newAllowed) return
    await this.prisma.authzShadowLog
      .create({
        data: {
          employeeId: params.employeeId,
          employeeEmail: params.employeeEmail,
          actingRole: params.actingRole,
          permissionCode: params.permissionCode,
          routePath: params.routePath,
          httpMethod: params.httpMethod,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          oldAllowed: params.oldAllowed,
          newAllowed: params.newAllowed,
          reason: params.reason,
          mode: this.getAuthzMode(),
        },
      })
      .catch((err) =>
        this.logger.warn(
          `Shadow log write failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
  }

  async getPolicyValue<T = unknown>(key: string, defaultValue: T): Promise<T> {
    const row = await this.prisma.authorizationPolicy.findUnique({ where: { key } })
    if (!row) return defaultValue
    return row.value as T
  }

  async setPolicyValue(
    key: string,
    value: Prisma.InputJsonValue,
    description?: string,
    updatedById?: string,
  ) {
    return this.prisma.authorizationPolicy.upsert({
      where: { key },
      update: { value, description, updatedById },
      create: { key, value, description, updatedById },
    })
  }

  async grantDenial(params: {
    employeeId: string
    permissionCode: string
    scope?: AuthorizationScope
    scopeIds?: string[]
    reason?: string
    deniedById?: string
    expiresAt?: Date | null
  }) {
    const perm = await this.prisma.permission.findUnique({
      where: { code: params.permissionCode },
    })
    if (!perm) {
      throw new ForbiddenException(`Unknown permission "${params.permissionCode}"`)
    }
    const created = await this.prisma.userPermissionDenial.create({
      data: {
        employeeId: params.employeeId,
        permissionId: perm.id,
        scope: params.scope ?? 'ORG',
        scopeIds: params.scopeIds ?? [],
        reason: params.reason,
        deniedById: params.deniedById,
        expiresAt: params.expiresAt ?? null,
        isActive: true,
      },
      include: { permission: true },
    })
    await this.invalidateUserCache(params.employeeId)
    return created
  }

  async revokeDenial(denialId: string, revokedById?: string) {
    const updated = await this.prisma.userPermissionDenial.update({
      where: { id: denialId },
      data: { isActive: false, revokedAt: new Date(), revokedById },
    })
    await this.invalidateUserCache(updated.employeeId)
    return updated
  }

  private resolveCandidateCodes(
    requestedCode: string,
    snapshot: EffectiveAuthzSnapshot,
  ): Set<string> {
    const candidates = new Set<string>([requestedCode])
    // If caller asks for target code (e.g. users:suspend), user holding legacy alias (employees:suspend) satisfies it
    for (const legacySource of snapshot.aliasReverse[requestedCode] ?? []) {
      candidates.add(legacySource)
    }
    // If caller asks for legacy code (e.g. permissions:delegate), user holding target (delegations:create) satisfies it
    for (const mappedTarget of snapshot.aliasForward[requestedCode] ?? []) {
      candidates.add(mappedTarget)
    }
    return candidates
  }

  private resolveScopeRequirement(
    employeeId: string,
    code: string,
    context?: AuthzCheckContext,
  ): {
    requiredScope: AuthorizationScope
    targetScopeId?: string
    isOwnResource: boolean
    isAssignedResource: boolean
  } {
    const isOwnResource = Boolean(context?.ownerId && context.ownerId === employeeId)
    const isAssignedResource = Boolean(context?.assignedUserIds?.includes(employeeId))

    if (context?.requiredScope) {
      return {
        requiredScope: context.requiredScope,
        targetScopeId:
          context.targetScopeId ??
          context.projectId ??
          context.squadId ??
          context.departmentId,
        isOwnResource,
        isAssignedResource,
      }
    }

    if (context?.projectId) {
      return {
        requiredScope: 'PROJECT',
        targetScopeId: context.projectId,
        isOwnResource,
        isAssignedResource,
      }
    }
    if (context?.squadId) {
      return {
        requiredScope: 'SQUAD',
        targetScopeId: context.squadId,
        isOwnResource,
        isAssignedResource,
      }
    }
    if (context?.departmentId) {
      return {
        requiredScope: 'DEPARTMENT',
        targetScopeId: context.departmentId,
        isOwnResource,
        isAssignedResource,
      }
    }

    if (code.endsWith('_own')) {
      return {
        requiredScope: 'SELF',
        isOwnResource: context?.ownerId ? isOwnResource : true,
        isAssignedResource,
      }
    }
    if (code.endsWith('_team')) {
      return { requiredScope: 'SQUAD', isOwnResource, isAssignedResource }
    }
    if (code.endsWith('_dept')) {
      return { requiredScope: 'DEPARTMENT', isOwnResource, isAssignedResource }
    }
    if (code.endsWith('_all')) {
      return { requiredScope: 'ORG', isOwnResource, isAssignedResource }
    }

    // Route-level check without explicit resource container ID allows any active grant (>= SELF);
    // when an explicit ownerId IS supplied, SELF enforces ownerId === employeeId.
    return {
      requiredScope: 'SELF',
      targetScopeId: context?.targetScopeId,
      isOwnResource: context?.ownerId ? isOwnResource : true,
      isAssignedResource,
    }
  }

  private denialApplies(
    denial: ScopedDenialEntry,
    requiredScope: AuthorizationScope,
    targetScopeId?: string,
  ): boolean {
    if (denial.scope === 'GLOBAL' || denial.scope === 'ORG') {
      return true
    }
    if (
      denial.scope === 'PROJECT' ||
      denial.scope === 'SQUAD' ||
      denial.scope === 'DEPARTMENT'
    ) {
      if (denial.scopeIds.length === 0) {
        return SCOPE_RANK[denial.scope] >= SCOPE_RANK[requiredScope]
      }
      return Boolean(targetScopeId && denial.scopeIds.includes(targetScopeId))
    }
    return SCOPE_RANK[denial.scope] >= SCOPE_RANK[requiredScope]
  }

  private grantSatisfiesContext(
    grant: ScopedGrantEntry,
    requiredScope: AuthorizationScope,
    targetScopeId?: string,
    isOwnResource?: boolean,
    isAssignedResource?: boolean,
  ): boolean {
    if (grant.scope === 'SELF') {
      if (requiredScope !== 'SELF') return false
      return isOwnResource !== false
    }
    if (grant.scope === 'ASSIGNED') {
      if (requiredScope === 'SELF') {
        return Boolean(isOwnResource || isAssignedResource)
      }
      if (requiredScope === 'ASSIGNED') {
        return Boolean(isAssignedResource)
      }
      return false
    }

    return scopeSatisfies(grant.scope, grant.scopeIds, requiredScope, targetScopeId)
  }
}
