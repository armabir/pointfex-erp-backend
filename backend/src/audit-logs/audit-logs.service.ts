import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { AuthorizationService } from '../rbac/authorization.service'
import { computeAuditEntryHash } from '../common/audit-logger.service'

const CONFIDENTIAL_ACTIONS = [
  'CONFIDENTIAL_GRIEVANCE_SUBMITTED',
  'CONFIDENTIAL_GRIEVANCE_ADJUDICATED',
]

@Injectable()
export class AuditLogsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly authz?: AuthorizationService,
  ) {}

  private async canReadConfidential(actor?: AuthenticatedUser): Promise<boolean> {
    if (!actor) return false
    if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
      const decision = await this.authz.check(actor, 'audit_logs:read_confidential')
      return decision.allowed
    }
    return (
      Boolean(actor.permissions?.includes('audit_logs:read_confidential')) ||
      actor.role === 'chro' ||
      actor.role === 'ceo'
    )
  }

  async findAll(
    filters: {
      category?: string
      severity?: string
      actorId?: string
      search?: string
    },
    actor?: AuthenticatedUser,
  ) {
    const where: any = {}
    const isConfidentialAuthorized = await this.canReadConfidential(actor)

    if (filters.category) where.category = filters.category
    if (filters.severity) where.severity = filters.severity
    if (filters.actorId) where.actorId = filters.actorId
    if (!isConfidentialAuthorized) {
      where.action = { notIn: CONFIDENTIAL_ACTIONS }
    }
    if (filters.search) {
      where.OR = [
        { action: { contains: filters.search, mode: 'insensitive' } },
        { actionCode: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { actorName: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return this.prisma.auditLog.findMany({
      where,
      include: { actor: true },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })
  }

  async findOne(id: string, actor?: AuthenticatedUser) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { actor: true },
    })

    if (!log) {
      throw new NotFoundException(`Audit log entry "${id}" not found`)
    }

    const isConfidentialAuthorized = await this.canReadConfidential(actor)
    if (CONFIDENTIAL_ACTIONS.includes(log.action) && !isConfidentialAuthorized) {
      throw new ForbiddenException(
        'Confidential HR audit entry requires audit_logs:read_confidential authority',
      )
    }

    return log
  }

  async verifyHashChain() {
    const chainedLogs = await this.prisma.auditLog.findMany({
      where: { entryHash: { not: null } },
      orderBy: [{ sequence: 'asc' }, { timestamp: 'asc' }],
    })

    let expectedPrevHash = 'GENESIS'
    let expectedSequence = 1

    for (const row of chainedLogs) {
      if (row.prevHash !== expectedPrevHash) {
        return {
          valid: false,
          checkedCount: chainedLogs.length,
          brokenAtId: row.id,
          brokenAtSequence: row.sequence,
          brokenReason: `prevHash mismatch at sequence ${row.sequence}: expected ${expectedPrevHash}, got ${row.prevHash}`,
        }
      }

      if (row.sequence !== expectedSequence) {
        return {
          valid: false,
          checkedCount: chainedLogs.length,
          brokenAtId: row.id,
          brokenAtSequence: row.sequence,
          brokenReason: `Sequence gap detected: expected ${expectedSequence}, got ${row.sequence}`,
        }
      }

      const recomputed = computeAuditEntryHash({
        prevHash: row.prevHash,
        sequence: row.sequence,
        timestampIso: row.timestamp.toISOString(),
        actorId: row.actorId,
        action: row.action,
        actionCode: row.actionCode,
        entityType: row.entityType,
        entityId: row.entityId,
        description: row.description,
        outcome: row.outcome,
        permissionSource: row.permissionSource,
        delegationId: row.delegationId,
        beforeState: row.beforeState,
        afterState: row.afterState,
      })

      if (recomputed !== row.entryHash) {
        return {
          valid: false,
          checkedCount: chainedLogs.length,
          brokenAtId: row.id,
          brokenAtSequence: row.sequence,
          brokenReason: `Payload digest tamper detected at sequence ${row.sequence} (${row.id})`,
        }
      }

      expectedPrevHash = row.entryHash!
      expectedSequence += 1
    }

    return {
      valid: true,
      checkedCount: chainedLogs.length,
      headSequence: chainedLogs.length > 0 ? chainedLogs[chainedLogs.length - 1].sequence : 0,
      headHash: chainedLogs.length > 0 ? chainedLogs[chainedLogs.length - 1].entryHash : 'GENESIS',
    }
  }
}
