jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }))
jest.mock('@nestjs/passport', () => ({ PassportStrategy: () => class {} }))
jest.mock('passport-jwt', () => ({ Strategy: class {}, ExtractJwt: { fromExtractors: () => () => null } }))

import * as bcrypt from 'bcrypt'
import { BadRequestException, ForbiddenException, HttpStatus, UnauthorizedException } from '@nestjs/common'
import { LoginAllowlistService } from './login-allowlist.service'
import { MailService } from '../mail/mail.service'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'

describe('LoginAllowlistService, MailService, Recovery Codes & Google OAuth', () => {
  it('enforces CEO-only rule on login allowlist management and ALLOW_DOMAIN_RULES=false', async () => {
    const entries: any[] = []
    const prisma: any = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === 'emp_ceo') {
            return {
              id: 'emp_ceo',
              name: 'Supreme CEO',
              email: 'ceo@pointfex.internal',
              employeeRoles: [{ isActive: true, role: { slug: 'ceo', isSystem: true, isActive: true } }],
              positionAssignments: [],
            }
          }
          return {
            id: 'emp_cto',
            name: 'CTO User',
            email: 'cto@pointfex.internal',
            employeeRoles: [{ isActive: true, role: { slug: 'cto', isSystem: false, isActive: true } }],
            positionAssignments: [],
          }
        }),
      },
      loginAllowlistEntry: {
        findMany: jest.fn(async () => entries),
        findFirst: jest.fn(async ({ where }: any) =>
          entries.find((e) => e.isActive && where.pattern.in.includes(e.pattern)) || null,
        ),
        upsert: jest.fn(async ({ where, create }: any) => {
          const row = { id: `allow_${entries.length + 1}`, ...create, pattern: where.pattern }
          entries.push(row)
          return row
        }),
      },
    }

    const config: any = {
      get: (k: string) =>
        k === 'LOGIN_ALLOWLIST_REQUIRED' ? 'true' : k === 'ALLOW_DOMAIN_RULES' ? 'false' : undefined,
    }
    const allowlist = new LoginAllowlistService(prisma, config)

    // Non-CEO blocked
    await expect(
      allowlist.addEntry(
        { id: 'emp_cto', role: 'cto', email: 'cto@pointfex.internal' } as any,
        'a@b.com',
        undefined,
        'Testing non-CEO restriction',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    // Domain rule blocked when ALLOW_DOMAIN_RULES=false
    await expect(
      allowlist.addEntry(
        { id: 'emp_ceo', role: 'ceo', email: 'ceo@pointfex.internal' } as any,
        '@pointfex.com',
        undefined,
        'Testing domain rule rejection',
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    // CEO can bulk import exact emails
    const imported = await allowlist.bulkImport(
      { id: 'emp_ceo', role: 'ceo', email: 'ceo@pointfex.internal' } as any,
      {
        entries: 'alice@pointfex.com\nbob@pointfex.com, alice@pointfex.com',
        reason: 'Bulk onboarding for new team members',
      },
    )
    expect(imported.imported).toBe(2)

    expect(await allowlist.isEmailAllowed('alice@pointfex.com', false)).toBe(true)
    expect(await allowlist.isEmailAllowed('intruder@gmail.com', false)).toBe(false)
    expect(await allowlist.isEmailAllowed('ceo@pointfex.internal', true)).toBe(true)
  })

  it('consumes a single-use recovery code during login and rejects expired temporary passwords', async () => {
    const recoveryPlain = 'ABCDE12345'
    const recoveryHash = await bcrypt.hash(recoveryPlain, 6)
    const passwordHash = await bcrypt.hash('StrongPass123!', 6)

    let storedRecovery = [recoveryHash]
    let tempExpiresAt: Date | null = null

    const prisma: any = {
      employee: {
        findFirst: jest.fn(async () => ({
          id: 'emp_1',
          email: 'dev@pointfex.com',
          name: 'Dev User',
          title: 'Developer',
          initials: 'DU',
          avatarUrl: null,
          status: 'online',
          isSuspended: false,
          passwordHash,
          mustChangePassword: true,
          mustEnrollMfa: false,
          mfaEnabled: true,
          mfaSecret: 'JBSWY3DPEHPK3PXP',
          mfaRecoveryCodes: storedRecovery,
          tempPasswordExpiresAt: tempExpiresAt,
          employeeRoles: [{ isActive: true, role: { id: 'r1', slug: 'developer', name: 'Developer', isSystem: false } }],
          positionAssignments: [],
        })),
        update: jest.fn(async ({ data }: any) => {
          if (data.mfaRecoveryCodes) storedRecovery = data.mfaRecoveryCodes
          return {}
        }),
      },
      refreshToken: { create: jest.fn(async () => ({})) },
      securitySession: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    }

    const jwt: any = { signAsync: jest.fn(async () => 'jwt.token'), sign: jest.fn(() => 'signed'), verify: jest.fn() }
    const auth = new AuthService(prisma, jwt)
    const req: any = { headers: {} }
    const res: any = { cookie: jest.fn(), clearCookie: jest.fn() }

    // 1. Expired temp password rejected
    tempExpiresAt = new Date(Date.now() - 60_000)
    await expect(
      auth.login({ email: 'dev@pointfex.com', password: 'StrongPass123!' }, req, res),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    // 2. Valid temp password + MFA enabled without code prompts MFA challenge
    tempExpiresAt = new Date(Date.now() + 60_000)
    const challenge = await auth.login(
      { email: 'dev@pointfex.com', password: 'StrongPass123!' },
      req,
      res,
    )
    expect(challenge).toMatchObject({ authenticated: false, mfaRequired: true })

    // 3. Valid recovery code signs in and consumes code
    const ok = await auth.login(
      { email: 'dev@pointfex.com', password: 'StrongPass123!', recoveryCode: recoveryPlain },
      req,
      res,
    )
    expect(ok).toMatchObject({ authenticated: true })
    expect(storedRecovery).toHaveLength(0)

    // 4. Reusing consumed recovery code fails
    await expect(
      auth.login(
        { email: 'dev@pointfex.com', password: 'StrongPass123!', recoveryCode: recoveryPlain },
        req,
        res,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('GET /api/auth/google returns 302 to accounts.google.com with PKCE+state+nonce and callback handles errors', async () => {
    const config: any = {
      get: (k: string) =>
        ({
          GOOGLE_CLIENT_ID: 'google-client-id',
          GOOGLE_CLIENT_SECRET: 'google-secret',
          GOOGLE_REDIRECT_URI: 'http://localhost:5173/api/auth/google/callback',
          NODE_ENV: 'test',
          FRONTEND_URL: 'http://localhost:5173',
        })[k],
    }
    const jwt: any = {
      sign: jest.fn(() => 'signed_state'),
      verify: jest.fn(() => {
        throw new Error('expired')
      }),
    }
    const auth = new AuthService({} as any, jwt, config)
    const controller = new AuthController(auth)

    const res: any = { redirect: jest.fn() }
    controller.getGoogleAuthUrl(res)
    expect(res.redirect).toHaveBeenCalledTimes(1)
    const [status, redirectUrl] = res.redirect.mock.calls[0]
    expect(status).toBe(HttpStatus.FOUND)
    const parsed = new URL(redirectUrl)
    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(parsed.searchParams.get('scope')).toBe('openid email profile')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy()
    expect(parsed.searchParams.get('nonce')).toBeTruthy()
    expect(parsed.searchParams.get('state')).toBe('signed_state')

    // Callback: cancelled
    const cancelRes: any = { redirect: jest.fn() }
    await controller.googleCallback(undefined, undefined, 'access_denied', cancelRes)
    expect(cancelRes.redirect.mock.calls[0][0]).toContain('oauthErrorCode=cancelled')

    // Callback: expired/invalid state
    const expiredRes: any = { redirect: jest.fn() }
    await controller.googleCallback('auth_code', 'bad_state', undefined, expiredRes)
    expect(expiredRes.redirect.mock.calls[0][0]).toContain('oauthErrorCode=expired_link')

    const mail = new MailService(config)
    const sent = await mail.sendWelcomeTempPassword({
      to: 'dev@pointfex.com',
      name: 'Dev',
      temporaryPassword: 'TempPass123!',
    })
    expect(sent).toEqual({ sent: false, provider: 'noop' })
  })
})

