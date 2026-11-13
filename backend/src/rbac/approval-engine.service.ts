import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { ApprovalMode, ApprovalStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { AuthorizationService } from './authorization.service'
import { SodValidatorService } from './sod-validator.service'

export interface StepDefinitionInput {
  stepOrder: number
  stepName: string
  requiredPermission: string
  conditionMinAmount?: number
  escalatedToPermission?: string
}

export interface CreateApprovalWorkflowInput {
  actionCode: string
  entityType: string
  entityId: string
  amount?: number
  reason?: string
  mode?: ApprovalMode
  payload?: Record<string, unknown>
  priorActorsByAction?: Record<string, string | null | undefined>
  steps?: StepDefinitionInput[]
}

@Injectable()
export class ApprovalEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly sodValidator: SodValidatorService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  async initiateWorkflow(actor: AuthenticatedUser, input: CreateApprovalWorkflowInput) {
    // Enforce SoD before even opening a workflow for conflicting prior steps on the same entity
    await this.sodValidator.assertNoSodConflict({
      actorId: actor.id,
      actionCode: input.actionCode,
      entityType: input.entityType,
      entityId: input.entityId,
      priorActorsByAction: input.priorActorsByAction,
    })

    const [permMeta, policy] = await Promise.all([
      this.prisma.permission.findUnique({ where: { code: input.actionCode } }),
      this.prisma.approvalPolicy.findFirst({
        where: { actionCode: input.actionCode, isActive: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const requiresDualApproval =
      Boolean(permMeta?.isCritical) || Boolean(policy?.requiresDualApproval)
    const mode: ApprovalMode = input.mode ?? policy?.mode ?? 'SEQUENTIAL'

    const rawSteps: StepDefinitionInput[] = input.steps?.length
      ? input.steps
      : Array.isArray(policy?.stepDefinitions)
        ? (policy!.stepDefinitions as unknown as StepDefinitionInput[])
        : [
            {
              stepOrder: 1,
              stepName: `Primary Sign-Off (${input.actionCode})`,
              requiredPermission: input.actionCode,
            },
          ]

    // Conditional step filtering based on amount threshold
    const filteredSteps = rawSteps.filter((step) => {
      if (step.conditionMinAmount === undefined || step.conditionMinAmount === null) return true
      return typeof input.amount === 'number' && input.amount >= step.conditionMinAmount
    })

    // Rule: ⚠ Critical permissions MUST require dual approval by two DIFFERENT people
    if (requiresDualApproval && filteredSteps.length < 2) {
      filteredSteps.push({
        stepOrder: filteredSteps.length + 1,
        stepName: `Dual Approval Ratification (${input.actionCode})`,
        requiredPermission: input.actionCode,
      })
    }

    const now = new Date()
    const dueHours = policy?.escalationAfterHours ?? 24
    const timeoutHours = policy?.timeoutHours ?? 72
    const dueAt = new Date(now.getTime() + dueHours * 3600_000)
    const expiresAt = new Date(now.getTime() + timeoutHours * 3600_000)

    const created = await this.prisma.approvalRequest.create({
      data: {
        policyId: policy?.id ?? null,
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        requesterId: actor.id,
        amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : null,
        status: 'PENDING',
        mode,
        requiresDualApproval,
        currentStep: 1,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        reason: input.reason?.trim() || null,
        expiresAt,
        steps: {
          create: filteredSteps.map((st, idx) => ({
            stepOrder: st.stepOrder ?? idx + 1,
            stepName: st.stepName,
            requiredPermission: st.requiredPermission,
            status: 'PENDING',
            escalatedToPermission: st.escalatedToPermission ?? null,
            dueAt,
          })),
        },
      },
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
        policy: true,
      },
    })

    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: actor.id,
        actorName: actor.name || actor.id,
        actorEmail: actor.email || '',
        actorRole: actor.role.toUpperCase(),
        action: 'APPROVAL_WORKFLOW_INITIATED',
        actionCode: input.actionCode,
        severity: requiresDualApproval ? 'WARNING' : 'INFO',
        entityType: input.entityType,
        entityId: input.entityId,
        description: `Initiated ${mode} approval (${filteredSteps.length} step(s), dual=${requiresDualApproval}) for ${input.actionCode} on ${input.entityType}:${input.entityId}`,
        category: 'governance',
        badgeColor: requiresDualApproval ? 'amber' : 'sky',
      })
    }

    return created
  }

  async actOnStep(
    requestId: string,
    actor: AuthenticatedUser,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
      },
    })
    if (!request) {
      throw new NotFoundException(`Approval request "${requestId}" not found`)
    }

    if (['APPROVED', 'REJECTED', 'TIMED_OUT', 'CANCELLED'].includes(request.status)) {
      throw new BadRequestException(`Approval request is already finalized (${request.status}).`)
    }

    const now = new Date()
    if (request.expiresAt && request.expiresAt <= now) {
      await this.prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'TIMED_OUT', completedAt: now },
      })
      throw new BadRequestException('Approval request has expired and can no longer be decided.')
    }

    // Hard Rule: Self-approval is blocked for everyone
    if (
      decision === 'APPROVED' &&
      (request.requesterId === actor.id ||
        (request.entityType === 'user' && request.entityId === actor.id))
    ) {
      throw new ForbiddenException(
        'Self-approval is blocked. An independent decision maker must approve this request.',
      )
    }

    // Dual approval invariant: Two DIFFERENT people must approve; same person cannot sign two steps
    if (
      decision === 'APPROVED' &&
      request.steps.some((s) => s.status === 'APPROVED' && s.approverId === actor.id)
    ) {
      throw new ForbiddenException(
        'Dual-approval violation: The same person cannot approve multiple steps on the same request.',
      )
    }

    const pendingSteps = request.steps.filter((s) => s.status === 'PENDING')
    if (pendingSteps.length === 0) {
      throw new BadRequestException('No pending approval steps remain')
    }

    // Choose target step: in SEQUENTIAL/CONDITIONAL take the lowest pending stepOrder;
    // in PARALLEL pick the first pending step the actor has permission for.
    let targetStep = pendingSteps[0]
    if (request.mode === 'PARALLEL') {
      let matched: (typeof pendingSteps)[number] | undefined
      for (const st of pendingSteps) {
        const permCheck = await this.authz.check(actor, st.requiredPermission)
        const escalatedCheck =
          !permCheck.allowed && request.status === 'ESCALATED' && st.escalatedToPermission
            ? await this.authz.check(actor, st.escalatedToPermission)
            : null
        if (permCheck.allowed || escalatedCheck?.allowed) {
          matched = st
          break
        }
      }
      if (!matched) {
        throw new ForbiddenException(
          'You lack the required permission for any pending parallel approval step',
        )
      }
      targetStep = matched
    } else {
      const hasPrimary = (await this.authz.check(actor, targetStep.requiredPermission)).allowed
      const hasEscalated =
        !hasPrimary && request.status === 'ESCALATED' && targetStep.escalatedToPermission
          ? (await this.authz.check(actor, targetStep.escalatedToPermission)).allowed
          : false
      if (!hasPrimary && !hasEscalated) {
        throw new ForbiddenException(
          `Step ${targetStep.stepOrder} requires "${targetStep.requiredPermission}" permission`,
        )
      }
    }

    if (decision === 'APPROVED') {
      await this.sodValidator.assertNoSodConflict({
        actorId: actor.id,
        actionCode: request.actionCode,
        entityType: request.entityType,
        entityId: request.entityId,
        priorActorsByAction: (request.payload as Record<string, any>)?.priorActorsByAction,
      })
    }

    const remainingAfter = pendingSteps.filter((s) => s.id !== targetStep.id)
    const nextRequestStatus: ApprovalStatus =
      decision === 'REJECTED'
        ? 'REJECTED'
        : remainingAfter.length === 0
          ? 'APPROVED'
          : 'IN_PROGRESS'

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: targetStep.id },
        data: {
          status: decision,
          approverId: actor.id,
          decisionNotes: notes?.trim() || null,
          decidedAt: now,
        },
      })

      if (decision === 'REJECTED' && remainingAfter.length > 0) {
        await tx.approvalStep.updateMany({
          where: { id: { in: remainingAfter.map((s) => s.id) } },
          data: { status: 'SKIPPED' },
        })
      }

      const savedReq = await tx.approvalRequest.update({
        where: { id: requestId },
        data: {
          status: nextRequestStatus,
          currentStep:
            remainingAfter.length > 0 ? remainingAfter[0].stepOrder : targetStep.stepOrder,
          completedAt:
            nextRequestStatus === 'APPROVED' || nextRequestStatus === 'REJECTED' ? now : null,
        },
        include: {
          requester: { select: { id: true, name: true, email: true, title: true } },
          steps: {
            include: { approver: { select: { id: true, name: true, email: true, title: true } } },
            orderBy: { stepOrder: 'asc' },
          },
          policy: true,
        },
      })

      if (this.auditLogger) {
        await this.auditLogger.log(
          {
            actorId: actor.id,
            actorName: actor.name || actor.id,
            actorEmail: actor.email || '',
            actorRole: actor.role.toUpperCase(),
            action: decision === 'APPROVED' ? 'APPROVAL_STEP_APPROVED' : 'APPROVAL_STEP_REJECTED',
            actionCode: request.actionCode,
            severity: nextRequestStatus === 'REJECTED' ? 'WARNING' : 'SUCCESS',
            entityType: request.entityType,
            entityId: request.entityId,
            description: `${actor.id} ${decision.toLowerCase()} step ${targetStep.stepOrder} (${targetStep.stepName}) on ${request.actionCode} -> status=${nextRequestStatus}`,
            category: 'governance',
            badgeColor: nextRequestStatus === 'APPROVED' ? 'emerald' : 'amber',
          },
          tx,
        )
      }

      return savedReq
    })

    return updated
  }

  async processEscalationsAndTimeouts(now: Date = new Date()) {
    const expired = await this.prisma.approvalRequest.updateMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS', 'ESCALATED'] },
        expiresAt: { lte: now },
      },
      data: { status: 'TIMED_OUT', completedAt: now },
    })

    const overdueSteps = await this.prisma.approvalStep.findMany({
      where: {
        status: 'PENDING',
        dueAt: { lte: now },
        request: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      },
      select: { requestId: true },
    })

    const escalateIds = Array.from(new Set(overdueSteps.map((s) => s.requestId)))
    if (escalateIds.length > 0) {
      await this.prisma.approvalRequest.updateMany({
        where: { id: { in: escalateIds } },
        data: { status: 'ESCALATED', escalatedAt: now },
      })
    }

    return {
      timedOutCount: expired.count,
      escalatedCount: escalateIds.length,
    }
  }

  async listInboxForUser(actorId: string) {
    await this.processEscalationsAndTimeouts()
    const pendingRequests = await this.prisma.approvalRequest.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS', 'ESCALATED'] },
        requesterId: { not: actorId },
      },
      include: {
        requester: { select: { id: true, name: true, email: true, title: true } },
        steps: { orderBy: { stepOrder: 'asc' } },
        policy: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const eligible: typeof pendingRequests = []
    for (const req of pendingRequests) {
      if (req.steps.some((s) => s.status === 'APPROVED' && s.approverId === actorId)) {
        continue
      }
      const actionableSteps =
        req.mode === 'PARALLEL'
          ? req.steps.filter((s) => s.status === 'PENDING')
          : req.steps.filter((s) => s.status === 'PENDING').slice(0, 1)

      let canAct = false
      for (const st of actionableSteps) {
        if ((await this.authz.check(actorId, st.requiredPermission)).allowed) {
          canAct = true
          break
        }
        if (req.status === 'ESCALATED' && st.escalatedToPermission) {
          if ((await this.authz.check(actorId, st.escalatedToPermission)).allowed) {
            canAct = true
            break
          }
        }
      }
      if (canAct) eligible.push(req)
    }

    return eligible
  }

  async listForRequester(employeeId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { requesterId: employeeId },
      include: {
        steps: {
          include: { approver: { select: { id: true, name: true, title: true } } },
          orderBy: { stepOrder: 'asc' },
        },
        policy: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}

