import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { UpdateEmployeeDto } from './dto/update-employee.dto'

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(roleCategory?: string, teamId?: string) {
    const where: any = {}

    if (teamId) {
      where.teamMemberships = {
        some: {
          teamId,
          isActive: true,
        },
      }
    }

    if (roleCategory) {
      where.positionAssignments = {
        some: {
          isActive: true,
          position: {
            roleCategory: roleCategory.toLowerCase(),
          },
        },
      }
    }

    return this.prisma.employee.findMany({
      where,
      include: {
        positionAssignments: {
          where: { isActive: true },
          include: { position: true },
        },
        teamMemberships: {
          where: { isActive: true },
          include: { team: true },
        },
        wallet: true,
        performanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { id: 'asc' },
    })
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        positionAssignments: {
          include: { position: true },
          orderBy: { startDate: 'desc' },
        },
        teamMemberships: {
          include: { team: true },
          orderBy: { joinedAt: 'desc' },
        },
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
        performanceRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!employee) {
      throw new NotFoundException(`Employee with ID "${id}" not found`)
    }

    return employee
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id)

    return this.prisma.employee.update({
      where: { id },
      data: dto,
      include: {
        positionAssignments: {
          where: { isActive: true },
          include: { position: true },
        },
        teamMemberships: {
          where: { isActive: true },
          include: { team: true },
        },
        wallet: true,
      },
    })
  }
}

