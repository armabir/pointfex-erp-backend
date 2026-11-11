import { SetMetadata } from '@nestjs/common'

export const PERMISSIONS_ALL_KEY = 'pbac_permissions_all'
export const PERMISSIONS_ANY_KEY = 'pbac_permissions_any'

/**
 * Requires the acting user to hold ALL listed permissions.
 * Example: @RequirePermissions('budgets:approve_request')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ALL_KEY, permissions)

/**
 * Requires the acting user to hold AT LEAST ONE of the listed permissions.
 * Useful when a service enforces record-level ownership for `*_own` vs `*_all`.
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions)
