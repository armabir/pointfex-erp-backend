import { ForbiddenException } from '@nestjs/common'
import { PrismaService } from './prisma.service'

export enum RoleTier {
  CEO = 'CEO',
  EXECUTIVE = 'EXECUTIVE',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
}

export const TIER_RANKS: Record<string, number> = {
  CEO: 4,
  EXECUTIVE: 3,
  MANAGER: 2,
  STAFF: 1,
}

export function isStrictlyLowerTier(actorTier: string, targetTier: string): boolean {
  const actorRank = TIER_RANKS[actorTier] ?? 1
  const targetRank = TIER_RANKS[targetTier] ?? 1
  return actorRank > targetRank
}

/**
 * Resolves the highest effective tier for an employee:
 * CEO (implicit for system:root or pos_ceo) > EXECUTIVE > MANAGER > STAFF (default).
 */
export async function getEmployeeEffectiveTier(
  prisma: PrismaService,
  employeeId: string,
): Promise<RoleTier> {
  // Check position assignments (pos_ceo)
  const ceoPos = prisma.positionAssignment
    ? await prisma.positionAssignment.findFirst({
        where: { employeeId, positionId: 'pos_ceo', isActive: true },
        select: { id: true },
      })
    : null
  if (ceoPos) return RoleTier.CEO

  // Check roles assigned
  const assignments = prisma.userRoleAssignment
    ? await prisma.userRoleAssignment.findMany({
        where: { employeeId, isActive: true },
        include: { role: { select: { isRootRole: true, slug: true, tier: true } } },
      })
    : []
  if (assignments.some((a) => a.role.isRootRole || a.role.slug === 'ceo')) {
    return RoleTier.CEO
  }

  const legacyRoles = prisma.employeeRole
    ? await prisma.employeeRole.findMany({
        where: { employeeId, isActive: true },
        include: { role: { select: { isRootRole: true, slug: true, tier: true } } },
      })
    : []
  if (legacyRoles.some((a) => a.role.isRootRole || a.role.slug === 'ceo')) {
    return RoleTier.CEO
  }

  const allRoles = [...assignments.map((a) => a.role), ...legacyRoles.map((a) => a.role)]
  let highestRank = 1
  let resolvedTier = RoleTier.STAFF

  for (const r of allRoles) {
    const rawTier = String((r as any).tier || 'STAFF').toUpperCase()
    const rank = TIER_RANKS[rawTier] || 1
    if (rank > highestRank) {
      highestRank = rank
      resolvedTier = rawTier as RoleTier
    }
  }

  return resolvedTier
}

export function assertTierCeiling(
  actorTier: RoleTier | string,
  targetTier: RoleTier | string,
  actionLabel: string,
): void {
  const aTier = (actorTier as RoleTier) || RoleTier.STAFF
  const tTier = (targetTier as RoleTier) || RoleTier.STAFF

  if (aTier === RoleTier.CEO) {
    return
  }

  if (aTier === RoleTier.EXECUTIVE) {
    if (tTier === RoleTier.CEO || tTier === RoleTier.EXECUTIVE) {
      throw new ForbiddenException(
        `Tier ceiling restriction: Executives cannot ${actionLabel} on Executive or CEO personnel.`,
      )
    }
    return
  }

  if ((TIER_RANKS[aTier] || 1) <= (TIER_RANKS[tTier] || 1)) {
    throw new ForbiddenException(
      `Tier ceiling restriction: You can only ${actionLabel} for lower tier personnel in scope.`,
    )
  }
}
