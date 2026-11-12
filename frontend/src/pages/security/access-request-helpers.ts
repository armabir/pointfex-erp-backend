import { findNavItemByRoute } from '../../config/nav-registry'

export function resolveMissingPermissionsForRoute(
  routeId: string,
  explicitMissing?: string[],
): string[] {
  if (explicitMissing && explicitMissing.length > 0) return explicitMissing
  const targetNav = findNavItemByRoute(routeId)
  return targetNav?.requiredPermissions?.all || targetNav?.requiredPermissions?.any || []
}

export function buildAccessRequestPayload(params: {
  userId: string
  routeId: string
  routeLabel?: string
  missingPermissions: string[]
  reason?: string
}) {
  const primaryMissing = params.missingPermissions[0] || 'permissions:read'
  return {
    actionCode: primaryMissing,
    entityType: 'route_access',
    entityId: `${params.userId}:${params.routeId}`,
    reason:
      params.reason?.trim() ||
      `Requesting access to "${params.routeLabel || params.routeId}" (${params.missingPermissions.join(', ')})`,
  }
}

