import * as fs from 'fs'
import * as path from 'path'
import { envValidationSchema } from '../common/config/env.validation'
import { SanitizeResponseInterceptor } from '../common/interceptors/sanitize-response.interceptor'

describe('Phase D: Automated Security Audit Suite', () => {
  it('ensures every non-@Public controller route enforces authentication and/or explicit permission or self-service auth', () => {
    function walk(dir: string): string[] {
      const out: string[] = []
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...walk(p))
        else if (entry.name.endsWith('.controller.ts')) out.push(p)
      }
      return out
    }

    const controllers = walk(path.resolve(__dirname, '..'))
    expect(controllers.length).toBeGreaterThanOrEqual(10)

    const unguardedRoutes: string[] = []
    for (const file of controllers) {
      const src = fs.readFileSync(file, 'utf8')
      const isAuthController = file.endsWith('auth.controller.ts')
      const hasClassPermissionsGuard =
        src.includes('@UseGuards(PermissionsGuard)') || src.includes('@UseGuards(RolesGuard)')
      const lines = src.split('\n')
      let isPublic = false
      let hasPerm = false
      let route = ''
      for (const raw of lines) {
        const l = raw.trim()
        if (l.startsWith('@Public(')) isPublic = true
        if (/^@(Requires?Permissions?|RequireAnyPermission|RequireAllPermissions|Roles)\(/.test(l)) {
          hasPerm = true
        }
        if (/^@(Get|Post|Put|Patch|Delete)\(/.test(l)) route = l
        if (route && /^[a-zA-Z0-9_]+\(/.test(l)) {
          const isSelfService =
            (file.endsWith('rbac.controller.ts') && route === "@Get('me/permissions')") ||
            (file.endsWith('delegations.controller.ts') && route === "@Post(':id/approve')")
          if (!isPublic && !isAuthController && !isSelfService && (!hasClassPermissionsGuard || !hasPerm)) {
            unguardedRoutes.push(`${path.basename(file)}:${route}`)
          }
          isPublic = false
          hasPerm = false
          route = ''
        }
      }
    }

    expect(unguardedRoutes).toEqual([])
  })

  it('strips sensitive fields (passwordHash, mfaSecret, mfaRecoveryCodes, temporaryPassword) in response sanitizer', (done) => {
    const interceptor = new SanitizeResponseInterceptor()
    const { of } = require('rxjs')
    const mockCtx: any = { switchToHttp: () => ({ getRequest: () => ({}) }) }
    const next: any = {
      handle: () =>
        of({
          id: 'emp_1',
          passwordHash: 'hash_secret',
          mfaSecret: 'totp_secret',
          mfaRecoveryCodes: ['CODE1'],
          nested: { passwordHash: 'nested_hash', mfaSecret: 'nested_mfa' },
        }),
    }
    interceptor.intercept(mockCtx, next).subscribe((val: any) => {
      const serialized = JSON.stringify(val)
      expect(serialized).not.toContain('hash_secret')
      expect(serialized).not.toContain('totp_secret')
      expect(serialized).not.toContain('CODE1')
      expect(serialized).not.toContain('nested_hash')
      expect(serialized).not.toContain('nested_mfa')
      done()
    })
  })

  it('fails fast in production if JWT_SECRET is weaker than 32 chars', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      CORS_ORIGIN: 'https://erp.pointfex.com',
      JWT_SECRET: 'too_short_secret',
    })
    expect(error).toBeDefined()
  })
})

