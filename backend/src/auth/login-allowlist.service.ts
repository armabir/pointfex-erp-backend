import * as crypto from 'crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { isEmployeeCeo, loadEmployeeWithSecurityContext } from '../common/security-policy.util'

export function maskEmail(rawEmail: string): string {
  const cleaned = (rawEmail || '').trim().toLowerCase()
  const at = cleaned.indexOf('@')
  if (at <= 0) return '***'
  const local = cleaned.slice(0, at)
  const domain = cleaned.slice(at + 1)
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}***@${domain}`
}

@Injectable()
export class LoginAllowlistService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  isAllowlistRequired(): boolean {
    return this.configService?.get<string>('LOGIN_ALLOWLIST_REQUIRED') === 'true'
  }

  isDomainRulesAllowed(): boolean {
    return this.configService?.get<string>('ALLOW_DOMAIN_RULES') === 'true'
  }

  async assertCeoActor(actor: AuthenticatedUser) {
    const employee = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    if (!isEmployeeCeo(employee)) {
      throw new ForbiddenException('Only the CEO (system:root) may manage the login allowlist.')
    }
    return employee
  }

  private assertValidReason(reason?: string) {
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('A written reason of at least 10 characters is required.')
    }
  }

  normalizePattern(raw: string): { pattern: string; isDomain: boolean } {
    // Exact email preserved (never strip +tags or Gmail dots)
    const cleaned = raw.trim().toLowerCase()
    if (!cleaned) {
      throw new BadRequestException('Allowlist entry cannot be empty.')
    }
    if (cleaned.startsWith('@')) {
      if (!this.isDomainRulesAllowed()) {
        throw new BadRequestException(
          'Domain-wide allowlist rules are disabled (ALLOW_DOMAIN_RULES=false). Use exact email addresses.',
        )
      }
      if (!/^@[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) {
        throw new BadRequestException(`Invalid domain rule "${cleaned}".`)
      }
      return { pattern: cleaned, isDomain: true }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      throw new BadRequestException(`Invalid email address "${cleaned}".`)
    }
    return { pattern: cleaned, isDomain: false }
  }

  async isEmailAllowed(email: string, isSystemRoot = false): Promise<boolean> {
    if (isSystemRoot) return true
    if (!this.isAllowlistRequired()) return true

    const normalized = email.trim().toLowerCase()
    const domainPart = normalized.includes('@') ? `@${normalized.split('@')[1]}` : ''
    const patterns = domainPart && this.isDomainRulesAllowed() ? [normalized, domainPart] : [normalized]
    const match = await this.prisma.loginAllowlistEntry.findFirst({
      where: {
        isActive: true,
        pattern: { in: patterns },
      },
      select: { id: true },
    })
    return Boolean(match)
  }

  async isEmailOnActiveAllowlist(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase()
    const match = await this.prisma.loginAllowlistEntry.findFirst({
      where: { isActive: true, pattern: normalized },
      select: { id: true },
    })
    return Boolean(match)
  }

  async recordBlockedAttempt(
    email: string,
    provider: 'password' | 'google' | 'forgot_password',
    reason: string,
    ipAddress?: string | null,
  ) {
    const normalized = (email || '').trim().toLowerCase()
    const emailHash = crypto.createHash('sha256').update(normalized).digest('hex')
    await this.prisma.loginBlockedAttempt
      .create({
        data: {
          maskedEmail: maskEmail(normalized),
          emailHash,
          provider,
          reason,
          ipAddress: ipAddress || null,
        },
      })
      .catch(() => undefined)
  }

  private async revokeSessionsForEmail(email: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
      select: { id: true },
    })
    if (!emp) return
    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.employee.update({
        where: { id: emp.id },
        data: { authVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { employeeId: emp.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.securitySession.updateMany({
        where: { employeeId: emp.id, isRevoked: false },
        data: { isRevoked: true, revokedAt: now },
      }),
    ])
  }

  async listEntries(actor: AuthenticatedUser) {
    const actorEmp = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    const isCeo = isEmployeeCeo(actorEmp)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [entries, employees, blockedAttempts, blockedLast7Days, pendingRequests] =
      await Promise.all([
        this.prisma.loginAllowlistEntry.findMany({
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.employee.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            isSuspended: true,
            lastLoginAt: true,
            lastLoginMethod: true,
            inviteDeliveryStatus: true,
          },
        }),
        isCeo
          ? this.prisma.loginBlockedAttempt.findMany({
              where: { createdAt: { gte: sevenDaysAgo } },
              orderBy: { createdAt: 'desc' },
              take: 100,
            })
          : Promise.resolve([]),
        this.prisma.loginBlockedAttempt.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        isCeo
          ? this.prisma.allowlistEmailRequest.findMany({
              where: { status: 'PENDING' },
              orderBy: { createdAt: 'desc' },
            })
          : Promise.resolve([]),
      ])

    const empByEmail = new Map(employees.map((e) => [e.email.trim().toLowerCase(), e]))
    const enrichedEntries = entries.map((entry) => {
      const emp = empByEmail.get(entry.pattern.toLowerCase()) || null
      return {
        ...entry,
        note: isCeo ? entry.note : null,
        employeeId: emp?.id || null,
        employeeName: emp?.name || null,
        employeeSuspended: emp?.isSuspended ?? false,
        lastLoginAt: emp?.lastLoginAt || null,
        lastLoginMethod: emp?.lastLoginMethod || null,
        inviteDeliveryStatus: emp?.inviteDeliveryStatus || null,
      }
    })

    const allowedEmails = entries.filter((e) => e.isActive).length
    const readyToOnboard = enrichedEntries.filter((e) => e.isActive && !e.employeeId).length
    const activeEmployees = employees.filter((e) => !e.isSuspended).length

    return {
      allowlistRequired: this.isAllowlistRequired(),
      allowDomainRules: this.isDomainRulesAllowed(),
      canManage: isCeo,
      summary: {
        allowedEmails,
        readyToOnboard,
        activeEmployees,
        blockedLast7Days,
      },
      entries: enrichedEntries,
      blockedAttempts,
      pendingRequests,
    }
  }

  async listReadyToOnboardEmails(): Promise<Array<{ email: string }>> {
    const [activeEntries, employees] = await Promise.all([
      this.prisma.loginAllowlistEntry.findMany({
        where: { isActive: true, isDomain: false },
        select: { pattern: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.findMany({
        select: { email: true },
      }),
    ])
    const existingSet = new Set(employees.map((e) => e.email.trim().toLowerCase()))
    return activeEntries
      .filter((entry) => !existingSet.has(entry.pattern.toLowerCase()))
      .map((entry) => ({ email: entry.pattern }))
  }

  async addEntry(actor: AuthenticatedUser, rawPattern: string, note?: string, reason?: string) {
    const ceo = await this.assertCeoActor(actor)
    this.assertValidReason(reason)
    const { pattern, isDomain } = this.normalizePattern(rawPattern)

    const entry = await this.prisma.loginAllowlistEntry.upsert({
      where: { pattern },
      update: {
        isActive: true,
        isDomain,
        note: note?.trim() || undefined,
        addedById: ceo.id,
      },
      create: {
        pattern,
        isDomain,
        isActive: true,
        note: note?.trim() || null,
        addedById: ceo.id,
      },
    })

    await this.auditLogger?.log({
      actorId: ceo.id,
      actorName: ceo.name,
      actorEmail: ceo.email,
      actorRole: 'CEO',
      action: `Added login allowlist entry ${maskEmail(pattern)}`,
      actionCode: 'LOGIN_ALLOWLIST_ADDED',
      severity: 'WARNING',
      entityType: 'LoginAllowlistEntry',
      entityId: entry.id,
      description: `CEO added "${maskEmail(pattern)}" to the login allowlist.`,
      category: 'security',
      reason: reason!.trim(),
      mfaVerified: true,
    })

    return entry
  }

  async bulkImport(
    actor: AuthenticatedUser,
    input: { entries: string[] | string; note?: string; reason?: string },
  ) {
    const ceo = await this.assertCeoActor(actor)
    this.assertValidReason(input.reason)
    const rawList = Array.isArray(input.entries)
      ? input.entries
      : String(input.entries || '').split(/[\n,;]+/)

    const uniqueNormalized: Array<{ pattern: string; isDomain: boolean }> = []
    const seen = new Set<string>()
    for (const raw of rawList) {
      const trimmed = raw.trim()
      if (!trimmed) continue
      const parsed = this.normalizePattern(trimmed)
      if (!seen.has(parsed.pattern)) {
        seen.add(parsed.pattern)
        uniqueNormalized.push(parsed)
      }
    }

    if (uniqueNormalized.length === 0) {
      throw new BadRequestException('Provide at least one valid email address to import.')
    }

    let imported = 0
    for (const item of uniqueNormalized) {
      await this.prisma.loginAllowlistEntry.upsert({
        where: { pattern: item.pattern },
        update: {
          isActive: true,
          isDomain: item.isDomain,
          note: input.note?.trim() || undefined,
          addedById: ceo.id,
        },
        create: {
          pattern: item.pattern,
          isDomain: item.isDomain,
          isActive: true,
          note: input.note?.trim() || 'Bulk CSV/list import',
          addedById: ceo.id,
        },
      })
      imported++
    }

    await this.auditLogger?.log({
      actorId: ceo.id,
      actorName: ceo.name,
      actorEmail: ceo.email,
      actorRole: 'CEO',
      action: `Bulk imported ${imported} login allowlist entries`,
      actionCode: 'LOGIN_ALLOWLIST_IMPORTED',
      severity: 'WARNING',
      entityType: 'LoginAllowlistEntry',
      entityId: 'bulk',
      description: `CEO bulk-imported ${imported} login allowlist entries (${uniqueNormalized.map((x) => maskEmail(x.pattern)).join(', ')}).`,
      category: 'security',
      reason: input.reason!.trim(),
      mfaVerified: true,
    })

    return { imported, patterns: uniqueNormalized.map((x) => x.pattern) }
  }

  async setActive(actor: AuthenticatedUser, id: string, isActive: boolean, reason?: string) {
    const ceo = await this.assertCeoActor(actor)
    this.assertValidReason(reason)
    const existing = await this.prisma.loginAllowlistEntry.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Allowlist entry not found.')
    }
    if (!isActive && existing.pattern.toLowerCase() === ceo.email.trim().toLowerCase()) {
      throw new ForbiddenException('The CEO email cannot be disabled.')
    }

    const updated = await this.prisma.loginAllowlistEntry.update({
      where: { id },
      data: { isActive },
    })

    if (!isActive) {
      await this.revokeSessionsForEmail(existing.pattern)
    }

    await this.auditLogger?.log({
      actorId: ceo.id,
      actorName: ceo.name,
      actorEmail: ceo.email,
      actorRole: 'CEO',
      action: `${isActive ? 'Enabled' : 'Disabled'} login allowlist entry ${maskEmail(existing.pattern)}`,
      actionCode: 'LOGIN_ALLOWLIST_UPDATED',
      severity: 'WARNING',
      entityType: 'LoginAllowlistEntry',
      entityId: id,
      description: `CEO ${isActive ? 'enabled' : 'disabled'} "${maskEmail(existing.pattern)}".`,
      category: 'security',
      reason: reason!.trim(),
      mfaVerified: true,
    })

    return updated
  }

  async removeEntry(actor: AuthenticatedUser, id: string, reason?: string) {
    const ceo = await this.assertCeoActor(actor)
    this.assertValidReason(reason)
    const existing = await this.prisma.loginAllowlistEntry.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Allowlist entry not found.')
    }
    if (existing.pattern.toLowerCase() === ceo.email.trim().toLowerCase()) {
      throw new ForbiddenException('The CEO email cannot be removed.')
    }

    await this.prisma.loginAllowlistEntry.delete({ where: { id } })
    await this.revokeSessionsForEmail(existing.pattern)

    await this.auditLogger?.log({
      actorId: ceo.id,
      actorName: ceo.name,
      actorEmail: ceo.email,
      actorRole: 'CEO',
      action: `Removed login allowlist entry ${maskEmail(existing.pattern)}`,
      actionCode: 'LOGIN_ALLOWLIST_REMOVED',
      severity: 'WARNING',
      entityType: 'LoginAllowlistEntry',
      entityId: id,
      description: `CEO removed "${maskEmail(existing.pattern)}" from the login allowlist and revoked active sessions.`,
      category: 'security',
      reason: reason!.trim(),
      mfaVerified: true,
    })

    return { deleted: true, id }
  }

  async requestEmail(
    actor: AuthenticatedUser,
    body: { email: string; fullName: string; reason: string },
  ) {
    this.assertValidReason(body.reason)
    const { pattern, isDomain } = this.normalizePattern(body.email)
    if (isDomain) {
      throw new BadRequestException('Request an exact email address, not a domain rule.')
    }
    const req = await this.prisma.allowlistEmailRequest.create({
      data: {
        email: pattern,
        fullName: (body.fullName || '').trim() || pattern,
        reason: body.reason.trim(),
        requesterId: actor.id,
      },
    })
    return req
  }

  async listEmailRequests(actor: AuthenticatedUser) {
    const actorEmp = await loadEmployeeWithSecurityContext(this.prisma, actor.id)
    if (isEmployeeCeo(actorEmp)) {
      return this.prisma.allowlistEmailRequest.findMany({
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      })
    }
    return this.prisma.allowlistEmailRequest.findMany({
      where: { requesterId: actor.id },
      orderBy: { createdAt: 'desc' },
    })
  }

  async approveEmailRequest(actor: AuthenticatedUser, id: string, reason?: string) {
    const ceo = await this.assertCeoActor(actor)
    const req = await this.prisma.allowlistEmailRequest.findUnique({ where: { id } })
    if (!req) {
      throw new NotFoundException('Email allowlist request not found.')
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Request has already been decided.')
    }

    const effectiveReason = (reason && reason.trim().length >= 10 ? reason : req.reason).trim()

    await this.prisma.loginAllowlistEntry.upsert({
      where: { pattern: req.email },
      update: { isActive: true, isDomain: false, addedById: ceo.id },
      create: {
        pattern: req.email,
        isDomain: false,
        isActive: true,
        note: `Requested for ${req.fullName}`,
        addedById: ceo.id,
      },
    })

    const updated = await this.prisma.allowlistEmailRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: ceo.id,
        reviewedAt: new Date(),
        reviewNotes: effectiveReason,
      },
    })

    await this.auditLogger?.log({
      actorId: ceo.id,
      actorName: ceo.name,
      actorEmail: ceo.email,
      actorRole: 'CEO',
      action: `Approved allowlist email request for ${maskEmail(req.email)}`,
      actionCode: 'LOGIN_ALLOWLIST_REQUEST_APPROVED',
      severity: 'WARNING',
      entityType: 'AllowlistEmailRequest',
      entityId: id,
      description: `CEO approved allowlist request for ${maskEmail(req.email)}.`,
      category: 'security',
      reason: effectiveReason,
      mfaVerified: true,
    })

    return updated
  }

  async rejectEmailRequest(actor: AuthenticatedUser, id: string, reason?: string) {
    const ceo = await this.assertCeoActor(actor)
    this.assertValidReason(reason)
    const req = await this.prisma.allowlistEmailRequest.findUnique({ where: { id } })
    if (!req) {
      throw new NotFoundException('Email allowlist request not found.')
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Request has already been decided.')
    }
    return this.prisma.allowlistEmailRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: ceo.id,
        reviewedAt: new Date(),
        reviewNotes: reason!.trim(),
      },
    })
  }
}
