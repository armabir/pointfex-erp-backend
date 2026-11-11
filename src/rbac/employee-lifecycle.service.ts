import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { PermissionCacheService } from './permission-cache.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import {
  assertHorizontalCLevelGuard,
  assertNotSelfTarget,
  assertTargetNotCeoForDestructiveAction,
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

    const result = await this.prisma.$transaction(async (tx) => {
      const devRole = await tx.role.findUnique({ where: { slug: 'developer' } })
      if (!devRole) {
        throw new NotFoundException('Base "developer" role not found in system catalog')
      }

      const revokedRoles = await tx.employeeRole.updateMany({
        where: {
          employeeId,
          isActive: true,
          roleId: { not: devRole.id },
        },
        data: { isActive: false },
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

    await this.cache.invalidateUser(employeeId)
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

    await this.cache.invalidateUser(employeeId)
    return updated
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
