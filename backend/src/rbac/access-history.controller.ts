import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common'
import { Response } from 'express'
import { PrismaService } from '../common/prisma.service'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequiresPermission } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'

@Controller('rbac/access-history')
@UseGuards(PermissionsGuard)
export class AccessHistoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequiresPermission('access_history:read')
  async getAccessHistory(
    @Query('actorId') actorId?: string,
    @Query('targetId') targetId?: string,
    @Query('changeType') changeType?: string,
    @Query('search') search?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    const limit = Math.min(100, Math.max(1, Number(limitStr) || 25))
    const offset = Math.max(0, Number(offsetStr) || 0)

    const where: any = {}
    if (actorId) where.actorId = actorId
    if (targetId) where.employeeId = targetId
    if (changeType) where.changeType = changeType
    if (search?.trim()) {
      const q = search.trim().toLowerCase()
      where.OR = [
        { reason: { contains: q, mode: 'insensitive' } },
        { actionKey: { contains: q, mode: 'insensitive' } },
        { employee: { name: { contains: q, mode: 'insensitive' } } },
        { actor: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const [entries, totalCount, roleChangesCount, delegationsCount, grantsCount, revocationsCount] =
      await Promise.all([
        this.prisma.employeeChangeHistory.findMany({
          where,
          include: {
            employee: { select: { id: true, name: true, email: true, title: true } },
            actor: { select: { id: true, name: true, email: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.employeeChangeHistory.count({ where }),
        this.prisma.employeeChangeHistory.count({ where: { changeType: 'ROLE' } }),
        this.prisma.delegation.count(),
        this.prisma.userRoleAssignment.count({ where: { isActive: true } }),
        this.prisma.userRoleAssignment.count({ where: { isActive: false } }),
      ])

    const items = entries.map((e) => ({
      id: e.id,
      timestamp: e.createdAt.toISOString(),
      effectiveDate: e.effectiveDate.toISOString(),
      actorId: e.actorId,
      actorName: e.actor?.name || 'System',
      actorEmail: e.actor?.email || '',
      actorTitle: e.actor?.title || '',
      targetId: e.employeeId,
      targetName: e.employee?.name || 'Unknown',
      targetEmail: e.employee?.email || '',
      targetTitle: e.employee?.title || '',
      changeType: e.changeType,
      actionKey: e.actionKey,
      reason: e.reason,
      beforeState: e.beforeState,
      afterState: e.afterState,
    }))

    return {
      summary: {
        totalEvents: totalCount,
        roleChanges: roleChangesCount,
        activeGrants: grantsCount,
        revocations: revocationsCount,
        delegations: delegationsCount,
      },
      items,
      totalCount,
      limit,
      offset,
    }
  }

  @Get('export')
  @RequiresPermission('access_history:read')
  async exportAccessHistory(
    @Query('format') format = 'csv',
    @Res() res: Response,
    @CurrentUser() actor?: AuthenticatedUser,
  ) {
    const entries = await this.prisma.employeeChangeHistory.findMany({
      include: {
        employee: { select: { id: true, name: true, email: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename="access-history.json"')
      return res.send(JSON.stringify(entries, null, 2))
    }

    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Target Name', 'Target Email', 'Change Type', 'Action', 'Reason']
    const rows = entries.map((e) => [
      `"${e.createdAt.toISOString()}"`,
      `"${e.actor?.name || ''}"`,
      `"${e.actor?.email || ''}"`,
      `"${e.employee?.name || ''}"`,
      `"${e.employee?.email || ''}"`,
      `"${e.changeType}"`,
      `"${e.actionKey}"`,
      `"${(e.reason || '').replace(/"/g, '""')}"`,
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="access-history.csv"')
    return res.send(csv)
  }
}

