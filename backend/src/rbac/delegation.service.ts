import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common'
import { AuthorizationScope, DelegationStatus } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import {
  AuthorizationService,
  DelegationGrantProvider,
  ScopedGrantEntry,
} from './authorization.service'

import { getEmployeeEffectiveTier, RoleTier } from '../common/tier.util'

export interface CreateDelegationInput {
  delegateeId: string
  permissionCodes: string[]
  scope?: AuthorizationScope
  scopeIds?: string[]
  resourceType?: string
  resourceId?: string
  reason: string
  startsAt?: string | Date
  expiresAt: string | Date
  requireApproval?: boolean
}

@Injectable()
export class DelegationService
  implements DelegationGrantProvider, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DelegationService.name)
  private sweepTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  onModuleInit() {
    this.authz.registerDelegationProvider(this)
    // Periodic cleanup sweep every 60s (.unref() prevents hanging event loop in CLI/tests)
    this.sweepTimer = setInterval(() => {
      this.expireStaleDelegations().catch((err) =>
        this.logger.warn(
          `Delegation expiry sweep error: ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
    }, 60_000)
    if (typeof this.sweepTimer.unref === 'function') {
      this.sweepTimer.unref()
    }
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
  }

  /**
   * Rule 10: Check-time enforcement. Only returns ACTIVE delegations where
   * startsAt <= now < expiresAt AND delegator is NOT suspended.
   */
  async getActiveDelegationsForUser(
    employeeId: string,
    now: Date = new Date(),
  ): Promise<ScopedGrantEntry[]> {
    const rows = await this.prisma.delegation.findMany({
      where: {
        delegateeId: employeeId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        expiresAt: { gt: now },
        delegator: { isSuspended: false },
      },
      include: {
        permissions: {
          include: {
            permission: {
              select: { code: true, isCritical: true, isSystemRoot: true, isDeprecated: true },
            },
          },
        },
        scopes: true,
      },
    })

    const grants: ScopedGrantEntry[] = []
    for (const del of rows) {
      const scopes =
        del.scopes.length > 0
          ? del.scopes
          : [{ scope: 'ORG' as AuthorizationScope, scopeIds: [] as string[] }]

      for (const dp of del.permissions) {
        if (
          dp.permission.isCritical ||
          dp.permission.isSystemRoot ||
          dp.permission.isDeprecated
        ) {
          continue // Defense in depth: critical/root never active via delegation
        }
        for (const sc of scopes) {
          grants.push({
            code: dp.permission.code,
            scope: sc.scope,
            scopeIds: sc.scopeIds,
            sourceType: 'delegation',
            sourceId: del.id,
            expiresAt: del.expiresAt.toISOString(),
          })
        }
      }
    }
    return grants
  }

  async createDelegation(actor: AuthenticatedUser, input: CreateDelegationInput) {
    const delegatorId = actor.id
    if (!input.delegateeId || input.delegateeId === delegatorId) {
      throw new BadRequestException('Cannot delegate permissions to yourself')
    }
    if (!input.reason || input.reason.trim().length < 3) {
      throw new BadRequestException('A delegation reason (at least 3 characters) is required')
    }

    const isCeo =
      actor.role === 'system:root' ||
      actor.roles?.includes('system:root') ||
      (actor.role || '').toLowerCase() === 'ceo'
    const isExecutive =
      ['cto', 'cfo', 'chro', 'cpo', 'cro', 'coo'].includes((actor.role || '').toLowerCase()) ||
      actor.roles?.some((r) => ['cto', 'cfo', 'chro', 'cpo', 'cro', 'coo'].includes(r.toLowerCase()))
    const actorTier = isCeo
      ? RoleTier.CEO
      : isExecutive
        ? RoleTier.EXECUTIVE
        : await getEmployeeEffectiveTier(this.prisma, delegatorId)
    if (actorTier !== RoleTier.CEO && actorTier !== RoleTier.EXECUTIVE) {
      throw new ForbiddenException(
        'Only the CEO and Executives can create delegations. PM and Developer can only receive.',
      )
    }

    const permissionCodes = Array.from(
      new Set((input.permissionCodes ?? []).map((c) => c.trim()).filter(Boolean)),
    )
    if (permissionCodes.length === 0) {
      throw new BadRequestException('At least one permissionCode is required for delegation')
    }
    if (
      permissionCodes.includes('login_allowlist:manage') ||
      permissionCodes.includes('system:root')
    ) {
      throw new ForbiddenException(
        'CEO-only permissions (system:root, login_allowlist:manage) cannot be delegated.',
      )
    }
    if (
      permissionCodes.includes('governance:transfer_ceo') ||
      permissionCodes.includes('governance:manage_succession')
    ) {
      throw new ForbiddenException(
        'CEO transfer and succession powers cannot be delegated.',
      )
    }

    // Rule 2: startsAt / expiresAt required and capped by max_delegation_days policy (default 30)
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date()
    const expiresAt = new Date(input.expiresAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid startsAt or expiresAt timestamp')
    }
    if (expiresAt <= startsAt) {
      throw new BadRequestException('expiresAt must be strictly after startsAt')
    }

    const maxDays = Number(await this.authz.getPolicyValue<number>('max_delegation_days', 30))
    const maxDurationMs = maxDays * 24 * 60 * 60 * 1000
    if (expiresAt.getTime() - startsAt.getTime() > maxDurationMs) {
      throw new BadRequestException(
        `Delegation duration exceeds system policy maximum of ${maxDays} days`,
      )
    }

    // Rule 6: Validate scope containment
    const scope: AuthorizationScope = input.scope ?? 'ORG'
    const scopeIds = Array.from(new Set((input.scopeIds ?? []).map((s) => s.trim()).filter(Boolean)))
    if (input.resourceId && !scopeIds.includes(input.resourceId)) {
      scopeIds.push(input.resourceId)
    }

    const [delegator, delegatee, permissions] = await Promise.all([
      this.prisma.employee.findUnique({ where: { id: delegatorId } }),
      this.prisma.employee.findUnique({ where: { id: input.delegateeId } }),
      this.prisma.permission.findMany({ where: { code: { in: permissionCodes } } }),
    ])

    if (!delegator || delegator.isSuspended) {
      throw new ForbiddenException('Suspended or unknown delegators cannot delegate permissions')
    }
    if (!delegatee || delegatee.isSuspended) {
      throw new BadRequestException('Target delegatee does not exist or is suspended')
    }
    if (permissions.length !== permissionCodes.length) {
      const found = new Set(permissions.map((p) => p.code))
      const missing = permissionCodes.filter((c) => !found.has(c))
      throw new BadRequestException(`Unknown permission code(s): [${missing.join(', ')}]`)
    }

    const allowRedelegationDepth = Number(
      await this.authz.getPolicyValue<number>('allow_redelegation_depth', 1),
    )

    // Rules 1, 3, 4: validate each requested permission
    let requiresApproval = Boolean(input.requireApproval)
    for (const perm of permissions) {
      // Rule 4: All ⚠ critical codes and system:root are strictly non-delegable
      if (perm.isSystemRoot || perm.code === 'system:root') {
        throw new ForbiddenException(
          'Security law: system:root cannot be delegated under any circumstance',
        )
      }
      if (perm.isCritical || !perm.isDelegable) {
        throw new ForbiddenException(
          `Security law: Critical (⚠) or non-delegable permission "${perm.code}" cannot be delegated`,
        )
      }
      if (perm.isDeprecated) {
        throw new ForbiddenException(
          `Deprecated permission "${perm.code}" cannot be newly delegated; use its replacement permission instead`,
        )
      }
      if (perm.isSensitive) {
        requiresApproval = true
      }

      // Rule 1 + Rule 3: Must hold the permission at the requested scope/scopeIds, and not purely via delegation
      const targetsToCheck = scopeIds.length > 0 ? scopeIds : [undefined]
      for (const targetScopeId of targetsToCheck) {
        const check = await this.authz.check(delegatorId, perm.code, {
          requiredScope: scope,
          targetScopeId,
        })
        if (!check.allowed) {
          throw new ForbiddenException(
            `Delegation denied: You do not hold "${perm.code}" at scope "${scope}"${targetScopeId ? ` (${targetScopeId})` : ''}`,
          )
        }
        if (check.source === 'delegation' && allowRedelegationDepth <= 1) {
          throw new ForbiddenException(
            `Re-delegation denied: Permission "${perm.code}" was received via delegation and max delegation depth is ${allowRedelegationDepth}`,
          )
        }
      }
    }

    const initialStatus: DelegationStatus = requiresApproval ? 'PENDING_APPROVAL' : 'ACTIVE'

    const created = await this.prisma.$transaction(async (tx) => {
      const delegation = await tx.delegation.create({
        data: {
          delegatorId,
          delegateeId: delegatee.id,
          status: initialStatus,
          reason: input.reason.trim(),
          startsAt,
          expiresAt,
          depth: 1,
          requiresApproval,
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
          scopes: {
            create: [
              {
                scope,
                scopeIds,
                resourceType: input.resourceType ?? null,
                resourceId: input.resourceId ?? null,
              },
            ],
          },
        },
        include: {
          delegator: { select: { id: true, name: true, email: true, title: true } },
          delegatee: { select: { id: true, name: true, email: true, title: true } },
          permissions: { include: { permission: true } },
          scopes: true,
        },
      })

      if (this.auditLogger) {
        await this.auditLogger.log(
          {
            actorId: delegator.id,
            actorName: delegator.name,
            actorEmail: delegator.email,
            actorRole: actor.role.toUpperCase(),
            action: requiresApproval ? 'DELEGATION_REQUESTED' : 'DELEGATION_CREATED',
            actionCode: requiresApproval ? 'DELEGATION_PENDING_APPROVAL' : 'DELEGATION_ACTIVE',
            severity: requiresApproval ? 'WARNING' : 'INFO',
            entityType: 'delegation',
            entityId: delegation.id,
            entityTitle: `${delegator.name} -> ${delegatee.name}`,
            description: `${delegator.name} ${requiresApproval ? 'requested' : 'granted'} temporary delegation [${permissionCodes.join(', ')}] at scope ${scope}${scopeIds.length ? ` [${scopeIds.join(',')}]` : ''} to ${delegatee.name} until ${expiresAt.toISOString()}`,
            category: 'security',
            badgeColor: requiresApproval ? 'amber' : 'purple',
          },
          tx,
        )
      }

      return delegation
    })

    if (initialStatus === 'ACTIVE') {
      await this.authz.invalidateUserCache(delegatee.id)
    }

    return created
  }

  /**
   * Rule 7: Sensitive delegations require approval by an authorized `delegations:approve` holder
   * who is NEITHER delegator NOR delegatee.
   */
  async approveDelegation(delegationId: string, actor: AuthenticatedUser) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id: delegationId },
      include: { delegatee: { select: { id: true, name: true } } },
    })
    if (!delegation) throw new NotFoundException(`Delegation "${delegationId}" not found`)
    if (delegation.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Delegation is "${delegation.status}", not PENDING_APPROVAL`)
    }
    if (actor.id === delegation.delegatorId || actor.id === delegation.delegateeId) {
      throw new ForbiddenException(
        'Separation of duties: Neither delegator nor delegatee can approve a delegation request',
      )
    }
    await this.authz.assert(actor, 'delegations:approve')

    const now = new Date()
    if (delegation.expiresAt <= now) {
      const expired = await this.prisma.delegation.update({
        where: { id: delegationId },
        data: { status: 'EXPIRED', revocationTrigger: 'EXPIRED' },
      })
      return expired
    }

    const approved = await this.prisma.delegation.update({
      where: { id: delegationId },
      data: {
        status: 'ACTIVE',
        approvedById: actor.id,
        approvedAt: now,
      },
      include: {
        delegator: { select: { id: true, name: true, email: true } },
        delegatee: { select: { id: true, name: true, email: true } },
        permissions: { include: { permission: true } },
        scopes: true,
      },
    })

    await this.authz.invalidateUserCache(delegation.delegateeId)
    return approved
  }

  /**
   * Rule 8 & 9: Original delegator, authorized admin (`delegations:revoke`), or `system:root` can revoke.
   * History is immutable (status transition, never delete).
   */
  async revokeDelegation(delegationId: string, actor: AuthenticatedUser, reason?: string) {
    const delegation = await this.prisma.delegation.findUnique({
      where: { id: delegationId },
      include: {
        delegator: { select: { id: true, name: true, email: true } },
        delegatee: { select: { id: true, name: true, email: true } },
      },
    })
    if (!delegation) throw new NotFoundException(`Delegation "${delegationId}" not found`)

    if (delegation.status === 'REVOKED' || delegation.status === 'EXPIRED') {
      return delegation
    }

    const isOriginalHolder = delegation.delegatorId === actor.id
    if (!isOriginalHolder) {
      const isCeo =
        actor.roles?.includes('system:root') || (actor.role || '').toLowerCase() === 'ceo'
      if (!isCeo) {
        throw new ForbiddenException(
          "Executives can only revoke delegations they created. Only the CEO can revoke third-party delegations.",
        )
      }
    }

    const now = new Date()
    const trigger = isOriginalHolder ? 'MANUAL' : 'ADMIN_REVOKED'
    const updated = await this.prisma.delegation.update({
      where: { id: delegationId },
      data: {
        status: 'REVOKED',
        revokedAt: now,
        revokedById: actor.id,
        revokeReason: reason?.trim() || 'Revoked',
        revocationTrigger: trigger,
      },
      include: {
        delegator: { select: { id: true, name: true, email: true } },
        delegatee: { select: { id: true, name: true, email: true } },
        permissions: { include: { permission: true } },
        scopes: true,
      },
    })

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actor.id,
        actorName: actor.name || actor.id,
        actorEmail: actor.email || '',
        actorRole: actor.role.toUpperCase(),
        action: 'DELEGATION_REVOKED',
        actionCode: 'DELEGATION_REVOKED',
        severity: 'WARNING',
        entityType: 'delegation',
        entityId: delegation.id,
        entityTitle: `${delegation.delegator?.name ?? delegation.delegatorId} -> ${delegation.delegatee?.name ?? delegation.delegateeId}`,
        description: `Delegation ${delegation.id} revoked by ${actor.id} (${trigger})${reason ? `: ${reason}` : ''}`,
        category: 'security',
        badgeColor: 'amber',
      })
    }

    await this.authz.invalidateUserCache(delegation.delegateeId)
    return updated
  }

  /**
   * Rule 5: Scheduled expiry sweep marks overdue ACTIVE delegations as EXPIRED and clears delegatee caches.
   */
  async expireStaleDelegations(now: Date = new Date()) {
    const overdue = await this.prisma.delegation.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
      select: { id: true, delegateeId: true },
    })

    if (overdue.length === 0) return { expiredCount: 0 }

    const ids = overdue.map((d) => d.id)
    const delegateeIds = Array.from(new Set(overdue.map((d) => d.delegateeId)))

    await this.prisma.delegation.updateMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      data: {
        status: 'EXPIRED',
        revocationTrigger: 'EXPIRED',
      },
    })

    await this.authz.invalidateUsersCache(delegateeIds)
    return { expiredCount: ids.length }
  }

  /**
   * Rule 5: Cascading revocation when delegator is suspended, demoted, or loses permissions.
   */
  async cascadeRevokeForDelegator(
    delegatorId: string,
    trigger: 'DELEGATOR_SUSPENDED' | 'DELEGATOR_DEMOTED' | 'PERMISSION_LOST',
    lostPermissionCodes?: string[],
    actorId?: string,
  ) {
    const activeDelegations = await this.prisma.delegation.findMany({
      where: {
        delegatorId,
        status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
      },
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
      },
    })

    if (activeDelegations.length === 0) return { revokedCount: 0 }

    const lostSet = lostPermissionCodes ? new Set(lostPermissionCodes) : null
    const toRevoke = activeDelegations.filter((del) => {
      if (!lostSet) return true
      return del.permissions.some((dp) => lostSet.has(dp.permission.code))
    })

    if (toRevoke.length === 0) return { revokedCount: 0 }

    const now = new Date()
    const ids = toRevoke.map((d) => d.id)
    const affectedDelegatees = Array.from(new Set(toRevoke.map((d) => d.delegateeId)))

    await this.prisma.delegation.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'REVOKED',
        revokedAt: now,
        revokedById: actorId ?? 'system',
        revocationTrigger: trigger,
        revokeReason: `Cascade revoked automatically (${trigger})`,
      },
    })

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actorId ?? delegatorId,
        actorName: actorId ?? 'System Cascade Guard',
        actorEmail: '',
        actorRole: 'SYSTEM',
        action: 'DELEGATION_CASCADE_REVOKED',
        actionCode: trigger,
        severity: 'CRITICAL',
        entityType: 'user',
        entityId: delegatorId,
        description: `Cascade revoked ${ids.length} active/pending delegation(s) for delegator ${delegatorId} due to ${trigger}`,
        category: 'security',
        badgeColor: 'rose',
      })
    }

    await this.authz.invalidateUsersCache(affectedDelegatees)
    return { revokedCount: ids.length, affectedDelegatees }
  }

  async listForUser(employeeId: string) {
    await this.expireStaleDelegations()
    const [created, received] = await Promise.all([
      this.prisma.delegation.findMany({
        where: { delegatorId: employeeId },
        include: {
          delegator: { select: { id: true, name: true, email: true, title: true } },
          delegatee: { select: { id: true, name: true, email: true, title: true } },
          permissions: { include: { permission: true } },
          scopes: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.delegation.findMany({
        where: { delegateeId: employeeId },
        include: {
          delegator: { select: { id: true, name: true, email: true, title: true } },
          delegatee: { select: { id: true, name: true, email: true, title: true } },
          permissions: { include: { permission: true } },
          scopes: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return { created, received }
  }

  async listAll() {
    await this.expireStaleDelegations()
    return this.prisma.delegation.findMany({
      include: {
        delegator: { select: { id: true, name: true, email: true, title: true } },
        delegatee: { select: { id: true, name: true, email: true, title: true } },
        permissions: { include: { permission: true } },
        scopes: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }
}
