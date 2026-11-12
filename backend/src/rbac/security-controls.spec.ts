import * as bcrypt from 'bcrypt'
import { ForbiddenException, BadRequestException } from '@nestjs/common'
import { AuditLoggerService } from '../common/audit-logger.service'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import {
  assertStepUpForPermission,
  generateTotpCode,
  verifyStepUpAuth,
} from '../common/security-policy.util'
import { SecurityControlsService } from './security-controls.service'
import { FinanceService } from '../finance/finance.service'

describe('Phase 6: Audit Hash Chain, Step-Up/MFA, Sessions & Immutable Ledgers', () => {
  it('computes SHA-256 hash chains and detects payload or prevHash tampering immediately', async () => {
    const chainRows: any[] = []
    let seq = 0

    const prismaMock: any = {
      auditLog: {
        findFirst: jest.fn(async () =>
          chainRows.length > 0 ? chainRows[chainRows.length - 1] : null,
        ),
        create: jest.fn(async ({ data }) => {
          const row = { id: `aud_${++seq}`, ...data }
          chainRows.push(row)
          return row
        }),
        findMany: jest.fn(async () => chainRows),
      },
    }

    const logger = new AuditLoggerService(prismaMock)
    const auditLogsService = new AuditLogsService(prismaMock)

    await logger.log({
      actorId: 'emp_ceo_01',
      actorName: 'Noor',
      actorEmail: 'noor@pointfex.com',
      actorRole: 'CEO',
      permissionSource: 'root',
      action: 'POLICY_UPDATED',
      actionCode: 'AUTHZ_POLICY_SET',
      severity: 'INFO',
      entityType: 'policy',
      entityId: 'max_delegation_days',
      description: 'Updated max delegation window to 30 days',
      category: 'security',
      ipAddress: '127.0.0.1',
    })

    await logger.log({
      actorId: 'emp_cto_01',
      actorName: 'Abir',
      actorEmail: 'abir@pointfex.com',
      actorRole: 'CTO',
      permissionSource: 'role',
      action: 'DELEGATION_CREATED',
      actionCode: 'DELEGATION_ACTIVE',
      severity: 'WARNING',
      entityType: 'delegation',
      entityId: 'del_1',
      description: 'Delegated deployments:approve for Project A',
      category: 'security',
      ipAddress: '127.0.0.1',
    })

    const cleanResult = await auditLogsService.verifyHashChain()
    expect(cleanResult.valid).toBe(true)
    expect(cleanResult.checkedCount).toBe(2)

    // Simulate malicious DB tamper on row 1 description
    const originalDesc = chainRows[0].description
    chainRows[0].description = 'Tampered benign note'
    const tamperedResult = await auditLogsService.verifyHashChain()
    expect(tamperedResult.valid).toBe(false)
    expect(tamperedResult.brokenAtId).toBe(chainRows[0].id)
    expect(tamperedResult.brokenReason).toMatch(/tamper detected/i)

    // Restore description and test prevHash link tampering on row 2
    chainRows[0].description = originalDesc
    chainRows[1].prevHash = 'deadbeef'
    const brokenLink = await auditLogsService.verifyHashChain()
    expect(brokenLink.valid).toBe(false)
    expect(brokenLink.brokenAtId).toBe(chainRows[1].id)
    expect(brokenLink.brokenReason).toMatch(/prevHash mismatch/i)
  })

  it('requires step-up re-auth for both ⚠ critical and 21 legacy isSensitive codes, and verifies executive TOTP MFA', async () => {
    const passwordHash = await bcrypt.hash('SecretPass123!', 4)
    const mfaSecret = '0123456789abcdef0123456789abcdef01234567'
    let mfaEnabled = false

    const prismaMock: any = {
      employee: {
        findUnique: jest.fn(async () => ({
          id: 'emp_ceo_01',
          passwordHash,
          isSuspended: false,
          mfaEnabled,
          mfaSecret,
        })),
      },
      permission: {
        findUnique: jest.fn(async ({ where }) => {
          if (where.code === 'employees:create') {
            return { isCritical: false, isSensitive: true } // One of the 21 non-critical sensitive codes
          }
          if (where.code === 'payroll:approve_batch') {
            return { isCritical: true, isSensitive: false }
          }
          return { isCritical: false, isSensitive: false }
        }),
      },
    }

    // Normal code skips step-up
    expect(
      await assertStepUpForPermission(prismaMock, 'emp_ceo_01', 'tasks:read_own', {}),
    ).toBeNull()

    // Non-critical isSensitive code STILL enforces step-up re-auth (no downgrade!)
    await expect(
      assertStepUpForPermission(prismaMock, 'emp_ceo_01', 'employees:create', {}),
    ).rejects.toThrow(ForbiddenException)

    // Valid password satisfies password-only step-up
    expect(
      await assertStepUpForPermission(prismaMock, 'emp_ceo_01', 'employees:create', {
        passwordConfirm: 'SecretPass123!',
      }),
    ).toBe('VERIFIED')

    // Enable Executive MFA: wrong or missing MFA rejected even with valid password
    mfaEnabled = true
    await expect(
      verifyStepUpAuth(prismaMock, 'emp_ceo_01', { passwordConfirm: 'SecretPass123!' }),
    ).rejects.toThrow(ForbiddenException)

    const validTotp = generateTotpCode(mfaSecret)
    expect(
      await verifyStepUpAuth(prismaMock, 'emp_ceo_01', {
        passwordConfirm: 'SecretPass123!',
        mfaCode: validTotp,
      }),
    ).toBe('VERIFIED_MFA')
  })

  it('tracks and revokes security sessions, and enforces append-only XP & financial ledger reversals', async () => {
    const sessions = [
      {
        id: 'sess_1',
        employeeId: 'emp_dev_01',
        tokenFamilyId: 'fam_1',
        isRevoked: false,
      },
    ]
    const refreshTokens = [{ id: 'rt_1', familyId: 'fam_1', revokedAt: null as Date | null }]
    const xpEntries: any[] = []
    const txRows: any[] = [
      {
        id: 'tx_orig',
        walletId: 'wal_1',
        employeeId: 'emp_dev_01',
        projectId: 'proj_01',
        milestoneId: null,
        amount: 5000,
        type: 'bonus',
        description: 'Sprint bonus',
        reversalOfId: null,
      },
    ]
    let walletBalance = 5000

    const prismaMock: any = {
      securitySession: {
        findUnique: jest.fn(async ({ where }) => sessions.find((s) => s.id === where.id) ?? null),
        update: jest.fn(async ({ where, data }) => {
          const s = sessions.find((row) => row.id === where.id)!
          Object.assign(s, data)
          return s
        }),
      },
      refreshToken: {
        updateMany: jest.fn(async ({ where, data }) => {
          for (const rt of refreshTokens) {
            if (rt.familyId === where.familyId) rt.revokedAt = data.revokedAt
          }
          return { count: 1 }
        }),
      },
      xpLedgerEntry: {
        create: jest.fn(async ({ data }) => {
          const row = { id: `xp_${xpEntries.length + 1}`, createdAt: new Date(), ...data }
          xpEntries.push(row)
          return row
        }),
        findMany: jest.fn(async ({ where }) =>
          xpEntries.filter((e) => e.employeeId === where.employeeId),
        ),
        findUnique: jest.fn(async ({ where }) => xpEntries.find((e) => e.id === where.id) ?? null),
        findFirst: jest.fn(async ({ where }) =>
          xpEntries.find((e) => e.reversalOfId === where.reversalOfId) ?? null,
        ),
      },
      financialTransaction: {
        findUnique: jest.fn(async ({ where }) => txRows.find((t) => t.id === where.id) ?? null),
        findFirst: jest.fn(async ({ where }) =>
          txRows.find((t) => t.reversalOfId === where.reversalOfId) ?? null,
        ),
        create: jest.fn(async ({ data }) => {
          const row = { id: `tx_${txRows.length + 1}`, createdAt: new Date(), ...data }
          txRows.push(row)
          return row
        }),
      },
      employeeWallet: {
        update: jest.fn(async ({ data }) => {
          walletBalance += Number(data.balance.increment)
          return { id: 'wal_1', balance: walletBalance }
        }),
      },
      $transaction: jest.fn(async (cb) => cb(prismaMock)),
    }

    const authzMock: any = {
      assert: jest.fn(async () => ({ allowed: true })),
      invalidateUserCache: jest.fn(async () => undefined),
    }

    const controls = new SecurityControlsService(prismaMock, authzMock)
    const devActor: any = { id: 'emp_dev_01', role: 'developer' }
    const hrActor: any = { id: 'emp_chro_01', role: 'chro' }

    // Revoking session also revokes refresh token family and invalidates authz cache
    const revokedSess = await controls.revokeSession('sess_1', devActor)
    expect(revokedSess.isRevoked).toBe(true)
    expect(refreshTokens[0].revokedAt).toBeInstanceOf(Date)
    expect(authzMock.invalidateUserCache).toHaveBeenCalledWith('emp_dev_01')

    // XP ledger award + reversal via new entry (net balance = 0)
    const awarded = await controls.awardOrAdjustXp(hrActor, {
      employeeId: 'emp_dev_01',
      delta: 150,
      reason: 'On-call incident excellence',
    })
    await controls.reverseXpEntry(awarded.id, hrActor, 'Duplicate XP award')
    const xpSummary = await controls.getEmployeeXpSummary('emp_dev_01', devActor)
    expect(xpSummary.entries).toHaveLength(2)
    expect(xpSummary.balance).toBe(0)

    // Financial ledger reversal creates offsetting reversal row & updates wallet balance cleanly
    const financeService = new FinanceService(prismaMock)
    const reversed = await financeService.reverseTransaction('tx_orig', 'Incorrect sprint attribution', hrActor)
    expect(reversed.reversed).toBe(true)
    expect(txRows).toHaveLength(2)
    expect(Number(txRows[1].amount)).toBe(-5000)
    expect(walletBalance).toBe(0)

    // Double reversal rejected
    await expect(financeService.reverseTransaction('tx_orig', 'Again', hrActor)).rejects.toThrow(
      BadRequestException,
    )
  })
})

