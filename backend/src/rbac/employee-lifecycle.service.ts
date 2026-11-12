import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { PermissionCacheService } from './permission-cache.service'
import { AuthorizationService } from './authorization.service'
import { DelegationService } from './delegation.service'
import { MailService } from '../mail/mail.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import {
  C_LEVEL_ROLE_SLUGS,
  assertHorizontalCLevelGuard,
  assertNotSelfTarget,
  assertTargetNotCeoForDestructiveAction,
  isEmployeeCeo,
  loadEmployeeWithSecurityContext,
  verifyStepUpAuth,
} from '../common/security-policy.util'
import { LifecycleActionDto } from './dto/rbac.dto'

@Injectable()
export class EmployeeLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
    private readonly auditLogger: AuditLoggerService,
    @Optional() private readonly authz?: AuthorizationService,
    @Optional() private readonly delegationService?: DelegationService,
    @Optional() private readonly mailService?: MailService,
  ) {}

  async suspendEmployee(
    employeeId: string,
    actor: AuthenticatedUser,
    dto?: LifecycleActionDto,
    headers?: Record<string, string>,
  ) {
    await verifyStepUpAuth(this.prisma, actor.id, dto, headers, 'account suspension')
    return this.setEmployeeSuspension(employeeId, true, actor, dto?.reason)
  }

  async unsuspendEmployee(employeeId: string, actor: AuthenticatedUser, reason?: string) {
    return this.setEmployeeSuspension(employeeId, false, actor, reason)
  }

  async demoteEmployee(
    employeeId: string,
    actor: AuthenticatedUser,
    dto?: LifecycleActionDto,
    headers?: Record<string, string>,
  ) {
    await verifyStepUpAuth(this.prisma, actor.id, dto, headers, 'user demotion')
    const { employee, actorEmp } = await this.loadProtectedLifecycleTarget(
      employeeId,
      actor,
      'demote',
    )
    const actorName = actorEmp?.name || actor.name || actor.role.toUpperCase()
    const actorEmail = actorEmp?.email || actor.email || ''
    const cleanReason = dto?.reason?.trim() || null

    const fallbackSlug = this.authz
      ? await this.authz.getPolicyValue<string>('default_fallback_role_slug', 'developer')
      : 'developer'

    const result = await this.prisma.$transaction(async (tx) => {
      const devRole = await tx.role.findUnique({ where: { slug: fallbackSlug } })
      if (!devRole) {
        throw new NotFoundException(`Base fallback role "${fallbackSlug}" not found in catalog`)
      }

      const revokedRoles = await tx.employeeRole.updateMany({
        where: {
          employeeId,
          isActive: true,
          roleId: { not: devRole.id },
        },
        data: { isActive: false },
      })

      await tx.userRoleAssignment.updateMany({
        where: {
          employeeId,
          isActive: true,
          roleId: { not: devRole.id },
        },
        data: { isActive: false, revokedAt: new Date(), revokedById: actor.id },
      })

      await tx.userRoleAssignment.create({
        data: {
          employeeId,
          roleId: devRole.id,
          scope: 'SELF',
          scopeIds: [],
          assignedById: actor.id,
          reason: cleanReason || 'Demoted to baseline fallback role',
          isActive: true,
        },
      })

      await tx.employeeRole.upsert({
        where: { employeeId_roleId: { employeeId, roleId: devRole.id } },
        update: {
          isActive: true,
          assignedById: actor.id,
          assignedAt: new Date(),
          expiresAt: null,
        },
        create: {
          employeeId,
          roleId: devRole.id,
          assignedById: actor.id,
          isActive: true,
          expiresAt: null,
        },
      })

      const deletedOverrides = await tx.employeePermission.deleteMany({
        where: { employeeId },
      })

      await this.auditLogger.log(
        {
          actorId: actor.id,
          actorName,
          actorEmail,
          actorRole: actor.role.toUpperCase(),
          action: 'ACCESS_RESET_DEMOTED',
          actionCode: 'IDENTITY_ACCESS_RESET_DEMOTED',
          severity: 'CRITICAL',
          entityType: 'user',
          entityId: employeeId,
          entityTitle: employee.name,
          description: `${actor.role.toUpperCase()} reset system access to baseline Developer for ${employee.name} (revoked ${revokedRoles.count} role(s), cleared ${deletedOverrides.count} direct delegation(s))${cleanReason ? ` — Reason: ${cleanReason}` : ''}`,
          category: 'security',
          badgeColor: 'rose',
          payload: {
            revokedRoleCount: revokedRoles.count,
            clearedDirectPermissionCount: deletedOverrides.count,
            reason: cleanReason,
          },
        },
        tx,
      )

      return {
        employeeId,
        name: employee.name,
        demotedTo: devRole.slug,
        revokedRoleCount: revokedRoles.count,
        clearedDirectPermissionCount: deletedOverrides.count,
      }
    })

    if (this.delegationService) {
      await this.delegationService.cascadeRevokeForDelegator(
        employeeId,
        'DELEGATOR_DEMOTED',
        undefined,
        actor.id,
      )
    }

    if (this.authz) {
      await this.authz.invalidateUserCache(employeeId)
    } else {
      await this.cache.invalidateUser(employeeId)
    }
    return result
  }

  private async setEmployeeSuspension(
    employeeId: string,
    suspend: boolean,
    actor: AuthenticatedUser,
    reason?: string,
  ) {
    const { employee, actorEmp } = await this.loadProtectedLifecycleTarget(
      employeeId,
      actor,
      suspend ? 'suspend' : 'reactivate',
    )
    const actorName = actorEmp?.name || actor.name || actor.role.toUpperCase()
    const actorEmail = actorEmp?.email || actor.email || ''
    const cleanReason = reason?.trim() || null

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.employee.update({
        where: { id: employeeId },
        data: { isSuspended: suspend },
        select: { id: true, name: true, email: true, isSuspended: true },
      })

      await this.auditLogger.log(
        {
          actorId: actor.id,
          actorName,
          actorEmail,
          actorRole: actor.role.toUpperCase(),
          action: suspend ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REACTIVATED',
          actionCode: suspend ? 'IDENTITY_ACCOUNT_SUSPENDED' : 'IDENTITY_ACCOUNT_REACTIVATED',
          severity: suspend ? 'CRITICAL' : 'WARNING',
          entityType: 'user',
          entityId: employeeId,
          entityTitle: employee.name,
          description: suspend
            ? `${actor.role.toUpperCase()} suspended account for ${employee.name}${cleanReason ? ` — Reason: ${cleanReason}` : ''}`
            : `${actor.role.toUpperCase()} reactivated account for ${employee.name}${cleanReason ? ` — Reason: ${cleanReason}` : ''}`,
          category: 'security',
          badgeColor: suspend ? 'rose' : 'emerald',
          payload: {
            isSuspended: suspend,
            reason: cleanReason,
          },
        },
        tx,
      )

      return saved
    })

    if (suspend && this.delegationService) {
      await this.delegationService.cascadeRevokeForDelegator(
        employeeId,
        'DELEGATOR_SUSPENDED',
        undefined,
        actor.id,
      )
    }

    if (this.authz) {
      await this.authz.invalidateUserCache(employeeId)
    } else {
      await this.cache.invalidateUser(employeeId)
    }
    return updated
  }

  /**
   * Admin-initiated password reset: generates a new random temporary password
   * (dispatched via email/notification, NEVER returned to the admin), forces password
   * change at next login, and revokes all active sessions & refresh tokens.
   */
  async adminResetPassword(
    employeeId: string,
    actor: AuthenticatedUser,
    reason?: string,
  ) {
    const { employee } = await this.loadProtectedLifecycleTarget(employeeId, actor, 'demote')
    const tempPassword = crypto.randomBytes(12).toString('base64url')
    const nextHash = await bcrypt.hash(tempPassword, 12)
    const ttlHours = this.mailService?.tempPasswordTtlHours ?? 24
    const tempPasswordExpiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          passwordHash: nextHash,
          mustChangePassword: true,
          tempPasswordExpiresAt,
          authVersion: { increment: 1 },
        },
      })

      await tx.refreshToken.updateMany({
        where: { employeeId, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      await tx.securitySession.updateMany({
        where: { employeeId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      })

      await tx.employeeChangeHistory.create({
        data: {
          employeeId,
          actorId: actor.id,
          actionKey: 'users:reset_password',
          changeType: 'SECURITY',
          beforeState: { sessionsRevoked: false } as any,
          afterState: { mustChangePassword: true, sessionsRevoked: true } as any,
          reason: reason?.trim() || 'Administrative password reset',
        },
      })
    })

    await this.auditLogger.log({
      actorId: actor.id,
      actorName: actor.id,
      actorEmail: actor.email || '',
      actorRole: actor.role.toUpperCase(),
      action: `Admin reset password for ${employee.name}`,
      actionCode: 'USER_PASSWORD_ADMIN_RESET',
      severity: 'CRITICAL',
      entityType: 'Employee',
      entityId: employeeId,
      description: `Issued temporary password by email and revoked all sessions for ${employee.email}.`,
      category: 'security',
      reason: reason?.trim() || 'Administrative password reset',
    })

    const mailResult = await this.mailService?.sendAdminResetTempPassword({
      to: employee.email,
      name: employee.name,
      temporaryPassword: tempPassword,
      ttlHours,
    })

    // Never return the temporary password in the response payload
    return {
      reset: true,
      employeeId,
      mustChangePassword: true,
      sessionsRevoked: true,
      delivery: 'email',
      emailSent: mailResult?.sent ?? false,
      expiresAt: tempPasswordExpiresAt.toISOString(),
    }
  }

  /**
   * Admin-initiated MFA reset for lost authenticator devices.
   */
  async adminResetMfa(
    employeeId: string,
    actor: AuthenticatedUser,
    reason?: string,
  ) {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('A written reason of at least 10 characters is required.')
    }
    const { actorEmp, employee } = await this.loadProtectedLifecycleTarget(
      employeeId,
      actor,
      'demote',
    )

    const targetIsPrivileged =
      employee.employeeRoles.some(
        (er) =>
          C_LEVEL_ROLE_SLUGS.has(er.role.slug.toLowerCase()) ||
          Boolean((er.role as any).includeCritical),
      ) || false
    if (targetIsPrivileged && !isEmployeeCeo(actorEmp)) {
      throw new ForbiddenException(
        'Only the CEO (system:root) may reset MFA for another privileged or executive user.',
      )
    }

    const shouldRequireReenroll = targetIsPrivileged || Boolean((employee as any).mustEnrollMfa)

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaLastUsedStep: null,
          mfaRecoveryCodes: [],
          mfaFailureCount: 0,
          mfaFailureWindowStart: null,
          mfaLockedUntil: null,
          mustEnrollMfa: shouldRequireReenroll,
          authVersion: { increment: 1 },
        },
      })

      await tx.refreshToken.updateMany({
        where: { employeeId, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      await tx.securitySession.updateMany({
        where: { employeeId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      })

      await tx.employeeChangeHistory.create({
        data: {
          employeeId,
          actorId: actor.id,
          actionKey: 'mfa:manage',
          changeType: 'SECURITY',
          beforeState: { mfaEnabled: true } as any,
          afterState: { mfaEnabled: false, mustEnrollMfa: shouldRequireReenroll } as any,
          reason: reason.trim(),
        },
      })
    })

    const mailResult = await this.mailService?.sendMfaResetNotice({
      to: employee.email,
      name: employee.name,
    })

    await this.auditLogger.log({
      actorId: actor.id,
      actorName: actorEmp.name || actor.id,
      actorEmail: actor.email || '',
      actorRole: actor.role.toUpperCase(),
      action: `Admin reset MFA for ${employee.name}`,
      actionCode: 'USER_MFA_ADMIN_RESET',
      actionKey: 'mfa:manage',
      mfaVerified: true,
      severity: 'CRITICAL',
      entityType: 'Employee',
      entityId: employeeId,
      description: `Reset MFA, revoked all sessions, and sent notification email.`,
      category: 'security',
      reason: reason.trim(),
    })

    return {
      reset: true,
      employeeId,
      mustEnrollMfa: shouldRequireReenroll,
      sessionsRevoked: true,
      emailSent: mailResult?.sent ?? false,
    }
  }

  async revokeAllSessionsForEmployee(
    employeeId: string,
    actor: AuthenticatedUser,
    reason?: string,
  ) {
    const { actorEmp, employee } = await this.loadProtectedLifecycleTarget(
      employeeId,
      actor,
      'demote',
    )
    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.employee.update({
        where: { id: employeeId },
        data: { authVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { employeeId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.securitySession.updateMany({
        where: { employeeId, isRevoked: false },
        data: { isRevoked: true, revokedAt: now },
      }),
    ])
    await this.auditLogger.log({
      actorId: actor.id,
      actorName: actorEmp.name || actor.id,
      actorEmail: actor.email || '',
      actorRole: actor.role.toUpperCase(),
      action: `Revoked all sessions for ${employee.name}`,
      actionCode: 'USER_SESSIONS_REVOKED',
      actionKey: 'mfa:manage',
      mfaVerified: true,
      severity: 'WARNING',
      entityType: 'Employee',
      entityId: employeeId,
      description: `Admin revoked all active sessions and refresh tokens for ${employee.name}.`,
      category: 'security',
      reason: reason?.trim() || 'Administrative session revocation',
    })
    return { revoked: true, employeeId }
  }

  async getMfaSecurityOverview() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const [employees, resetHistory, resetsThisMonth] = await Promise.all([
      this.prisma.employee.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          mfaEnabled: true,
          mustEnrollMfa: true,
          mfaLockedUntil: true,
          isSuspended: true,
          employeeRoles: {
            where: { isActive: true },
            select: { role: { select: { slug: true, name: true } } },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employeeChangeHistory.findMany({
        where: { actionKey: 'mfa:manage' },
        select: { employeeId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeChangeHistory.count({
        where: { actionKey: 'mfa:manage', createdAt: { gte: monthStart } },
      }),
    ])

    const lastResetMap = new Map<string, Date>()
    for (const h of resetHistory) {
      if (!lastResetMap.has(h.employeeId)) lastResetMap.set(h.employeeId, h.createdAt)
    }

    const rows = employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      title: e.title,
      role: e.employeeRoles[0]?.role?.slug || 'employee',
      mfaEnabled: e.mfaEnabled,
      mustEnrollMfa: e.mustEnrollMfa,
      isLocked: Boolean(e.mfaLockedUntil && e.mfaLockedUntil > now),
      mfaLockedUntil: e.mfaLockedUntil,
      isSuspended: e.isSuspended,
      lastMfaResetAt: lastResetMap.get(e.id) || null,
    }))

    const total = rows.length
    const mfaEnabledCount = rows.filter((r) => r.mfaEnabled).length
    const lockedCount = rows.filter((r) => r.isLocked).length

    return {
      summary: {
        totalUsers: total,
        mfaEnabledCount,
        mfaEnabledPct: total > 0 ? Math.round((mfaEnabledCount / total) * 100) : 0,
        lockedUsersCount: lockedCount,
        resetsThisMonth,
      },
      employees: rows,
    }
  }

  private async loadProtectedLifecycleTarget(
    employeeId: string,
    actor: AuthenticatedUser,
    verb: 'suspend' | 'reactivate' | 'demote',
  ) {
    assertNotSelfTarget(actor.id, employeeId, verb)

    const employee = await loadEmployeeWithSecurityContext(this.prisma, employeeId)
    assertTargetNotCeoForDestructiveAction(employee, verb)

    const actorEmp = await assertHorizontalCLevelGuard(this.prisma, actor.id, employee, verb)

    return { employee, actorEmp }
  }
}
