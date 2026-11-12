jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class {
      canActivate() {
        return true
      }
    },
}))

import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { execFileSync } from 'child_process'
import * as path from 'path'
import { Reflector } from '@nestjs/core'
import { envValidationSchema } from '../common/config/env.validation'
import { JwtAuthGuard } from '../common/jwt-auth.guard'

describe('Neon Cloud Readiness, Env Validation & First-Login Onboarding Lock', () => {
  const baseEnv = {
    NODE_ENV: 'development',
    PORT: 3000,
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/pointfex_erp?schema=public',
    CORS_ORIGIN: 'http://localhost:5173',
    JWT_SECRET: 'dev-secret-at-least-32-chars-long-value',
  }

  it('keeps DIRECT_URL optional locally and requires it + pooled flags on Neon', () => {
    const localOk = envValidationSchema.validate(baseEnv)
    expect(localOk.error).toBeUndefined()

    const neonMissingDirect = envValidationSchema.validate({
      ...baseEnv,
      DATABASE_URL:
        'postgresql://user:pass@ep-cool-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15',
    })
    expect(neonMissingDirect.error?.message).toMatch(/DIRECT_URL is required/i)

    const neonMissingPgbouncer = envValidationSchema.validate({
      ...baseEnv,
      DATABASE_URL: 'postgresql://user:pass@ep-cool-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      DIRECT_URL: 'postgresql://user:pass@ep-cool.us-east-1.aws.neon.tech/neondb?sslmode=require',
    })
    expect(neonMissingPgbouncer.error?.message).toMatch(/pgbouncer=true/i)

    const neonValid = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'production',
      DATABASE_URL:
        'postgresql://pointfex_app:strongpass@ep-cool-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15',
      DIRECT_URL:
        'postgresql://owner:strongpass@ep-cool.us-east-1.aws.neon.tech/neondb?sslmode=require',
      JWT_SECRET: 'a9d8e7f6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a392',
    })
    expect(neonValid.error).toBeUndefined()

    const prodWeakJwt = envValidationSchema.validate({
      ...baseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'short-secret-12345',
    })
    expect(prodWeakJwt.error?.message).toMatch(/at least 32 characters/i)
  })

  it('refuses prisma migrate reset / dev against non-localhost hosts', () => {
    const guardScript = path.resolve(__dirname, '../../scripts/guard-prisma-dev.js')
    expect(() =>
      execFileSync(process.execPath, [guardScript, 'migrate', 'reset'], {
        env: {
          ...process.env,
          DATABASE_URL:
            'postgresql://owner:pass@ep-cool.us-east-1.aws.neon.tech/neondb?sslmode=require',
          DIRECT_URL: '',
        },
        stdio: 'pipe',
      }),
    ).toThrow()

    expect(() =>
      execFileSync(process.execPath, [guardScript, 'migrate', 'dev'], {
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/pointfex_erp',
          DIRECT_URL:
            'postgresql://owner:pass@ep-cool.us-east-1.aws.neon.tech/neondb?sslmode=require',
        },
        stdio: 'pipe',
      }),
    ).toThrow()
  })

  it('enforces first-login password change and MFA enrollment lock inside JwtAuthGuard', () => {
    const guard = new JwtAuthGuard(new Reflector())
    const mkCtx = (url: string) =>
      ({
        getHandler: () => (() => undefined) as any,
        getClass: () => class Dummy {} as any,
        switchToHttp: () => ({ getRequest: () => ({ url }) }),
      }) as unknown as ExecutionContext

    const lockedUser = {
      id: 'emp_ceo_01',
      role: 'ceo',
      mustChangePassword: true,
      mustEnrollMfa: true,
    }

    // Operational API routes are blocked until first-login setup finishes
    expect(() => guard.handleRequest(null, lockedUser, null, mkCtx('/api/employees'))).toThrow(
      ForbiddenException,
    )
    expect(() => guard.handleRequest(null, lockedUser, null, mkCtx('/api/rbac/roles'))).toThrow(
      ForbiddenException,
    )

    // Onboarding endpoints remain accessible to finish password rotation & MFA enrollment
    expect(
      guard.handleRequest(null, lockedUser, null, mkCtx('/api/auth/change-password')),
    ).toEqual(lockedUser)
    expect(
      guard.handleRequest(null, lockedUser, null, mkCtx('/api/rbac/security/mfa/enroll')),
    ).toEqual(lockedUser)
    expect(
      guard.handleRequest(null, lockedUser, null, mkCtx('/api/rbac/security/mfa/verify')),
    ).toEqual(lockedUser)
  })
})
