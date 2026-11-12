import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { PermissionCacheService } from './permission-cache.service'

export interface RootCeoInvariantResult {
  healthy: boolean
  recovered: boolean
  deduplicated: boolean
  activeHolderIds: string[]
  canonicalCeoId: string
}

@Injectable()
export class CeoBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(CeoBootstrapService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PermissionCacheService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async onModuleInit() {
    try {
      const result = await this.ensureSingleRootCeo()
      if (result.recovered) {
        this.logger.warn(
          `CEO lockout recovery triggered: restored system:root to ${result.canonicalCeoId}`,
        )
      } else if (result.deduplicated) {
        this.logger.warn(
          `Multiple system:root holders detected; enforced single holder ${result.canonicalCeoId}`,
        )
      } else {
        this.logger.log(`CEO system:root invariant verified (holder: ${result.canonicalCeoId})`)
      }
    } catch (error) {
      this.logger.error(
        `CEO bootstrap check failed during startup: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Lockout protection invariant:
   * - `system:root` must exist and belong to the active root role (`isRootRole = true`).
   * - Exactly ONE active, non-suspended employee must hold `system:root` at all times.
   * - If zero holders exist, automatically re-grants the root role (`GLOBAL` scope) to the configured CEO employee.
   * - If more than one holder exists, deactivates duplicate holders while keeping the canonical CEO.
   */
  async ensureSingleRootCeo(): Promise<RootCeoInvariantResult> {
    const canonicalCeoId = process.env.CEO_EMPLOYEE_ID?.trim() || 'emp_ceo_01'
    const now = new Date()

    const rootPermission = await this.prisma.permission.findUnique({
      where: { code: 'system:root' },
    })
    if (!rootPermission) {
      throw new Error('Permission "system:root" missing from catalog; run catalog seed first.')
    }

    let rootRole = await this.prisma.role.findFirst({
      where: { OR: [{ isRootRole: true }, { slug: 'ceo' }] },
      orderBy: [{ isRootRole: 'desc' }, { createdAt: 'asc' }],
    })

    if (!rootRole) {
      rootRole = await this.prisma.role.create({
        data: {
          slug: 'ceo',
          name: 'Chief Executive Officer',
          description: 'Supreme system:root role',
          isSystemDefault: true,
          isActive: true,
          includeCritical: true,
          isRootRole: true,
          templateCode: 'CEO',
        },
      })
    } else if (!rootRole.isActive || !rootRole.isRootRole || !rootRole.includeCritical) {
      rootRole = await this.prisma.role.update({
        where: { id: rootRole.id },
        data: {
          isActive: true,
          isRootRole: true,
          includeCritical: true,
          deactivatedAt: null,
        },
      })
    }

    await this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: rootRole.id,
          permissionId: rootPermission.id,
        },
      },
      update: {},
      create: {
        roleId: rootRole.id,
        permissionId: rootPermission.id,
        grantedById: canonicalCeoId,
      },
    })

    const activeAssignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        roleId: rootRole.id,
        isActive: true,
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        employee: { select: { id: true, name: true, email: true, isSuspended: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const validHolders = activeAssignments.filter((a) => !a.employee.isSuspended)
    let recovered = false
    let deduplicated = false
    let finalHolderId = canonicalCeoId

    if (validHolders.length === 0) {
      const targetCeo = await this.prisma.employee.findUnique({
        where: { id: canonicalCeoId },
      })
      if (!targetCeo) {
        throw new Error(
          `Cannot recover system:root: configured CEO employee "${canonicalCeoId}" not found.`,
        )
      }

      await this.prisma.$transaction(async (tx) => {
        if (targetCeo.isSuspended) {
          await tx.employee.update({
            where: { id: targetCeo.id },
            data: { isSuspended: false },
          })
        }

        await tx.userRoleAssignment.create({
          data: {
            employeeId: targetCeo.id,
            roleId: rootRole.id,
            scope: 'GLOBAL',
            scopeIds: [],
            assignedById: targetCeo.id,
            reason: 'Automatic CEO lockout protection bootstrap recovery',
            isActive: true,
          },
        })

        await tx.employeeRole.upsert({
          where: {
            employeeId_roleId: {
              employeeId: targetCeo.id,
              roleId: rootRole.id,
            },
          },
          update: { isActive: true, expiresAt: null },
          create: {
            employeeId: targetCeo.id,
            roleId: rootRole.id,
            assignedById: targetCeo.id,
            isActive: true,
          },
        })

        await this.auditLogger.log(
          {
            actorId: targetCeo.id,
            actorName: targetCeo.name,
            actorEmail: targetCeo.email,
            actorRole: 'CEO',
            action: 'CEO_LOCKOUT_RECOVERY',
            actionCode: 'GOVERNANCE_ROOT_INVARIANT_RECOVERED',
            severity: 'CRITICAL',
            entityType: 'user',
            entityId: targetCeo.id,
            entityTitle: targetCeo.name,
            description: `Startup/invariant check found zero active system:root holders; restored GLOBAL CEO root assignment to ${targetCeo.name}.`,
            category: 'security',
            badgeColor: 'rose',
          },
          tx,
        )
      })

      await this.cache.invalidateUser(targetCeo.id)
      recovered = true
      finalHolderId = targetCeo.id
    } else if (validHolders.length > 1) {
      const preferred =
        validHolders.find((h) => h.employeeId === canonicalCeoId) ?? validHolders[0]
      finalHolderId = preferred.employeeId

      const duplicateAssignments = validHolders.filter((h) => h.id !== preferred.id)
      for (const dup of duplicateAssignments) {
        await this.prisma.userRoleAssignment.update({
          where: { id: dup.id },
          data: {
            isActive: false,
            revokedAt: now,
            revokedById: finalHolderId,
          },
        })
        if (dup.employeeId !== finalHolderId) {
          await this.prisma.employeeRole.updateMany({
            where: { employeeId: dup.employeeId, roleId: rootRole.id, isActive: true },
            data: { isActive: false },
          })
          await this.cache.invalidateUser(dup.employeeId)
        }
      }
      deduplicated = true
    } else {
      finalHolderId = validHolders[0].employeeId
    }

    return {
      healthy: true,
      recovered,
      deduplicated,
      activeHolderIds: [finalHolderId],
      canonicalCeoId: finalHolderId,
    }
  }
}

