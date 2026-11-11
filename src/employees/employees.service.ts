import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common'
import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { UpdateEmployeeDto } from './dto/update-employee.dto'
import { CreateEmployeeDto } from './dto/create-employee.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import {
  C_LEVEL_ROLE_SLUGS,
  assertHorizontalCLevelGuard,
  assertTargetNotSupremeCeo,
  isEmployeeCeo,
  loadEmployeeWithSecurityContext,
} from '../common/security-policy.util'

function stripPasswordHash<T extends { passwordHash?: string }>(
  record: T,
): Omit<T, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...safe } = record
  return safe
}

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'PF'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    @Optional()
    @Inject(AuditLoggerService)
    private readonly auditLogger?: AuditLoggerService,
  ) {}

  async create(dto: CreateEmployeeDto, actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase()
    const existing = await this.prisma.employee.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    })

    if (existing) {
      throw new ConflictException(`An employee with email "${email}" already exists.`)
    }

    const requestedSlugRaw = (dto.roleSlug || 'developer').trim().toLowerCase()
    const normalizedSlug = requestedSlugRaw === 'cpo' ? 'chro' : requestedSlugRaw

    if (normalizedSlug === 'ceo') {
      throw new ForbiddenException(
        'Supreme CEO authority cannot be assigned via onboarding. Use the CEO Succession protocol.',
      )
    }

    const actorContext = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    const actorIsCeo = isEmployeeCeo(actorContext) || actor.role.toLowerCase() === 'ceo'
    if (C_LEVEL_ROLE_SLUGS.has(normalizedSlug) && !actorIsCeo) {
      throw new ForbiddenException('Only the CEO may onboard C-Level executive accounts.')
    }

    const role = await this.prisma.role.findUnique({
      where: { slug: normalizedSlug },
    })

    if (!role || !role.isActive) {
      throw new NotFoundException(`Role "${normalizedSlug}" not found or inactive.`)
    }

    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } })
      if (!team) {
        throw new NotFoundException(`Squad with ID "${dto.teamId}" not found.`)
      }
    }

    const temporaryPassword = `${crypto.randomBytes(9).toString('base64url')}!A9`
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)
    const employeeId = `emp_${normalizedSlug.replace(/[^a-z0-9]/g, '')}_${crypto.randomUUID().slice(0, 8)}`
    const initials = buildInitials(dto.name)

    const createdEmployee = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          id: employeeId,
          name: dto.name.trim(),
          email,
          passwordHash,
          title: dto.title.trim(),
          initials,
          status: 'online',
          isSuspended: false,
          timezone: dto.timezone?.trim() || 'UTC+6 (BST)',
          skills: dto.skills && dto.skills.length > 0 ? dto.skills : [],
          bio: dto.bio?.trim() || `${dto.title.trim()} at Pointfex ERP.`,
        },
      })

      await tx.employeeRole.create({
        data: {
          employeeId: employee.id,
          roleId: role.id,
          assignedById: actor.id,
          isActive: true,
        },
      })

      await tx.employeeWallet.create({
        data: {
          employeeId: employee.id,
        },
      })

      if (dto.teamId) {
        await tx.teamMembership.create({
          data: {
            teamId: dto.teamId,
            employeeId: employee.id,
            isLead: false,
            roleInTeam: normalizedSlug === 'pm' ? 'pm' : 'developer',
            isActive: true,
          },
        })
      }

      await this.auditLogger?.log(
        {
          actorId: actor.id,
          actorName: actorContext.name,
          actorEmail: actorContext.email,
          actorRole: actor.role,
          action: `Provisioned employee account ${employee.name}`,
          actionCode: 'EMPLOYEE_PROVISIONED',
          severity: 'INFO',
          entityType: 'Employee',
          entityId: employee.id,
          entityTitle: employee.name,
          description: `Onboarded ${employee.name} (${employee.email}) with role "${role.name}" (${role.slug})${dto.teamId ? ` in squad ${dto.teamId}` : ''}.`,
          category: 'people',
        },
        tx,
      )

      return tx.employee.findUnique({
        where: { id: employee.id },
        include: {
          positionAssignments: {
            where: { isActive: true },
            include: { position: true },
          },
          employeeRoles: {
            where: { isActive: true },
            include: { role: true },
          },
          targetedAccessChanges: {
            where: { status: 'PENDING' },
            include: {
              requestedRole: true,
              requester: { select: { id: true, name: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          teamMemberships: {
            where: { isActive: true },
            include: { team: true },
          },
          wallet: true,
        },
      })
    })

    if (!createdEmployee) {
      throw new NotFoundException('Failed to reload newly provisioned employee.')
    }

    return {
      employee: stripPasswordHash(createdEmployee),
      temporaryPassword,
    }
  }

  async findAll(roleCategory?: string, teamId?: string) {
    const where: Prisma.EmployeeWhereInput = {}

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

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        positionAssignments: {
          where: { isActive: true },
          include: { position: true },
        },
        employeeRoles: {
          where: { isActive: true },
          include: { role: true },
        },
        targetedAccessChanges: {
          where: { status: 'PENDING' },
          include: {
            requestedRole: true,
            requester: { select: { id: true, name: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
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

    return employees.map(stripPasswordHash)
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

    return stripPasswordHash(employee)
  }

  async update(id: string, dto: UpdateEmployeeDto, actor?: AuthenticatedUser) {
    await this.findOne(id)

    if (actor?.id && actor.id !== id) {
      const target = await loadEmployeeWithSecurityContext(this.prisma, id)
      assertTargetNotSupremeCeo(target)
      await assertHorizontalCLevelGuard(this.prisma, actor.id, target, 'edit employee profile')
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: dto,
      include: {
        positionAssignments: {
          where: { isActive: true },
          include: { position: true },
        },
        employeeRoles: {
          where: { isActive: true },
          include: { role: true },
        },
        targetedAccessChanges: {
          where: { status: 'PENDING' },
          include: {
            requestedRole: true,
            requester: { select: { id: true, name: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        teamMemberships: {
          where: { isActive: true },
          include: { team: true },
        },
        wallet: true,
      },
    })

    return stripPasswordHash(updated)
  }
}
