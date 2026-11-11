import { getCurrentRequestIp } from '../common/ip-address.util'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { PermissionCacheService } from '../rbac/permission-cache.service'
import {
  CreateAccessRequestDto,
  CreateDirectiveDto,
  RatifyDecisionDto,
  ReviewAccessRequestDto,
  TransferCeoDto,
} from './dto/governance.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { Prisma } from '@prisma/client'
import {
  CORE_ROLE_SLUGS,
  assertHorizontalCLevelGuard,
  assertNotSelfTarget,
  isEmployeeCeo,
  isEmployeeChro,
  loadEmployeeWithSecurityContext,
  verifyStepUpAuth,
} from '../common/security-policy.util'

@Injectable()
export class GovernanceService {
  constructor(
    private prisma: PrismaService,
    @Optional() private cache?: PermissionCacheService,
  ) {}

  async getDirectives() {
    return this.prisma.executiveDirective.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async getDecisions() {
    return this.prisma.executiveDecision.findMany({
      orderBy: { ratifiedAt: 'desc' },
    })
  }

  async dispatchDirective(dto: CreateDirectiveDto, actor: AuthenticatedUser) {
    const directiveId = `dir_${Date.now()}`
    const taskId = `tsk_exec_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      // 1. Create ExecutiveDirective
      const directive = await tx.executiveDirective.create({
        data: {
          id: directiveId,
          title: dto.title,
          description: dto.description,
          assigneeRole: dto.assigneeRole,
          assigneeId: dto.assigneeId,
          priority: dto.priority || 'urgent',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 14 * 86400000),
          tags: dto.tags || ['Executive Directive', dto.assigneeRole.toUpperCase()],
          projectId: dto.projectId,
          status: 'active',
          issuedById: actor.id,
        },
      })

      // 2. Resolve target employee for the task
      let targetEmpId = dto.assigneeId
      if (!targetEmpId) {
        const matchingPosition = await tx.position.findFirst({
          where: { roleCategory: dto.assigneeRole.toLowerCase() },
          include: {
            assignments: {
              where: { isActive: true },
              take: 1,
            },
          },
        })
        targetEmpId = matchingPosition?.assignments[0]?.employeeId || actor.id
      }

      const defaultProject = await tx.project.findFirst({ select: { id: true } })

      // Create Task linked to directive
      await tx.task.create({
        data: {
          id: taskId,
          title: dto.title,
          description:
            dto.description || 'Executive strategic directive dispatched from leadership.',
          projectId: dto.projectId || defaultProject?.id || 'proj_01',
          creatorId: actor.id,
          assigneeId: targetEmpId,
          status: 'todo',
          priority: dto.priority || 'urgent',
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 14 * 86400000),
          estimatedHours: new Prisma.Decimal(24),
          loggedHours: new Prisma.Decimal(0),
          tags: dto.tags || ['Executive Directive', dto.assigneeRole.toUpperCase()],
          checklist: {
            create: [
              { text: 'Executive brief and stakeholder alignment', completed: false },
              { text: 'Milestone execution and telemetry validation', completed: false },
              { text: 'C-Suite sign-off and retrospective documentation', completed: false },
            ],
          },
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'EXECUTIVE_DIRECTIVE_ISSUED',
          actionCode: 'EXECUTIVE_DIRECTIVE_DISPATCHED',
          severity: 'INFO',
          entityType: 'task',
          entityId: taskId,
          entityTitle: dto.title,
          description: `Dispatched strategic directive to ${dto.assigneeRole.toUpperCase()}: "${dto.title}"`,
          category: 'governance',
          badgeColor: 'sky',
        },
      })

      return directive
    })
  }

  async ratifyDecision(dto: RatifyDecisionDto, actor: AuthenticatedUser) {
    const decisionId = `dec_${Date.now()}`

    return this.prisma.$transaction(async (tx) => {
      const decision = await tx.executiveDecision.create({
        data: {
          id: decisionId,
          actionType: dto.actionType,
          entityId: dto.entityId,
          notes: dto.notes,
          ratifiedById: actor.id,
        },
      })

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actor.id,
          actorEmail: `${actor.id}@pointfex.internal`,
          actorRole: actor.role.toUpperCase(),
          action: 'CEO_DECISION_RATIFIED',
          actionCode: 'CEO_DECISION_AUTHORIZED',
          severity: 'SUCCESS',
          entityType: 'governance',
          entityId: dto.entityId,
          description: `CEO formally ratified ${dto.actionType.replace(/_/g, ' ')}${dto.notes ? `: ${dto.notes}` : ''}`,
          category: 'governance',
          badgeColor: 'emerald',
        },
      })

      return decision
    })
  }

  async transferCeo(
    dto: TransferCeoDto,
    actor: AuthenticatedUser,
    headers?: Record<string, string>,
  ) {
    assertNotSelfTarget(actor.id, dto.newCeoEmployeeId, 'transfer the CEO title')
    await verifyStepUpAuth(this.prisma, actor.id, dto, headers, 'CEO transfer')

    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    if (!isEmployeeCeo(actorEmployee)) {
      throw new ForbiddenException(
        'Only the current verified CEO can initiate CEO succession transfer',
      )
    }

    const successor = await loadEmployeeWithSecurityContext(this.prisma, dto.newCeoEmployeeId)
    if (successor.isSuspended) {
      throw new BadRequestException('Cannot transfer CEO authority to a suspended account')
    }

    const fallbackSlug = (dto.demoteToRoleSlug || 'developer').toLowerCase()
    if (fallbackSlug === 'ceo') {
      throw new BadRequestException('Outgoing CEO must transition to a non-CEO standard role')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const [ceoRole, fallbackRole, ceoPosition] = await Promise.all([
        tx.role.findUnique({ where: { slug: 'ceo' } }),
        tx.role.findUnique({ where: { slug: fallbackSlug } }),
        tx.position.findFirst({ where: { roleCategory: 'ceo' } }),
      ])

      if (!ceoRole) throw new NotFoundException('System CEO role not found')
      if (!fallbackRole) throw new NotFoundException(`Fallback role "${fallbackSlug}" not found`)

      // 1. Revoke CEO EmployeeRole from acting CEO & attach standard fallback role
      await tx.employeeRole.updateMany({
        where: { employeeId: actor.id, roleId: ceoRole.id, isActive: true },
        data: { isActive: false },
      })

      await tx.employeeRole.upsert({
        where: { employeeId_roleId: { employeeId: actor.id, roleId: fallbackRole.id } },
        update: { isActive: true, assignedById: actor.id, assignedAt: new Date(), expiresAt: null },
        create: {
          employeeId: actor.id,
          roleId: fallbackRole.id,
          assignedById: actor.id,
          isActive: true,
        },
      })

      // 2. Grant CEO EmployeeRole to successor
      await tx.employeeRole.upsert({
        where: { employeeId_roleId: { employeeId: successor.id, roleId: ceoRole.id } },
        update: { isActive: true, assignedById: actor.id, assignedAt: new Date(), expiresAt: null },
        create: {
          employeeId: successor.id,
          roleId: ceoRole.id,
          assignedById: actor.id,
          isActive: true,
        },
      })

      // 3. Transfer active CEO PositionAssignment seat atomically (if defined)
      if (ceoPosition) {
        const now = new Date()
        await tx.positionAssignment.updateMany({
          where: { positionId: ceoPosition.id, isActive: true },
          data: { isActive: false, endDate: now },
        })
        await tx.positionAssignment.create({
          data: {
            employeeId: successor.id,
            positionId: ceoPosition.id,
            startDate: now,
            isActive: true,
          },
        })
      }

      // 4. High-severity Audit Log
      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actorEmployee.name,
          actorEmail: actorEmployee.email,
          actorRole: 'CEO',
          action: 'CEO_SUCCESSION_TRANSFERRED',
          actionCode: 'GOVERNANCE_CEO_TRANSFER',
          severity: 'CRITICAL',
          entityType: 'user',
          entityId: successor.id,
          entityTitle: successor.name,
          description: `${actorEmployee.name} transferred CEO executive authority to ${successor.name} and stepped down to ${fallbackRole.name}${dto.reason?.trim() ? ` — Reason: ${dto.reason.trim()}` : ''}`,
          category: 'governance',
          badgeColor: 'rose',
          payload: {
            previousCeoId: actor.id,
            newCeoEmployeeId: successor.id,
            outgoingRoleSlug: fallbackRole.slug,
            reason: dto.reason?.trim() || null,
          },
        },
      })

      return {
        transferred: true,
        previousCeoId: actor.id,
        previousCeoNewRole: fallbackRole.slug,
        newCeoEmployeeId: successor.id,
        newCeoName: successor.name,
      }
    })

    await this.cache?.invalidateUsers([actor.id, successor.id])
    return result
  }

  async listAccessRequests(status?: string, targetEmployeeId?: string) {
    const where: Prisma.AccessChangeRequestWhereInput = {}
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED'
    }
    if (targetEmployeeId) {
      where.targetEmployeeId = targetEmployeeId
    }

    return this.prisma.accessChangeRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
        targetEmployee: { select: { id: true, name: true, email: true, title: true } },
        requestedRole: { select: { id: true, slug: true, name: true, isSystemDefault: true } },
        approvedBy: { select: { id: true, name: true, email: true, title: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
  }

  async createAccessRequest(dto: CreateAccessRequestDto, actor: AuthenticatedUser) {
    assertNotSelfTarget(actor.id, dto.targetEmployeeId, 'request a role change')

    const targetEmployee = await loadEmployeeWithSecurityContext(this.prisma, dto.targetEmployeeId)
    const actorEmployee = await assertHorizontalCLevelGuard(
      this.prisma,
      actor.id,
      targetEmployee,
      'request a role change',
    )

    if (!dto.requestedRoleId && !dto.requestedRoleSlug) {
      throw new BadRequestException('Either requestedRoleId or requestedRoleSlug is required')
    }

    const role = await this.prisma.role.findFirst({
      where: dto.requestedRoleId
        ? { id: dto.requestedRoleId }
        : { slug: dto.requestedRoleSlug?.toLowerCase() },
    })

    if (!role || !role.isActive) {
      throw new NotFoundException('Requested active role not found')
    }

    if (role.slug === 'ceo') {
      throw new BadRequestException(
        'CEO role transitions must use POST /api/governance/transfer-ceo, not standard access requests.',
      )
    }

    // Cancel superseded pending requests on the same employee or block duplicates cleanly
    const existingPending = await this.prisma.accessChangeRequest.findFirst({
      where: {
        targetEmployeeId: dto.targetEmployeeId,
        requestedRoleId: role.id,
        status: 'PENDING',
      },
    })
    if (existingPending) {
      return this.prisma.accessChangeRequest.findUnique({
        where: { id: existingPending.id },
        include: {
          requester: { select: { id: true, name: true, email: true, title: true } },
          targetEmployee: { select: { id: true, name: true, email: true, title: true } },
          requestedRole: { select: { id: true, slug: true, name: true } },
        },
      })
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.accessChangeRequest.create({
        data: {
          requesterId: actor.id,
          targetEmployeeId: dto.targetEmployeeId,
          requestedRoleId: role.id,
          status: 'PENDING',
          reason: dto.reason?.trim() || null,
        },
        include: {
          requester: { select: { id: true, name: true, email: true, title: true } },
          targetEmployee: { select: { id: true, name: true, email: true, title: true } },
          requestedRole: { select: { id: true, slug: true, name: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actorEmployee.name,
          actorEmail: actorEmployee.email,
          actorRole: actor.role.toUpperCase(),
          action: 'ACCESS_CHANGE_REQUESTED',
          actionCode: 'MAKER_CHECKER_REQUEST_CREATED',
          severity: 'WARNING',
          entityType: 'user',
          entityId: dto.targetEmployeeId,
          entityTitle: targetEmployee.name,
          description: `${actorEmployee.name} requested role change to "${role.name}" for ${targetEmployee.name} — Pending CHRO/CEO approval`,
          category: 'governance',
          badgeColor: 'amber',
          payload: {
            requestId: request.id,
            requestedRoleSlug: role.slug,
            reason: dto.reason?.trim() || null,
          },
        },
      })

      return request
    })
  }

  async approveAccessRequest(
    requestId: string,
    dto: ReviewAccessRequestDto,
    actor: AuthenticatedUser,
  ) {
    const request = await this.prisma.accessChangeRequest.findUnique({
      where: { id: requestId },
      include: { requestedRole: true },
    })
    if (!request) {
      throw new NotFoundException(`Access change request "${requestId}" not found`)
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`)
    }

    assertNotSelfTarget(actor.id, request.targetEmployeeId, 'approve access change')

    if (request.requesterId === actor.id) {
      throw new ForbiddenException(
        'Maker-Checker violation: You cannot approve an access change request that you initiated.',
      )
    }

    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    if (!isEmployeeCeo(actorEmployee) && !isEmployeeChro(actorEmployee)) {
      throw new ForbiddenException('Only CHRO or CEO can approve role change requests')
    }

    const targetEmployee = await loadEmployeeWithSecurityContext(
      this.prisma,
      request.targetEmployeeId,
    )
    await assertHorizontalCLevelGuard(
      this.prisma,
      actor.id,
      targetEmployee,
      'approve access change',
    )

    if (request.requestedRole.slug === 'ceo') {
      throw new BadRequestException('CEO role requires CEO succession transfer protocol')
    }

    const approved = await this.prisma.$transaction(async (tx) => {
      const now = new Date()

      const updatedReq = await tx.accessChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedById: actor.id,
          reviewedAt: now,
          reviewNotes: dto?.reviewNotes?.trim() || null,
        },
        include: {
          requester: { select: { id: true, name: true, email: true, title: true } },
          targetEmployee: { select: { id: true, name: true, email: true, title: true } },
          requestedRole: { select: { id: true, slug: true, name: true } },
          approvedBy: { select: { id: true, name: true, email: true, title: true } },
        },
      })

      // If assigning a core organizational role, deactivate previous core roles first
      if (CORE_ROLE_SLUGS.has(request.requestedRole.slug)) {
        await tx.employeeRole.updateMany({
          where: {
            employeeId: request.targetEmployeeId,
            isActive: true,
            role: { slug: { in: Array.from(CORE_ROLE_SLUGS) } },
          },
          data: { isActive: false },
        })
      }

      await tx.employeeRole.upsert({
        where: {
          employeeId_roleId: {
            employeeId: request.targetEmployeeId,
            roleId: request.requestedRoleId,
          },
        },
        update: {
          isActive: true,
          assignedById: actor.id,
          assignedAt: now,
          expiresAt: null,
        },
        create: {
          employeeId: request.targetEmployeeId,
          roleId: request.requestedRoleId,
          assignedById: actor.id,
          isActive: true,
          expiresAt: null,
        },
      })

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actorEmployee.name,
          actorEmail: actorEmployee.email,
          actorRole: actor.role.toUpperCase(),
          action: 'ACCESS_CHANGE_APPROVED',
          actionCode: 'MAKER_CHECKER_REQUEST_APPROVED',
          severity: 'SUCCESS',
          entityType: 'user',
          entityId: request.targetEmployeeId,
          entityTitle: targetEmployee.name,
          description: `${actorEmployee.name} approved role change to "${request.requestedRole.name}" for ${targetEmployee.name}`,
          category: 'governance',
          badgeColor: 'emerald',
          payload: {
            requestId: request.id,
            requestedRoleSlug: request.requestedRole.slug,
            requesterId: request.requesterId,
            reviewNotes: dto?.reviewNotes?.trim() || null,
          },
        },
      })

      return updatedReq
    })

    await this.cache?.invalidateUser(request.targetEmployeeId)
    return approved
  }

  async rejectAccessRequest(
    requestId: string,
    dto: ReviewAccessRequestDto,
    actor: AuthenticatedUser,
  ) {
    const request = await this.prisma.accessChangeRequest.findUnique({
      where: { id: requestId },
      include: { requestedRole: true },
    })
    if (!request) {
      throw new NotFoundException(`Access change request "${requestId}" not found`)
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`)
    }

    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    if (!isEmployeeCeo(actorEmployee) && !isEmployeeChro(actorEmployee)) {
      throw new ForbiddenException('Only CHRO or CEO can reject role change requests')
    }

    const targetEmployee = await loadEmployeeWithSecurityContext(
      this.prisma,
      request.targetEmployeeId,
    )

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.accessChangeRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          approvedById: actor.id,
          reviewedAt: new Date(),
          reviewNotes: dto?.reviewNotes?.trim() || null,
        },
        include: {
          requester: { select: { id: true, name: true, email: true, title: true } },
          targetEmployee: { select: { id: true, name: true, email: true, title: true } },
          requestedRole: { select: { id: true, slug: true, name: true } },
          approvedBy: { select: { id: true, name: true, email: true, title: true } },
        },
      })

      await tx.auditLog.create({
        data: {
          ipAddress: getCurrentRequestIp(),
          actorId: actor.id,
          actorName: actorEmployee.name,
          actorEmail: actorEmployee.email,
          actorRole: actor.role.toUpperCase(),
          action: 'ACCESS_CHANGE_REJECTED',
          actionCode: 'MAKER_CHECKER_REQUEST_REJECTED',
          severity: 'WARNING',
          entityType: 'user',
          entityId: request.targetEmployeeId,
          entityTitle: targetEmployee.name,
          description: `${actorEmployee.name} rejected role change to "${request.requestedRole.name}" for ${targetEmployee.name}${dto?.reviewNotes?.trim() ? ` — Notes: ${dto.reviewNotes.trim()}` : ''}`,
          category: 'governance',
          badgeColor: 'rose',
        },
      })

      return updated
    })
  }
}
