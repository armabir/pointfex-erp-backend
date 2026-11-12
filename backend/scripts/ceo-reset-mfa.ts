import * as readline from 'readline'
import { PrismaClient } from '@prisma/client'
import { AuditLoggerService } from '../src/common/audit-logger.service'

async function promptLine(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  const ceoEmail = process.env.CEO_EMAIL?.trim().toLowerCase()
  if (!ceoEmail) {
    console.error('CEO_EMAIL must be set in the server environment.')
    process.exit(1)
  }

  const argConfirmIdx = process.argv.indexOf('--confirm')
  const phrase =
    argConfirmIdx >= 0 && process.argv[argConfirmIdx + 1]
      ? process.argv[argConfirmIdx + 1]
      : await promptLine('Type "RESET CEO MFA" to confirm offline CEO MFA reset: ')

  if (phrase !== 'RESET CEO MFA') {
    console.error('Confirmation phrase did not match. Aborting.')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  try {
    const ceo = await prisma.employee.findFirst({
      where: { email: { equals: ceoEmail, mode: 'insensitive' } },
      include: {
        employeeRoles: {
          where: { isActive: true },
          include: { role: true },
        },
      },
    })

    if (!ceo || !ceo.employeeRoles.some((er) => er.role.isSystemDefault || er.role.slug === 'ceo')) {
      console.error('No active system:root CEO account matched CEO_EMAIL.')
      process.exit(1)
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.employee.update({
        where: { id: ceo.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaLastUsedStep: null,
          mfaRecoveryCodes: [],
          mfaFailureCount: 0,
          mfaFailureWindowStart: null,
          mfaLockedUntil: null,
          mustEnrollMfa: true,
          authVersion: { increment: 1 },
        },
      }),
      prisma.refreshToken.updateMany({
        where: { employeeId: ceo.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.securitySession.updateMany({
        where: { employeeId: ceo.id, isRevoked: false },
        data: { isRevoked: true, revokedAt: now },
      }),
    ])

    const auditLogger = new AuditLoggerService(prisma as any)
    await auditLogger.log({
      actorId: ceo.id,
      actorName: 'SERVER_CLI',
      actorEmail: ceo.email,
      actorRole: 'SYSTEM',
      action: 'Offline server CLI reset CEO MFA',
      actionCode: 'CEO_MFA_OFFLINE_RESET',
      actionKey: 'mfa:manage',
      severity: 'CRITICAL',
      entityType: 'Employee',
      entityId: ceo.id,
      description: 'Offline server operator reset CEO MFA, revoked all sessions, and forced re-enrollment.',
      category: 'security',
      reason: 'Offline CEO lost-device recovery via server CLI',
    })

    console.log('CEO MFA reset complete. All active sessions revoked; re-enrollment required on next sign-in.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Offline CEO MFA reset failed:', err?.message || 'unknown error')
  process.exit(1)
})

