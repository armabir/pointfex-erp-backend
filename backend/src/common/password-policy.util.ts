import * as bcrypt from 'bcrypt'
import { PrismaService } from './prisma.service'
import { BadRequestException } from '@nestjs/common'

export const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  'admin123',
  'admin1234',
  'welcome123',
  'pointfex123',
  'qwerty123',
  'letmein123',
  'iloveyou123',
  'changeme123',
  'bangladesh123',
  'dhaka1234',
])

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  score: number // 0 to 4
}

export function validatePasswordStrength(
  password: string,
  user?: { name?: string; email?: string },
): PasswordValidationResult {
  const minLength = Math.max(8, Number(process.env.PASSWORD_MIN_LENGTH) || 8)
  const errors: string[] = []
  let score = 0

  if (!password || password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long.`)
  } else if (password.length > 128) {
    errors.push('Password must be at most 128 characters long.')
  } else {
    score += 1
  }

  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  if (!hasUpper) errors.push('Password must include at least one uppercase letter.')
  if (!hasLower) errors.push('Password must include at least one lowercase letter.')
  if (!hasNumber) errors.push('Password must include at least one number.')
  if (!hasSymbol) errors.push('Password must include at least one symbol or special character.')

  if (hasUpper && hasLower) score += 1
  if (hasNumber && hasSymbol) score += 1

  const lowerPwd = (password || '').toLowerCase()

  // Common password check
  const strippedLower = lowerPwd.replace(/[^a-z0-9]/g, '')
  if (COMMON_PASSWORDS.has(lowerPwd) || COMMON_PASSWORDS.has(strippedLower)) {
    errors.push('Password is too common or easily guessed.')
    score = Math.min(score, 1)
  }

  // Name and email check
  if (user?.email) {
    const emailPrefix = user.email.split('@')[0]?.toLowerCase()
    if (emailPrefix && emailPrefix.length >= 3 && lowerPwd.includes(emailPrefix)) {
      errors.push('Password must not contain your email address.')
    }
  }

  if (user?.name) {
    const parts = user.name.toLowerCase().split(/\s+/).filter((p) => p.length >= 3)
    for (const part of parts) {
      if (lowerPwd.includes(part)) {
        errors.push('Password must not contain your name.')
        break
      }
    }
  }

  if (errors.length === 0) {
    score = Math.max(score, 3)
    if (password.length >= 12 && hasUpper && hasLower && hasNumber && hasSymbol) {
      score = 4
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    score,
  }
}

export async function assertPasswordPolicy(
  prisma: PrismaService,
  employeeId: string,
  newPassword: string,
  user?: { name?: string; email?: string },
): Promise<void> {
  const result = validatePasswordStrength(newPassword, user)
  if (!result.valid) {
    throw new BadRequestException(result.errors.join(' '))
  }

  // Check no reuse of the last 5 passwords
  const histories = prisma.passwordHistory
    ? await prisma.passwordHistory.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : []

  // Also check employee current hash
  const employee = prisma.employee
    ? await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { passwordHash: true },
      })
    : null

  const hashesToCheck = histories.map((h) => h.passwordHash)
  if (employee?.passwordHash) {
    hashesToCheck.unshift(employee.passwordHash)
  }

  for (const hash of hashesToCheck) {
    if (hash && (await bcrypt.compare(newPassword, hash).catch(() => false))) {
      throw new BadRequestException(
        'Password cannot match any of your last 5 passwords. Choose a new password.',
      )
    }
  }
}

