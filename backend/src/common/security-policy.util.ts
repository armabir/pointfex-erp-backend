import * as crypto from 'crypto'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { PrismaService } from './prisma.service'

export const C_LEVEL_ROLE_SLUGS = new Set(['ceo', 'cto', 'cfo', 'chro', 'cpo'])
export const CORE_ROLE_SLUGS = new Set(['developer', 'pm', 'cto', 'cfo', 'chro', 'ceo'])

export interface EmployeeSecurityContext {
  id: string
  name: string
  email: string
  isSuspended: boolean
  employeeRoles: Array<{ role: { id: string; slug: string; name: string } }>
  positionAssignments: Array<{ position: { roleCategory: string; code: string; title: string } }>
}

export function isEmployeeCeo(
  emp: Pick<EmployeeSecurityContext, 'id' | 'employeeRoles' | 'positionAssignments'>,
): boolean {
  if (emp.id === 'emp_ceo_01') {
    // Allow emp_ceo_01 ONLY while they still hold active CEO role/position if succession transferred away
    const hasCeoRole = emp.employeeRoles.some((er) => er.role.slug === 'ceo')
    const hasCeoPosition = emp.positionAssignments.some(
      (pa) => pa.position.roleCategory.toLowerCase() === 'ceo',
    )
    if (emp.employeeRoles.length > 0 || emp.positionAssignments.length > 0) {
      return hasCeoRole || hasCeoPosition
    }
    return true
  }
  return (
    emp.employeeRoles.some((er) => er.role.slug === 'ceo') ||
    emp.positionAssignments.some((pa) => pa.position.roleCategory.toLowerCase() === 'ceo')
  )
}

export function isEmployeeChro(
  emp: Pick<EmployeeSecurityContext, 'employeeRoles' | 'positionAssignments'>,
): boolean {
  return (
    emp.employeeRoles.some((er) => er.role.slug === 'chro' || er.role.slug === 'cpo') ||
    emp.positionAssignments.some((pa) => {
      const cat = pa.position.roleCategory.toLowerCase()
      return cat === 'chro' || cat === 'cpo'
    })
  )
}

export function isEmployeeCLevel(
  emp: Pick<EmployeeSecurityContext, 'id' | 'employeeRoles' | 'positionAssignments'>,
): boolean {
  if (isEmployeeCeo(emp)) return true
  return (
    emp.employeeRoles.some((er) => C_LEVEL_ROLE_SLUGS.has(er.role.slug.toLowerCase())) ||
    emp.positionAssignments.some((pa) =>
      C_LEVEL_ROLE_SLUGS.has(pa.position.roleCategory.toLowerCase()),
    )
  )
}

export async function loadEmployeeWithSecurityContext(
  prisma: PrismaService,
  employeeId: string,
): Promise<EmployeeSecurityContext> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      email: true,
      isSuspended: true,
      employeeRoles: {
        where: { isActive: true },
        select: {
          role: { select: { id: true, slug: true, name: true } },
        },
      },
      positionAssignments: {
        where: { isActive: true },
        select: {
          position: { select: { roleCategory: true, code: true, title: true } },
        },
      },
    },
  })

  if (!employee) {
    throw new NotFoundException(`Employee "${employeeId}" not found`)
  }

  return employee
}

export function assertNotSelfTarget(
  actorId: string,
  targetEmployeeId: string,
  actionLabel: string,
): void {
  if (actorId === targetEmployeeId) {
    throw new ForbiddenException(
      `Zero-Trust violation: You cannot ${actionLabel} on your own account.`,
    )
  }
}

export async function assertHorizontalCLevelGuard(
  prisma: PrismaService,
  actorId: string,
  targetEmployee: EmployeeSecurityContext,
  actionLabel: string,
): Promise<EmployeeSecurityContext> {
  const actorEmployee = await loadEmployeeWithSecurityContext(prisma, actorId)

  if (isEmployeeCLevel(targetEmployee) && !isEmployeeCeo(actorEmployee)) {
    throw new ForbiddenException(
      `Horizontal C-Level restriction: Only the CEO can ${actionLabel} on C-Level executive accounts.`,
    )
  }

  return actorEmployee
}

export function generateTotpCode(secretHex: string, windowOffset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + windowOffset
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buf.writeUInt32BE(counter >>> 0, 4)
  const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex')).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 1_000_000).padStart(6, '0')
}

export function verifyTotpCode(secretHex: string, submittedCode: string): boolean {
  const normalized = submittedCode.trim()
  if (!/^\d{6}$/.test(normalized)) return false
  for (const offset of [-2, -1, 0, 1, 2]) {
    if (generateTotpCode(secretHex, offset) === normalized) {
      return true
    }
  }
  return false
}

export async function verifyStepUpAuth(
  prisma: PrismaService,
  actorId: string,
  payload?: { verificationToken?: string; passwordConfirm?: string; mfaCode?: string },
  headers?: Record<string, unknown>,
  actionLabel?: string,
): Promise<string> {
  const headerPassword =
    typeof headers?.['x-password-confirm'] === 'string'
      ? headers['x-password-confirm']
      : typeof headers?.['x-verification-token'] === 'string'
        ? headers['x-verification-token']
        : ''
  const headerMfa = typeof headers?.['x-mfa-code'] === 'string' ? headers['x-mfa-code'] : ''

  const secretInput =
    payload?.passwordConfirm?.trim() || payload?.verificationToken?.trim() || headerPassword.trim()

  if (!secretInput || secretInput.length < 4) {
    throw new ForbiddenException(
      `Step-Up Verification required${actionLabel ? ` for ${actionLabel}` : ''}: Confirm with your active account password.`,
    )
  }

  const actor = await prisma.employee.findUnique({
    where: { id: actorId },
    select: { id: true, passwordHash: true, isSuspended: true, mfaEnabled: true, mfaSecret: true },
  })

  if (!actor || actor.isSuspended || !actor.passwordHash) {
    throw new ForbiddenException(
      `Step-Up Verification failed${actionLabel ? ` for ${actionLabel}` : ''}: Account is ineligible or suspended.`,
    )
  }

  const isPasswordValid = await bcrypt.compare(secretInput, actor.passwordHash)
  if (!isPasswordValid) {
    throw new ForbiddenException(
      `Step-Up Verification failed${actionLabel ? ` for ${actionLabel}` : ''}: Invalid account password confirmation.`,
    )
  }

  if (actor.mfaEnabled && actor.mfaSecret) {
    const mfaInput = payload?.mfaCode?.trim() || headerMfa.trim()
    if (!mfaInput || !verifyTotpCode(actor.mfaSecret, mfaInput)) {
      throw new ForbiddenException(
        `MFA Verification required${actionLabel ? ` for ${actionLabel}` : ''}: Valid 6-digit MFA code missing or invalid.`,
      )
    }
    return 'VERIFIED_MFA'
  }

  return 'VERIFIED'
}

/**
 * Enforces re-authentication for both `⚠` (`isCritical`) and legacy `isSensitive` actions
 * (including the 21 active non-critical sensitive permissions so zero protections downgrade).
 */
export async function assertStepUpForPermission(
  prisma: PrismaService,
  actorId: string,
  permissionCode: string,
  payload?: { verificationToken?: string; passwordConfirm?: string; mfaCode?: string },
  headers?: Record<string, unknown>,
  actionLabel?: string,
): Promise<string | null> {
  const perm = await prisma.permission.findUnique({
    where: { code: permissionCode },
    select: { isCritical: true, isSensitive: true },
  })
  if (!perm || (!perm.isCritical && !perm.isSensitive)) {
    return null
  }
  return verifyStepUpAuth(
    prisma,
    actorId,
    payload,
    headers,
    actionLabel || permissionCode,
  )
}

export function assertTargetNotCeoForDestructiveAction(
  targetEmployee: EmployeeSecurityContext,
  verb: string,
): void {
  if (isEmployeeCeo(targetEmployee)) {
    throw new BadRequestException(`Security law: Cannot ${verb} the CEO executive account.`)
  }
}

export function assertTargetNotSupremeCeo(targetEmployee: EmployeeSecurityContext): void {
  if (isEmployeeCeo(targetEmployee)) {
    throw new ForbiddenException(
      'The CEO account holds absolute system authority and cannot be modified or delegated access by subordinates.',
    )
  }
}
