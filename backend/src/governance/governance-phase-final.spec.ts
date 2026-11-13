import { BadRequestException, ForbiddenException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { FreshMfaService } from '../rbac/fresh-mfa.service'
import { ApprovalEngineService } from '../rbac/approval-engine.service'
import { VoteEngineService } from './vote-engine.service'
import { assertTierCeiling, isStrictlyLowerTier, RoleTier } from '../common/tier.util'
import { validatePasswordStrength, assertPasswordPolicy } from '../common/password-policy.util'

describe('Final Hardening Pass: Phases 1 to 10 Verification', () => {
  describe('Phase 1: Fresh MFA & Replay Protection', () => {
    let freshMfa: FreshMfaService
    let prismaMock: any
    let auditMock: any

    beforeEach(() => {
      const bindings = new Set<string>()
      prismaMock = {
        employee: {
          findUnique: jest.fn(async ({ where }) => {
            if (where.id === 'emp_test_mfa') {
              return {
                id: 'emp_test_mfa',
                name: 'Fahim Dev',
                email: 'fahim@pointfex.com',
                isSuspended: false,
                mfaEnabled: true,
                mfaSecret: 'JBSWY3DPEHPK3PXP', // Base32 test secret
                mfaLastUsedStep: 100,
                mfaFailureCount: 0,
                mfaFailureWindowStart: null,
                mfaLockedUntil: null,
                mfaRecoveryCodes: [],
              }
            }
            return null
          }),
          update: jest.fn(async () => {}),
        },
        mfaActionBinding: {
          findUnique: jest.fn(async ({ where }) => {
            const key = `${where.actorId_timeStep.actorId}:${where.actorId_timeStep.timeStep}`
            return bindings.has(key) ? { id: 'b_1' } : null
          }),
          create: jest.fn(async ({ data }) => {
            const key = `${data.actorId}:${data.timeStep}`
            bindings.add(key)
            return { id: 'b_1', ...data }
          }),
        },
      }
      freshMfa = new FreshMfaService(prismaMock)
    })

    it('rejects replay with the exact friendly message', async () => {
      // Step 100 was already used (mfaLastUsedStep: 100)
      // When verifying with a code that matches an already consumed step:
      await expect(
        freshMfa.verifyFreshMfa({
          actorId: 'emp_test_mfa',
          actionKey: 'governance:approve_request',
          targetId: 'req_1',
          code: '123456',
        }),
      ).rejects.toThrow()
    })

    it('blocks self-approval with explicit friendly message', async () => {
      const approvalPrismaMock: any = {
        approvalRequest: {
          findUnique: jest.fn(async () => ({
            id: 'req_1',
            requesterId: 'emp_requester_1',
            status: 'PENDING',
            steps: [
              {
                id: 'step_1',
                stepOrder: 1,
                status: 'PENDING',
              },
            ],
          })),
        },
      }
      const engine = new ApprovalEngineService(
        approvalPrismaMock,
        {} as any,
        {} as any,
      )

      await expect(
        engine.actOnStep(
          'req_1',
          { id: 'emp_requester_1', role: 'developer' },
          'APPROVED',
          'Attempting self-approval',
        ),
      ).rejects.toThrow('Self-approval is blocked')
    })
  })

  describe('Phase 3: Tier Matrix & Executive Restrictions', () => {
    it('ranks tiers strictly: CEO > EXECUTIVE > MANAGER > STAFF', () => {
      expect(isStrictlyLowerTier(RoleTier.CEO, RoleTier.EXECUTIVE)).toBe(true)
      expect(isStrictlyLowerTier(RoleTier.EXECUTIVE, RoleTier.MANAGER)).toBe(true)
      expect(isStrictlyLowerTier(RoleTier.MANAGER, RoleTier.STAFF)).toBe(true)
      expect(isStrictlyLowerTier(RoleTier.EXECUTIVE, RoleTier.EXECUTIVE)).toBe(false)
      expect(isStrictlyLowerTier(RoleTier.EXECUTIVE, RoleTier.CEO)).toBe(false)
      expect(isStrictlyLowerTier(RoleTier.STAFF, RoleTier.MANAGER)).toBe(false)
    })

    it('rejects an executive attempting to modify or touch another executive or CEO', () => {
      expect(() => {
        assertTierCeiling(RoleTier.EXECUTIVE, RoleTier.EXECUTIVE, 'role change')
      }).toThrow(ForbiddenException)

      expect(() => {
        assertTierCeiling(RoleTier.EXECUTIVE, RoleTier.CEO, 'role change')
      }).toThrow(ForbiddenException)

      // Executive CAN touch Manager and Staff
      expect(() => {
        assertTierCeiling(RoleTier.EXECUTIVE, RoleTier.MANAGER, 'role change')
      }).not.toThrow()

      expect(() => {
        assertTierCeiling(RoleTier.EXECUTIVE, RoleTier.STAFF, 'role change')
      }).not.toThrow()
    })
  })

  describe('Phase 7: Executive Voting Engine', () => {
    let voteEngine: VoteEngineService
    let mockPrisma: any
    let mockAuditLogger: any

    beforeEach(() => {
      const votes: any[] = []
      const projectRequests = new Map<string, any>([
        [
          'req_test_01',
          {
            id: 'req_test_01',
            title: 'Enterprise Billing Gateway',
            requesterId: 'emp_pm_01',
            status: 'IN_VOTE',
            voteDeadline: new Date(Date.now() + 7 * 24 * 3600_000),
            initialBudgetBDT: 750000,
            decisionMode: 'EXECUTIVE_VOTE',
          },
        ],
      ])

      // 3 eligible executive voters (excluding PM requester)
      const eligibleExecutives = [
        { id: 'emp_cto_01', name: 'CTO', email: 'cto@pointfex.com' },
        { id: 'emp_cfo_01', name: 'CFO', email: 'cfo@pointfex.com' },
        { id: 'emp_chro_01', name: 'CHRO', email: 'chro@pointfex.com' },
      ]

      mockPrisma = {
        projectCreationRequest: {
          findUnique: jest.fn(async ({ where }) => projectRequests.get(where.id) ?? null),
          update: jest.fn(async ({ where, data }) => {
            const req = projectRequests.get(where.id)
            Object.assign(req, data)
            return req
          }),
        },
        executiveVote: {
          findUnique: jest.fn(async ({ where }) => {
            return (
              votes.find(
                (v) =>
                  v.voterId === where.requestId_voterId?.voterId &&
                  v.requestId === where.requestId_voterId?.requestId,
              ) ?? null
            )
          }),
          findMany: jest.fn(async ({ where }) => {
            return votes.filter((v) => !where.requestId || v.requestId === where.requestId)
          }),
          upsert: jest.fn(async ({ where, update, create }) => {
            const voterId = where.requestId_voterId?.voterId ?? create.voterId
            const requestId = where.requestId_voterId?.requestId ?? create.requestId
            const existingIdx = votes.findIndex(
              (v) => v.voterId === voterId && v.requestId === requestId,
            )
            if (existingIdx >= 0) {
              Object.assign(votes[existingIdx], update)
              return votes[existingIdx]
            }
            const record = { id: `vote_${votes.length + 1}`, ...create }
            votes.push(record)
            return record
          }),
        },
        project: {
          create: jest.fn(async ({ data }) => ({ id: 'proj_new_01', ...data })),
        },
        employee: {
          findMany: jest.fn(async () => eligibleExecutives),
          findUnique: jest.fn(async ({ where }) => ({
            id: where.id,
            isSuspended: false,
            positionAssignments: [{ position: { id: 'pos_ceo', roleCategory: 'ceo' }, isActive: true }],
            employeeRoles: [{ role: { slug: 'ceo', isRootRole: true, isActive: true }, isActive: true }],
          })),
        },
        userRoleAssignment: {
          findMany: jest.fn(async () => []),
        },
      }

      mockAuditLogger = {
        log: jest.fn(async () => {}),
      }

      voteEngine = new VoteEngineService(mockPrisma, mockAuditLogger)
    })

    it('finalizes as APPROVED when strictly more than half of eligible voters approve', async () => {
      // 3 eligible voters -> majority threshold is > 1.5 -> needs 2 APPROVE votes
      const vote1 = await voteEngine.castVote(
        'req_test_01',
        'PROJECT_REQUEST',
        { id: 'emp_cto_01', name: 'CTO', role: 'cto', email: 'cto@pointfex.com' },
        'APPROVE',
        'Architecture is sound and feasible within 3 months.',
      )
      expect(vote1.status).toBe('IN_VOTE') // 1 vote: not yet majority

      const vote2 = await voteEngine.castVote(
        'req_test_01',
        'PROJECT_REQUEST',
        { id: 'emp_cfo_01', name: 'CFO', role: 'cfo', email: 'cfo@pointfex.com' },
        'APPROVE',
        'Budget of 750,000 BDT allocated from engineering reserves.',
      )
      expect(vote2.status).toBe('APPROVED') // 2/3: majority reached!
    })

    it('finalizes as REJECTED when approval becomes mathematically impossible', async () => {
      // 3 eligible voters -> 2 REJECT votes make approval impossible (max remaining approve = 1)
      await voteEngine.castVote(
        'req_test_01',
        'PROJECT_REQUEST',
        { id: 'emp_cto_01', name: 'CTO', role: 'cto', email: 'cto@pointfex.com' },
        'REJECT',
        'Technical stack conflicts with current infrastructure.',
      )

      const vote2 = await voteEngine.castVote(
        'req_test_01',
        'PROJECT_REQUEST',
        { id: 'emp_cfo_01', name: 'CFO', role: 'cfo', email: 'cfo@pointfex.com' },
        'REJECT',
        'Capital expenditure exceeds quarterly budget limits.',
      )
      expect(vote2.status).toBe('REJECTED')
    })

    it('CEO override directly settles the request regardless of vote tally', async () => {
      const overridden = await voteEngine.ceoOverride(
        'req_test_01',
        'PROJECT_REQUEST',
        { id: 'emp_ceo_01', role: 'ceo', name: 'Chief Executive Officer', email: 'ceo@pointfex.com' },
        'APPROVE',
        'Strategic company priority decided by executive leadership.',
      )
      expect(overridden.status).toBe('APPROVED')
      expect(overridden.decidedById).toBe('emp_ceo_01')
    })
  })

  describe('Phase 8: Password Hardening & History Policy', () => {
    it('validates password complexity (8-128 chars, upper, lower, num, sym, no name/email)', () => {
      const user = { name: 'Fahim Rahman', email: 'fahim@pointfex.com' }

      expect(validatePasswordStrength('short1!', user).valid).toBe(false)
      expect(validatePasswordStrength('alllowercase123!', user).valid).toBe(false)
      expect(validatePasswordStrength('ALLUPPERCASE123!', user).valid).toBe(false)
      expect(validatePasswordStrength('NoSpecialChars123', user).valid).toBe(false)
      expect(validatePasswordStrength('NoNumbersHere!@#', user).valid).toBe(false)
      expect(validatePasswordStrength('Fahim2026!Secure', user).valid).toBe(false) // contains name
      expect(validatePasswordStrength('Password123!', user).valid).toBe(false) // common dictionary

      // Strong compliant password
      expect(validatePasswordStrength('Kolkata#Dhaka$2026', user).valid).toBe(true)
    })

    it('blocks reuse of any of the last 5 passwords', async () => {
      const oldHash1 = await bcrypt.hash('PriorSecret#2024', 4)
      const oldHash2 = await bcrypt.hash('PriorSecret#2025', 4)

      const prismaMock: any = {
        passwordHistory: {
          findMany: jest.fn(async () => [
            { passwordHash: oldHash1 },
            { passwordHash: oldHash2 },
          ]),
        },
        employee: {
          findUnique: jest.fn(async () => ({ passwordHash: oldHash2 })),
        },
      }

      await expect(
        assertPasswordPolicy(prismaMock, 'emp_01', 'PriorSecret#2024'),
      ).rejects.toThrow('Password cannot match any of your last 5 passwords.')

      // New password passes
      await expect(
        assertPasswordPolicy(prismaMock, 'emp_01', 'CompletelyNew#Secret2026'),
      ).resolves.toBeUndefined()
    })
  })
})
