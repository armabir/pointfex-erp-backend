import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from './public.decorator'

const FIRST_LOGIN_ALLOWED_PATHS = new Set([
  '/api/auth/change-password',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/rbac/security/mfa/enroll',
  '/api/rbac/security/mfa/verify',
  '/api/rbac/me/effective',
  '/api/rbac/me/permissions',
])

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }
    return super.canActivate(context)
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    context?: ExecutionContext,
  ): TUser {
    if (err) {
      throw err
    }
    if (!user) {
      const message =
        info && typeof info === 'object' && 'message' in info
          ? String((info as { message: unknown }).message)
          : 'Authentication required. Please sign in.'
      throw new UnauthorizedException(message)
    }

    const authUser = user as { mustChangePassword?: boolean; mustEnrollMfa?: boolean }
    if ((authUser.mustChangePassword || authUser.mustEnrollMfa) && context) {
      const req = context.switchToHttp().getRequest()
      const cleanPath = String(req?.url || '').split('?')[0]
      if (!FIRST_LOGIN_ALLOWED_PATHS.has(cleanPath)) {
        throw new ForbiddenException(
          'First-login security setup required: rotate initial password and complete MFA enrollment before accessing ERP resources.',
        )
      }
    }

    return user
  }
}
