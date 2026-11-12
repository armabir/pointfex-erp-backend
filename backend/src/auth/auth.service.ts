import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Optional,
  Inject,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import type { CookieOptions, Request, Response } from 'express'
import { PrismaService } from '../common/prisma.service'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { extractClientIp } from '../common/ip-address.util'
import { RbacService } from '../rbac/rbac.service'
import { FreshMfaService } from '../rbac/fresh-mfa.service'
import { MailService } from '../mail/mail.service'
import { LoginAllowlistService } from './login-allowlist.service'
import { verifyTotpCode } from '../common/security-policy.util'
import { ChangePasswordDto, LoginDto } from './dto/auth.dto'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, resolveCanonicalRoleSlug } from './jwt.strategy'

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000 // 15 minutes
const GOOGLE_CODE_TTL_MS = 60 * 1000

function sha256Hex(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

@Injectable()
export class AuthService {
  private readonly googleOneTimeCodes = new Map<
    string,
    { employeeId: string; expiresAt: number }
  >()
  private readonly googlePkceChallenges = new Map<
    string,
    { codeVerifier: string; nonce: string; expiresAt: number }
  >()

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Optional()
    @Inject(ConfigService)
    private readonly configService?: ConfigService,
    @Optional()
    @Inject(AuditLoggerService)
    private readonly auditLogger?: AuditLoggerService,
    @Optional()
    @Inject(RbacService)
    private readonly rbacService?: RbacService,
    @Optional()
    @Inject(FreshMfaService)
    private readonly freshMfa?: FreshMfaService,
    @Optional()
    @Inject(MailService)
    private readonly mailService?: MailService,
    @Optional()
    @Inject(LoginAllowlistService)
    private readonly allowlistService?: LoginAllowlistService,
  ) {}

  private getRefreshTtlDays(): number {
    const raw = this.configService?.get<number | string>('JWT_REFRESH_EXPIRES_DAYS')
    const parsed = Number(raw || 7)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 7
  }

  private resolveCookieSecure(request: Request): boolean {
    const explicit = this.configService?.get<string>('COOKIE_SECURE')
    if (explicit === 'true') return true
    if (explicit === 'false') return false
    const forwardedProto = request.headers?.['x-forwarded-proto']
    return (
      Boolean(request.secure) ||
      forwardedProto === 'https' ||
      this.configService?.get<string>('NODE_ENV') === 'production'
    )
  }

  private resolveCookieSameSite(): 'strict' | 'lax' | 'none' {
    const raw = this.configService?.get<string>('COOKIE_SAMESITE')?.trim().toLowerCase()
    if (raw === 'strict' || raw === 'lax' || raw === 'none') return raw
    return 'lax'
  }

  private buildAccessCookieOptions(request: Request): CookieOptions {
    const sameSite = this.resolveCookieSameSite()
    return {
      httpOnly: true,
      secure: sameSite === 'none' ? true : this.resolveCookieSecure(request),
      sameSite,
      path: '/api',
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    }
  }

  private buildRefreshCookieOptions(request: Request): CookieOptions {
    const sameSite = this.resolveCookieSameSite()
    return {
      httpOnly: true,
      secure: sameSite === 'none' ? true : this.resolveCookieSecure(request),
      sameSite,
      path: '/api/auth',
      maxAge: this.getRefreshTtlDays() * 24 * 60 * 60 * 1000,
    }
  }

  private clearAuthCookies(request: Request, response: Response): void {
    const sameSite = this.resolveCookieSameSite()
    const secure = sameSite === 'none' ? true : this.resolveCookieSecure(request)
    response.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api',
    })
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/auth',
    })
  }

  private async issueSessionCookies(
    employeeId: string,
    email: string,
    primaryRole: string,
    familyId: string,
    request: Request,
    response: Response,
    revokeTokenHash?: string,
  ): Promise<void> {
    const rawRefreshToken = crypto.randomBytes(48).toString('hex')
    const refreshTokenHash = sha256Hex(rawRefreshToken)
    const refreshExpiresAt = new Date(Date.now() + this.getRefreshTtlDays() * 24 * 60 * 60 * 1000)
    const ipAddress = extractClientIp(request)
    const userAgent = request.headers?.['user-agent']?.slice(0, 255) || null

    await this.prisma.$transaction(async (tx) => {
      if (revokeTokenHash) {
        await tx.refreshToken.update({
          where: { tokenHash: revokeTokenHash },
          data: {
            revokedAt: new Date(),
            replacedByTokenHash: refreshTokenHash,
          },
        })
      }

      await tx.refreshToken.create({
        data: {
          employeeId,
          tokenHash: refreshTokenHash,
          familyId,
          expiresAt: refreshExpiresAt,
          ipAddress,
          userAgent,
        },
      })

      if (!revokeTokenHash) {
        await tx.securitySession.create({
          data: {
            employeeId,
            tokenFamilyId: familyId,
            ipAddress,
            userAgent,
            deviceLabel: userAgent ? userAgent.slice(0, 64) : 'Web Client',
            mfaVerified: false,
            mfaMethod: 'NONE',
            expiresAt: refreshExpiresAt,
          },
        })
      } else {
        await tx.securitySession.updateMany({
          where: { tokenFamilyId: familyId, isRevoked: false },
          data: { lastActiveAt: new Date(), expiresAt: refreshExpiresAt },
        })
      }
    })

    const accessToken = await this.jwtService.signAsync({
      sub: employeeId,
      employeeId,
      email,
      role: primaryRole,
    })

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, this.buildAccessCookieOptions(request))
    response.cookie(REFRESH_TOKEN_COOKIE, rawRefreshToken, this.buildRefreshCookieOptions(request))
  }

  async login(dto: LoginDto, request: Request, response: Response) {
    const normalizedEmail = dto.email.trim()
    const employee = await this.prisma.employee.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
      include: {
        employeeRoles: {
          where: { isActive: true, role: { isActive: true } },
          include: { role: true },
        },
        positionAssignments: {
          where: { isActive: true },
          include: { position: true },
        },
      },
    })

    if (!employee || !employee.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.')
    }

    const passwordMatches = await bcrypt.compare(dto.password, employee.passwordHash)
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.')
    }

    if (employee.isSuspended) {
      throw new ForbiddenException('Account Suspended. Contact HR.')
    }

    if (
      employee.mustChangePassword &&
      employee.tempPasswordExpiresAt &&
      employee.tempPasswordExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'Your temporary password has expired. Ask an administrator to reset your password.',
      )
    }

    const activeSlugs = employee.employeeRoles.map((er) => er.role.slug)
    const fallbackCategory = employee.positionAssignments[0]?.position.roleCategory
    const primaryRole = resolveCanonicalRoleSlug(activeSlugs, fallbackCategory)
    const isSystemRoot = employee.employeeRoles.some((er) => er.role.isSystemDefault) || primaryRole === 'ceo'

    if (this.allowlistService) {
      const allowed = await this.allowlistService.isEmailAllowed(employee.email, isSystemRoot)
      if (!allowed) {
        await this.allowlistService.recordBlockedAttempt(
          employee.email,
          'password',
          'Email not on active login allowlist',
          extractClientIp(request),
        )
        throw new ForbiddenException('This account is not allowed.')
      }
    }

    if (employee.mfaEnabled) {
      const mfaResult = await this.verifyLoginMfaOrRecovery(
        employee.id,
        employee.mfaSecret,
        employee.mfaRecoveryCodes,
        dto.mfaCode,
        dto.recoveryCode,
      )
      if (mfaResult === 'REQUIRED') {
        return {
          authenticated: false,
          mfaRequired: true,
          methods: ['totp', 'recovery'],
        }
      }
    }

    const accessProfile = this.rbacService
      ? await this.rbacService.getEmployeeAccessProfile(employee.id)
      : null
    const effectivePermissions = accessProfile?.permissions || []

    await this.issueSessionCookies(
      employee.id,
      employee.email,
      primaryRole,
      crypto.randomUUID(),
      request,
      response,
    )

    await this.prisma.employee
      .update({
        where: { id: employee.id },
        data: { lastLoginAt: new Date(), lastLoginMethod: 'password' },
      })
      .catch(() => undefined)

    await this.auditLogger?.log({
      actorId: employee.id,
      actorName: employee.name,
      actorEmail: employee.email,
      actorRole: primaryRole,
      action: 'Signed in via HttpOnly JWT cookie session',
      actionCode: 'AUTH_LOGIN',
      severity: 'INFO',
      entityType: 'Employee',
      entityId: employee.id,
      entityTitle: employee.name,
      description: `${employee.name} signed in via HttpOnly JWT authentication (${employee.email})`,
      category: 'security',
      ipAddress: extractClientIp(request),
    })

    return {
      authenticated: true,
      user: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        title: employee.title,
        initials: employee.initials,
        avatarUrl: employee.avatarUrl,
        status: employee.status,
        isSuspended: employee.isSuspended,
        mustChangePassword: employee.mustChangePassword,
        mustEnrollMfa: employee.mustEnrollMfa && !employee.mfaEnabled,
        mfaEnabled: employee.mfaEnabled,
        role: primaryRole,
        roles: employee.employeeRoles.map((er) => ({
          id: er.role.id,
          slug: er.role.slug,
          name: er.role.name,
        })),
        permissions: effectivePermissions,
      },
    }
  }

  async refresh(request: Request, response: Response) {
    const cookies = request?.cookies as Record<string, string | undefined> | undefined
    const rawToken = cookies?.[REFRESH_TOKEN_COOKIE]

    if (!rawToken) {
      this.clearAuthCookies(request, response)
      throw new UnauthorizedException('Refresh token missing. Please sign in.')
    }

    const tokenHash = sha256Hex(rawToken)
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        employee: {
          include: {
            employeeRoles: {
              where: { isActive: true, role: { isActive: true } },
              include: { role: true },
            },
            positionAssignments: {
              where: { isActive: true },
              include: { position: true },
            },
          },
        },
      },
    })

    if (!existing) {
      this.clearAuthCookies(request, response)
      throw new UnauthorizedException('Invalid refresh session. Please sign in again.')
    }

    // Reuse detection: invalidate entire token family immediately if a rotated token is replayed
    if (existing.revokedAt !== null) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      await this.auditLogger?.log({
        actorId: existing.employee.id,
        actorName: existing.employee.name,
        actorEmail: existing.employee.email,
        actorRole: 'SECURITY',
        action: 'Detected refresh token replay attempt and revoked session family',
        actionCode: 'SECURITY_REFRESH_REUSE_DETECTED',
        severity: 'CRITICAL',
        entityType: 'Employee',
        entityId: existing.employee.id,
        entityTitle: existing.employee.name,
        description: `Revoked token family ${existing.familyId} after rotated token reuse attempt`,
        category: 'security',
        badgeColor: 'rose',
        ipAddress: extractClientIp(request),
      })

      this.clearAuthCookies(request, response)
      throw new UnauthorizedException(
        'Session invalidated due to token reuse. Please sign in again.',
      )
    }

    if (existing.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      })
      this.clearAuthCookies(request, response)
      throw new UnauthorizedException('Session expired. Please sign in again.')
    }

    const employee = existing.employee
    if (employee.isSuspended) {
      await this.prisma.refreshToken.updateMany({
        where: { employeeId: employee.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      this.clearAuthCookies(request, response)
      throw new ForbiddenException('Account Suspended. Contact HR.')
    }

    const isSystemRoot = employee.employeeRoles.some((er) => er.role.isSystemDefault)
    if (this.allowlistService) {
      const allowed = await this.allowlistService.isEmailAllowed(employee.email, isSystemRoot)
      if (!allowed) {
        this.clearAuthCookies(request, response)
        throw new ForbiddenException('This account is not allowed.')
      }
    }

    const activeSlugs = employee.employeeRoles.map((er) => er.role.slug)
    const fallbackCategory = employee.positionAssignments[0]?.position.roleCategory
    const primaryRole = resolveCanonicalRoleSlug(activeSlugs, fallbackCategory)

    const accessProfile = this.rbacService
      ? await this.rbacService.getEmployeeAccessProfile(employee.id)
      : null
    const effectivePermissions = accessProfile?.permissions || []

    await this.issueSessionCookies(
      employee.id,
      employee.email,
      primaryRole,
      existing.familyId,
      request,
      response,
      tokenHash,
    )

    return {
      authenticated: true,
      user: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        title: employee.title,
        initials: employee.initials,
        avatarUrl: employee.avatarUrl,
        status: employee.status,
        isSuspended: employee.isSuspended,
        mustChangePassword: employee.mustChangePassword,
        mustEnrollMfa: employee.mustEnrollMfa && !employee.mfaEnabled,
        mfaEnabled: employee.mfaEnabled,
        role: primaryRole,
        roles: employee.employeeRoles.map((er) => ({
          id: er.role.id,
          slug: er.role.slug,
          name: er.role.name,
        })),
        permissions: effectivePermissions,
      },
    }
  }

  async changePassword(
    actor: AuthenticatedUser,
    dto: ChangePasswordDto & { mfaCode?: string },
    headerMfaCode?: string,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: actor.employeeId || actor.id },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        isSuspended: true,
        mfaEnabled: true,
      },
    })

    if (!employee || employee.isSuspended) {
      throw new ForbiddenException('Account unavailable.')
    }

    if (!employee.passwordHash) {
      throw new ForbiddenException('Account password is not initialized.')
    }

    const matches = await bcrypt.compare(dto.currentPassword, employee.passwordHash)
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect.')
    }

    if (employee.mfaEnabled && this.freshMfa) {
      await this.freshMfa.verifyFreshMfa({
        actorId: employee.id,
        actionKey: 'account:change_password',
        targetId: employee.id,
        code: headerMfaCode || dto.mfaCode,
      })
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new ForbiddenException('New password must differ from current temporary password.')
    }

    const nextHash = await bcrypt.hash(dto.newPassword, 12)
    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        passwordHash: nextHash,
        mustChangePassword: false,
        authVersion: { increment: 1 },
      },
      select: {
        id: true,
        mustChangePassword: true,
        mustEnrollMfa: true,
        mfaEnabled: true,
      },
    })

    await this.auditLogger?.log({
      actorId: employee.id,
      actorName: employee.name,
      actorEmail: employee.email,
      actorRole: actor.role.toUpperCase(),
      action: 'AUTH_PASSWORD_CHANGED',
      actionCode: 'AUTH_PASSWORD_CHANGED',
      severity: 'INFO',
      entityType: 'Employee',
      entityId: employee.id,
      description: `${employee.name} rotated account password.`,
      category: 'security',
      badgeColor: 'emerald',
    })

    return {
      changed: true,
      mustChangePassword: updated.mustChangePassword,
      mustEnrollMfa: updated.mustEnrollMfa && !updated.mfaEnabled,
    }
  }

  async logout(request: Request, response: Response) {
    const cookies = request?.cookies as Record<string, string | undefined> | undefined
    const rawRefreshToken = cookies?.[REFRESH_TOKEN_COOKIE]

    if (rawRefreshToken) {
      const tokenHash = sha256Hex(rawRefreshToken)
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }

    this.clearAuthCookies(request, response)
    return { loggedOut: true }
  }

  async getProfile(actor: AuthenticatedUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: actor.employeeId || actor.id },
      select: {
        id: true,
        email: true,
        name: true,
        title: true,
        initials: true,
        avatarUrl: true,
        status: true,
        isSuspended: true,
        mustChangePassword: true,
        mustEnrollMfa: true,
        mfaEnabled: true,
        timezone: true,
        skills: true,
        bio: true,
        employeeRoles: {
          where: { isActive: true, role: { isActive: true } },
          select: {
            role: {
              select: { id: true, slug: true, name: true },
            },
          },
        },
        positionAssignments: {
          where: { isActive: true },
          select: {
            position: {
              select: { roleCategory: true },
            },
          },
        },
      },
    })

    if (!employee) {
      throw new UnauthorizedException('Employee record not found.')
    }

    if (employee.isSuspended) {
      throw new ForbiddenException('Account Suspended. Contact HR.')
    }

    const activeSlugs = employee.employeeRoles.map((er) => er.role.slug)
    const fallbackCategory = employee.positionAssignments[0]?.position.roleCategory
    const primaryRole = resolveCanonicalRoleSlug(activeSlugs, fallbackCategory)

    const accessProfile = this.rbacService
      ? await this.rbacService.getEmployeeAccessProfile(employee.id)
      : null
    const effectivePermissions = accessProfile?.permissions || []

    return {
      id: employee.id,
      email: employee.email,
      name: employee.name,
      title: employee.title,
      initials: employee.initials,
      avatarUrl: employee.avatarUrl,
      status: employee.status,
      isSuspended: employee.isSuspended,
      mustChangePassword: employee.mustChangePassword,
      mustEnrollMfa: employee.mustEnrollMfa && !employee.mfaEnabled,
      mfaEnabled: employee.mfaEnabled,
      timezone: employee.timezone,
      skills: employee.skills,
      bio: employee.bio,
      role: primaryRole,
      roles: employee.employeeRoles.map((er) => er.role),
      permissions: effectivePermissions,
    }
  }

  async forgotPassword(rawEmail: string) {
    const email = (rawEmail || '').trim().toLowerCase()
    const employee = email
      ? await this.prisma.employee.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, isSuspended: true },
        })
      : null

    if (!employee || employee.isSuspended) {
      return { sent: true }
    }

    if (this.allowlistService) {
      const fullEmp = await this.prisma.employee.findUnique({
        where: { id: employee.id },
        select: { employeeRoles: { where: { isActive: true }, select: { role: { select: { isSystemDefault: true } } } } },
      })
      const isRoot = fullEmp?.employeeRoles.some((er) => er.role.isSystemDefault) ?? false
      const allowed = await this.allowlistService.isEmailAllowed(employee.email, isRoot)
      if (!allowed) {
        await this.allowlistService.recordBlockedAttempt(
          employee.email,
          'forgot_password',
          'Email not on active login allowlist',
        )
        return { sent: true }
      }
    }

    const token = this.jwtService.sign(
      { sub: employee.id, purpose: 'password_reset' },
      { expiresIn: '15m' },
    )
    const mailResult = await this.mailService?.sendPasswordResetLink({
      to: employee.email,
      name: employee.name,
      resetToken: token,
      ttlMinutes: 15,
    })
    const isProd = this.configService?.get<string>('NODE_ENV') === 'production'
    return {
      sent: true,
      emailSent: mailResult?.sent ?? false,
      ...(isProd ? {} : { resetTokenPreview: token }),
    }
  }

  async resetPasswordWithToken(
    body: { token: string; newPassword: string; mfaCode?: string },
    headerMfaCode?: string,
  ) {
    const rawToken = (body.token || '').trim()
    if (!rawToken) {
      throw new UnauthorizedException('Setup or reset token is missing.')
    }

    // Check one-time 24h onboarding invite token first
    const tokenHash = sha256Hex(rawToken)
    const invitedLookup = (this.prisma as any).employee?.findUnique
      ? await this.prisma.employee
          .findUnique({
            where: { inviteTokenHash: tokenHash },
            select: {
              id: true,
              name: true,
              email: true,
              isSuspended: true,
              mfaEnabled: true,
              inviteTokenHash: true,
              inviteTokenExpiresAt: true,
              inviteTokenUsedAt: true,
            },
          })
          .catch(() => null)
      : null
    const invitedEmployee =
      invitedLookup &&
      (invitedLookup.inviteTokenHash === tokenHash ||
        invitedLookup.inviteTokenExpiresAt ||
        invitedLookup.inviteTokenUsedAt)
        ? invitedLookup
        : null

    if (invitedEmployee) {
      if (invitedEmployee.isSuspended) {
        throw new ForbiddenException('Account unavailable.')
      }
      if (
        invitedEmployee.inviteTokenUsedAt ||
        !invitedEmployee.inviteTokenExpiresAt ||
        invitedEmployee.inviteTokenExpiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException('This setup link has already been used or expired.')
      }

      const nextHash = await bcrypt.hash(body.newPassword, 12)
      const usedAt = new Date()
      await this.prisma.$transaction(async (tx) => {
        await tx.employee.update({
          where: { id: invitedEmployee.id },
          data: {
            passwordHash: nextHash,
            mustChangePassword: false,
            inviteTokenHash: null,
            inviteTokenUsedAt: usedAt,
            inviteDeliveryStatus: 'sent',
            inviteLastError: null,
            authVersion: { increment: 1 },
          },
        })
        await tx.refreshToken.updateMany({
          where: { employeeId: invitedEmployee.id, revokedAt: null },
          data: { revokedAt: usedAt },
        })
        await tx.employeeChangeHistory.create({
          data: {
            employeeId: invitedEmployee.id,
            actorId: invitedEmployee.id,
            actionKey: 'account:invite_link_used',
            changeType: 'SECURITY',
            beforeState: { inviteUsed: false } as any,
            afterState: { inviteUsed: true, usedAt: usedAt.toISOString() } as any,
            reason: 'Employee activated account using 24-hour one-time setup link',
          },
        })
      })

      await this.auditLogger?.log({
        actorId: invitedEmployee.id,
        actorName: invitedEmployee.name,
        actorEmail: invitedEmployee.email,
        actorRole: 'EMPLOYEE',
        action: `Activated account via one-time setup link (${invitedEmployee.name})`,
        actionCode: 'EMPLOYEE_INVITE_LINK_USED',
        severity: 'INFO',
        entityType: 'Employee',
        entityId: invitedEmployee.id,
        description: `${invitedEmployee.name} used their 24-hour one-time onboarding link and set a password.`,
        category: 'security',
      })

      return { reset: true, activated: true, inviteUsedAt: usedAt.toISOString() }
    }

    let payload: { sub?: string; purpose?: string }
    try {
      payload = this.jwtService.verify(rawToken)
    } catch {
      throw new UnauthorizedException('This setup or reset link is invalid, already used, or expired.')
    }
    if (payload.purpose !== 'password_reset' || !payload.sub) {
      throw new UnauthorizedException('Invalid password reset token.')
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, isSuspended: true, mfaEnabled: true },
    })
    if (!employee || employee.isSuspended) {
      throw new ForbiddenException('Account unavailable.')
    }

    if (employee.mfaEnabled && this.freshMfa) {
      await this.freshMfa.verifyFreshMfa({
        actorId: employee.id,
        actionKey: 'account:reset_password',
        targetId: employee.id,
        code: headerMfaCode || body.mfaCode,
      })
    }

    const nextHash = await bcrypt.hash(body.newPassword, 12)
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        passwordHash: nextHash,
        mustChangePassword: false,
        authVersion: { increment: 1 },
      },
    })
    await this.prisma.refreshToken.updateMany({
      where: { employeeId: employee.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { reset: true }
  }

  async regenerateRecoveryCodes(
    actor: AuthenticatedUser,
    body: { currentPassword?: string; mfaCode?: string },
    headerMfaCode?: string,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: actor.employeeId || actor.id },
      select: { id: true, passwordHash: true, mfaEnabled: true, isSuspended: true },
    })
    if (!employee || employee.isSuspended) {
      throw new ForbiddenException('Account unavailable.')
    }

    if (employee.mfaEnabled && this.freshMfa) {
      await this.freshMfa.verifyFreshMfa({
        actorId: employee.id,
        actionKey: 'account:recovery_codes',
        targetId: employee.id,
        code: headerMfaCode || body.mfaCode,
      })
    } else {
      const ok =
        body.currentPassword &&
        employee.passwordHash &&
        (await bcrypt.compare(body.currentPassword, employee.passwordHash))
      if (!ok) {
        throw new UnauthorizedException('Current password confirmation required.')
      }
    }

    const plainCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase(),
    )
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)))

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { mfaRecoveryCodes: hashedCodes },
    })

    return { recoveryCodes: plainCodes }
  }

  private async verifyLoginMfaOrRecovery(
    employeeId: string,
    mfaSecret: string | null,
    mfaRecoveryCodes: string[] | undefined,
    mfaCode?: string,
    recoveryCode?: string,
  ): Promise<'VERIFIED' | 'REQUIRED'> {
    const cleanedRecovery = recoveryCode?.trim().toUpperCase()
    const cleanedMfa = mfaCode?.trim()

    if (!cleanedMfa && !cleanedRecovery) {
      return 'REQUIRED'
    }

    if (cleanedRecovery) {
      const hashes = Array.isArray(mfaRecoveryCodes) ? mfaRecoveryCodes : []
      let matchedIndex = -1
      for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(cleanedRecovery, hashes[i])) {
          matchedIndex = i
          break
        }
      }
      if (matchedIndex < 0) {
        throw new UnauthorizedException('Invalid recovery code.')
      }
      const nextHashes = hashes.filter((_, idx) => idx !== matchedIndex)
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { mfaRecoveryCodes: nextHashes },
      })
      return 'VERIFIED'
    }

    if (!mfaSecret || !cleanedMfa || !verifyTotpCode(mfaSecret, cleanedMfa)) {
      throw new UnauthorizedException('Invalid 6-digit MFA code.')
    }
    return 'VERIFIED'
  }

  private getFrontendUrl(): string {
    return (this.configService?.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(
      /\/+$/,
      '',
    )
  }

  getGoogleAuthUrl(): string {
    const clientId = this.configService?.get<string>('GOOGLE_CLIENT_ID')?.trim()
    const redirectUri = this.configService?.get<string>('GOOGLE_REDIRECT_URI')?.trim()
    if (!clientId || !redirectUri) {
      throw new ForbiddenException('Google Sign-In is not configured on this server.')
    }
    const nonce = crypto.randomBytes(16).toString('hex')
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    const state = this.jwtService.sign(
      { purpose: 'google_oauth', nonce },
      { expiresIn: '10m' },
    )
    this.googlePkceChallenges.set(nonce, {
      codeVerifier,
      nonce,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async handleGoogleCallback(
    params: { code?: string; state?: string; oauthError?: string },
    response: Response,
  ) {
    const frontendLogin = `${this.getFrontendUrl()}/login`
    const failRedirect = (errorCode: string, message: string) =>
      response.redirect(
        `${frontendLogin}?oauthErrorCode=${encodeURIComponent(errorCode)}&oauthError=${encodeURIComponent(message)}`,
      )

    if (params.oauthError) {
      if (params.oauthError === 'access_denied') {
        return failRedirect('cancelled', 'Google sign-in was cancelled.')
      }
      return failRedirect('google_error', 'Google sign-in failed. Please try again.')
    }
    if (!params.code || !params.state) {
      return failRedirect('google_error', 'Missing Google authorization code or state.')
    }

    let pkceEntry: { codeVerifier: string; nonce: string; expiresAt: number } | undefined
    try {
      const statePayload = this.jwtService.verify<{ purpose?: string; nonce?: string }>(
        params.state,
      )
      if (statePayload.purpose !== 'google_oauth' || !statePayload.nonce) {
        return failRedirect('expired_link', 'Invalid Google sign-in link. Please try again.')
      }
      pkceEntry = this.googlePkceChallenges.get(statePayload.nonce)
      this.googlePkceChallenges.delete(statePayload.nonce)
      if (!pkceEntry || pkceEntry.expiresAt < Date.now()) {
        return failRedirect('expired_link', 'This Google sign-in link expired. Please try again.')
      }
    } catch {
      return failRedirect('expired_link', 'This Google sign-in link expired. Please try again.')
    }

    const clientId = this.configService?.get<string>('GOOGLE_CLIENT_ID')?.trim()
    const clientSecret = this.configService?.get<string>('GOOGLE_CLIENT_SECRET')?.trim()
    const redirectUri = this.configService?.get<string>('GOOGLE_REDIRECT_URI')?.trim()
    if (!clientId || !clientSecret || !redirectUri) {
      return failRedirect('google_error', 'Google Sign-In is not configured on this server.')
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: params.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: pkceEntry.codeVerifier,
        }).toString(),
      })
      if (!tokenRes.ok) {
        return failRedirect('google_error', 'Failed to exchange Google authorization code.')
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string }
      if (!tokenJson.access_token) {
        return failRedirect('google_error', 'Google access token missing from response.')
      }

      const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      })
      if (!userInfoRes.ok) {
        return failRedirect('google_error', 'Failed to fetch Google user profile.')
      }
      const profile = (await userInfoRes.json()) as {
        sub?: string
        email?: string
        email_verified?: boolean
      }
      const email = profile.email?.trim().toLowerCase()
      if (!profile.sub || !email || profile.email_verified !== true) {
        return failRedirect('unverified_email', 'Your Google account email is not verified.')
      }

      const employee = await this.prisma.employee.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: {
          employeeRoles: {
            where: { isActive: true, role: { isActive: true } },
            include: { role: true },
          },
          positionAssignments: {
            where: { isActive: true },
            include: { position: true },
          },
        },
      })

      if (!employee) {
        return failRedirect('not_allowed', 'This account is not allowed.')
      }
      if (employee.isSuspended) {
        return failRedirect('not_allowed', 'This account is not allowed.')
      }

      const isSystemRoot = employee.employeeRoles.some((er) => er.role.isSystemDefault)
      if (this.allowlistService) {
        const allowed = await this.allowlistService.isEmailAllowed(employee.email, isSystemRoot)
        if (!allowed) {
          await this.allowlistService.recordBlockedAttempt(
            employee.email,
            'google',
            'Email not on active login allowlist',
          )
          return failRedirect('not_allowed', 'This account is not allowed.')
        }
      }

      await this.prisma.externalIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider: 'google',
            providerUserId: profile.sub,
          },
        },
        update: {
          employeeId: employee.id,
          email,
          emailVerified: true,
          lastLoginAt: new Date(),
        },
        create: {
          employeeId: employee.id,
          provider: 'google',
          providerUserId: profile.sub,
          email,
          emailVerified: true,
          lastLoginAt: new Date(),
        },
      })

      const oneTimeCode = crypto.randomBytes(24).toString('base64url')
      this.googleOneTimeCodes.set(oneTimeCode, {
        employeeId: employee.id,
        expiresAt: Date.now() + GOOGLE_CODE_TTL_MS,
      })

      return response.redirect(`${frontendLogin}?oauthCode=${encodeURIComponent(oneTimeCode)}`)
    } catch {
      return failRedirect('google_error', 'Google sign-in failed unexpectedly.')
    }
  }

  async exchangeGoogleCode(
    body: { code?: string; pendingToken?: string; mfaCode?: string; recoveryCode?: string },
    request: Request,
    response: Response,
  ) {
    let employeeId: string | undefined

    if (body.pendingToken) {
      try {
        const payload = this.jwtService.verify<{ sub?: string; purpose?: string }>(body.pendingToken)
        if (payload.purpose === 'google_mfa_challenge' && payload.sub) {
          employeeId = payload.sub
        }
      } catch {
        throw new UnauthorizedException('Google MFA challenge expired. Sign in with Google again.')
      }
    } else if (body.code) {
      const entry = this.googleOneTimeCodes.get(body.code)
      this.googleOneTimeCodes.delete(body.code)
      if (!entry || entry.expiresAt < Date.now()) {
        throw new UnauthorizedException('Google sign-in code is invalid or expired.')
      }
      employeeId = entry.employeeId
    }

    if (!employeeId) {
      throw new UnauthorizedException('Missing Google sign-in code.')
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employeeRoles: {
          where: { isActive: true, role: { isActive: true } },
          include: { role: true },
        },
        positionAssignments: {
          where: { isActive: true },
          include: { position: true },
        },
      },
    })

    if (!employee || employee.isSuspended) {
      throw new ForbiddenException('Account unavailable.')
    }

    if (employee.mfaEnabled) {
      const mfaResult = await this.verifyLoginMfaOrRecovery(
        employee.id,
        employee.mfaSecret,
        employee.mfaRecoveryCodes,
        body.mfaCode,
        body.recoveryCode,
      )
      if (mfaResult === 'REQUIRED') {
        const pendingToken = this.jwtService.sign(
          { sub: employee.id, purpose: 'google_mfa_challenge' },
          { expiresIn: '5m' },
        )
        return {
          authenticated: false,
          mfaRequired: true,
          pendingToken,
          methods: ['totp', 'recovery'],
        }
      }
    }

    const activeSlugs = employee.employeeRoles.map((er) => er.role.slug)
    const fallbackCategory = employee.positionAssignments[0]?.position.roleCategory
    const primaryRole = resolveCanonicalRoleSlug(activeSlugs, fallbackCategory)
    const accessProfile = this.rbacService
      ? await this.rbacService.getEmployeeAccessProfile(employee.id)
      : null

    await this.issueSessionCookies(
      employee.id,
      employee.email,
      primaryRole,
      crypto.randomUUID(),
      request,
      response,
    )

    await this.prisma.employee
      .update({
        where: { id: employee.id },
        data: { lastLoginAt: new Date(), lastLoginMethod: 'google' },
      })
      .catch(() => undefined)

    await this.auditLogger?.log({
      actorId: employee.id,
      actorName: employee.name,
      actorEmail: employee.email,
      actorRole: primaryRole,
      action: 'Signed in via Google OAuth + HttpOnly JWT session',
      actionCode: 'AUTH_GOOGLE_LOGIN',
      severity: 'INFO',
      entityType: 'Employee',
      entityId: employee.id,
      entityTitle: employee.name,
      description: `${employee.name} signed in via Google OAuth (${employee.email})`,
      category: 'security',
      ipAddress: extractClientIp(request),
    })

    return {
      authenticated: true,
      user: {
        id: employee.id,
        email: employee.email,
        name: employee.name,
        title: employee.title,
        initials: employee.initials,
        avatarUrl: employee.avatarUrl,
        status: employee.status,
        isSuspended: employee.isSuspended,
        mustChangePassword: employee.mustChangePassword,
        mustEnrollMfa: employee.mustEnrollMfa && !employee.mfaEnabled,
        mfaEnabled: employee.mfaEnabled,
        role: primaryRole,
        roles: employee.employeeRoles.map((er) => ({
          id: er.role.id,
          slug: er.role.slug,
          name: er.role.name,
        })),
        permissions: accessProfile?.permissions || [],
      },
    }
  }

  async getMySessionsAndLinks(actor: AuthenticatedUser) {
    const employeeId = actor.employeeId || actor.id
    const [sessions, externalIdentities, employee] = await Promise.all([
      this.prisma.securitySession.findMany({
        where: { employeeId, isRevoked: false, expiresAt: { gt: new Date() } },
        orderBy: { lastActiveAt: 'desc' },
      }),
      this.prisma.externalIdentity.findMany({
        where: { employeeId },
        select: { id: true, provider: true, email: true, emailVerified: true, lastLoginAt: true },
      }),
      this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { passwordHash: true, mfaEnabled: true },
      }),
    ])
    return {
      sessions,
      externalIdentities,
      hasPassword: Boolean(employee?.passwordHash),
      mfaEnabled: Boolean(employee?.mfaEnabled),
    }
  }

  async revokeMySession(actor: AuthenticatedUser, sessionId: string) {
    const employeeId = actor.employeeId || actor.id
    const session = await this.prisma.securitySession.findUnique({ where: { id: sessionId } })
    if (!session || session.employeeId !== employeeId) {
      throw new ForbiddenException('Session not found or not owned by you.')
    }
    const now = new Date()
    await this.prisma.$transaction([
      this.prisma.securitySession.update({
        where: { id: sessionId },
        data: { isRevoked: true, revokedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { employeeId, familyId: session.tokenFamilyId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ])
    return { revoked: true, id: sessionId }
  }

  async unlinkGoogleIdentity(actor: AuthenticatedUser) {
    const employeeId = actor.employeeId || actor.id
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { passwordHash: true },
    })
    if (!employee?.passwordHash) {
      throw new ForbiddenException(
        'Set a local password before unlinking your Google account so you do not lock yourself out.',
      )
    }
    await this.prisma.externalIdentity.deleteMany({
      where: { employeeId, provider: 'google' },
    })
    return { unlinked: true }
  }
}
