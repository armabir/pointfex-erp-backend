import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { extractClientIp, runWithRequestIp } from './ip-address.util'

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const clientIp = extractClientIp(req)
    runWithRequestIp(clientIp, next)
  }
}
