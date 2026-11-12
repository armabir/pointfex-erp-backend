import { SetMetadata } from '@nestjs/common'
import { AuthorizationScope } from '@prisma/client'

export const PERMISSIONS_ALL_KEY = 'pbac_permissions_all'
export const PERMISSIONS_ANY_KEY = 'pbac_permissions_any'
export const PERMISSION_SCOPE_KEY = 'pbac_required_scope'

/**
 * Requires the acting user to hold ALL listed permissions.
 * Example: @RequirePermissions('budgets:approve_request')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ALL_KEY, permissions)

/**
 * Alias matching `@RequiresPermission('tasks:approve')` convention.
 */
export const RequiresPermission = RequirePermissions

/**
 * Requires the acting user to hold AT LEAST ONE of the listed permissions.
 * Useful when a service enforces record-level ownership for `*_own` vs `*_all`.
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions)

/**
 * Optional minimum ABAC scope metadata for controller routes.
 */
export const RequireScope = (scope: AuthorizationScope) => SetMetadata(PERMISSION_SCOPE_KEY, scope)
