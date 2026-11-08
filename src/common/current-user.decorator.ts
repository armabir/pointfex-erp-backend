import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { DemoUser } from './demo-identity.guard'

export const CurrentUser = createParamDecorator(
  (data: keyof DemoUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as DemoUser
    return data ? user?.[data] : user
  },
)

