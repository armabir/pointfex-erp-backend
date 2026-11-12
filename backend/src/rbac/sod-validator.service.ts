import { ForbiddenException, Injectable, Optional } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'

export type MoneyActionKind = 'BUDGET_ALLOCATION' | 'INTERNAL_LEDGER' | 'REAL_BANK_PAYMENT'

export const MONEY_KIND_ALLOWED_PERMISSIONS: Record<MoneyActionKind, readonly string[]> = {
  BUDGET_ALLOCATION: [
    'budgets:allocate_developer',
    'budgets:allocate_project',
    'budgets:approve_request',
  ],
  INTERNAL_LEDGER: ['wallets:adjust', 'transactions:reverse', 'finance:issue_adjustment'],
  REAL_BANK_PAYMENT: ['treasury:transfer', 'treasury:withdraw', 'payroll:release_payment'],
}

export interface SodCheckContext {
  actorId: string
  actionCode: string
  entityType: string
  entityId: string
  /** Optional known actor IDs mapped by action code (e.g. { 'tasks:submit_work': task.submitterId }) */
  priorActorsByAction?: Record<string, string | null | undefined>
}

@Injectable()
export class SodValidatorService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  async listRules() {
    return this.prisma.sodRule.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    })
  }

  /**
   * Hard Rule 8: Separate budget allocation, internal ledger/wallet transactions, and real bank payment.
   * One authority never implies another.
   */
  assertMoneyAuthorityMatch(kind: MoneyActionKind, permissionCode: string): void {
    const allowed = MONEY_KIND_ALLOWED_PERMISSIONS[kind]
    if (!allowed.includes(permissionCode)) {
      throw new ForbiddenException(
        `Money-authority isolation violation: "${permissionCode}" cannot authorize ${kind} (allowed: [${allowed.join(', ')}])`,
      )
    }
  }

  /**
   * Enforces all active SoD rules against known prior actors, approval requests/steps, and audit logs.
   */
  async assertNoSodConflict(context: SodCheckContext): Promise<void> {
    const matchingRules = await this.prisma.sodRule.findMany({
      where: {
        isActive: true,
        actionCodes: { has: context.actionCode },
      },
    })

    if (matchingRules.length === 0) return

    const conflictingCodes = new Set<string>()
    for (const rule of matchingRules) {
      for (const code of rule.actionCodes) {
        if (code !== context.actionCode) {
          conflictingCodes.add(code)
        }
      }
    }

    if (conflictingCodes.size === 0) return

    // 1. Check caller-provided prior actors for this resource
    for (const conflictCode of conflictingCodes) {
      const priorActor = context.priorActorsByAction?.[conflictCode]
      if (priorActor && priorActor === context.actorId) {
        await this.blockSodViolation(context, matchingRules[0].code, conflictCode)
      }
    }

    // 2. Check existing ApprovalRequest / ApprovalStep history on this entity
    const priorRequests = await this.prisma.approvalRequest.findMany({
      where: {
        entityType: context.entityType,
        entityId: context.entityId,
        actionCode: { in: Array.from(conflictingCodes) },
        status: { in: ['PENDING', 'IN_PROGRESS', 'APPROVED'] },
      },
      include: {
        steps: { where: { status: 'APPROVED' }, select: { approverId: true } },
      },
    })

    for (const req of priorRequests) {
      if (req.requesterId === context.actorId || req.steps.some((s) => s.approverId === context.actorId)) {
        await this.blockSodViolation(context, matchingRules[0].code, req.actionCode)
      }
    }

    // 3. Check append-only AuditLog trail on this entity for prior conflicting actionCode
    const priorAudits = await this.prisma.auditLog.findMany({
      where: {
        entityType: context.entityType,
        entityId: context.entityId,
        actorId: context.actorId,
        actionCode: { in: Array.from(conflictingCodes) },
      },
      take: 1,
    })

    if (priorAudits.length > 0) {
      await this.blockSodViolation(context, matchingRules[0].code, priorAudits[0].actionCode)
    }
  }

  private async blockSodViolation(
    context: SodCheckContext,
    ruleCode: string,
    conflictingAction: string,
  ): Promise<never> {
    if (this.auditLogger) {
      await this.auditLogger.log({
        actorId: context.actorId,
        actorName: context.actorId,
        actorEmail: '',
        actorRole: 'ACTOR',
        action: 'SOD_VIOLATION_BLOCKED',
        actionCode: ruleCode,
        severity: 'CRITICAL',
        entityType: context.entityType,
        entityId: context.entityId,
        description: `Blocked SoD violation (${ruleCode}): actor ${context.actorId} already performed conflicting action "${conflictingAction}" on ${context.entityType}:${context.entityId}, cannot execute "${context.actionCode}".`,
        category: 'security',
        badgeColor: 'rose',
      })
    }

    throw new ForbiddenException(
      `Separation of duties (${ruleCode}): Same person cannot perform both "${conflictingAction}" and "${context.actionCode}" on ${context.entityType} "${context.entityId}"`,
    )
  }
}

