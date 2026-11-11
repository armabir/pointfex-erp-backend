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
import { LoginDto } from './dto/auth.dto'
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, resolveCanonicalRoleSlug } from './jwt.strategy'

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000 // 15 minutes

function sha256Hex(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

@Injectable()
export class AuthService {
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

  private buildAccessCookieOptions(request: Request): CookieOptions {
    return {
      httpOnly: true,
      secure: this.resolveCookieSecure(request),
      sameSite: 'strict',
      path: '/api',
      maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    }
  }

  private buildRefreshCookieOptions(request: Request): CookieOptions {
    return {
      httpOnly: true,
      secure: this.resolveCookieSecure(request),
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: this.getRefreshTtlDays() * 24 * 60 * 60 * 1000,
    }
  }

  private clearAuthCookies(request: Request, response: Response): void {
    const secure = this.resolveCookieSecure(request)
    response.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api',
    })
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
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
      crypto.randomUUID(),
      request,
      response,
    )

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
      timezone: employee.timezone,
      skills: employee.skills,
      bio: employee.bio,
      role: primaryRole,
      roles: employee.employeeRoles.map((er) => er.role),
      permissions: effectivePermissions,
    }
  }
}
