import { AsyncLocalStorage } from 'async_hooks'
import type { Request } from 'express'

interface RequestIpContext {
  ipAddress: string
}

const requestIpStorage = new AsyncLocalStorage<RequestIpContext>()

export function normalizeClientIp(raw?: string | null): string {
  if (!raw) return 'unknown'
  const firstHop = raw.split(',')[0]?.trim() || ''
  if (!firstHop) return 'unknown'
  return firstHop.startsWith('::ffff:') ? firstHop.slice(7) : firstHop
}

export function extractClientIp(request: Request): string {
  const forwardedHeader = request.headers?.['x-forwarded-for']
  const forwarded = Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader
  const candidate = request.ip || forwarded || request.socket?.remoteAddress || null
  return normalizeClientIp(candidate)
}

export function runWithRequestIp(ipAddress: string, callback: () => void): void {
  requestIpStorage.run({ ipAddress }, callback)
}

export function getCurrentRequestIp(): string | null {
  return requestIpStorage.getStore()?.ipAddress ?? null
}
