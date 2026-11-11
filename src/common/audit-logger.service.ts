import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from './prisma.service'
import { getCurrentRequestIp } from './ip-address.util'

export interface AuditEntryInput {
  actorId?: string | null
  actorName: string
  actorEmail: string
  actorRole: string
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
  payload?: Prisma.InputJsonValue
}

@Injectable()
export class AuditLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntryInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma
    const resolvedIp = entry.ipAddress ?? getCurrentRequestIp()

    return client.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorName: entry.actorName,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
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
        ...(entry.payload !== undefined ? { payload: entry.payload } : {}),
      },
    })
  }
}
