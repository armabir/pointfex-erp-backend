import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { PermissionCacheService } from './permission-cache.service'
import { AuthorizationService } from './authorization.service'
import { DelegationService } from './delegation.service'
import { RbacService } from './rbac.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import {
  assertHorizontalCLevelGuard,
  assertNotSelfTarget,
  assertTargetNotSupremeCeo,
  isEmployeeCeo,
  loadEmployeeWithSecurityContext,
} from '../common/security-policy.util'
import { AssignEmployeeRoleDto, GrantDirectPermissionDto } from './dto/rbac.dto'

@Injectable()
export class EmployeeAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
    private readonly rbacService: RbacService,
    private readonly auditLogger: AuditLoggerService,
    @Optional() private readonly authz?: AuthorizationService,
    @Optional() private readonly delegationService?: DelegationService,
  ) {}

  async assignRoleToEmployee(
    employeeId: string,
    dto: AssignEmployeeRoleDto,
    actor: AuthenticatedUser,
  ) {
    assertNotSelfTarget(actor.id, employeeId, 'modify roles')

    const targetEmployee = await loadEmployeeWithSecurityContext(this.prisma, employeeId)
    const actorEmployee = await assertHorizontalCLevelGuard(
      this.prisma,
      actor.id,
      targetEmployee,
      'modify roles',
    )

    if (!dto.roleId && !dto.roleSlug) {
      throw new BadRequestException('Either roleId or roleSlug is required')
    }

    const role = await this.prisma.role.findFirst({
      where: dto.roleId ? { id: dto.roleId } : { slug: dto.roleSlug },
    })
    if (!role || !role.isActive) {
      throw new NotFoundException('Target active role not found')
    }

    if (role.isRootRole || role.slug === 'ceo') {
      throw new BadRequestException(
        'CEO role cannot be assigned directly. Use POST /api/governance/transfer-ceo for CEO succession.',
      )
    }

    const scope = dto.scope ?? 'ORG'
    const scopeIds = Array.from(new Set((dto.scopeIds ?? []).map((id) => id.trim()).filter(Boolean)))
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date()
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null

    // Maker-Checker Enforcement: non-CEO callers submit approval requests
    if (!isEmployeeCeo(actorEmployee)) {
      const request = await this.prisma.$transaction(async (tx) => {
        const created = await tx.accessChangeRequest.create({
          data: {
            requesterId: actor.id,
            targetEmployeeId: employeeId,
            requestedRoleId: role.id,
            status: 'PENDING',
            reason: dto.reason || `Requested via role management by ${actorEmployee.name}`,
          },
          include: {
            requestedRole: true,
            targetEmployee: true,
            requester: { select: { id: true, name: true, title: true } },
          },
        })

        await this.auditLogger.log(
          {
            actorId: actor.id,
            actorName: actorEmployee.name,
            actorEmail: actorEmployee.email,
            actorRole: actor.role.toUpperCase(),
            action: 'ACCESS_CHANGE_REQUESTED',
            actionCode: 'MAKER_CHECKER_ROLE_REQUEST',
            severity: 'WARNING',
            entityType: 'user',
            entityId: employeeId,
            entityTitle: targetEmployee.name,
            description: `${actorEmployee.name} submitted Maker-Checker role change request (${role.name}, scope=${scope}) for ${targetEmployee.name} — awaiting CHRO/CEO approval`,
            category: 'governance',
            badgeColor: 'amber',
          },
          tx,
        )

        return created
      })

      return { pendingApproval: true, accessRequest: request }
    }

    const assignment = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.employeeRole.upsert({
        where: { employeeId_roleId: { employeeId, roleId: role.id } },
        update: {
          isActive: true,
          assignedById: actor.id,
          assignedAt: new Date(),
          expiresAt,
        },
        create: {
          employeeId,
          roleId: role.id,
          assignedById: actor.id,
          expiresAt,
          isActive: true,
        },
        include: { role: true, employee: true },
      })

      await tx.userRoleAssignment.updateMany({
        where: { employeeId, roleId: role.id, isActive: true },
        data: { isActive: false, revokedAt: new Date(), revokedById: actor.id },
      })

      const scoped = await tx.userRoleAssignment.create({
        data: {
          employeeId,
          roleId: role.id,
          scope,
          scopeIds,
          assignedById: actor.id,
          reason: dto.reason,
          startsAt,
          expiresAt,
          isActive: true,
        },
      })

      await this.auditLogger.log(
        {
          actorId: actor.id,
          actorName: actorEmployee.name,
          actorEmail: actorEmployee.email,
          actorRole: actor.role.toUpperCase(),
          action: 'USER_ROLE_ASSIGNED',
          actionCode: 'RBAC_USER_ROLE_GRANTED',
          severity: 'INFO',
          entityType: 'user',
          entityId: employeeId,
          entityTitle: targetEmployee.name,
          description: `Assigned role "${role.name}" (${role.slug}) at scope ${scope}${scopeIds.length ? ` [${scopeIds.join(',')}]` : ''} to ${targetEmployee.name}`,
          category: 'people',
          badgeColor: 'purple',
        },
        tx,
      )

      await (tx as any).employeeChangeHistory?.create({
        data: {
          employeeId,
          actorId: actor.id,
          actionKey: 'users:assign_role',
          changeType: 'ROLE',
          beforeState: targetEmployee.employeeRoles.map((er) => er.role.slug) as any,
          afterState: { roleSlug: role.slug, roleName: role.name, scope, scopeIds } as any,
          reason: dto.reason?.trim() || `Assigned role ${role.name}`,
        },
      })

      return { ...saved, scopedAssignment: scoped }
    })

    if (this.authz) {
      await this.authz.invalidateUserCache(employeeId)
    } else {
      await this.cache.invalidateUser(employeeId)
    }
    return assignment
  }

  async listScopedRoleAssignments(employeeId: string) {
    return this.prisma.userRoleAssignment.findMany({
      where: { employeeId },
      include: {
        role: { select: { id: true, slug: true, name: true, wildcards: true, isActive: true } },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async revokeRoleFromEmployee(employeeId: string, roleId: string, actor: AuthenticatedUser) {
    assertNotSelfTarget(actor.id, employeeId, 'revoke roles')

    const targetEmployee = await loadEmployeeWithSecurityContext(this.prisma, employeeId)
    const actorEmployee = await assertHorizontalCLevelGuard(
      this.prisma,
      actor.id,
      targetEmployee,
      'revoke roles',
    )

    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    if (role.isRootRole || role.slug === 'ceo') {
      throw new ForbiddenException(
        'Security law: CEO role cannot be detached directly. Use POST /api/governance/transfer-ceo.',
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employeeRole.updateMany({
        where: { employeeId, roleId, isActive: true },
        data: { isActive: false },
      })

      await tx.userRoleAssignment.updateMany({
        where: { employeeId, roleId, isActive: true },
        data: { isActive: false, revokedAt: new Date(), revokedById: actor.id },
      })

      await this.auditLogger.log(
        {
          actorId: actor.id,
          actorName: actorEmployee.name,
          actorEmail: actorEmployee.email,
          actorRole: actor.role.toUpperCase(),
          action: 'USER_ROLE_REVOKED',
          actionCode: 'RBAC_USER_ROLE_REVOKED',
          severity: 'WARNING',
          entityType: 'user',
          entityId: employeeId,
          entityTitle: targetEmployee.name,
          description: `Revoked role "${role.name}" (${role.slug}) from ${targetEmployee.name}`,
          category: 'people',
          badgeColor: 'amber',
        },
        tx,
      )
    })

    if (this.delegationService) {
      await this.delegationService.cascadeRevokeForDelegator(
        employeeId,
        'PERMISSION_LOST',
        undefined,
        actor.id,
      )
    }

    if (this.authz) {
      await this.authz.invalidateUserCache(employeeId)
    } else {
      await this.cache.invalidateUser(employeeId)
    }
    await (this.prisma as any).employeeChangeHistory?.create({
      data: {
        employeeId,
        actorId: actor.id,
        actionKey: 'users:assign_role',
        changeType: 'ROLE',
        beforeState: { revokedRoleId: roleId } as any,
        afterState: { active: false } as any,
        reason: `Revoked role ${roleId}`,
      },
    })
    return { revoked: true, employeeId, roleId }
  }

  async grantDirectPermission(
    targetEmployeeId: string,
    dto: GrantDirectPermissionDto,
    actor: AuthenticatedUser,
  ) {
    assertNotSelfTarget(actor.id, targetEmployeeId, 'grant direct permissions')

    const employee = await loadEmployeeWithSecurityContext(this.prisma, targetEmployeeId)
    assertTargetNotSupremeCeo(employee)

    if (!dto.permissionId && !dto.permissionCode) {
      throw new BadRequestException('Either permissionId or permissionCode is required')
    }

    const perm = await this.prisma.permission.findFirst({
      where: dto.permissionId ? { id: dto.permissionId } : { code: dto.permissionCode },
    })
    if (!perm) throw new NotFoundException('Target permission not found')

    if (
      perm.isSystemRoot ||
      perm.code === 'system:root' ||
      perm.code === 'login_allowlist:manage' ||
      perm.isCritical ||
      !perm.isDelegable
    ) {
      throw new ForbiddenException(
        `Security law: Critical (⚠) or root permission "${perm.code}" cannot be delegated.`,
      )
    }

    // Anti-escalation constraint: acting user can ONLY delegate permissions they hold
    const actorProfile = await this.rbacService.getEmployeeAccessProfile(actor.id)
    const actorPermSet = new Set(actorProfile.permissions)
    if (!actorPermSet.has(perm.code)) {
      throw new ForbiddenException(
        `Delegation denied: You cannot grant "${perm.code}" because your account does not hold this permission`,
      )
    }

    let expiresAtDate: Date | null = null
    if (dto.expiresAt) {
      expiresAtDate = new Date(dto.expiresAt)
      if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate <= new Date()) {
        throw new BadRequestException('expiresAt must be a valid future ISO timestamp')
      }
    }

    const actorEmp = await this.prisma.employee.findUnique({
      where: { id: actor.id },
      select: { name: true, email: true },
    })
    const actorName = actorEmp?.name || actor.name || actor.role.toUpperCase()
    const actorEmail = actorEmp?.email || actor.email || ''

    const override = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.employeePermission.upsert({
        where: {
          employeeId_permissionId: {
            employeeId: targetEmployeeId,
            permissionId: perm.id,
          },
        },
        update: {
          isActive: true,
          grantedById: actor.id,
          grantedAt: new Date(),
          expiresAt: expiresAtDate,
          reason: dto.reason?.trim() || null,
        },
        create: {
          employeeId: targetEmployeeId,
          permissionId: perm.id,
          grantedById: actor.id,
          expiresAt: expiresAtDate,
          reason: dto.reason?.trim() || null,
          isActive: true,
        },
        include: { permission: true, employee: true },
      })

      await this.auditLogger.log(
        {
          actorId: actor.id,
          actorName,
          actorEmail,
          actorRole: actor.role.toUpperCase(),
          action: 'DIRECT_PERMISSION_DELEGATED',
          actionCode: 'RBAC_DIRECT_OVERRIDE_GRANTED',
          severity: 'WARNING',
          entityType: 'user',
          entityId: targetEmployeeId,
          entityTitle: employee.name,
          description: `${actor.role.toUpperCase()} granted '${perm.code}' to ${employee.name}${
            expiresAtDate
              ? ` (expires ${expiresAtDate.toISOString().split('T')[0]})`
              : ' (no expiry)'
          }`,
          category: 'governance',
          badgeColor: 'amber',
          payload: {
            permissionCode: perm.code,
            expiresAt: expiresAtDate?.toISOString() || null,
            reason: dto.reason || null,
          },
        },
        tx,
      )

      return saved
    })

    await this.cache.invalidateUser(targetEmployeeId)
    return override
  }

  async revokeDirectPermission(
    targetEmployeeId: string,
    permissionId: string,
    actor: AuthenticatedUser,
  ) {
    assertNotSelfTarget(actor.id, targetEmployeeId, 'revoke direct permissions')

    const employee = await loadEmployeeWithSecurityContext(this.prisma, targetEmployeeId)
    assertTargetNotSupremeCeo(employee)

    const perm = await this.prisma.permission.findUnique({ where: { id: permissionId } })
    if (!perm) throw new NotFoundException(`Permission "${permissionId}" not found`)

    const actorProfile = await this.rbacService.getEmployeeAccessProfile(actor.id)
    const actorPermSet = new Set(actorProfile.permissions)
    const canAdminAll = actorPermSet.has('users:assign_role')

    if (!canAdminAll && !actorPermSet.has(perm.code)) {
      throw new ForbiddenException(
        `Revocation denied: You do not hold "${perm.code}" or global role-assignment authority`,
      )
    }

    const actorEmp = await this.prisma.employee.findUnique({
      where: { id: actor.id },
      select: { name: true, email: true },
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.employeePermission.updateMany({
        where: { employeeId: targetEmployeeId, permissionId, isActive: true },
        data: { isActive: false },
      })

      await this.auditLogger.log(
        {
          actorId: actor.id,
          actorName: actorEmp?.name || actor.name || actor.id,
          actorEmail: actorEmp?.email || actor.email || '',
          actorRole: actor.role.toUpperCase(),
          action: 'DIRECT_PERMISSION_REVOKED',
          actionCode: 'RBAC_DIRECT_OVERRIDE_REVOKED',
          severity: 'INFO',
          entityType: 'user',
          entityId: targetEmployeeId,
          entityTitle: employee.name,
          description: `${actor.role.toUpperCase()} revoked direct permission '${perm.code}' from ${employee.name}`,
          category: 'governance',
          badgeColor: 'sky',
        },
        tx,
      )
    })

    if (this.delegationService) {
      await this.delegationService.cascadeRevokeForDelegator(
        targetEmployeeId,
        'PERMISSION_LOST',
        [perm.code],
        actor.id,
      )
    }

    if (this.authz) {
      await this.authz.invalidateUserCache(targetEmployeeId)
    } else {
      await this.cache.invalidateUser(targetEmployeeId)
    }
    return { revoked: true, employeeId: targetEmployeeId, permissionId, code: perm.code }
  }
}
