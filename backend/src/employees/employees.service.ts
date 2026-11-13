import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Optional,
  Inject,
} from '@nestjs/common'
import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuthorizationService } from '../rbac/authorization.service'
import { FreshMfaService } from '../rbac/fresh-mfa.service'
import { MailService } from '../mail/mail.service'
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

function stripPasswordHash<T extends { passwordHash?: string; inviteTokenHash?: string | null }>(
  record: T,
): Omit<T, 'passwordHash' | 'inviteTokenHash'> {
  const { passwordHash: _passwordHash, inviteTokenHash: _inviteTokenHash, ...safe } = record
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
    @Optional() private readonly authz?: AuthorizationService,
    @Optional() private readonly freshMfa?: FreshMfaService,
    @Optional() private readonly mailService?: MailService,
  ) {}

  async create(dto: CreateEmployeeDto, actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase()
    if ((this.prisma as any).loginAllowlistEntry?.findFirst) {
      const allowlistEntry = await this.prisma.loginAllowlistEntry.findFirst({
        where: { isActive: true, isDomain: false, pattern: email },
        select: { id: true },
      })
      if (!allowlistEntry) {
        throw new ForbiddenException(
          'This email is not on the active login allowlist. Ask the CEO to approve it first.',
        )
      }
    }

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
    let canAppointExecutive = isEmployeeCeo(actorContext) || actor.role.toLowerCase() === 'ceo'
    if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
      canAppointExecutive = (
        await this.authz.check(actor, 'governance:appoint_executive')
      ).allowed
    }
    if (C_LEVEL_ROLE_SLUGS.has(normalizedSlug) && !canAppointExecutive) {
      throw new ForbiddenException(
        'Requires governance:appoint_executive / system:root authority to onboard C-Level executive accounts.',
      )
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

    const placeholderSecret = crypto.randomBytes(24).toString('base64url')
    const passwordHash = await bcrypt.hash(placeholderSecret, 10)
    const rawInviteToken = crypto.randomBytes(32).toString('base64url')
    const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex')
    const ttlHours = this.mailService?.tempPasswordTtlHours ?? 24
    const inviteTokenExpiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    const employeeId = `emp_${normalizedSlug.replace(/[^a-z0-9]/g, '')}_${crypto.randomUUID().slice(0, 8)}`
    const initials = buildInitials(dto.name)

    const createdId = await this.prisma.$transaction(
      async (tx) => {
        const employee = await tx.employee.create({
          data: {
            id: employeeId,
            name: dto.name.trim(),
            email,
            passwordHash,
            mustChangePassword: true,
            inviteTokenHash,
            inviteTokenExpiresAt,
            inviteTokenUsedAt: null,
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

        return employee.id
      },
      { maxWait: 10000, timeout: 15000 },
    )

    await this.auditLogger?.log({
      actorId: actor.id,
      actorName: actorContext.name,
      actorEmail: actorContext.email,
      actorRole: actor.role,
      action: `Provisioned employee account ${dto.name.trim()}`,
      actionCode: 'EMPLOYEE_PROVISIONED',
      severity: 'INFO',
      entityType: 'Employee',
      entityId: createdId,
      entityTitle: dto.name.trim(),
      description: `Onboarded ${dto.name.trim()} (${email}) with role "${role.name}" (${role.slug})${dto.teamId ? ` in squad ${dto.teamId}` : ''}.`,
      category: 'people',
    })

    const createdEmployee = await this.prisma.employee.findUnique({
      where: { id: createdId },
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

    if (!createdEmployee) {
      throw new NotFoundException('Failed to reload newly provisioned employee.')
    }

    const mailResult = this.mailService?.sendWelcomeSetupLink
      ? await this.mailService.sendWelcomeSetupLink({
          to: email,
          name: dto.name.trim(),
          setupToken: rawInviteToken,
          ttlHours,
        })
      : await this.mailService?.sendWelcomeTempPassword?.({
          to: email,
          name: dto.name.trim(),
          temporaryPassword: rawInviteToken,
          ttlHours,
        })

    const deliveryStatus = mailResult?.sent
      ? 'sent'
      : mailResult?.error
        ? 'failed'
        : 'queued'

    await this.prisma.employee.update({
      where: { id: createdEmployee.id },
      data: {
        inviteDeliveryStatus: deliveryStatus,
        inviteLastSentAt: mailResult?.sent ? new Date() : null,
        inviteLastError: mailResult?.error || null,
      },
    })

    return {
      employee: {
        ...stripPasswordHash(createdEmployee),
        inviteDeliveryStatus: deliveryStatus,
        inviteLastError: mailResult?.error || null,
      },
      deliveryStatus,
      emailSent: mailResult?.sent ?? false,
      deliveryError: mailResult?.error || null,
    }
  }

  async resendInvite(employeeId: string, actor: AuthenticatedUser, reason?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        isSuspended: true,
        inviteResendCount: true,
        inviteResendWindowStart: true,
      },
    })
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found.`)
    }
    if (employee.isSuspended) {
      throw new ForbiddenException('Cannot resend invitation to a suspended employee.')
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const inWindow =
      employee.inviteResendWindowStart && employee.inviteResendWindowStart > oneHourAgo
    const nextCount = inWindow ? employee.inviteResendCount + 1 : 1
    if (inWindow && employee.inviteResendCount >= 3) {
      throw new ForbiddenException(
        'Resend limit reached (maximum 3 invitations per hour for this employee).',
      )
    }

    const rawInviteToken = crypto.randomBytes(32).toString('base64url')
    const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex')
    const ttlHours = this.mailService?.tempPasswordTtlHours ?? 24
    const inviteTokenExpiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        mustChangePassword: true,
        inviteTokenHash,
        inviteTokenExpiresAt,
        inviteTokenUsedAt: null,
        authVersion: { increment: 1 },
        inviteResendCount: nextCount,
        inviteResendWindowStart: inWindow ? employee.inviteResendWindowStart : now,
      },
    })

    const mailResult = this.mailService?.sendWelcomeSetupLink
      ? await this.mailService.sendWelcomeSetupLink({
          to: employee.email,
          name: employee.name,
          setupToken: rawInviteToken,
          ttlHours,
        })
      : await this.mailService?.sendWelcomeTempPassword?.({
          to: employee.email,
          name: employee.name,
          temporaryPassword: rawInviteToken,
          ttlHours,
        })

    const deliveryStatus = mailResult?.sent
      ? 'sent'
      : mailResult?.error
        ? 'failed'
        : 'queued'

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        inviteDeliveryStatus: deliveryStatus,
        inviteLastSentAt: mailResult?.sent ? now : null,
        inviteLastError: mailResult?.error || null,
      },
    })

    await this.auditLogger?.log({
      actorId: actor.id,
      actorName: actor.id,
      actorEmail: actor.email || '',
      actorRole: actor.role.toUpperCase(),
      action: `Resent 24h one-time onboarding link to ${employee.name}`,
      actionCode: 'EMPLOYEE_INVITE_RESENT',
      severity: 'INFO',
      entityType: 'Employee',
      entityId: employeeId,
      description: `Invalidated previous invite link and sent a new 24h one-time setup link (${deliveryStatus}).`,
      category: 'people',
      reason: reason?.trim() || 'Resend onboarding invitation',
      mfaVerified: true,
    })

    return {
      employeeId,
      deliveryStatus,
      emailSent: mailResult?.sent ?? false,
      deliveryError: mailResult?.error || null,
    }
  }

  async findAll(roleCategory?: string, teamId?: string, actor?: AuthenticatedUser) {
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

    const hasAdminAccess =
      actor?.roles?.includes('system:root') ||
      (actor?.role || '').toLowerCase() === 'ceo' ||
      actor?.roles?.some((r) => ['cto', 'chro'].includes(r.toLowerCase()))

    if (!hasAdminAccess) {
      // Minimal DTO for non-admin directory callers
      return employees.map((emp) => ({
        id: emp.id,
        name: emp.name,
        photo: emp.avatarUrl || null,
        avatarUrl: emp.avatarUrl || null,
        initials: emp.initials,
        title: emp.title,
        department: emp.positionAssignments?.[0]?.position?.department || 'General',
        squads: emp.teamMemberships?.map((tm) => tm.team?.name).filter(Boolean) || [],
        email: emp.email,
        status: emp.status,
      }))
    }

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

  async unlockSensitiveProfile(targetEmployeeId: string, actorId: string) {
    await this.findOne(targetEmployeeId)
    if (!this.freshMfa) {
      throw new ForbiddenException('Fresh MFA service unavailable.')
    }
    return this.freshMfa.issueProfileViewToken(actorId, targetEmployeeId)
  }

  async getSensitiveProfile(
    targetEmployeeId: string,
    actor: AuthenticatedUser,
    viewToken: string,
    request?: { ip?: string; headers?: Record<string, unknown> },
  ) {
    if (!this.freshMfa) {
      throw new ForbiddenException('Fresh MFA service unavailable.')
    }
    const valid = await this.freshMfa.validateProfileViewToken(
      viewToken,
      actor.id,
      targetEmployeeId,
    )
    if (!valid) {
      throw new ForbiddenException({
        code: 'PROFILE_VIEW_TOKEN_REQUIRED',
        message:
          'Sensitive profile view token missing, expired (5 min limit), or bound to another employee. Re-verify with MFA.',
      })
    }

    const profile = await this.findOne(targetEmployeeId)
    await this.freshMfa.auditMfaOutcome({
      actor: { id: actor.id, name: actor.id, email: actor.email || '' },
      actionKey: 'employees:read_sensitive',
      targetId: targetEmployeeId,
      outcome: 'VIEWED',
      mfaVerified: true,
      ipAddress: request?.ip,
      device:
        typeof request?.headers?.['user-agent'] === 'string'
          ? request.headers['user-agent']
          : undefined,
    })
    return profile
  }

  async getChangeHistory(employeeId: string) {
    await this.findOne(employeeId)
    return this.prisma.employeeChangeHistory.findMany({
      where: { employeeId },
      include: {
        actor: { select: { id: true, name: true, email: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async promoteEmployee(
    employeeId: string,
    body: { newTitle: string; reason: string; effectiveDate?: string },
    actor: AuthenticatedUser,
  ) {
    const existing = await this.findOne(employeeId)
    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : new Date()
    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: { title: body.newTitle.trim() },
    })

    if (this.freshMfa) {
      await this.freshMfa.recordChangeHistory({
        employeeId,
        actorId: actor.id,
        actionKey: 'promotions:approve',
        changeType: 'PROMOTION',
        beforeState: { title: existing.title },
        afterState: { title: updated.title },
        reason: body.reason.trim(),
        effectiveDate,
        approvers: [actor.id],
      })
    }

    return stripPasswordHash(updated)
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto & { reason?: string },
    actor?: AuthenticatedUser,
    headers?: Record<string, string>,
    request?: { ip?: string },
  ) {
    const existing = await this.findOne(id)

    if (actor?.id && actor.id !== id) {
      if (this.authz && this.authz.getAuthzMode() !== 'legacy') {
        await this.authz.assert(actor, 'employees:update_any')
      }
      const target = await loadEmployeeWithSecurityContext(this.prisma, id)
      assertTargetNotSupremeCeo(target)
      await assertHorizontalCLevelGuard(this.prisma, actor.id, target, 'edit employee profile')

      if (this.freshMfa) {
        await this.freshMfa.verifyFreshMfa({
          actorId: actor.id,
          actionKey: 'employees:update_any',
          targetId: id,
          code: headers?.['x-mfa-code'],
          boundActionHeader: headers?.['x-mfa-action'],
          boundTargetHeader: headers?.['x-mfa-target'],
          reason: dto.reason,
          ipAddress: request?.ip,
          device: headers?.['user-agent'],
        })
      }
    }

    const { reason, ...updateData } = dto
    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateData,
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

    if (actor?.id && this.freshMfa && actor.id !== id) {
      await this.freshMfa.recordChangeHistory({
        employeeId: id,
        actorId: actor.id,
        actionKey: 'employees:update_any',
        changeType: 'PROFILE',
        beforeState: {
          name: existing.name,
          title: existing.title,
          phone: existing.phone,
          location: existing.location,
        },
        afterState: {
          name: updated.name,
          title: updated.title,
          phone: updated.phone,
          location: updated.location,
        },
        reason: reason?.trim() || 'Profile updated by authorized administrator',
      })
    }

    return stripPasswordHash(updated)
  }

  async updateUserIdentity(
    id: string,
    body: { name?: string; email?: string; addToAllowlist?: boolean; reason: string },
    actor: AuthenticatedUser,
  ) {
    if (!body.reason || body.reason.trim().length < 10) {
      throw new BadRequestException('Written reason must be at least 10 characters.')
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id },
    })
    if (!employee) throw new NotFoundException(`Employee "${id}" not found.`)

    const beforeState = { name: employee.name, email: employee.email }
    const newName = body.name?.trim()
    const newEmail = body.email?.trim().toLowerCase()
    let emailChanged = false

    if (newEmail && newEmail !== employee.email.toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        throw new BadRequestException('A valid email address is required.')
      }

      const existingWithEmail = await this.prisma.employee.findUnique({
        where: { email: newEmail },
      })
      if (existingWithEmail && existingWithEmail.id !== id) {
        throw new BadRequestException(`Email "${newEmail}" is already in use by another user.`)
      }

      // Check allowlist
      const allowlistEntry = await this.prisma.loginAllowlistEntry.findFirst({
        where: { pattern: newEmail, isActive: true },
      })

      if (!allowlistEntry) {
        if (body.addToAllowlist !== false) {
          await this.prisma.loginAllowlistEntry.upsert({
            where: { pattern: newEmail },
            update: { isActive: true },
            create: {
              pattern: newEmail,
              isDomain: false,
              isActive: true,
              addedById: actor.id,
              note: `Added during CEO email identity update for ${employee.name}`,
            },
          })
        } else {
          throw new BadRequestException(
            `The new email "${newEmail}" must be on the active login allowlist.`,
          )
        }
      }

      emailChanged = true
    }

    const now = new Date()
    const updated = await this.prisma.$transaction(async (tx) => {
      if (emailChanged) {
        // Detach linked Google identity
        await tx.externalIdentity.deleteMany({
          where: { employeeId: id, provider: 'google' },
        })

        // Revoke all existing sessions
        await tx.refreshToken.updateMany({
          where: { employeeId: id, revokedAt: null },
          data: { revokedAt: now },
        })
        await tx.securitySession.updateMany({
          where: { employeeId: id, isRevoked: false },
          data: { isRevoked: true, revokedAt: now },
        })
      }

      const initials = newName ? buildInitials(newName) : employee.initials
      const saved = await tx.employee.update({
        where: { id },
        data: {
          name: newName || employee.name,
          initials,
          email: newEmail || employee.email,
          authVersion: emailChanged ? { increment: 1 } : undefined,
        },
      })

      await tx.employeeChangeHistory.create({
        data: {
          employeeId: id,
          actorId: actor.id,
          actionKey: 'users:edit_identity',
          changeType: 'PROFILE',
          beforeState: beforeState as any,
          afterState: { name: saved.name, email: saved.email } as any,
          reason: body.reason.trim(),
        },
      })

      if (this.auditLogger) {
        await this.auditLogger.log(
          {
            actorId: actor.id,
            actorName: actor.name || 'Chief Executive Officer',
            actorEmail: actor.email || 'ceo@pointfex.com',
            actorRole: 'CEO',
            action: 'USER_IDENTITY_UPDATED',
            actionCode: 'IDENTITY_EMAIL_NAME_UPDATED',
            severity: 'CRITICAL',
            entityType: 'user',
            entityId: id,
            entityTitle: saved.name,
            description: `CEO updated user identity for ${employee.name}: name "${beforeState.name}" -> "${saved.name}", email "${beforeState.email}" -> "${saved.email}". Sessions revoked and Google detached.`,
            category: 'governance',
            badgeColor: 'rose',
            outcome: 'APPLIED_IMMEDIATELY',
            mfaVerified: true,
          },
          tx,
        )
      }

      return saved
    })

    if (emailChanged && this.mailService) {
      void this.mailService.sendEmail({
        to: beforeState.email,
        subject: 'Security Alert: Your Pointfex ERP account email has changed',
        text: `Your account email has been updated from ${beforeState.email} to ${newEmail} by the Chief Executive Officer. Any active sessions were signed out for your security.`,
        html: `<p>Your account email has been updated from <strong>${beforeState.email}</strong> to <strong>${newEmail}</strong> by the Chief Executive Officer. Any active sessions were signed out for your security.</p>`,
      })
      void this.mailService.sendEmail({
        to: newEmail!,
        subject: 'Pointfex ERP: Account Email Confirmed',
        text: `Your Pointfex ERP account is now registered to this email address (${newEmail}).`,
        html: `<p>Your Pointfex ERP account is now registered to this email address (<strong>${newEmail}</strong>).</p>`,
      })
    }

    return stripPasswordHash(updated)
  }
}
