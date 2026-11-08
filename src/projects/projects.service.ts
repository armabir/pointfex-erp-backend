import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateMilestoneDto,
  UpdateMilestoneStatusDto,
  AssignProjectTeamDto,
} from './dto/project.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(teamId?: string, status?: string) {
    const where: any = {}
    if (status) {
      where.status = status
    }
    if (teamId) {
      where.teamProjects = {
        some: {
          teamId,
          isActive: true,
        },
      }
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        teamProjects: {
          where: { isActive: true },
          include: {
            team: {
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
              },
            },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        tasks: true,
        codeQuality: true,
        securityAlerts: {
          where: { status: { not: 'resolved' } },
        },
      },
      orderBy: { id: 'asc' },
    })

    return projects.map((p) => {
      const activeTeamProject = p.teamProjects[0]
      const team = activeTeamProject?.team
      const pmEmployee = team?.pmPosition?.assignments[0]?.employee || null
      const assignedDevs = team?.memberships.map((m) => m.employee) || []

      const completedTasks = p.tasks.filter((t) => t.status === 'completed')
      const inReviewTasks = p.tasks.filter((t) => t.status === 'in_review')

      return {
        ...p,
        teamId: team?.id || null,
        teamName: team?.name || null,
        pm: pmEmployee,
        assignedDevs,
        tasksCount: p.tasks.length,
        completedTasksCount: completedTasks.length,
        inReviewTasksCount: inReviewTasks.length,
      }
    })
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        teamProjects: {
          where: { isActive: true },
          include: {
            team: {
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
              },
            },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        tasks: {
          include: {
            assignee: true,
            creator: true,
            checklist: true,
          },
        },
        codeQuality: true,
        securityAlerts: true,
        testRuns: {
          orderBy: { lastRun: 'desc' },
          take: 5,
        },
      },
    })

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`)
    }

    const activeTeamProject = project.teamProjects[0]
    const team = activeTeamProject?.team
    const pmEmployee = team?.pmPosition?.assignments[0]?.employee || null
    const assignedDevs = team?.memberships.map((m) => m.employee) || []

    return {
      ...project,
      teamId: team?.id || null,
      teamName: team?.name || null,
      pm: pmEmployee,
      assignedDevs,
      tasksCount: project.tasks.length,
      completedTasksCount: project.tasks.filter((t) => t.status === 'completed').length,
    }
  }

  async create(dto: CreateProjectDto) {
    const projectId = dto.id || `proj_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: projectId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          budget: dto.budget ? new Prisma.Decimal(dto.budget) : new Prisma.Decimal(0),
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          deadline: dto.deadline ? new Date(dto.deadline) : new Date(Date.now() + 35 * 86400000),
          repositoryUrl: dto.repositoryUrl,
          demoUrl: dto.demoUrl,
          tags: dto.tags || [],
          srsUrl: dto.srsUrl,
          srsTitle: dto.srsTitle,
        },
      })

      if (dto.teamId) {
        const team = await tx.team.findUnique({ where: { id: dto.teamId } })
        if (!team) {
          throw new NotFoundException(`Team "${dto.teamId}" not found`)
        }
        await tx.teamProject.create({
          data: {
            teamId: dto.teamId,
            projectId,
            isActive: true,
          },
        })
      }

      return project
    })
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id)

    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    })
  }

  async addMilestone(projectId: string, dto: CreateMilestoneDto) {
    await this.findOne(projectId)
    const milestoneId = `ms_${Date.now()}`

    return this.prisma.projectMilestone.create({
      data: {
        id: milestoneId,
        projectId,
        title: dto.title,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 14 * 86400000),
        status: dto.status || 'pending',
        payoutAmount: dto.payoutAmount ? new Prisma.Decimal(dto.payoutAmount) : null,
      },
    })
  }

  async updateMilestoneStatus(projectId: string, milestoneId: string, dto: UpdateMilestoneStatusDto) {
    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    })
    if (!milestone) {
      throw new NotFoundException(`Milestone "${milestoneId}" not found for project "${projectId}"`)
    }

    return this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        status: dto.status,
        progress: dto.status === 'completed' ? 100 : dto.status === 'in_progress' ? 50 : 0,
      },
    })
  }

  async assignTeam(projectId: string, dto: AssignProjectTeamDto) {
    await this.findOne(projectId)
    const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } })
    if (!team) {
      throw new NotFoundException(`Team "${dto.teamId}" not found`)
    }

    // Flexible project reassignment: deactivate old active TeamProjects and bind to new team
    return this.prisma.$transaction(async (tx) => {
      await tx.teamProject.updateMany({
        where: {
          projectId,
          isActive: true,
        },
        data: {
          isActive: false,
          unassignedAt: new Date(),
        },
      })

      const newTeamProject = await tx.teamProject.create({
        data: {
          teamId: dto.teamId,
          projectId,
          isActive: true,
        },
        include: {
          team: true,
          project: true,
        },
      })

      return newTeamProject
    })
  }
}

