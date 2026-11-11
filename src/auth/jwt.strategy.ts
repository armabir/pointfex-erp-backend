import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import type { Request } from 'express'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../common/prisma.service'
import { AuthenticatedUser } from '../common/auth-user.interface'

export const ACCESS_TOKEN_COOKIE = 'pointfex_access_token'
export const REFRESH_TOKEN_COOKIE = 'pointfex_refresh_token'

export interface JwtPayload {
  sub: string
  employeeId: string
  email: string
  role: string
}

const ROLE_PRIORITY = ['ceo', 'cto', 'cfo', 'chro', 'cpo', 'pm', 'developer']

export function resolveCanonicalRoleSlug(
  activeRoleSlugs: string[],
  fallbackCategory?: string | null,
): string {
  const normalized = activeRoleSlugs.map((slug) => slug.toLowerCase())
  for (const preferred of ROLE_PRIORITY) {
    if (normalized.includes(preferred)) {
      return preferred === 'cpo' ? 'chro' : preferred
    }
  }
  if (normalized.length > 0) {
    return normalized[0]
  }
  if (fallbackCategory) {
    const cat = fallbackCategory.toLowerCase()
    return cat === 'cpo' ? 'chro' : cat
  }
  return 'developer'
}

function extractAccessTokenFromCookie(request: Request): string | null {
  const cookies = request?.cookies as Record<string, string | undefined> | undefined
  return cookies?.[ACCESS_TOKEN_COOKIE] ?? null
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractAccessTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const employeeId = payload.employeeId || payload.sub
    if (!employeeId) {
      throw new UnauthorizedException('Malformed authentication token.')
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        email: true,
        name: true,
        isSuspended: true,
        employeeRoles: {
          where: { isActive: true, role: { isActive: true } },
          select: { role: { select: { slug: true } } },
        },
        positionAssignments: {
          where: { isActive: true },
          select: { position: { select: { roleCategory: true } } },
        },
      },
    })

    if (!employee) {
      throw new UnauthorizedException('Account not found or session expired.')
    }

    if (employee.isSuspended) {
      throw new ForbiddenException('Account Suspended. Contact HR.')
    }

    const activeSlugs = employee.employeeRoles.map((er) => er.role.slug)
    const fallbackCategory = employee.positionAssignments[0]?.position.roleCategory
    const resolvedRole = resolveCanonicalRoleSlug(activeSlugs, fallbackCategory)

    return {
      id: employee.id,
      employeeId: employee.id,
      email: employee.email,
      name: employee.name,
      role: resolvedRole,
    }
  }
}
