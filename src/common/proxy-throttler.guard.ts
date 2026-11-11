import { Inject, Injectable, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ThrottlerGuard } from '@nestjs/throttler'
import type { ThrottlerRequest } from '@nestjs/throttler'
import type { Request } from 'express'
import { extractClientIp } from './ip-address.util'

@Injectable()
export class ProxyThrottlerGuard extends ThrottlerGuard {
  @Optional()
  @Inject(ConfigService)
  private readonly configService?: ConfigService

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const bypass =
      this.configService?.get<boolean | string>('THROTTLE_BYPASS') ?? process.env.THROTTLE_BYPASS
    if (bypass === true || String(bypass).toLowerCase() === 'true') {
      return true
    }
    return super.handleRequest(requestProps)
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return extractClientIp(req as unknown as Request)
  }
}
