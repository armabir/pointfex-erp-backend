import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuthenticatedUser } from '../common/auth-user.interface'

const CONFIDENTIAL_ACTIONS = [
  'CONFIDENTIAL_GRIEVANCE_SUBMITTED',
  'CONFIDENTIAL_GRIEVANCE_ADJUDICATED',
]

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

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
    const isChroOrCeo =
      actor?.permissions?.includes('audit_logs:read_confidential') ||
      actor?.role === 'chro' ||
      actor?.role === 'ceo'

    if (filters.category) where.category = filters.category
    if (filters.severity) where.severity = filters.severity
    if (filters.actorId) where.actorId = filters.actorId
    if (!isChroOrCeo) {
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

    const isChroOrCeo =
      actor?.permissions?.includes('audit_logs:read_confidential') ||
      actor?.role === 'chro' ||
      actor?.role === 'ceo'
    if (CONFIDENTIAL_ACTIONS.includes(log.action) && !isChroOrCeo) {
      throw new ForbiddenException('Confidential HR audit entry is restricted to CHRO and CEO')
    }

    return log
  }
}
