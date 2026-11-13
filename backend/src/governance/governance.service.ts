import { getCurrentRequestIp } from '../common/ip-address.util'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { PermissionCacheService } from '../rbac/permission-cache.service'
import { AuthorizationService } from '../rbac/authorization.service'
import { getEmployeeEffectiveTier, isStrictlyLowerTier, RoleTier } from '../common/tier.util'
import { VoteEngineService } from './vote-engine.service'
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
export class GovernanceService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    @Optional() private cache?: PermissionCacheService,
    @Optional() private readonly authz?: AuthorizationService,
    @Optional() private readonly voteEngine?: VoteEngineService,
  ) {}

  async onModuleInit() {
    await this.cancelSupersededCeoRequests()
  }

  async cancelSupersededCeoRequests() {
    try {
      const rootRoles = await this.prisma.role.findMany({
        where: { OR: [{ isRootRole: true }, { slug: 'ceo' }] },
        select: { id: true },
      })
      const rootRoleIds = rootRoles.map((r) => r.id)

      const rootAssignments = await this.prisma.userRoleAssignment.findMany({
        where: { roleId: { in: rootRoleIds }, isActive: true },
        select: { employeeId: true },
      })
      const ceoEmployeeIds = new Set(rootAssignments.map((a) => a.employeeId))

      const ceoPos = await this.prisma.positionAssignment.findFirst({
        where: { positionId: 'pos_ceo', isActive: true },
        select: { employeeId: true },
      })
      if (ceoPos) ceoEmployeeIds.add(ceoPos.employeeId)

      if (process.env.CEO_EMAIL) {
        const ceoByEmail = await this.prisma.employee.findUnique({
          where: { email: process.env.CEO_EMAIL.trim().toLowerCase() },
          select: { id: true },
        })
        if (ceoByEmail) ceoEmployeeIds.add(ceoByEmail.id)
      }

      const pendingCeoRequests = await this.prisma.accessChangeRequest.findMany({
        where: {
          status: 'PENDING',
          requesterId: { in: Array.from(ceoEmployeeIds) },
        },
        include: {
          requestedRole: true,
          targetEmployee: true,
          requester: true,
        },
      })

      for (const req of pendingCeoRequests) {
        await this.prisma.accessChangeRequest.update({
          where: { id: req.id },
          data: {
            status: 'REJECTED',
            reviewNotes: 'cancelled: superseded by direct CEO action',
            reviewedAt: new Date(),
          },
        })

        await this.prisma.auditLog.create({
          data: {
            actorId: req.requesterId,
            actorName: req.requester?.name || 'Chief Executive Officer',
            actorEmail: req.requester?.email || 'ceo@pointfex.com',
            actorRole: 'CEO',
            action: 'ACCESS_REQUEST_CANCELLED',
            actionCode: 'SUPERSEDED_BY_DIRECT_CEO_ACTION',
            severity: 'INFO',
            entityType: 'user',
            entityId: req.targetEmployeeId,
            entityTitle: req.targetEmployee?.name || 'Employee',
            description: `Pending request for "${req.requestedRole?.name}" for ${req.targetEmployee?.name} marked "cancelled: superseded by direct CEO action".`,
            category: 'governance',
            badgeColor: 'gray',
            payload: {
              requestId: req.id,
              requestedRoleSlug: req.requestedRole?.slug,
              reason: 'cancelled: superseded by direct CEO action',
            },
          },
        })
      }
    } catch {
      // ignore startup errors on unmigrated db
    }
  }

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
    let canTransferCeo = false
    if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
      canTransferCeo = (await this.authz.check(actor, 'governance:transfer_ceo')).allowed
    } else {
      canTransferCeo = isEmployeeCeo(actorEmployee)
    }
    if (!canTransferCeo) {
      throw new ForbiddenException(
        'Only the current verified system:root CEO holder can initiate CEO succession transfer',
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

      // 2. Grant CEO EmployeeRole + GLOBAL UserRoleAssignment to successor
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

      await tx.userRoleAssignment.updateMany({
        where: { employeeId: actor.id, roleId: ceoRole.id, isActive: true },
        data: { isActive: false, revokedAt: new Date(), revokedById: actor.id },
      })
      await tx.userRoleAssignment.create({
        data: {
          employeeId: actor.id,
          roleId: fallbackRole.id,
          scope: 'SELF',
          scopeIds: [],
          assignedById: actor.id,
          reason: 'Outgoing CEO fallback after succession transfer',
          isActive: true,
        },
      })
      await tx.userRoleAssignment.create({
        data: {
          employeeId: successor.id,
          roleId: ceoRole.id,
          scope: 'GLOBAL',
          scopeIds: [],
          assignedById: actor.id,
          reason: dto.reason?.trim() || 'CEO succession transfer',
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

  async listAccessRequests(status?: string, targetEmployeeId?: string, actor?: AuthenticatedUser) {
    const where: Prisma.AccessChangeRequestWhereInput = {}
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      where.status = status.toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED'
    }
    if (targetEmployeeId) {
      where.targetEmployeeId = targetEmployeeId
    }

    if (actor) {
      const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
      const isCeo = isEmployeeCeo(actorEmployee) || (actor.roles?.includes('system:root') ?? false)
      if (isCeo) {
        // CEO sees all pending requests, EXCLUDING any where CEO was the requester
        where.requesterId = { not: actor.id }
      } else {
        const actorTier = await getEmployeeEffectiveTier(this.prisma, actor.id)
        if (actorTier === RoleTier.EXECUTIVE) {
          // Executive sees only requests they initiated
          where.requesterId = actor.id
        } else {
          return []
        }
      }
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
    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    const isCeo = isEmployeeCeo(actorEmployee) || (actor.roles?.includes('system:root') ?? false)
    const actorTier = isCeo ? RoleTier.CEO : await getEmployeeEffectiveTier(this.prisma, actor.id)
    const targetTier = await getEmployeeEffectiveTier(this.prisma, dto.targetEmployeeId)

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

    if (role.slug === 'ceo' || role.isRootRole) {
      throw new BadRequestException(
        'CEO role transitions must use POST /api/governance/transfer-ceo, not standard access requests.',
      )
    }

    // 1. CEO direct power: apply immediately with NO approval request created
    if (isCeo) {
      const now = new Date()
      await this.prisma.$transaction(async (tx) => {
        await tx.employeeRole.upsert({
          where: { employeeId_roleId: { employeeId: dto.targetEmployeeId, roleId: role.id } },
          update: { isActive: true, assignedById: actor.id, assignedAt: now },
          create: { employeeId: dto.targetEmployeeId, roleId: role.id, assignedById: actor.id, isActive: true },
        })

        await tx.userRoleAssignment.create({
          data: {
            employeeId: dto.targetEmployeeId,
            roleId: role.id,
            scope: 'ORG',
            assignedById: actor.id,
            reason: dto.reason?.trim() || 'Direct CEO assignment',
            isActive: true,
          },
        })

        await tx.employeeChangeHistory.create({
          data: {
            employeeId: dto.targetEmployeeId,
            actorId: actor.id,
            actionKey: 'users:assign_role',
            changeType: 'ROLE',
            afterState: { roleId: role.id, roleSlug: role.slug, roleName: role.name },
            reason: dto.reason?.trim() || 'Direct CEO assignment',
          },
        })

        await tx.auditLog.create({
          data: {
            ipAddress: getCurrentRequestIp(),
            actorId: actor.id,
            actorName: actorEmployee.name,
            actorEmail: actorEmployee.email,
            actorRole: 'CEO',
            action: 'ROLE_ASSIGNED_DIRECT_CEO',
            actionCode: 'CEO_DIRECT_APPLY',
            severity: 'INFO',
            entityType: 'user',
            entityId: dto.targetEmployeeId,
            entityTitle: targetEmployee.name,
            description: `CEO assigned role "${role.name}" to ${targetEmployee.name} — takes effect immediately.`,
            category: 'governance',
            badgeColor: 'emerald',
            outcome: 'APPLIED_IMMEDIATELY',
            mfaVerified: true,
          },
        })
      })

      await this.cache?.invalidateUsers([dto.targetEmployeeId])
      return {
        id: `direct_${Date.now()}`,
        status: 'APPROVED',
        immediate: true,
        message: 'This takes effect immediately.',
        targetEmployee,
        requestedRole: role,
      }
    }

    // 2. Executive restrictions:
    if (actorTier === RoleTier.EXECUTIVE) {
      if (
        targetTier === RoleTier.EXECUTIVE ||
        targetTier === RoleTier.CEO ||
        dto.targetEmployeeId === actor.id
      ) {
        throw new ForbiddenException(
          'Executives cannot change or request changes for Executive or CEO users, or for themselves.',
        )
      }
      // Executives can only request for MANAGER and STAFF
    } else {
      throw new ForbiddenException('You do not have permission to request role changes.')
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
          description: `${actorEmployee.name} requested role change to "${role.name}" for ${targetEmployee.name} — Pending CEO approval`,
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
      include: { requestedRole: true, targetEmployee: true, requester: true },
    })
    if (!request) {
      throw new NotFoundException(`Access change request "${requestId}" not found`)
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Request is already ${request.status}`)
    }

    if (request.requesterId === actor.id || request.targetEmployeeId === actor.id) {
      throw new ForbiddenException('Self-approval is blocked for everyone.')
    }

    if (request.requesterId === actor.id || request.targetEmployeeId === actor.id) {
      throw new ForbiddenException('Self-approval is blocked for everyone.')
    }

    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    const isCeo = isEmployeeCeo(actorEmployee) || (actor.roles?.includes('system:root') ?? false)
    const actorTier = isCeo ? RoleTier.CEO : await getEmployeeEffectiveTier(this.prisma, actor.id)
    const targetTier = await getEmployeeEffectiveTier(this.prisma, request.targetEmployeeId)

    if (!isCeo && !isStrictlyLowerTier(actorTier, targetTier)) {
      throw new ForbiddenException(
        'Tier ceiling violation: You can only act on employees in a strictly lower tier.',
      )
    }

    const canApprove =
      isCeo || (await this.authz?.check(actor, 'governance:approve_request'))?.allowed
    if (!canApprove) {
      throw new ForbiddenException(
        'Requires governance:approve_request authority to approve role change requests',
      )
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
        await tx.userRoleAssignment.updateMany({
          where: {
            employeeId: request.targetEmployeeId,
            isActive: true,
            role: { slug: { in: Array.from(CORE_ROLE_SLUGS) } },
          },
          data: { isActive: false, revokedAt: now, revokedById: actor.id },
        })
      }

      await tx.userRoleAssignment.create({
        data: {
          employeeId: request.targetEmployeeId,
          roleId: request.requestedRoleId,
          scope: 'ORG',
          scopeIds: [],
          assignedById: actor.id,
          reason: `Maker-Checker approved access request (${request.id})`,
          isActive: true,
        },
      })

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

    if (this.authz) {
      await this.authz.invalidateUserCache(request.targetEmployeeId)
    } else {
      await this.cache?.invalidateUser(request.targetEmployeeId)
    }
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

    if (request.requesterId === actor.id || request.targetEmployeeId === actor.id) {
      throw new ForbiddenException('Self-approval is blocked for everyone.')
    }

    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    let canReject = false
    if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
      canReject = (await this.authz.check(actor, 'governance:approve_request')).allowed
    } else {
      canReject = isEmployeeCeo(actorEmployee) || isEmployeeChro(actorEmployee)
    }
    if (!canReject) {
      throw new ForbiddenException(
        'Requires governance:approve_request authority to reject role change requests',
      )
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

  // --------------------------------------------------------------------------
  // Phase 7: Decision Policies, Votes, Proposals & Project Requests
  // --------------------------------------------------------------------------

  async listDecisionPolicies() {
    const policies = await this.prisma.decisionPolicy.findMany({
      orderBy: { requestType: 'asc' },
    })

    const defaults = [
      { requestType: 'role_change', mode: 'CEO_ONLY', description: 'Changes to manager and staff roles/access' },
      { requestType: 'project_request', mode: 'EXECUTIVE_VOTE', description: 'New project creation and initial budget approval' },
      { requestType: 'budget_increase', mode: 'EXECUTIVE_VOTE', description: 'Additional project budget allocation' },
      { requestType: 'proposal', mode: 'CEO_ONLY', description: 'Developer proposals and suggestions forwarded to governance' },
    ]

    const existingMap = new Map(policies.map((p) => [p.requestType, p]))
    return defaults.map((d) => existingMap.get(d.requestType) || d)
  }

  async updateDecisionPolicy(
    requestType: string,
    mode: 'CEO_ONLY' | 'EXECUTIVE_VOTE',
    actor: AuthenticatedUser,
  ) {
    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    if (!isEmployeeCeo(actorEmployee)) {
      throw new ForbiddenException('Only the Chief Executive Officer may edit decision policies.')
    }

    const updated = await this.prisma.decisionPolicy.upsert({
      where: { requestType },
      update: { mode, updatedById: actor.id },
      create: { requestType, mode, updatedById: actor.id },
    })

    return updated
  }

  async createProjectCreationRequest(dto: any, actor: AuthenticatedUser) {
    const actorEmployee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    const isCeo = isEmployeeCeo(actorEmployee)

    const initialBudget = Number(dto.initialBudgetBDT) || 0
    if (initialBudget <= 0) {
      throw new BadRequestException('Initial budget in BDT must be greater than zero.')
    }
    if (!dto.title?.trim() || !dto.scopeDeliverables?.trim()) {
      throw new BadRequestException('Project title and scope/deliverables are required.')
    }

    const policies = await this.listDecisionPolicies()
    const projectPolicy = policies.find((p) => p.requestType === 'project_request')
    const mode = (projectPolicy?.mode || 'EXECUTIVE_VOTE') as 'CEO_ONLY' | 'EXECUTIVE_VOTE'

    const deadlineDays = Number(process.env.VOTE_DEADLINE_DAYS) || 7
    const voteDeadline = new Date(Date.now() + deadlineDays * 86400000)

    if (isCeo) {
      // CEO direct power: takes effect immediately with NO request created
      const project = await this.prisma.project.create({
        data: {
          id: `proj_${Date.now()}`,
          name: dto.title.trim(),
          code: dto.code?.trim() || `PRJ-${Date.now().toString(36).toUpperCase()}`,
          description: dto.scopeDeliverables.trim(),
          budget: new Prisma.Decimal(initialBudget),
          allocatedBudget: 0,
          status: 'planning',
          health: 'on_track',
          startDate: new Date(),
          deadline: new Date(Date.now() + 60 * 86400000),
          priority: 'High Priority',
          tags: ['direct_ceo_created'],
        },
      })

      return {
        id: `direct_${Date.now()}`,
        status: 'APPROVED',
        immediate: true,
        message: 'This takes effect immediately. Project created in Planning.',
        approvedProjectId: project.id,
        project,
      }
    }

    const created = await this.prisma.projectCreationRequest.create({
      data: {
        title: dto.title.trim(),
        code: dto.code?.trim() || null,
        requesterId: actor.id,
        proposedPmId: dto.proposedPmId || null,
        scopeDeliverables: dto.scopeDeliverables.trim(),
        timeline: dto.timeline?.trim() || '4-8 weeks',
        teamDetails: dto.teamDetails || {},
        initialBudgetBDT: new Prisma.Decimal(initialBudget),
        risks: dto.risks?.trim() || 'Standard operational risks',
        successCriteria: dto.successCriteria?.trim() || 'On-time delivery within approved initial budget',
        justification: dto.justification?.trim() || 'Strategic growth and client commitments',
        creditedDeveloperId: dto.creditedDeveloperId || null,
        proposalId: dto.proposalId || null,
        status: mode === 'EXECUTIVE_VOTE' ? 'IN_VOTE' : 'SUBMITTED',
        decisionMode: mode,
        voteDeadline: mode === 'EXECUTIVE_VOTE' ? voteDeadline : null,
      },
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
    })

    return created
  }

  async listProjectCreationRequests(status?: string, actor?: AuthenticatedUser) {
    const where: Prisma.ProjectCreationRequestWhereInput = {}
    if (status && status !== 'all') {
      where.status = status.toUpperCase() as any
    }

    const requests = await this.prisma.projectCreationRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!this.voteEngine) return requests

    // Enrich with vote tallies
    const enriched = await Promise.all(
      requests.map(async (r) => {
        const tally = await this.voteEngine!.getTally(r.id, r.requesterId, r.status, r.voteDeadline)
        return {
          ...r,
          tally,
        }
      }),
    )

    return enriched
  }

  async getProjectCreationRequest(id: string) {
    const req = await this.prisma.projectCreationRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
    })
    if (!req) throw new NotFoundException(`Project request "${id}" not found.`)

    const tally = this.voteEngine
      ? await this.voteEngine.getTally(req.id, req.requesterId, req.status, req.voteDeadline)
      : null

    return { ...req, tally }
  }

  async createProjectProposal(dto: any, actor: AuthenticatedUser) {
    if (!dto.title?.trim() || !dto.description?.trim()) {
      throw new BadRequestException('Proposal title and description are required.')
    }

    return this.prisma.projectProposal.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        requesterId: actor.id,
        suggestedPmId: dto.suggestedPmId || null,
        type: dto.type || 'PROPOSAL',
        status: 'PENDING',
      },
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
    })
  }

  async listProjectProposals(actor: AuthenticatedUser) {
    const actorTier = await getEmployeeEffectiveTier(this.prisma, actor.id)
    const isCeo = actorTier === RoleTier.CEO

    const where: Prisma.ProjectProposalWhereInput = {}
    if (!isCeo && actorTier === RoleTier.STAFF) {
      where.requesterId = actor.id
    } else if (actorTier === RoleTier.MANAGER) {
      where.OR = [
        { requesterId: actor.id },
        { suggestedPmId: actor.id },
        { suggestedPmId: null },
      ]
    }

    return this.prisma.projectProposal.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async forwardProjectProposal(id: string, actor: AuthenticatedUser, dto?: any) {
    const proposal = await this.prisma.projectProposal.findUnique({
      where: { id },
      include: { requester: true },
    })
    if (!proposal) throw new NotFoundException('Proposal not found.')
    if (proposal.status !== 'PENDING') {
      throw new BadRequestException(`Proposal is already ${proposal.status}.`)
    }

    const initialBudget = Number(dto?.initialBudgetBDT) || 500000 // default 5 Lakh BDT
    const deadlineDays = Number(process.env.VOTE_DEADLINE_DAYS) || 7
    const voteDeadline = new Date(Date.now() + deadlineDays * 86400000)

    return this.prisma.$transaction(async (tx) => {
      const projectReq = await tx.projectCreationRequest.create({
        data: {
          title: dto?.title?.trim() || proposal.title,
          requesterId: actor.id,
          proposedPmId: actor.id,
          scopeDeliverables: dto?.scopeDeliverables?.trim() || proposal.description,
          timeline: dto?.timeline || '6-8 weeks',
          initialBudgetBDT: new Prisma.Decimal(initialBudget),
          risks: dto?.risks || 'Standard delivery and squad resource risks',
          successCriteria: dto?.successCriteria || 'Deliver on-spec within approved initial budget',
          justification: `Forwarded by PM from Developer proposal by ${proposal.requester.name}`,
          creditedDeveloperId: proposal.requesterId,
          proposalId: proposal.id,
          status: 'IN_VOTE',
          decisionMode: 'EXECUTIVE_VOTE',
          voteDeadline,
        },
      })

      const updated = await tx.projectProposal.update({
        where: { id },
        data: {
          status: 'FORWARDED',
          forwardedRequestId: projectReq.id,
          comments: dto?.comments?.trim() || `Approved & forwarded by PM ${actor.name || actor.id}`,
        },
      })

      return { proposal: updated, projectRequest: projectReq }
    })
  }

  async returnProjectProposal(id: string, actor: AuthenticatedUser, comments: string) {
    const proposal = await this.prisma.projectProposal.findUnique({ where: { id } })
    if (!proposal) throw new NotFoundException('Proposal not found.')
    return this.prisma.projectProposal.update({
      where: { id },
      data: {
        status: 'RETURNED',
        comments: comments?.trim() || 'Returned with PM feedback.',
      },
    })
  }

  async declineProjectProposal(id: string, actor: AuthenticatedUser, reason: string) {
    const proposal = await this.prisma.projectProposal.findUnique({ where: { id } })
    if (!proposal) throw new NotFoundException('Proposal not found.')
    return this.prisma.projectProposal.update({
      where: { id },
      data: {
        status: 'DECLINED',
        comments: reason?.trim() || 'Declined by Project Manager.',
      },
    })
  }

  async listMyRequests(actor: AuthenticatedUser) {
    const [access, projects, budgets, proposals] = await Promise.all([
      this.prisma.accessChangeRequest.findMany({
        where: { requesterId: actor.id },
        include: {
          targetEmployee: { select: { id: true, name: true } },
          requestedRole: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.projectCreationRequest.findMany({
        where: { requesterId: actor.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.budgetRequest.findMany({
        where: { requesterId: actor.id },
        include: { project: { select: { id: true, name: true, code: true } } },
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.projectProposal.findMany({
        where: { requesterId: actor.id },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const items: any[] = []

    for (const a of access) {
      items.push({
        id: a.id,
        category: 'ACCESS',
        title: `Role change: ${a.requestedRole?.name || 'Role'}`,
        subtitle: `For ${a.targetEmployee?.name || a.targetEmployeeId}`,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.reviewedAt || a.createdAt,
        details: a.reason,
        reviewNotes: a.reviewNotes,
      })
    }

    for (const p of projects) {
      items.push({
        id: p.id,
        category: 'PROJECT',
        title: `Project: ${p.title}`,
        subtitle: `Initial Budget: ৳${p.initialBudgetBDT} BDT`,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.decidedAt || p.updatedAt,
        details: p.scopeDeliverables,
        reviewNotes: p.decisionReason,
        voteDeadline: p.voteDeadline,
      })
    }

    for (const b of budgets) {
      items.push({
        id: b.id,
        category: 'BUDGET',
        title: `Budget Increase: ${b.project?.name || 'Project'}`,
        subtitle: `Requested: ৳${b.requestedAmount} BDT`,
        status: b.status.toUpperCase(),
        createdAt: b.requestedAt,
        updatedAt: b.reviewedAt || b.requestedAt,
        details: b.reason,
        reviewNotes: b.feedback,
      })
    }

    for (const prop of proposals) {
      items.push({
        id: prop.id,
        category: 'PROPOSAL',
        title: `Idea: ${prop.title}`,
        subtitle: prop.type,
        status: prop.status,
        createdAt: prop.createdAt,
        updatedAt: prop.updatedAt,
        details: prop.description,
        reviewNotes: prop.comments,
      })
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return items
  }
}
