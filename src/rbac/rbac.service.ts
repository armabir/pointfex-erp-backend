import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { PermissionCacheService } from './permission-cache.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { verifyStepUpAuth } from '../common/security-policy.util'
import {
  AttachRolePermissionDto,
  CreateRoleDto,
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
  ) {}

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    })

    const groupedByModule = permissions.reduce<Record<string, typeof permissions>>((acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = []
      acc[perm.module].push(perm)
      return acc
    }, {})

    return { total: permissions.length, permissions, groupedByModule }
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

    const permissionIds = await this.resolvePermissionIds(undefined, dto.permissionCodes)

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          slug,
          name: dto.name.trim(),
          description: dto.description,
          isSystemDefault: false,
          isActive: true,
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

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_CREATED',
          actionCode: 'RBAC_ROLE_CREATED',
          severity: 'INFO',
          entityType: 'role',
          entityId: role.id,
          entityTitle: role.name,
          description: `Created dynamic role "${role.name}" (${role.slug}) with ${permissionIds.length} permission(s)`,
          category: 'governance',
          badgeColor: 'purple',
        },
        tx,
      )

      return role
    })
  }

  async updateRole(roleId: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    if (role.slug === 'ceo' && dto.isActive === false) {
      throw new BadRequestException('Cannot deactivate the system CEO role')
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.role.update({
        where: { id: roleId },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          isActive: dto.isActive,
        },
      })

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_UPDATED',
          actionCode: 'RBAC_ROLE_UPDATED',
          severity: 'INFO',
          entityType: 'role',
          entityId: roleId,
          entityTitle: saved.name,
          description: `Updated role "${saved.name}" metadata/status`,
          category: 'governance',
          badgeColor: 'sky',
        },
        tx,
      )

      return saved
    })

    if (dto.isActive !== undefined && dto.isActive !== role.isActive) {
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
    if (role.slug === 'ceo' || role.isSystemDefault) {
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

    const targetIds = await this.resolvePermissionIds(dto.permissionIds, dto.permissionCodes)

    if (role.slug === 'ceo') {
      const targetPerms = await this.prisma.permission.findMany({
        where: { id: { in: targetIds } },
        select: { code: true },
      })
      const targetCodeSet = new Set(targetPerms.map((p) => p.code))
      const missingCore = CEO_LOCKED_PERMISSIONS.filter((c) => !targetCodeSet.has(c))
      if (missingCore.length > 0) {
        throw new BadRequestException(
          `Cannot strip core administration permissions from CEO role: [${missingCore.join(', ')}]`,
        )
      }
    }

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

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'ROLE_PERMISSIONS_UPDATED',
          actionCode: 'RBAC_PERMISSIONS_SYNCED',
          severity: 'WARNING',
          entityType: 'role',
          entityId: roleId,
          entityTitle: role.name,
          description: `Set ${targetIds.length} permission(s) on role "${role.name}"`,
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

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: { grantedById: actor.id, grantedAt: new Date() },
        create: { roleId, permissionId: perm.id, grantedById: actor.id },
      })

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'PERMISSION_ATTACHED',
          actionCode: 'RBAC_PERMISSION_GRANTED',
          severity: 'INFO',
          entityType: 'role',
          entityId: roleId,
          entityTitle: role.name,
          description: `Attached permission "${perm.code}" to role "${role.name}"`,
          category: 'governance',
          badgeColor: 'emerald',
        },
        tx,
      )
    })

    await this.invalidateUsersForRole(roleId)
    return { attached: true, roleId, permission: perm.code }
  }

  async detachPermission(roleId: string, permissionId: string, actor: AuthenticatedUser) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } })
    if (!role) throw new NotFoundException(`Role "${roleId}" not found`)

    const perm = await this.prisma.permission.findUnique({ where: { id: permissionId } })
    if (!perm) throw new NotFoundException(`Permission "${permissionId}" not found`)

    if (role.slug === 'ceo' && CEO_LOCKED_PERMISSIONS.includes(perm.code)) {
      throw new BadRequestException(`Cannot detach core admin permission "${perm.code}" from CEO`)
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId, permissionId } })

      await this.auditLogger.log(
        {
          ...resolveActorAuditMeta(actor),
          action: 'PERMISSION_DETACHED',
          actionCode: 'RBAC_PERMISSION_REVOKED',
          severity: 'WARNING',
          entityType: 'role',
          entityId: roleId,
          entityTitle: role.name,
          description: `Detached permission "${perm.code}" from role "${role.name}"`,
          category: 'governance',
          badgeColor: 'amber',
        },
        tx,
      )
    })

    await this.invalidateUsersForRole(roleId)
    return { detached: true, roleId, permission: perm.code }
  }

  async getEmployeeAccessProfile(employeeId: string) {
    const now = new Date()
    const [roleRows, directRows, pendingRoleRequests] = await Promise.all([
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
    ])

    const roles = roleRows.map((r) => ({
      id: r.role.id,
      slug: r.role.slug,
      name: r.role.name,
      expiresAt: r.expiresAt,
    }))

    const rolePermCodes = roleRows.flatMap((r) =>
      r.role.rolePermissions.map((rp) => rp.permission.code),
    )

    const directPermissions = directRows.map((dp) => ({
      id: dp.id,
      permissionId: dp.permissionId,
      code: dp.permission.code,
      module: dp.permission.module,
      description: dp.permission.description,
      isSensitive: dp.permission.isSensitive,
      grantedById: dp.grantedById,
      grantedAt: dp.grantedAt,
      expiresAt: dp.expiresAt,
      reason: dp.reason,
    }))

    const permissions = Array.from(
      new Set([...rolePermCodes, ...directPermissions.map((d) => d.code)]),
    ).sort()

    return {
      employeeId,
      roles,
      rolePermissions: Array.from(new Set(rolePermCodes)).sort(),
      directPermissions,
      pendingRoleRequests,
      permissions,
    }
  }

  async getDelegatablePermissions(actorId: string) {
    const profile = await this.getEmployeeAccessProfile(actorId)
    if (profile.permissions.length === 0) {
      return { permissions: [], groupedByModule: {} }
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: profile.permissions } },
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    })

    const groupedByModule = permissions.reduce<Record<string, typeof permissions>>((acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = []
      acc[perm.module].push(perm)
      return acc
    }, {})

    return { permissions, groupedByModule }
  }

  private async resolvePermissionIds(ids?: string[], codes?: string[]): Promise<string[]> {
    if ((!ids || ids.length === 0) && (!codes || codes.length === 0)) return []

    const perms = await this.prisma.permission.findMany({
      where: {
        OR: [
          ...(ids?.length ? [{ id: { in: ids } }] : []),
          ...(codes?.length ? [{ code: { in: codes } }] : []),
        ],
      },
      select: { id: true, code: true },
    })

    if (ids?.length && perms.length < new Set(ids).size) {
      throw new BadRequestException('One or more permissionIds do not exist')
    }
    if (codes?.length && perms.length < new Set(codes).size) {
      const found = new Set(perms.map((p) => p.code))
      const unknown = codes.filter((c) => !found.has(c))
      throw new BadRequestException(`Unknown permission code(s): [${unknown.join(', ')}]`)
    }

    return perms.map((p) => p.id)
  }

  private async getEmployeeIdsForRole(roleId: string): Promise<string[]> {
    const rows = await this.prisma.employeeRole.findMany({
      where: { roleId, isActive: true },
      select: { employeeId: true },
    })
    return rows.map((r) => r.employeeId)
  }

  private async invalidateUsersForRole(roleId: string): Promise<void> {
    const employeeIds = await this.getEmployeeIdsForRole(roleId)
    await this.cache.invalidateUsers(employeeIds)
  }
}
