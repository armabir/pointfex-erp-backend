import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto'

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const teams = await this.prisma.team.findMany({
      include: {
        pmPosition: {
          include: {
            assignments: {
              where: { isActive: true },
              include: { employee: true },
            },
          },
        },
        memberships: {
          where: { isActive: true },
          include: { employee: true },
        },
        teamProjects: {
          where: { isActive: true },
          include: {
            project: {
              include: {
                tasks: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    return teams.map((team) => {
      const activePmAssignment = team.pmPosition?.assignments[0]
      const leadMembership = team.memberships.find((m) => m.isLead)

      const projects = team.teamProjects.map((tp) => tp.project)
      const allTasks = projects.flatMap((p) => p.tasks || [])
      const completedTasks = allTasks.filter((t) => t.status === 'completed')
      const inProgressTasks = allTasks.filter((t) => t.status === 'in_progress')

      return {
        ...team,
        pm: activePmAssignment?.employee || null,
        leadDev: leadMembership?.employee || null,
        members: team.memberships.map((m) => m.employee),
        projects,
        tasksCount: allTasks.length,
        completedTasksCount: completedTasks.length,
        inProgressTasksCount: inProgressTasks.length,
      }
    })
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        pmPosition: {
          include: {
            assignments: {
              where: { isActive: true },
              include: { employee: true },
            },
          },
        },
        memberships: {
          where: { isActive: true },
          include: { employee: true },
        },
        teamProjects: {
          where: { isActive: true },
          include: {
            project: {
              include: {
                milestones: true,
                tasks: true,
              },
            },
          },
        },
      },
    })

    if (!team) {
      throw new NotFoundException(`Team with ID "${id}" not found`)
    }

    const activePmAssignment = team.pmPosition?.assignments[0]
    const leadMembership = team.memberships.find((m) => m.isLead)
    const projects = team.teamProjects.map((tp) => tp.project)
    const allTasks = projects.flatMap((p) => p.tasks || [])

    return {
      ...team,
      pm: activePmAssignment?.employee || null,
      leadDev: leadMembership?.employee || null,
      members: team.memberships.map((m) => m.employee),
      projects,
      tasksCount: allTasks.length,
      completedTasksCount: allTasks.filter((t) => t.status === 'completed').length,
    }
  }

  async create(dto: CreateTeamDto) {
    // 1. Validate that pmPositionId belongs to a Project Manager position
    const position = await this.prisma.position.findUnique({
      where: { id: dto.pmPositionId },
    })

    if (!position) {
      throw new NotFoundException(`PM Position "${dto.pmPositionId}" not found`)
    }

    if (position.roleCategory !== 'pm') {
      throw new BadRequestException(
        `Invalid position: Position "${position.code}" is categorized as "${position.roleCategory}", not a Project Manager ("pm")`,
      )
    }

    // 2. Validate that this PM position is not already assigned to another team
    const existingTeam = await this.prisma.team.findUnique({
      where: { pmPositionId: dto.pmPositionId },
    })

    if (existingTeam) {
      throw new BadRequestException(
        `PM Position "${position.code}" is already assigned to team "${existingTeam.name}"`,
      )
    }

    const teamId = dto.id || `team_${Date.now()}`

    return this.prisma.team.create({
      data: {
        id: teamId,
        name: dto.name,
        code: dto.code,
        focus: dto.focus,
        pmPositionId: dto.pmPositionId,
        color: dto.color || '#38bdf8',
        weeklyVelocity: dto.weeklyVelocity || 40,
      },
      include: {
        pmPosition: true,
      },
    })
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.findOne(id)

    if (dto.pmPositionId) {
      const position = await this.prisma.position.findUnique({
        where: { id: dto.pmPositionId },
      })
      if (!position || position.roleCategory !== 'pm') {
        throw new BadRequestException(
          `Target position must be a valid Project Manager ("pm") position`,
        )
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: dto,
      include: {
        pmPosition: true,
        memberships: {
          where: { isActive: true },
          include: { employee: true },
        },
      },
    })
  }

  async addMember(teamId: string, dto: AddTeamMemberDto) {
    await this.findOne(teamId)

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    })
    if (!employee) {
      throw new NotFoundException(`Employee "${dto.employeeId}" not found`)
    }

    // Interactive transaction: End any active memberships in other teams and add to this team
    return this.prisma.$transaction(async (tx) => {
      // Deactivate old active memberships
      await tx.teamMembership.updateMany({
        where: {
          employeeId: dto.employeeId,
          isActive: true,
        },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      })

      // If making lead, ensure other leads in this team are unset
      if (dto.isLead) {
        await tx.teamMembership.updateMany({
          where: {
            teamId,
            isActive: true,
            isLead: true,
          },
          data: {
            isLead: false,
          },
        })
      }

      // Create new membership
      const newMembership = await tx.teamMembership.create({
        data: {
          teamId,
          employeeId: dto.employeeId,
          isLead: dto.isLead || false,
          roleInTeam: dto.isLead ? 'lead_developer' : 'developer',
          isActive: true,
        },
        include: {
          team: true,
          employee: true,
        },
      })

      return newMembership
    })
  }

  async removeMember(teamId: string, employeeId: string) {
    await this.prisma.teamMembership.updateMany({
      where: {
        teamId,
        employeeId,
        isActive: true,
      },
      data: {
        isActive: false,
        leftAt: new Date(),
      },
    })

    return { message: `Employee "${employeeId}" removed from team "${teamId}"` }
  }
}

