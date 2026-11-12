import * as crypto from 'crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../common/prisma.service'
import { generateTotpCode } from '../common/security-policy.util'
import {
  getSensitiveActionEntry,
  resolveSensitiveActionForPermission,
} from './sensitive-actions'

const LOCKOUT_MAX_FAILURES = 5
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000
const PROFILE_TOKEN_TTL_MS = 5 * 60 * 1000

export interface FreshMfaVerifyContext {
  actorId: string
  actionKey: string
  targetId: string
  code?: string
  boundActionHeader?: string
  boundTargetHeader?: string
  reason?: string
  ipAddress?: string
  device?: string
}

@Injectable()
export class FreshMfaService {
  constructor(private readonly prisma: PrismaService) {}

  verifyTotpWithStep(secretHex: string, submittedCode: string): {
    valid: boolean
    matchedStep: number | null
  } {
    const normalized = submittedCode.trim()
    if (!/^\d{6}$/.test(normalized)) {
      return { valid: false, matchedStep: null }
    }
    const baseStep = Math.floor(Date.now() / 1000 / 30)
    for (const offset of [-1, 0, 1]) {
      if (generateTotpCode(secretHex, offset) === normalized) {
        return { valid: true, matchedStep: baseStep + offset }
      }
    }
    return { valid: false, matchedStep: null }
  }

  async verifyFreshMfa(ctx: FreshMfaVerifyContext): Promise<{
    actionKey: string
    targetId: string
    timeStep: number
  }> {
    const entry =
      getSensitiveActionEntry(ctx.actionKey) ||
      resolveSensitiveActionForPermission(ctx.actionKey, true)!

    const actor = await this.prisma.employee.findUnique({
      where: { id: ctx.actorId },
      select: {
        id: true,
        name: true,
        email: true,
        isSuspended: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaLastUsedStep: true,
        mfaFailureCount: true,
        mfaFailureWindowStart: true,
        mfaLockedUntil: true,
        mfaRecoveryCodes: true,
      },
    })

    if (!actor || actor.isSuspended) {
      throw new ForbiddenException('Account is inactive or suspended.')
    }

    if (!actor.mfaEnabled || !actor.mfaSecret) {
      throw new ForbiddenException({
        code: 'MFA_ENROLLMENT_REQUIRED',
        actionKey: ctx.actionKey,
        message: 'Enable MFA to do this sensitive action.',
      })
    }

    const now = new Date()
    if (actor.mfaLockedUntil && actor.mfaLockedUntil > now) {
      await this.auditMfaOutcome({
        actor,
        actionKey: ctx.actionKey,
        targetId: ctx.targetId,
        reason: ctx.reason,
        ipAddress: ctx.ipAddress,
        device: ctx.device,
        outcome: 'LOCKED',
        mfaVerified: false,
      })
      throw new ForbiddenException({
        code: 'MFA_LOCKED',
        lockedUntil: actor.mfaLockedUntil.toISOString(),
        message:
          'Sensitive actions are temporarily locked for 15 minutes after 5 failed MFA attempts.',
      })
    }

    // Enforce action + target binding if client passed explicit binding headers
    if (ctx.boundActionHeader && ctx.boundActionHeader !== ctx.actionKey) {
      throw new ForbiddenException(
        `MFA code binding mismatch: expected "${ctx.actionKey}", received "${ctx.boundActionHeader}".`,
      )
    }
    if (ctx.boundTargetHeader && ctx.boundTargetHeader !== ctx.targetId) {
      throw new ForbiddenException(
        `MFA code target mismatch: code is bound to "${ctx.boundTargetHeader}", not "${ctx.targetId}".`,
      )
    }

    const rawCode = (ctx.code || '').trim()
    if (!rawCode) {
      throw new ForbiddenException({
        code: 'MFA_CODE_REQUIRED',
        actionKey: ctx.actionKey,
        targetId: ctx.targetId,
        message: 'A fresh 6-digit authenticator code (X-MFA-Code) is required for this action.',
      })
    }

    // Explicitly reject recovery codes for sensitive actions (login-only)
    if (!/^\d{6}$/.test(rawCode)) {
      for (const hashed of actor.mfaRecoveryCodes || []) {
        if (await bcrypt.compare(rawCode, hashed).catch(() => false)) {
          throw new ForbiddenException({
            code: 'RECOVERY_CODE_NOT_ALLOWED',
            message:
              'Recovery codes can only be used to sign in. Enter a 6-digit authenticator code.',
          })
        }
      }
      await this.recordFailedAttempt(actor, ctx)
    }

    const { valid, matchedStep } = this.verifyTotpWithStep(actor.mfaSecret, rawCode)
    if (!valid || matchedStep === null) {
      await this.recordFailedAttempt(actor, ctx)
    }

    // Single-use replay protection: reject same or earlier time-step for this user
    if (actor.mfaLastUsedStep !== null && matchedStep! <= actor.mfaLastUsedStep) {
      await this.auditMfaOutcome({
        actor,
        actionKey: ctx.actionKey,
        targetId: ctx.targetId,
        reason: ctx.reason,
        ipAddress: ctx.ipAddress,
        device: ctx.device,
        outcome: 'REPLAY_REJECTED',
        mfaVerified: false,
      })
      throw new ForbiddenException({
        code: 'MFA_CODE_REPLAYED',
        message:
          'This authenticator code was already used. Wait for the next 30-second code and try again.',
      })
    }

    const existingBinding = await this.prisma.mfaActionBinding.findUnique({
      where: {
        actorId_timeStep: {
          actorId: actor.id,
          timeStep: matchedStep!,
        },
      },
    })
    if (existingBinding) {
      throw new ForbiddenException({
        code: 'MFA_CODE_REPLAYED',
        message:
          'This authenticator code was already bound to another action. Wait for the next code.',
      })
    }

    // Enforce written reason (min 10 chars) when required by registry
    if (entry.requiresReason) {
      const reasonText = (ctx.reason || '').trim()
      if (reasonText.length < 10) {
        throw new BadRequestException(
          `A written reason (minimum 10 characters) is required for "${entry.actionKey}".`,
        )
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: actor.id },
        data: {
          mfaLastUsedStep: matchedStep!,
          mfaFailureCount: 0,
          mfaFailureWindowStart: null,
          mfaLockedUntil: null,
        },
      })
      await tx.mfaActionBinding.create({
        data: {
          actorId: actor.id,
          timeStep: matchedStep!,
          actionKey: ctx.actionKey,
          targetId: ctx.targetId,
        },
      })
    })

    await this.auditMfaOutcome({
      actor,
      actionKey: ctx.actionKey,
      targetId: ctx.targetId,
      reason: ctx.reason,
      ipAddress: ctx.ipAddress,
      device: ctx.device,
      outcome: 'SUCCESS',
      mfaVerified: true,
    })

    return {
      actionKey: ctx.actionKey,
      targetId: ctx.targetId,
      timeStep: matchedStep!,
    }
  }

  private async recordFailedAttempt(
    actor: {
      id: string
      name: string
      email: string
      mfaFailureCount: number
      mfaFailureWindowStart: Date | null
    },
    ctx: FreshMfaVerifyContext,
  ): Promise<never> {
    const now = new Date()
    const windowValid =
      actor.mfaFailureWindowStart &&
      now.getTime() - actor.mfaFailureWindowStart.getTime() <= LOCKOUT_WINDOW_MS
    const nextCount = (windowValid ? actor.mfaFailureCount : 0) + 1
    const windowStart = windowValid ? actor.mfaFailureWindowStart! : now
    const shouldLock = nextCount >= LOCKOUT_MAX_FAILURES
    const lockedUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_WINDOW_MS) : null

    await this.prisma.employee.update({
      where: { id: actor.id },
      data: {
        mfaFailureCount: nextCount,
        mfaFailureWindowStart: windowStart,
        ...(lockedUntil ? { mfaLockedUntil: lockedUntil } : {}),
      },
    })

    await this.auditMfaOutcome({
      actor,
      actionKey: ctx.actionKey,
      targetId: ctx.targetId,
      reason: ctx.reason,
      ipAddress: ctx.ipAddress,
      device: ctx.device,
      outcome: shouldLock ? 'LOCKED' : 'INVALID_CODE',
      mfaVerified: false,
    })

    if (shouldLock) {
      await this.notifyAdminsOfMfaLockout(actor, ctx.actionKey)
      throw new ForbiddenException({
        code: 'MFA_LOCKED',
        attemptsRemaining: 0,
        lockedUntil: lockedUntil!.toISOString(),
        message:
          'Too many failed MFA attempts (5 in 15 minutes). Sensitive actions are locked for 15 minutes.',
      })
    }

    const attemptsRemaining = Math.max(0, LOCKOUT_MAX_FAILURES - nextCount)
    throw new ForbiddenException({
      code: 'INVALID_MFA_CODE',
      attemptsRemaining,
      message: `Invalid 6-digit MFA code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before 15-minute lockout.`,
    })
  }

  private async notifyAdminsOfMfaLockout(
    actor: { id: string; name: string; email: string },
    actionKey: string,
  ): Promise<void> {
    const admins = await this.prisma.employeeRole.findMany({
      where: {
        isActive: true,
        role: { slug: { in: ['ceo', 'cto', 'chro'] } },
      },
      select: { employeeId: true },
    })
    const adminIds = Array.from(new Set(admins.map((a) => a.employeeId)))
    if (adminIds.length === 0) return

    await this.prisma.notification.createMany({
      data: adminIds.map((userId) => ({
        userId,
        type: 'security_alert',
        title: `MFA Lockout Alert: ${actor.name}`,
        message: `${actor.email} failed 5 fresh-MFA checks on "${actionKey}" and is locked for 15 minutes.`,
        read: false,
      })),
    })
  }

  async auditMfaOutcome(params: {
    actor: { id: string; name: string; email: string }
    actionKey: string
    targetId: string
    reason?: string
    ipAddress?: string
    device?: string
    outcome: string
    mfaVerified: boolean
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actor.id,
        actorName: params.actor.name,
        actorEmail: params.actor.email,
        actorRole: 'USER',
        action: `Fresh MFA ${params.outcome}: ${params.actionKey}`,
        actionCode: params.actionKey,
        actionKey: params.actionKey,
        severity: params.mfaVerified ? 'INFO' : 'CRITICAL',
        entityType: 'sensitive_action',
        entityId: params.targetId,
        description: `Sensitive action "${params.actionKey}" on target "${params.targetId}" -> ${params.outcome}`,
        category: 'security',
        ipAddress: params.ipAddress || null,
        userAgent: params.device || null,
        device: params.device || null,
        reason: params.reason || null,
        outcome: params.outcome,
        mfaVerified: params.mfaVerified,
      },
    })
  }

  async recordChangeHistory(params: {
    employeeId: string
    actorId: string
    actionKey: string
    changeType: 'POSITION' | 'ROLE' | 'PROFILE' | 'PROMOTION' | 'SECURITY'
    beforeState?: unknown
    afterState?: unknown
    reason: string
    effectiveDate?: Date
    approvers?: unknown
  }) {
    return this.prisma.employeeChangeHistory.create({
      data: {
        employeeId: params.employeeId,
        actorId: params.actorId,
        actionKey: params.actionKey,
        changeType: params.changeType,
        beforeState: params.beforeState as any,
        afterState: params.afterState as any,
        reason: params.reason,
        effectiveDate: params.effectiveDate ?? new Date(),
        approvers: params.approvers as any,
      },
    })
  }

  async issueProfileViewToken(actorId: string, targetEmployeeId: string): Promise<{
    viewToken: string
    expiresAt: string
  }> {
    const rawToken = crypto.randomBytes(24).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + PROFILE_TOKEN_TTL_MS)

    await this.prisma.sensitiveProfileViewToken.create({
      data: {
        tokenHash,
        actorId,
        targetEmployeeId,
        expiresAt,
      },
    })

    return { viewToken: rawToken, expiresAt: expiresAt.toISOString() }
  }

  async validateProfileViewToken(
    rawToken: string,
    actorId: string,
    targetEmployeeId: string,
  ): Promise<boolean> {
    if (!rawToken.trim()) return false
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex')
    const record = await this.prisma.sensitiveProfileViewToken.findUnique({
      where: { tokenHash },
    })
    if (!record) return false
    if (record.actorId !== actorId || record.targetEmployeeId !== targetEmployeeId) {
      return false
    }
    return record.expiresAt > new Date()
  }
}
