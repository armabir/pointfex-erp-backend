import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AssignPositionDto } from './dto/assign-position.dto'

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.position.findMany({
      include: {
        assignments: {
          include: { employee: true },
          orderBy: { startDate: 'desc' },
        },
        managedTeam: true,
      },
      orderBy: { code: 'asc' },
    })
  }

  async findOne(id: string) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: {
        assignments: {
          include: { employee: true },
          orderBy: { startDate: 'desc' },
        },
        managedTeam: true,
      },
    })

    if (!position) {
      throw new NotFoundException(`Position with ID "${id}" not found`)
    }

    return position
  }

  async assignPosition(dto: AssignPositionDto, actorId?: string, reason?: string) {
    const position = await this.prisma.position.findUnique({
      where: { id: dto.positionId },
    })
    if (!position) {
      throw new NotFoundException(`Position "${dto.positionId}" not found`)
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    })
    if (!employee) {
      throw new NotFoundException(`Employee "${dto.employeeId}" not found`)
    }

    const previousAssignments = await this.prisma.positionAssignment.findMany({
      where: { employeeId: dto.employeeId, isActive: true },
      include: { position: { select: { code: true, title: true } } },
    })

    // Interactive transaction: End existing active assignment for this position and create new one
    return this.prisma.$transaction(async (tx) => {
      const now = new Date()

      // 1. End any active assignment for this position
      await tx.positionAssignment.updateMany({
        where: {
          positionId: dto.positionId,
          isActive: true,
        },
        data: {
          endDate: now,
          isActive: false,
        },
      })

      // 2. Create the new assignment (Preserves history)
      const newAssignment = await tx.positionAssignment.create({
        data: {
          employeeId: dto.employeeId,
          positionId: dto.positionId,
          startDate: now,
          isActive: true,
        },
        include: {
          position: true,
          employee: true,
        },
      })

      if (actorId) {
        await tx.employeeChangeHistory.create({
          data: {
            employeeId: dto.employeeId,
            actorId,
            actionKey: 'positions:assign',
            changeType: 'POSITION',
            beforeState: previousAssignments.map((a) => a.position) as any,
            afterState: { code: position.code, title: position.title } as any,
            reason: reason?.trim() || `Assigned position ${position.title}`,
            effectiveDate: now,
          },
        })
      }

      return newAssignment
    })
  }

  async removePosition(
    employeeId: string,
    actorId: string,
    reason: string,
    positionId?: string,
  ) {
    const active = await this.prisma.positionAssignment.findMany({
      where: {
        employeeId,
        isActive: true,
        ...(positionId ? { positionId } : {}),
      },
      include: { position: { select: { id: true, code: true, title: true } } },
    })

    if (active.length === 0) {
      throw new NotFoundException(`No active position assignment found for "${employeeId}"`)
    }

    const now = new Date()
    return this.prisma.$transaction(async (tx) => {
      await tx.positionAssignment.updateMany({
        where: {
          employeeId,
          isActive: true,
          ...(positionId ? { positionId } : {}),
        },
        data: { isActive: false, endDate: now },
      })

      await tx.employeeChangeHistory.create({
        data: {
          employeeId,
          actorId,
          actionKey: 'positions:remove',
          changeType: 'POSITION',
          beforeState: active.map((a) => a.position) as any,
          afterState: null as any,
          reason: reason.trim(),
          effectiveDate: now,
        },
      })

      return { removedCount: active.length, employeeId }
    })
  }
}
