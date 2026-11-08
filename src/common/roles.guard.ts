import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './roles.decorator'
import { DemoUser } from './demo-identity.guard'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user as DemoUser

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: Demo identity required')
    }

    // Role check: 'ceo' typically has full override capability
    const roleNormalized = user.role.toLowerCase()
    const hasRole = requiredRoles.map((r) => r.toLowerCase()).includes(roleNormalized) || roleNormalized === 'ceo'

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Required role(s) [${requiredRoles.join(', ')}], current role is [${user.role}]`,
      )
    }

    return true
  }
}

