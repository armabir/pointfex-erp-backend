import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { extractClientIp, normalizeClientIp } from './ip-address.util'

@Injectable()
export class IpBlocklistGuard implements CanActivate {
  private readonly logger = new Logger(IpBlocklistGuard.name)
  private static readonly runtimeBlockedIps = new Set<string>()
  private readonly configuredBlockedIps: Set<string>

  constructor(private readonly configService: ConfigService) {
    const raw = this.configService.get<string>('BLOCKED_IPS') || ''
    this.configuredBlockedIps = new Set(
      raw
        .split(',')
        .map((entry) => normalizeClientIp(entry))
        .filter((entry) => entry && entry !== 'unknown'),
    )
  }

  static blockIp(ip: string): void {
    const normalized = normalizeClientIp(ip)
    if (normalized !== 'unknown') {
      IpBlocklistGuard.runtimeBlockedIps.add(normalized)
    }
  }

  static unblockIp(ip: string): void {
    const normalized = normalizeClientIp(ip)
    IpBlocklistGuard.runtimeBlockedIps.delete(normalized)
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const clientIp = extractClientIp(request)

    if (
      this.configuredBlockedIps.has(clientIp) ||
      IpBlocklistGuard.runtimeBlockedIps.has(clientIp)
    ) {
      this.logger.warn(
        `Blocked request from banned IP ${clientIp} on ${request.method} ${request.url}`,
      )
      throw new ForbiddenException('Access denied: Your IP address is blocked by network policy.')
    }

    return true
  }
}
