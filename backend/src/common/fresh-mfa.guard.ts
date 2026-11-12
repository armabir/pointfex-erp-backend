import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FRESH_MFA_ACTION_KEY } from './requires-fresh-mfa.decorator'
import { FreshMfaService } from '../rbac/fresh-mfa.service'
import { AuthenticatedUser } from './auth-user.interface'

@Injectable()
export class FreshMfaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly freshMfa: FreshMfaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actionKey = this.reflector.getAllAndOverride<string | undefined>(
      FRESH_MFA_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!actionKey) return true

    const req = context.switchToHttp().getRequest()
    const user = req.user as AuthenticatedUser | undefined
    if (!user?.id) {
      throw new ForbiddenException('Authenticated user identity required.')
    }

    const codeHeader =
      typeof req.headers?.['x-mfa-code'] === 'string' ? req.headers['x-mfa-code'] : ''
    const boundActionHeader =
      typeof req.headers?.['x-mfa-action'] === 'string' ? req.headers['x-mfa-action'] : undefined
    const boundTargetHeader =
      typeof req.headers?.['x-mfa-target'] === 'string' ? req.headers['x-mfa-target'] : undefined

    const targetId = String(
      req.params?.employeeId ||
        req.params?.id ||
        req.params?.requestId ||
        req.params?.roleId ||
        req.params?.denialId ||
        req.body?.employeeId ||
        req.body?.targetEmployeeId ||
        req.body?.delegateeId ||
        req.body?.successorId ||
        req.body?.roleId ||
        'global',
    )

    const reason =
      typeof req.body?.reason === 'string'
        ? req.body.reason
        : typeof req.body?.reviewNotes === 'string'
          ? req.body.reviewNotes
          : typeof req.body?.feedback === 'string'
            ? req.body.feedback
            : undefined

    const verified = await this.freshMfa.verifyFreshMfa({
      actorId: user.id,
      actionKey,
      targetId,
      code: codeHeader,
      boundActionHeader,
      boundTargetHeader,
      reason,
      ipAddress: req.ip || (req.headers?.['x-forwarded-for'] as string | undefined),
      device: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    })

    req.freshMfa = verified
    return true
  }
}
