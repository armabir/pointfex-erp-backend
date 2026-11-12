import * as crypto from 'crypto'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from './prisma.service'
import { getCurrentRequestIp } from './ip-address.util'

export interface AuditEntryInput {
  actorId?: string | null
  actorName: string
  actorEmail: string
  actorRole: string
  permissionSource?: string | null
  delegationId?: string | null
  action: string
  actionCode: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS'
  entityType: string
  entityId: string
  entityTitle?: string | null
  description: string
  category: string
  badgeColor?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  sessionId?: string | null
  beforeState?: Prisma.InputJsonValue
  afterState?: Prisma.InputJsonValue
  approvalChain?: Prisma.InputJsonValue
  outcome?: string
  reason?: string | null
  mfaVerified?: boolean
  actionKey?: string | null
  payload?: Prisma.InputJsonValue
}

export function computeAuditEntryHash(params: {
  prevHash: string
  sequence: number
  timestampIso: string
  actorId: string | null
  action: string
  actionCode: string
  entityType: string
  entityId: string
  description: string
  outcome: string
  permissionSource?: string | null
  delegationId?: string | null
  beforeState?: unknown
  afterState?: unknown
}): string {
  const canonical = JSON.stringify({
    prevHash: params.prevHash,
    sequence: params.sequence,
    timestampIso: params.timestampIso,
    actorId: params.actorId ?? null,
    action: params.action,
    actionCode: params.actionCode,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
    outcome: params.outcome,
    permissionSource: params.permissionSource ?? null,
    delegationId: params.delegationId ?? null,
    beforeState: params.beforeState ?? null,
    afterState: params.afterState ?? null,
  })
  return crypto.createHash('sha256').update(canonical).digest('hex')
}

@Injectable()
export class AuditLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntryInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma
    const resolvedIp = entry.ipAddress ?? getCurrentRequestIp()
    const outcome = entry.outcome ?? 'SUCCESS'
    const timestamp = new Date()

    const latest = await client.auditLog.findFirst({
      where: { entryHash: { not: null } },
      orderBy: [{ sequence: 'desc' }, { timestamp: 'desc' }],
      select: { sequence: true, entryHash: true },
    })

    const sequence = (latest?.sequence ?? 0) + 1
    const prevHash = latest?.entryHash ?? 'GENESIS'

    const entryHash = computeAuditEntryHash({
      prevHash,
      sequence,
      timestampIso: timestamp.toISOString(),
      actorId: entry.actorId ?? null,
      action: entry.action,
      actionCode: entry.actionCode,
      entityType: entry.entityType,
      entityId: entry.entityId,
      description: entry.description,
      outcome,
      permissionSource: entry.permissionSource ?? null,
      delegationId: entry.delegationId ?? null,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
    })

    return client.auditLog.create({
      data: {
        sequence,
        actorId: entry.actorId ?? null,
        actorName: entry.actorName,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        permissionSource: entry.permissionSource ?? null,
        delegationId: entry.delegationId ?? null,
        action: entry.action,
        actionCode: entry.actionCode,
        severity: entry.severity,
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityTitle: entry.entityTitle ?? null,
        description: entry.description,
        category: entry.category,
        badgeColor: entry.badgeColor ?? null,
        ipAddress: resolvedIp,
        userAgent: entry.userAgent ?? null,
        sessionId: entry.sessionId ?? null,
        outcome,
        reason: entry.reason ?? null,
        prevHash,
        entryHash,
        timestamp,
        ...(entry.beforeState !== undefined ? { beforeState: entry.beforeState } : {}),
        ...(entry.afterState !== undefined ? { afterState: entry.afterState } : {}),
        ...(entry.approvalChain !== undefined ? { approvalChain: entry.approvalChain } : {}),
        ...(entry.payload !== undefined ? { payload: entry.payload } : {}),
      },
    })
  }
}
