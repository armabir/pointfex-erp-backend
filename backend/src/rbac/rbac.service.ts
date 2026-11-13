import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { PermissionCacheService } from './permission-cache.service'
import { AuthorizationService } from './authorization.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { verifyStepUpAuth } from '../common/security-policy.util'
import {
  expandDomainWildcards,
  normalizeDomainWildcards,
} from './wildcard-resolver.util'
import {
  AttachRolePermissionDto,
  CloneRoleDto,
  CreateRoleDto,
  CreateRoleFromTemplateDto,
  DeleteRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from './dto/rbac.dto'

const CEO_LOCKED_PERMISSIONS = [
  'employees:read_directory',
  'employees:create',
  'employees:update_any',
  'employees:suspend',
  'directives:dispatch',
  'decisions:ratify',
  'audit_logs:read',
  'roles:read',
  'roles:create',
  'roles:update',
  'roles:delete',
  'permissions:read',
  'permissions:delegate',
  'users:assign_role',
]

function resolveActorAuditMeta(actor: AuthenticatedUser) {
  return {
    actorId: actor.id,
    actorName: actor.name || actor.id,
    actorEmail: actor.email || '',
    actorRole: actor.role.toUpperCase(),
  }
}

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
    private readonly auditLogger: AuditLoggerService,
    @Optional() private readonly authz?: AuthorizationService,
  ) {}

  async listPermissions(options?: { includeDeprecated?: boolean; includeRoot?: boolean }) {
    const permissions = await this.prisma.permission.findMany({
      where: {
        ...(options?.includeDeprecated ? {} : { isDeprecated: false }),
        ...(options?.includeRoot ? {} : { isSystemRoot: false }),
      },
      include: {
        category: {
          select: { id: true, code: true, slug: true, name: true, domains: true, displayOrder: true },
        },
      },
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    })

    const groupedByModule = permissions.reduce<Record<string, typeof permissions>>((acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = []
      acc[perm.module].push(perm)
      return acc
    }, {})

    return { total: permissions.length, permissions, groupedByModule }
  }

  async listRoleTemplates() {
    return this.prisma.roleTemplate.findMany({
      orderBy: [{ code: 'asc' }],
    })
  }

  async getRoleVersions(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    return this.prisma.roleVersion.findMany({
      where: { roleId },
      orderBy: { version: 'desc' },
    })
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        employeeRoles: {
          where: { isActive: true },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                title: true,
                initials: true,
                avatarUrl: true,
                status: true,
                isSuspended: true,
              },
            },
          },
        },
        _count: {
          select: {
            employeeRoles: { where: { isActive: true } },
          },
        },
      },
      orderBy: [{ isSystemDefault: 'desc' }, { name: 'asc' }],
    })
  }

  async getRole(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        employeeRoles: {
          where: { isActive: true },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                title: true,
                initials: true,
                avatarUrl: true,
                status: true,
                isSuspended: true,
              },
            },
          },
        },
      },
    })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)
    return role
  }

  async createRole(dto: CreateRoleDto, actor: AuthenticatedUser) {
    const slug =
      dto.slug ||
      dto.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    if (!slug) throw new BadRequestException('Unable to derive valid role slug')

    const existing = await this.prisma.role.findFirst({
      where: { OR: [{ slug }, { name: dto.name.trim() }] },
    })
    if (existing) {
      throw new ConflictException(`Role with name "${dto.name}" or slug "${slug}" already exists`)
    }

    const permissionIds = await this.resolvePermissionIds(undefined, dto.permissionCodes, {
      forbidSystemRoot: true,
    })
    let wildcards: string[] = []
    try {
      wildcards = normalizeDomainWildcards(dto.wildcards)
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error))
    }
    const includeCritical = Boolean(dto.includeCritical)

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          slug,
          name: dto.name.trim(),
          description: dto.description,
          isSystemDefault: false,
          isActive: true,
          wildcards,
          includeCritical,
          tier: dto.tier ? (dto.tier.toUpperCase() as any) : 'STAFF',
          isRootRole: false,
          version: 1,
          createdById: actor.id,
          updatedById: actor.id,
          rolePermissions: permissionIds.length
            ? {
                create: permissionIds.map((permissionId) => ({
                  permissionId,
                  grantedById: actor.id,
                })),
              }
            : undefined,
        },
        include: {
          rolePermissions: { include: { permission: true } },
          employeeRoles: {
            where: { isActive: true },
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  title: true,
                  initials: true,
                  avatarUrl: true,
                  status: true,
                  isSuspended: true,
                },
              },
            },
          },
          _count: {
            select: {
              employeeRoles: { where: { isActive: true } },
            },
          },
        },
      })

      await this.recordRoleVersion(
        tx,
        role.id,
        1,
        dto.changeReason || 'Initial role creation',
        actor.id,
      )

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_CREATED',
          actionCode: 'RBAC_ROLE_CREATED',
          severity: 'INFO',
          entityType: 'role',
          entityId: role.id,
          entityTitle: role.name,
          description: `Created dynamic role "${role.name}" (${role.slug}) with ${permissionIds.length} permission(s) and ${wildcards.length} wildcard(s)`,
          category: 'governance',
          badgeColor: 'purple',
        },
        tx,
      )

      return role
    })
  }

  async createRoleFromTemplate(
    templateCode: string,
    dto: CreateRoleFromTemplateDto,
    actor: AuthenticatedUser,
  ) {
    const template = await this.prisma.roleTemplate.findUnique({
      where: { code: templateCode.trim().toUpperCase() },
    })
    if (!template) {
      throw new NotFoundException(`Role template "${templateCode}" not found`)
    }
    if (template.code === 'CEO' || template.permissionCodes.includes('system:root')) {
      throw new ForbiddenException(
        'CEO / system:root template cannot be instantiated as a new role; use governance:transfer_ceo.',
      )
    }

    const name = dto.name?.trim() || `${template.name} Copy`
    const slug =
      dto.slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    const existing = await this.prisma.role.findFirst({
      where: { OR: [{ slug }, { name }] },
    })
    if (existing) {
      throw new ConflictException(`Role with name "${name}" or slug "${slug}" already exists`)
    }

    const catalogPerms = await this.prisma.permission.findMany({
      where: { code: { in: template.permissionCodes }, isSystemRoot: false },
      select: { id: true, code: true },
    })

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          slug,
          name,
          description: dto.description ?? template.description,
          isSystemDefault: false,
          isActive: true,
          wildcards: template.wildcards,
          includeCritical: template.includeCritical,
          isRootRole: false,
          templateCode: template.code,
          version: 1,
          createdById: actor.id,
          updatedById: actor.id,
          rolePermissions: catalogPerms.length
            ? {
                create: catalogPerms.map((p) => ({
                  permissionId: p.id,
                  grantedById: actor.id,
                })),
              }
            : undefined,
        },
        include: {
          rolePermissions: { include: { permission: true } },
        },
      })

      await this.recordRoleVersion(
        tx,
        role.id,
        1,
        `Instantiated from template ${template.code}`,
        actor.id,
      )

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_CREATED_FROM_TEMPLATE',
          actionCode: 'RBAC_ROLE_TEMPLATE_INSTANTIATED',
          severity: 'INFO',
          entityType: 'role',
          entityId: role.id,
          entityTitle: role.name,
          description: `Created role "${role.name}" from authority template "${template.code}"`,
          category: 'governance',
          badgeColor: 'purple',
        },
        tx,
      )

      return role
    })
  }

  async cloneRole(roleId: string, dto: CloneRoleDto, actor: AuthenticatedUser) {
    const source = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: { permission: { select: { id: true, code: true, isSystemRoot: true } } },
        },
      },
    })
    if (!source) throw new NotFoundException(`Role "${roleId}" not found`)
    if (source.isRootRole || source.slug === 'ceo') {
      throw new ForbiddenException(
        'Security law: The system:root CEO role cannot be cloned.',
      )
    }

    const name = dto.name.trim()
    const slug =
      dto.slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

    if (!slug) throw new BadRequestException('Unable to derive valid role slug')

    const existing = await this.prisma.role.findFirst({
      where: { OR: [{ slug }, { name }] },
    })
    if (existing) {
      throw new ConflictException(`Role with name "${name}" or slug "${slug}" already exists`)
    }

    const clonedPermissionIds = source.rolePermissions
      .filter((rp) => !rp.permission.isSystemRoot && rp.permission.code !== 'system:root')
      .map((rp) => rp.permissionId)

    return this.prisma.$transaction(async (tx) => {
      const cloned = await tx.role.create({
        data: {
          slug,
          name,
          description: dto.description ?? source.description,
          isSystemDefault: false,
          isActive: true,
          wildcards: source.wildcards,
          includeCritical: source.includeCritical,
          isRootRole: false,
          templateCode: source.templateCode,
          version: 1,
          createdById: actor.id,
          updatedById: actor.id,
          rolePermissions: clonedPermissionIds.length
            ? {
                create: clonedPermissionIds.map((permissionId) => ({
                  permissionId,
                  grantedById: actor.id,
                })),
              }
            : undefined,
        },
        include: {
          rolePermissions: { include: { permission: true } },
        },
      })

      await this.recordRoleVersion(
        tx,
        cloned.id,
        1,
        `Cloned from role "${source.name}" (${source.slug} v${source.version})`,
        actor.id,
      )

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_CLONED',
          actionCode: 'RBAC_ROLE_CLONED',
          severity: 'INFO',
          entityType: 'role',
          entityId: cloned.id,
          entityTitle: cloned.name,
          description: `Cloned role "${source.name}" into "${cloned.name}" (${cloned.slug})`,
          category: 'governance',
          badgeColor: 'purple',
        },
        tx,
      )

      return cloned
    })
  }

  async setRoleActiveState(
    roleId: string,
    isActive: boolean,
    actor: AuthenticatedUser,
    reason?: string,
  ) {
    return this.updateRole(
      roleId,
      {
        isActive,
        changeReason: reason || (isActive ? 'Role activated' : 'Role deactivated'),
      },
      actor,
    )
  }

  async updateRole(roleId: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    if ((role.isRootRole || role.slug === 'ceo') && dto.isActive === false) {
      throw new ForbiddenException('Cannot deactivate the system:root CEO role')
    }
    if ((role.isRootRole || role.slug === 'ceo') && (dto.wildcards !== undefined || dto.includeCritical !== undefined)) {
      throw new ForbiddenException('Cannot modify root role wildcard/critical flags directly')
    }

    let normalizedWildcards: string[] | undefined
    if (dto.wildcards !== undefined) {
      try {
        normalizedWildcards = normalizeDomainWildcards(dto.wildcards)
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : String(error))
      }
    }

    const nextVersion = role.version + 1

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.role.update({
        where: { id: roleId },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          isActive: dto.isActive,
          deactivatedAt:
            dto.isActive === false ? new Date() : dto.isActive === true ? null : undefined,
          wildcards: normalizedWildcards,
          includeCritical: dto.includeCritical,
          tier: dto.tier ? (dto.tier.toUpperCase() as any) : undefined,
          version: nextVersion,
          updatedById: actor.id,
        },
      })

      await this.recordRoleVersion(
        tx,
        roleId,
        nextVersion,
        dto.changeReason || 'Updated role metadata/status',
        actor.id,
      )

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_UPDATED',
          actionCode: 'RBAC_ROLE_UPDATED',
          severity: dto.isActive === false ? 'WARNING' : 'INFO',
          entityType: 'role',
          entityId: roleId,
          entityTitle: saved.name,
          description: `Updated role "${saved.name}" (v${nextVersion})`,
          category: 'governance',
          badgeColor: 'sky',
        },
        tx,
      )

      return saved
    })

    if (
      (dto.isActive !== undefined && dto.isActive !== role.isActive) ||
      dto.wildcards !== undefined ||
      dto.includeCritical !== undefined
    ) {
      await this.invalidateUsersForRole(roleId)
    }

    return updated
  }

  async deleteRole(
    roleId: string,
    actor: AuthenticatedUser,
    dto?: DeleteRoleDto,
    headers?: Record<string, string>,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)
    if (role.isRootRole || role.slug === 'ceo' || role.isSystemDefault) {
      throw new ForbiddenException(
        `Security law: System role "${role.slug}" cannot be deleted by anyone`,
      )
    }

    await verifyStepUpAuth(this.prisma, actor.id, dto, headers, 'role deletion')

    const affectedEmployeeIds = await this.getEmployeeIdsForRole(roleId)

    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id: roleId } })

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_DELETED',
          actionCode: 'RBAC_ROLE_DELETED',
          severity: 'WARNING',
          entityType: 'role',
          entityId: roleId,
          entityTitle: role.name,
          description: `Deleted custom role "${role.name}" (${role.slug})`,
          category: 'governance',
          badgeColor: 'rose',
        },
        tx,
      )
    })

    await this.cache.invalidateUsers(affectedEmployeeIds)
    return { deleted: true, roleId }
  }

  async replaceRolePermissions(
    roleId: string,
    dto: SetRolePermissionsDto,
    actor: AuthenticatedUser,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    const targetIds = await this.resolvePermissionIds(dto.permissionIds, dto.permissionCodes, {
      forbidSystemRoot: !role.isRootRole && role.slug !== 'ceo',
    })

    let normalizedWildcards: string[] | undefined
    if (dto.wildcards !== undefined) {
      if (role.isRootRole || role.slug === 'ceo') {
        throw new ForbiddenException('Cannot overwrite wildcards on system:root CEO role')
      }
      try {
        normalizedWildcards = normalizeDomainWildcards(dto.wildcards)
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : String(error))
      }
    }

    if (role.isRootRole || role.slug === 'ceo') {
      const targetPerms = await this.prisma.permission.findMany({
        where: { id: { in: targetIds } },
        select: { code: true },
      })
      const targetCodeSet = new Set(targetPerms.map((p) => p.code))
      const missingCore = [...CEO_LOCKED_PERMISSIONS, 'system:root'].filter(
        (c) => !targetCodeSet.has(c),
      )
      if (missingCore.length > 0) {
        throw new BadRequestException(
          `Cannot strip core/root administration permissions from CEO role: [${missingCore.join(', ')}]`,
        )
      }
    }

    const nextVersion = role.version + 1

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } })

      if (targetIds.length > 0) {
        await tx.rolePermission.createMany({
          data: targetIds.map((permissionId) => ({
            roleId,
            permissionId,
            grantedById: actor.id,
          })),
          skipDuplicates: true,
        })
      }

      await tx.role.update({
        where: { id: roleId },
        data: {
          wildcards: normalizedWildcards,
          includeCritical:
            role.isRootRole || role.slug === 'ceo' ? undefined : dto.includeCritical,
          version: nextVersion,
          updatedById: actor.id,
        },
      })

      await this.recordRoleVersion(
        tx,
        roleId,
        nextVersion,
        dto.changeReason || `Replaced permissions (${targetIds.length} direct)`,
        actor.id,
      )

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_PERMISSIONS_UPDATED',
          actionCode: 'RBAC_PERMISSIONS_SYNCED',
          severity: 'WARNING',
          entityType: 'role',
          entityId: roleId,
          entityTitle: role.name,
          description: `Set ${targetIds.length} permission(s) on role "${role.name}" (v${nextVersion})`,
          category: 'governance',
          badgeColor: 'amber',
        },
        tx,
      )

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          rolePermissions: { include: { permission: true } },
          employeeRoles: {
            where: { isActive: true },
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  title: true,
                  initials: true,
                  avatarUrl: true,
                  status: true,
                  isSuspended: true,
                },
              },
            },
          },
          _count: {
            select: {
              employeeRoles: { where: { isActive: true } },
            },
          },
        },
      })
    })

    await this.invalidateUsersForRole(roleId)
    return updatedRole
  }

  async attachPermission(roleId: string, dto: AttachRolePermissionDto, actor: AuthenticatedUser) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    const perm = await this.prisma.permission.findFirst({
      where: dto.permissionId ? { id: dto.permissionId } : { code: dto.permissionCode },
    })
    if (!perm) throw new NotFoundException('Target permission not found')

    if ((perm.isSystemRoot || perm.code === 'system:root') && !role.isRootRole && role.slug !== 'ceo') {
      throw new ForbiddenException(
        'Security law: system:root cannot be granted via role editing; changes only via governance:transfer_ceo.',
      )
    }

    const nextVersion = role.version + 1

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: { grantedById: actor.id, grantedAt: new Date() },
        create: { roleId, permissionId: perm.id, grantedById: actor.id },
      })

      await tx.role.update({
        where: { id: roleId },
        data: { version: nextVersion, updatedById: actor.id },
      })

      await this.recordRoleVersion(
        tx,
        roleId,
        nextVersion,
        `Attached permission ${perm.code}`,
        actor.id,
      )

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'PERMISSION_ATTACHED',
          actionCode: 'RBAC_PERMISSION_GRANTED',
          severity: 'INFO',
          entityType: 'role',
          entityId: roleId,
          entityTitle: role.name,
          description: `Attached permission "${perm.code}" to role "${role.name}" (v${nextVersion})`,
          category: 'governance',
          badgeColor: 'emerald',
        },
        tx,
      )
    })

    await this.invalidateUsersForRole(roleId)
    return { attached: true, roleId, permission: perm.code, version: nextVersion }
  }

  async detachPermission(roleId: string, permissionId: string, actor: AuthenticatedUser) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    const perm = await this.prisma.permission.findUnique({ where: { id: permissionId } })
    if (!perm) throw new NotFoundException(`Permission "${permissionId}" not found`)

    if (perm.isSystemRoot || perm.code === 'system:root') {
      throw new ForbiddenException(
        'Security law: system:root cannot be removed via role editing; changes only via governance:transfer_ceo.',
      )
    }

    if ((role.isRootRole || role.slug === 'ceo') && CEO_LOCKED_PERMISSIONS.includes(perm.code)) {
      throw new BadRequestException(`Cannot detach core admin permission "${perm.code}" from CEO`)
    }

    const nextVersion = role.version + 1

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId, permissionId } })

      await tx.role.update({
        where: { id: roleId },
        data: { version: nextVersion, updatedById: actor.id },
      })

      await this.recordRoleVersion(
        tx,
        roleId,
        nextVersion,
        `Detached permission ${perm.code}`,
        actor.id,
      )

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'PERMISSION_DETACHED',
          actionCode: 'RBAC_PERMISSION_REVOKED',
          severity: 'WARNING',
          entityType: 'role',
          entityId: roleId,
          entityTitle: role.name,
          description: `Detached permission "${perm.code}" from role "${role.name}" (v${nextVersion})`,
          category: 'governance',
          badgeColor: 'amber',
        },
        tx,
      )
    })

    await this.invalidateUsersForRole(roleId)
    return { detached: true, roleId, permission: perm.code, version: nextVersion }
  }

  async getEmployeeAccessProfile(employeeId: string) {
    const now = new Date()
    const [scopedAssignments, legacyRoleRows, directRows, pendingRoleRequests, catalogPerms] =
      await Promise.all([
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
                rolePermissions: { include: { permission: true } },
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
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        }),
        this.prisma.employeePermission.findMany({
          where: {
            employeeId,
            isActive: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: {
            permission: true,
          },
          orderBy: { grantedAt: 'desc' },
        }),
        this.prisma.accessChangeRequest.findMany({
          where: { targetEmployeeId: employeeId, status: 'PENDING' },
          include: {
            requestedRole: { select: { id: true, slug: true, name: true } },
            requester: { select: { id: true, name: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
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
      ])

    const combinedRoleRows =
      scopedAssignments.length > 0
        ? scopedAssignments.map((a) => ({
            id: a.role.id,
            slug: a.role.slug,
            name: a.role.name,
            scope: a.scope,
            scopeIds: a.scopeIds,
            expiresAt: a.expiresAt,
            role: a.role,
          }))
        : legacyRoleRows.map((r) => ({
            id: r.role.id,
            slug: r.role.slug,
            name: r.role.name,
            scope: 'ORG' as const,
            scopeIds: [] as string[],
            expiresAt: r.expiresAt,
            role: r.role,
          }))

    const roles = combinedRoleRows.map(({ id, slug, name, scope, scopeIds, expiresAt }) => ({
      id,
      slug,
      name,
      scope,
      scopeIds,
      expiresAt,
    }))

    const rolePermCodes = combinedRoleRows.flatMap((r) => {
      const explicit = r.role.rolePermissions.map((rp) => rp.permission.code)
      const wildcardExpanded = expandDomainWildcards(
        r.role.wildcards ?? [],
        r.role.includeCritical,
        catalogPerms,
      )
      return [...explicit, ...wildcardExpanded]
    })

    const directPermissions = directRows.map((dp) => ({
      id: dp.id,
      permissionId: dp.permissionId,
      code: dp.permission.code,
      module: dp.permission.module,
      description: dp.permission.description,
      isSensitive: dp.permission.isSensitive,
      isCritical: dp.permission.isCritical,
      grantedById: dp.grantedById,
      grantedAt: dp.grantedAt,
      expiresAt: dp.expiresAt,
      reason: dp.reason,
    }))

    const fallbackPermissions = Array.from(
      new Set([...rolePermCodes, ...directPermissions.map((d) => d.code)]),
    ).sort()

    const effectiveSnapshot = this.authz
      ? await this.authz.resolveEffectiveAuthz(employeeId).catch(() => null)
      : null

    const permissions = effectiveSnapshot ? effectiveSnapshot.effectiveCodes : fallbackPermissions
    const delegatedPermissions = effectiveSnapshot
      ? effectiveSnapshot.grants.filter((g) => g.sourceType === 'delegation')
      : []

    return {
      employeeId,
      roles,
      rolePermissions: Array.from(new Set(rolePermCodes)).sort(),
      directPermissions,
      delegatedPermissions,
      denials: effectiveSnapshot?.denials ?? [],
      pendingRoleRequests,
      permissions,
    }
  }

  async getDelegatablePermissions(actorId: string) {
    const effectiveSnapshot = this.authz
      ? await this.authz.resolveEffectiveAuthz(actorId).catch(() => null)
      : null
    const profile = await this.getEmployeeAccessProfile(actorId)

    const eligibleCodes = effectiveSnapshot
      ? Array.from(
          new Set(
            effectiveSnapshot.grants
              .filter((g) => g.sourceType !== 'delegation')
              .map((g) => g.code),
          ),
        )
      : profile.permissions

    if (eligibleCodes.length === 0) {
      return { permissions: [], groupedByModule: {} }
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        code: { in: eligibleCodes },
        isCritical: false,
        isDelegable: true,
        isDeprecated: false,
        isSystemRoot: false,
      },
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    })

    const groupedByModule = permissions.reduce<Record<string, typeof permissions>>((acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = []
      acc[perm.module].push(perm)
      return acc
    }, {})

    return { permissions, groupedByModule }
  }

  async setRoleTier(
    roleId: string,
    tier: string,
    actor: AuthenticatedUser,
    changeReason?: string,
  ) {
    const validTiers = ['CEO', 'EXECUTIVE', 'MANAGER', 'STAFF']
    const upper = tier.trim().toUpperCase()
    if (!validTiers.includes(upper)) {
      throw new BadRequestException(
        `Invalid role tier "${tier}". Expected one of: ${validTiers.join(', ')}`,
      )
    }
    return this.updateRole(
      roleId,
      {
        tier: upper,
        changeReason: changeReason || `Tier updated to ${upper}`,
      },
      actor,
    )
  }

  private async recordRoleVersion(
    tx: Prisma.TransactionClient,
    roleId: string,
    version: number,
    changeReason: string,
    changedById: string,
  ): Promise<void> {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: { include: { permission: { select: { code: true } } } },
      },
    })
    if (!role) return

    await tx.roleVersion.upsert({
      where: { roleId_version: { roleId, version } },
      update: {
        name: role.name,
        description: role.description,
        wildcards: role.wildcards,
        permissionCodes: role.rolePermissions.map((rp) => rp.permission.code).sort(),
        includeCritical: role.includeCritical,
        tier: (role as any).tier || 'STAFF',
        isActive: role.isActive,
        changeReason,
        changedById,
      },
      create: {
        roleId,
        version,
        name: role.name,
        description: role.description,
        wildcards: role.wildcards,
        permissionCodes: role.rolePermissions.map((rp) => rp.permission.code).sort(),
        includeCritical: role.includeCritical,
        tier: (role as any).tier || 'STAFF',
        isActive: role.isActive,
        changeReason,
        changedById,
      },
    })
  }

  private async resolvePermissionIds(
    ids?: string[],
    codes?: string[],
    options?: { forbidSystemRoot?: boolean },
  ): Promise<string[]> {
    if ((!ids || ids.length === 0) && (!codes || codes.length === 0)) return []

    const perms = await this.prisma.permission.findMany({
      where: {
        OR: [
          ...(ids?.length ? [{ id: { in: ids } }] : []),
          ...(codes?.length ? [{ code: { in: codes } }] : []),
        ],
      },
      select: { id: true, code: true, isSystemRoot: true },
    })

    if (ids?.length && perms.length < new Set(ids).size) {
      throw new BadRequestException('One or more permissionIds do not exist')
    }
    if (codes?.length && perms.length < new Set(codes).size) {
      const found = new Set(perms.map((p) => p.code))
      const unknown = codes.filter((c) => !found.has(c))
      throw new BadRequestException(`Unknown permission code(s): [${unknown.join(', ')}]`)
    }

    if (
      options?.forbidSystemRoot &&
      perms.some(
        (p) =>
          p.isSystemRoot || p.code === 'system:root' || p.code === 'login_allowlist:manage',
      )
    ) {
      throw new ForbiddenException(
        'Security law: system:root cannot be attached via normal role CRUD; use governance:transfer_ceo.',
      )
    }

    return perms.map((p) => p.id)
  }

  private async getEmployeeIdsForRole(roleId: string): Promise<string[]> {
    const [legacyRows, scopedRows] = await Promise.all([
      this.prisma.employeeRole.findMany({
        where: { roleId, isActive: true },
        select: { employeeId: true },
      }),
      this.prisma.userRoleAssignment.findMany({
        where: { roleId, isActive: true },
        select: { employeeId: true },
      }),
    ])
    return Array.from(
      new Set([...legacyRows.map((r) => r.employeeId), ...scopedRows.map((r) => r.employeeId)]),
    )
  }

  private async invalidateUsersForRole(roleId: string): Promise<void> {
    const employeeIds = await this.getEmployeeIdsForRole(roleId)
    if (this.authz) {
      await this.authz.invalidateUsersCache(employeeIds)
    } else {
      await this.cache.invalidateUsers(employeeIds)
    }
  }
}
