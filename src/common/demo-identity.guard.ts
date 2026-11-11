import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'

export interface DemoUser {
  id: string
  role: string
}

@Injectable()
export class DemoIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    
    // Extract development-only demo identity headers
    const userId = (request.headers['x-demo-user-id'] as string) || (request.query?.demoUserId as string) || 'emp_dev_01'
    const role = (request.headers['x-demo-role'] as string) || (request.query?.demoRole as string) || 'developer'

    request.user = {
      id: userId,
      role: role.toLowerCase(),
    } as DemoUser

    return true
  }
}

