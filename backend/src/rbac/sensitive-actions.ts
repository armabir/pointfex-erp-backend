export interface SensitiveActionEntry {
  actionKey: string
  description: string
  requiresReason: boolean
  mfaRequired: true
  permissionCodes: readonly string[]
}

export const SENSITIVE_ACTION_REGISTRY: readonly SensitiveActionEntry[] = [
  // People and positions
  {
    actionKey: 'promotions:propose',
    description: 'Propose an employee promotion or title advancement',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['promotions:propose'],
  },
  {
    actionKey: 'promotions:approve',
    description: 'Approve a proposed employee promotion',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['promotions:approve'],
  },
  {
    actionKey: 'positions:assign',
    description: 'Assign an employee to an organizational position',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['positions:assign'],
  },
  {
    actionKey: 'positions:restructure',
    description: 'Restructure organizational positions or reporting lines',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['positions:restructure'],
  },
  {
    actionKey: 'positions:remove',
    description: 'Remove an employee from an active organizational position',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['positions:assign', 'positions:restructure'],
  },
  {
    actionKey: 'employees:change_department',
    description: 'Transfer an employee to another department',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['employees:change_department'],
  },
  {
    actionKey: 'employees:change_supervisor',
    description: 'Change an employee’s reporting manager',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['employees:change_supervisor'],
  },
  {
    actionKey: 'employees:offboard',
    description: 'Offboard an employee and revoke active access',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['employees:offboard', 'users:offboard'],
  },
  // Access & Roles
  {
    actionKey: 'users:assign_role',
    description: 'Assign or revoke a role on an employee account',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['users:assign_role'],
  },
  {
    actionKey: 'users:demote',
    description: 'Demote an employee to a lower role or position',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['users:demote'],
  },
  {
    actionKey: 'users:suspend',
    description: 'Suspend an employee account',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['users:suspend', 'employees:suspend'],
  },
  {
    actionKey: 'users:reactivate',
    description: 'Reactivate a suspended employee account',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['users:reactivate'],
  },
  {
    actionKey: 'permissions:grant_direct',
    description: 'Grant a direct permission override to an employee',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['permissions:grant_direct'],
  },
  {
    actionKey: 'permissions:deny_direct',
    description: 'Add or remove an explicit permission denial override',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['permissions:deny_direct'],
  },
  {
    actionKey: 'delegations:create',
    description: 'Create a temporary scoped authority delegation',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['delegations:create', 'permissions:delegate'],
  },
  {
    actionKey: 'delegations:approve',
    description: 'Approve a pending authority delegation',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: ['delegations:approve'],
  },
  {
    actionKey: 'delegations:revoke',
    description: 'Revoke an active authority delegation',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['delegations:revoke'],
  },
  {
    actionKey: 'delegations:create_on_behalf',
    description: 'Create a delegation on behalf of another manager',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['delegations:create_on_behalf'],
  },
  {
    actionKey: 'delegations:emergency',
    description: 'Issue an emergency delegation',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['delegations:emergency'],
  },
  {
    actionKey: 'roles:create',
    description: 'Create a new organizational role',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: ['roles:create'],
  },
  {
    actionKey: 'roles:update',
    description: 'Modify permissions or lifecycle status of a role',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: ['roles:update', 'roles:clone', 'roles:activate'],
  },
  {
    actionKey: 'roles:delete',
    description: 'Delete a custom organizational role',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['roles:delete'],
  },
  {
    actionKey: 'governance:approve_request',
    description: 'Approve or reject a maker-checker access or governance request',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['governance:approve_request'],
  },
  {
    actionKey: 'governance:transfer_ceo',
    description: 'Transfer supreme CEO authority to a successor',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['governance:transfer_ceo'],
  },
  {
    actionKey: 'approvals:decide',
    description: 'Initiate or sign a dual-approval workflow step',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: ['approvals:approve', 'approvals:reject', 'approvals:create'],
  },
  // Profiles and pay
  {
    actionKey: 'employees:update_any',
    description: 'Edit another employee’s profile record',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['employees:update_any'],
  },
  {
    actionKey: 'employees:read_sensitive',
    description: 'Open a sensitive employee profile or contract',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: ['employees:read_sensitive'],
  },
  {
    actionKey: 'compensation:set',
    description: 'Set or modify employee compensation',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['compensation:set'],
  },
  {
    actionKey: 'compensation:approve_changes',
    description: 'Approve compensation or salary changes',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['compensation:approve_changes'],
  },
  {
    actionKey: 'payroll_profiles:update',
    description: 'Update an employee payroll profile or bank details',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['payroll_profiles:update'],
  },
  {
    actionKey: 'payroll:approve_batch',
    description: 'Approve payroll batch disbursement',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['payroll:approve_batch'],
  },
  {
    actionKey: 'treasury:transfer',
    description: 'Execute treasury transfer, withdrawal, or financial adjustment',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['treasury:transfer', 'treasury:withdraw', 'budgets:approve_request', 'finance:issue_adjustment'],
  },
  // Credentials and security
  {
    actionKey: 'users:reset_password',
    description: 'Admin reset of another employee’s password',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['users:reset_password'],
  },
  {
    actionKey: 'mfa:manage',
    description: 'Reset or manage another employee’s MFA configuration',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['mfa:manage'],
  },
  {
    actionKey: 'login_allowlist:manage',
    description: 'Manage login IP or email allowlist rules',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['login_allowlist:manage'],
  },
  {
    actionKey: 'security_policies:manage',
    description: 'Update organization-wide security policies',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['security_policies:manage'],
  },
  {
    actionKey: 'api_tokens:manage',
    description: 'Create or revoke API tokens',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['api_tokens:manage'],
  },
  {
    actionKey: 'service_accounts:manage',
    description: 'Create or manage service accounts',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['service_accounts:manage'],
  },
  {
    actionKey: 'performance:discipline',
    description: 'Issue formal disciplinary action against an employee',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['performance:discipline'],
  },
  {
    actionKey: 'grievances:adjudicate_confidential',
    description: 'Adjudicate a confidential grievance or report',
    requiresReason: true,
    mfaRequired: true,
    permissionCodes: ['grievances:adjudicate_confidential'],
  },
  {
    actionKey: 'sessions:revoke',
    description: 'Revoke an active user security session',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: ['sessions:revoke'],
  },
  {
    actionKey: 'system:root',
    description: 'Verify or execute a root governance invariant operation',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: ['system:root'],
  },
  // Own-account security actions
  {
    actionKey: 'account:change_password',
    description: 'Change own account password',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: [],
  },
  {
    actionKey: 'account:reset_password',
    description: 'Complete forgot-password reset with MFA verification',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: [],
  },
  {
    actionKey: 'account:recovery_codes',
    description: 'View or regenerate own MFA recovery codes',
    requiresReason: false,
    mfaRequired: true,
    permissionCodes: [],
  },
]

const BY_ACTION_KEY = new Map<string, SensitiveActionEntry>(
  SENSITIVE_ACTION_REGISTRY.map((entry) => [entry.actionKey, entry]),
)

const BY_PERMISSION_CODE = new Map<string, SensitiveActionEntry>()
for (const entry of SENSITIVE_ACTION_REGISTRY) {
  for (const code of entry.permissionCodes) {
    if (!BY_PERMISSION_CODE.has(code)) {
      BY_PERMISSION_CODE.set(code, entry)
    }
  }
}

export function getSensitiveActionEntry(actionKey: string): SensitiveActionEntry | undefined {
  return BY_ACTION_KEY.get(actionKey)
}

/**
 * Automatically covers every explicitly registered action, every `isCritical`
 * permission code, and every `governance:*` permission code.
 */
export function resolveSensitiveActionForPermission(
  permissionCode: string,
  isCritical = false,
): SensitiveActionEntry | null {
  const direct = BY_PERMISSION_CODE.get(permissionCode)
  if (direct) return direct

  if (isCritical || permissionCode.startsWith('governance:')) {
    return {
      actionKey: permissionCode,
      description: `Critical or governance capability (${permissionCode})`,
      requiresReason: true,
      mfaRequired: true,
      permissionCodes: [permissionCode],
    }
  }

  return null
}

export function isPermissionSensitiveMfaRequired(
  permissionCode: string,
  isCritical = false,
): boolean {
  return resolveSensitiveActionForPermission(permissionCode, isCritical) !== null
}
