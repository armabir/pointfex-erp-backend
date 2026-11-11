import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from './prisma.service'
import { PermissionCacheService } from '../rbac/permission-cache.service'
import { PERMISSIONS_ALL_KEY, PERMISSIONS_ANY_KEY } from './require-permissions.decorator'
import { ROLES_KEY } from './roles.decorator'
import { AuthenticatedUser } from './auth-user.interface'

type PbacMode = 'legacy' | 'shadow' | 'enforce'

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAll =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_ALL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || []

    const requiredAny =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_ANY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || []

    const legacyRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || []

    const request = context.switchToHttp().getRequest()
    const user = request.user as AuthenticatedUser | undefined

    if (!user?.id) {
      throw new ForbiddenException('Access denied: Authenticated user identity required')
    }

    const userPerms = await this.resolveEmployeePermissions(user.id)
    user.permissions = userPerms
    const permSet = new Set(userPerms)

    const mode = (
      this.configService.get<string>('PBAC_MODE') || 'enforce'
    ).toLowerCase() as PbacMode

    const roleNorm = (user.role || '').toLowerCase()
    const legacyAllowed =
      legacyRoles.length === 0 ||
      legacyRoles.map((r) => r.toLowerCase()).includes(roleNorm) ||
      roleNorm === 'ceo'

    const hasAll = requiredAll.every((perm) => permSet.has(perm))
    const hasAny = requiredAny.length === 0 || requiredAny.some((perm) => permSet.has(perm))
    const pbacAllowed = hasAll && hasAny

    if (mode === 'legacy') {
      if (!legacyAllowed) {
        throw new ForbiddenException(`Access denied: Required role(s) [${legacyRoles.join(', ')}]`)
      }
      return true
    }

    if (mode === 'shadow') {
      if (legacyAllowed !== pbacAllowed) {
        this.logger.warn(
          `[PBAC SHADOW MISMATCH] ${request.method} ${request.url} | employee=${user.id} role=${user.role} | ` +
            `legacy=${legacyAllowed} pbac=${pbacAllowed} | all=[${requiredAll.join(',')}] any=[${requiredAny.join(',')}]`,
        )
      }
      if (!legacyAllowed) {
        throw new ForbiddenException(`Access denied: Required role(s) [${legacyRoles.join(', ')}]`)
      }
      return true
    }

    // mode === 'enforce'
    if (!pbacAllowed) {
      const missingAll = requiredAll.filter((p) => !permSet.has(p))
      const missingDesc = [
        ...(missingAll.length ? [`missing [${missingAll.join(', ')}]`] : []),
        ...(!hasAny ? [`requires any of [${requiredAny.join(', ')}]`] : []),
      ].join('; ')

      throw new ForbiddenException(`Access denied: Insufficient permissions (${missingDesc})`)
    }

    return true
  }

  private async resolveEmployeePermissions(employeeId: string): Promise<string[]> {
    const cached = await this.cache.getPermissions(employeeId)
    if (cached) return cached

    const now = new Date()

    // Merge: (Permissions from active EmployeeRoles) UNION (Active EmployeePermissions)
    const [roleAssignments, directOverrides] = await Promise.all([
      this.prisma.employeeRole.findMany({
        where: {
          employeeId,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          role: { isActive: true },
        },
        select: {
          expiresAt: true,
          role: {
            select: {
              rolePermissions: {
                select: {
                  permission: {
                    select: { code: true },
                  },
                },
              },
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
        select: {
          expiresAt: true,
          permission: {
            select: { code: true },
          },
        },
      }),
    ])

    const codeSet = new Set<string>()
    let earliestExpiryMs: number | undefined

    const trackExpiry = (dt: Date | null) => {
      if (!dt) return
      const ms = dt.getTime()
      if (earliestExpiryMs === undefined || ms < earliestExpiryMs) {
        earliestExpiryMs = ms
      }
    }

    for (const assignment of roleAssignments) {
      trackExpiry(assignment.expiresAt)
      for (const rp of assignment.role.rolePermissions) {
        codeSet.add(rp.permission.code)
      }
    }

    for (const override of directOverrides) {
      trackExpiry(override.expiresAt)
      codeSet.add(override.permission.code)
    }

    const resolved = Array.from(codeSet)
    const ttlOverrideSeconds =
      earliestExpiryMs !== undefined
        ? Math.max(1, Math.floor((earliestExpiryMs - now.getTime()) / 1000))
        : undefined

    await this.cache.setPermissions(employeeId, resolved, ttlOverrideSeconds)
    return resolved
  }
}
