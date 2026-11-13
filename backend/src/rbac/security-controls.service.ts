import * as crypto from 'crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { AuthorizationService } from './authorization.service'
import { generateTotpCode, verifyTotpCode } from '../common/security-policy.util'

function hexToBase32(hex: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = Buffer.from(hex, 'hex')
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31]
  }
  return out
}

@Injectable()
export class SecurityControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  // --- ACCESS HISTORY (CEO & EXECUTIVE ONLY) ---

  async listAccessHistory(actor: AuthenticatedUser) {
    const [changes, delegations, auditLogs] = await Promise.all([
      this.prisma.employeeChangeHistory.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.delegation.findMany({
        take: 50,
        include: {
          delegator: { select: { id: true, name: true, email: true } },
          delegatee: { select: { id: true, name: true, email: true } },
          permissions: { include: { permission: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: {
          category: { in: ['governance', 'security', 'people'] },
        },
        take: 100,
        orderBy: { timestamp: 'desc' },
      }),
    ])

    const timeline: any[] = []

    for (const c of changes) {
      timeline.push({
        id: c.id,
        eventType: c.changeType || 'ROLE_CHANGE',
        actionKey: c.actionKey || 'access:change',
        actorId: c.actorId || 'SYSTEM',
        targetId: c.employeeId,
        beforeState: c.beforeState,
        afterState: c.afterState,
        reason: c.reason,
        timestamp: c.createdAt,
      })
    }

    for (const d of delegations) {
      timeline.push({
        id: d.id,
        eventType: 'DELEGATION',
        actionKey: 'delegations:create',
        actorId: d.delegatorId,
        actorName: d.delegator?.name,
        targetId: d.delegateeId,
        targetName: d.delegatee?.name,
        reason: d.reason,
        timestamp: d.createdAt,
        details: {
          status: d.status,
          expiresAt: d.expiresAt,
          permissions: d.permissions.map((p) => (p as any).permission?.code || (p as any).permissionId),
        },
      })
    }

    for (const a of auditLogs) {
      timeline.push({
        id: a.id,
        eventType: 'AUDIT_LOG',
        actionKey: a.actionCode || 'audit:event',
        actorId: a.actorId,
        actorName: a.actorName,
        targetId: a.entityId,
        targetName: a.entityTitle,
        reason: a.description,
        timestamp: a.timestamp,
        severity: a.severity,
      })
    }

    timeline.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())

    const totalEvents = timeline.length
    const grantsCount = timeline.filter((t) => t.eventType.includes('GRANT') || t.actionKey.includes('assign') || t.actionKey.includes('create')).length
    const revocationsCount = timeline.filter((t) => t.eventType.includes('REVOKE') || t.actionKey.includes('revoke') || t.actionKey.includes('delete')).length
    const delegationsCount = delegations.length

    return {
      summary: {
        totalEvents,
        grantsCount,
        revocationsCount,
        delegationsCount,
      },
      timeline,
    }
  }

  // --- SECURITY SESSIONS ---

  async listMySessions(employeeId: string) {
    return this.prisma.securitySession.findMany({
      where: { employeeId },
      orderBy: { lastActiveAt: 'desc' },
      take: 50,
    })
  }

  async listAllSessions() {
    return this.prisma.securitySession.findMany({
      include: {
        employee: { select: { id: true, name: true, email: true, title: true } },
      },
      orderBy: { lastActiveAt: 'desc' },
      take: 200,
    })
  }

  async revokeSession(sessionId: string, actor: AuthenticatedUser) {
    const session = await this.prisma.securitySession.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException(`Security session "${sessionId}" not found`)

    if (session.employeeId !== actor.id) {
      await this.authz.assert(actor, 'sessions:revoke', { requiredScope: 'ORG' })
    }

    if (session.isRevoked) return session

    const now = new Date()
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.securitySession.update({
        where: { id: sessionId },
        data: { isRevoked: true, revokedAt: now, revokedById: actor.id },
      })

      if (session.tokenFamilyId) {
        await tx.refreshToken.updateMany({
          where: { familyId: session.tokenFamilyId, revokedAt: null },
          data: { revokedAt: now },
        })
      }

      if (this.auditLogger) {
        await this.auditLogger.log(
          {
            actorId: actor.id,
            actorName: actor.name || actor.id,
            actorEmail: actor.email || '',
            actorRole: actor.role.toUpperCase(),
            action: 'SECURITY_SESSION_REVOKED',
            actionCode: 'SESSION_REVOKED',
            severity: 'WARNING',
            entityType: 'session',
            entityId: sessionId,
            description: `Revoked session ${sessionId} belonging to ${session.employeeId}`,
            category: 'security',
            badgeColor: 'amber',
            sessionId,
          },
          tx,
        )
      }

      return saved
    })

    await this.authz.invalidateUserCache(session.employeeId)
    return updated
  }

  // --- EXECUTIVE MFA HOOKS ---

  async enrollMfa(actor: AuthenticatedUser) {
    const secretHex = crypto.randomBytes(20).toString('hex')
    await this.prisma.employee.update({
      where: { id: actor.id },
      data: { mfaSecret: secretHex, mfaEnabled: true },
    })

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actor.id,
        actorName: actor.name || actor.id,
        actorEmail: actor.email || '',
        actorRole: actor.role.toUpperCase(),
        action: 'MFA_ENROLLED',
        actionCode: 'SECURITY_MFA_ENROLLED',
        severity: 'INFO',
        entityType: 'user',
        entityId: actor.id,
        description: `Executive/user MFA TOTP enrolled for ${actor.id}`,
        category: 'security',
        badgeColor: 'emerald',
      })
    }

    const base32Secret = hexToBase32(secretHex)
    const issuer = encodeURIComponent('Pointfex ERP')
    const accountLabel = encodeURIComponent(actor.email || actor.id)
    const otpauthUrl = `otpauth://totp/${issuer}:${accountLabel}?secret=${base32Secret}&issuer=${issuer}`
    const isProd = process.env.NODE_ENV === 'production'

    return {
      enrolled: true,
      secretHex,
      base32Secret,
      otpauthUrl,
      ...(isProd ? {} : { previewCurrentCode: generateTotpCode(secretHex) }),
    }
  }

  async verifyMfa(actor: AuthenticatedUser, code: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id: actor.id },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    })
    if (!emp?.mfaEnabled || !emp.mfaSecret) {
      throw new BadRequestException('MFA is not enrolled on this account')
    }
    if (!verifyTotpCode(emp.mfaSecret, code)) {
      throw new ForbiddenException('Invalid 6-digit MFA verification code')
    }

    await this.prisma.$transaction([
      this.prisma.employee.update({
        where: { id: actor.id },
        data: { mustEnrollMfa: false, mfaEnabled: true },
      }),
      this.prisma.securitySession.updateMany({
        where: { employeeId: actor.id, isRevoked: false },
        data: { mfaVerified: true, mfaMethod: 'TOTP', lastActiveAt: new Date() },
      }),
    ])

    return { verified: true, method: 'TOTP', mustEnrollMfa: false }
  }

  // --- ACCESS REVIEWS ---

  async createAccessReview(
    actor: AuthenticatedUser,
    input: { title: string; targetEmployeeId: string; dueAt?: string; notes?: string },
  ) {
    const targetSnapshot = await this.authz.resolveEffectiveAuthz(input.targetEmployeeId)
    return this.prisma.accessReview.create({
      data: {
        title: input.title,
        reviewerId: actor.id,
        targetEmployeeId: input.targetEmployeeId,
        status: 'PENDING',
        findings: {
          roleSlugs: targetSnapshot.roleSlugs,
          effectiveCount: targetSnapshot.effectiveCodes.length,
        },
        notes: input.notes ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      },
    })
  }

  async listAccessReviews() {
    return this.prisma.accessReview.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  }

  async decideAccessReview(
    reviewId: string,
    actor: AuthenticatedUser,
    status: 'CERTIFIED' | 'REVOKED_EXCESS',
    notes?: string,
  ) {
    const existing = await this.prisma.accessReview.findUnique({ where: { id: reviewId } })
    if (!existing) throw new NotFoundException(`Access review "${reviewId}" not found`)
    return this.prisma.accessReview.update({
      where: { id: reviewId },
      data: {
        status,
        notes: notes ?? existing.notes,
        reviewedAt: new Date(),
        reviewerId: actor.id,
      },
    })
  }

  // --- APPEND-ONLY XP LEDGER ---

  async getEmployeeXpSummary(employeeId: string, actor: AuthenticatedUser) {
    if (employeeId !== actor.id) {
      await this.authz.assert(actor, 'xp:read_all')
    } else {
      await this.authz.assert(actor, 'xp:read_own', { ownerId: employeeId })
    }

    const entries = await this.prisma.xpLedgerEntry.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    })
    const balance = entries.reduce((sum, e) => sum + e.delta, 0)
    return { employeeId, balance, entries }
  }

  async awardOrAdjustXp(
    actor: AuthenticatedUser,
    input: { employeeId: string; delta: number; reason: string; entryType?: 'AWARD' | 'ADJUSTMENT' },
  ) {
    if (!input.reason || input.reason.trim().length < 3) {
      throw new BadRequestException('XP ledger entry requires a reason')
    }
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new BadRequestException('XP delta must be a non-zero integer')
    }

    const entryType = input.entryType ?? (input.delta > 0 ? 'AWARD' : 'ADJUSTMENT')
    const permNeeded = entryType === 'AWARD' ? 'xp:award' : 'xp:adjust'
    await this.authz.assert(actor, permNeeded)

    const entry = await this.prisma.xpLedgerEntry.create({
      data: {
        employeeId: input.employeeId,
        delta: input.delta,
        reason: input.reason.trim(),
        entryType,
        awardedById: actor.id,
      },
    })

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actor.id,
        actorName: actor.name || actor.id,
        actorEmail: actor.email || '',
        actorRole: actor.role.toUpperCase(),
        action: 'XP_LEDGER_ENTRY_CREATED',
        actionCode: permNeeded,
        severity: 'INFO',
        entityType: 'xp_ledger',
        entityId: entry.id,
        description: `${entryType} ${input.delta > 0 ? '+' : ''}${input.delta} XP for ${input.employeeId}: ${input.reason}`,
        category: 'people',
        badgeColor: 'emerald',
      })
    }

    return entry
  }

  async reverseXpEntry(entryId: string, actor: AuthenticatedUser, reason: string) {
    await this.authz.assert(actor, 'xp:adjust')
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('XP reversal requires a reason')
    }

    const original = await this.prisma.xpLedgerEntry.findUnique({ where: { id: entryId } })
    if (!original) throw new NotFoundException(`XP entry "${entryId}" not found`)
    if (original.entryType === 'REVERSAL') {
      throw new BadRequestException('Cannot reverse an entry that is already a reversal')
    }

    const alreadyReversed = await this.prisma.xpLedgerEntry.findFirst({
      where: { reversalOfId: entryId },
    })
    if (alreadyReversed) {
      throw new BadRequestException(`XP entry "${entryId}" was already reversed`)
    }

    return this.prisma.xpLedgerEntry.create({
      data: {
        employeeId: original.employeeId,
        delta: -original.delta,
        reason: `Reversal of [${original.id}]: ${reason.trim()}`,
        entryType: 'REVERSAL',
        reversalOfId: original.id,
        awardedById: actor.id,
      },
    })
  }
}

