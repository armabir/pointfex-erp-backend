import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    category?: string
    severity?: string
    actorId?: string
    search?: string
  }) {
    const where: any = {}

    if (filters.category) where.category = filters.category
    if (filters.severity) where.severity = filters.severity
    if (filters.actorId) where.actorId = filters.actorId
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

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { actor: true },
    })

    if (!log) {
      throw new NotFoundException(`Audit log entry "${id}" not found`)
    }

    return log
  }
}

