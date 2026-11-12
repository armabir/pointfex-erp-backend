import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AuthorizationScope } from '@prisma/client'
import { PrismaService } from './prisma.service'
import { PermissionCacheService } from '../rbac/permission-cache.service'
import { AuthorizationService, AuthzMode } from '../rbac/authorization.service'
import {
  PERMISSIONS_ALL_KEY,
  PERMISSIONS_ANY_KEY,
  PERMISSION_SCOPE_KEY,
} from './require-permissions.decorator'
import { ROLES_KEY } from './roles.decorator'
import { AuthenticatedUser } from './auth-user.interface'

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
    @Optional() private readonly authz?: AuthorizationService,
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

    const requiredScope = this.reflector.getAllAndOverride<AuthorizationScope | undefined>(
      PERMISSION_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    )

    const request = context.switchToHttp().getRequest()
    const user = request.user as AuthenticatedUser | undefined

    if (!user?.id) {
      throw new ForbiddenException('Access denied: Authenticated user identity required')
    }

    const mode = this.resolveMode()

    // Old / legacy check for comparison and `legacy` / `shadow` modes
    const legacyPerms = await this.resolveLegacyEmployeePermissions(user.id)
    const legacyPermSet = new Set(legacyPerms)

    const roleNorm = (user.role || '').toLowerCase()
    const legacyRoleAllowed =
      legacyRoles.length === 0 ||
      legacyRoles.map((r) => r.toLowerCase()).includes(roleNorm) ||
      roleNorm === 'ceo'

    const legacyAllAllowed = requiredAll.every((perm) => legacyPermSet.has(perm))
    const legacyAnyAllowed =
      requiredAny.length === 0 || requiredAny.some((perm) => legacyPermSet.has(perm))

    // In legacy mode, `@Roles` decides if present; otherwise legacy flat permissions decide.
    const oldAllowed =
      legacyRoles.length > 0 ? legacyRoleAllowed : legacyAllAllowed && legacyAnyAllowed

    // New central AuthorizationService check
    let newAllowed = oldAllowed
    let newDenialReason = ''

    if (this.authz) {
      const snapshot = await this.authz.resolveEffectiveAuthz(user.id)
      user.permissions = snapshot.effectiveCodes

      let allOk = true
      for (const perm of requiredAll) {
        const decision = await this.authz.check(user.id, perm, { requiredScope })
        if (!decision.allowed) {
          allOk = false
          newDenialReason = decision.reason || `Missing "${perm}"`
          break
        }
      }

      let anyOk = true
      if (allOk && requiredAny.length > 0) {
        const anyDecision = await this.authz.checkAny(user.id, requiredAny, { requiredScope })
        if (!anyDecision.allowed) {
          anyOk = false
          newDenialReason = anyDecision.reason || `Requires any of [${requiredAny.join(', ')}]`
        }
      }

      newAllowed = allOk && anyOk
    } else {
      user.permissions = legacyPerms
    }

    if (mode === 'legacy') {
      if (!oldAllowed) {
        throw new ForbiddenException(
          legacyRoles.length > 0
            ? `Access denied: Required role(s) [${legacyRoles.join(', ')}]`
            : `Access denied: Missing legacy permissions`,
        )
      }
      return true
    }

    if (mode === 'shadow') {
      if (oldAllowed !== newAllowed) {
        const permLabel =
          [...requiredAll, ...(requiredAny.length ? [`any(${requiredAny.join('|')})`] : [])].join(
            ',',
          ) || `roles(${legacyRoles.join(',')})`

        this.logger.warn(
          `[AUTHZ SHADOW MISMATCH] ${request.method} ${request.url} | employee=${user.id} role=${user.role} | ` +
            `old=${oldAllowed} new=${newAllowed} | perm=${permLabel} | ${newDenialReason}`,
        )

        if (this.authz) {
          await this.authz.recordShadowMismatch({
            employeeId: user.id,
            employeeEmail: user.email,
            actingRole: user.role,
            permissionCode: permLabel,
            routePath: request.url,
            httpMethod: request.method,
            oldAllowed,
            newAllowed,
            reason: newDenialReason || undefined,
          })
        }
      }

      if (!oldAllowed) {
        throw new ForbiddenException(
          legacyRoles.length > 0
            ? `Access denied: Required role(s) [${legacyRoles.join(', ')}]`
            : `Access denied: Insufficient permissions`,
        )
      }
      return true
    }

    // mode === 'enforce'
    if (!newAllowed) {
      throw new ForbiddenException(
        newDenialReason ||
          `Access denied: Insufficient permissions ([${[...requiredAll, ...requiredAny].join(', ')}])`,
      )
    }

    return true
  }

  private resolveMode(): AuthzMode {
    const raw = (
      this.configService.get<string>('AUTHZ_MODE') ||
      this.configService.get<string>('PBAC_MODE') ||
      'shadow'
    )
      .trim()
      .toLowerCase()
    if (raw === 'legacy' || raw === 'shadow' || raw === 'enforce') {
      return raw
    }
    return 'shadow'
  }

  private async resolveLegacyEmployeePermissions(employeeId: string): Promise<string[]> {
    const cached = await this.cache.getPermissions(employeeId)
    if (cached) return cached

    const now = new Date()

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
