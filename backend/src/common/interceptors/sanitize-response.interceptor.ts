import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

const SENSITIVE_KEYS = new Set([
  'passwordHash',
  'mfaSecret',
  'mfaRecoveryCodes',
  'temporaryPassword',
  'inviteTokenHash',
])

function sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value
  }

  if (value instanceof Date) {
    return value
  }

  // Preserve Decimal-like value objects (Prisma Decimal uses custom toJSON / d,e,s fields)
  if (
    typeof (value as { toFixed?: unknown }).toFixed === 'function' ||
    value.constructor?.name === 'Decimal'
  ) {
    return value
  }

  if (seen.has(value)) {
    return value
  }
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen))
  }

  const record = value as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(record)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue
    }
    sanitized[key] = sanitizeValue(entry, seen)
  }

  return sanitized
}

/**
 * Strips sensitive credential fields (such as passwordHash) universally
 * from all HTTP JSON payloads prior to serialization.
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => sanitizeValue(data)))
  }
}
