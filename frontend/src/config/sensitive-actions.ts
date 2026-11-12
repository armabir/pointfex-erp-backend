export const SENSITIVE_PERMISSION_CODES = new Set<string>([
  'promotions:propose',
  'promotions:approve',
  'positions:assign',
  'positions:restructure',
  'positions:remove',
  'employees:change_department',
  'employees:change_supervisor',
  'employees:offboard',
  'users:offboard',
  'users:assign_role',
  'users:demote',
  'users:suspend',
  'employees:suspend',
  'users:reactivate',
  'permissions:grant_direct',
  'permissions:deny_direct',
  'delegations:create',
  'permissions:delegate',
  'delegations:approve',
  'delegations:revoke',
  'delegations:create_on_behalf',
  'delegations:emergency',
  'roles:create',
  'roles:update',
  'roles:clone',
  'roles:activate',
  'roles:delete',
  'governance:approve_request',
  'governance:transfer_ceo',
  'approvals:approve',
  'approvals:reject',
  'approvals:create',
  'employees:update_any',
  'employees:read_sensitive',
  'compensation:set',
  'compensation:approve_changes',
  'payroll_profiles:update',
  'payroll:approve_batch',
  'treasury:transfer',
  'treasury:withdraw',
  'budgets:approve_request',
  'finance:issue_adjustment',
  'users:reset_password',
  'mfa:manage',
  'login_allowlist:manage',
  'security_policies:manage',
  'api_tokens:manage',
  'service_accounts:manage',
])

export function isPermissionMfaRequiredEveryTime(
  code: string,
  isCritical = false,
): boolean {
  return isCritical || code.startsWith('governance:') || SENSITIVE_PERMISSION_CODES.has(code)
}

export type SensitiveProfileActionKey =
  | 'reset_password'
  | 'reset_mfa'
  | 'unlock_sensitive'
  | 'promote'
  | 'remove_position'

export interface SensitiveProfileActionMeta {
  key: SensitiveProfileActionKey
  label: string
  permission: string
  requiresReason: boolean
  isCritical: boolean
  title: string
  confirmLabel: string
  describe: (targetName: string, extra?: string) => string
}

export const SENSITIVE_PROFILE_ACTIONS: readonly SensitiveProfileActionMeta[] = [
  {
    key: 'unlock_sensitive',
    label: 'Unlock sensitive profile',
    permission: 'employees:read_sensitive',
    requiresReason: false,
    isCritical: true,
    title: 'Unlock Sensitive Profile (5-Min View)',
    confirmLabel: 'Unlock for 5 Minutes',
    describe: (name) =>
      `Grant a 5-minute read-only view of ${name}'s sensitive profile fields. This access is bound to your account and audited.`,
  },
  {
    key: 'promote',
    label: 'Promote',
    permission: 'promotions:approve',
    requiresReason: true,
    isCritical: true,
    title: 'Confirm Employee Promotion',
    confirmLabel: 'Approve Promotion',
    describe: (name, newTitle) =>
      `Approve promotion for ${name}${newTitle ? ` to "${newTitle}"` : ''} and record it in Position & Access History.`,
  },
  {
    key: 'remove_position',
    label: 'Remove from position',
    permission: 'positions:remove',
    requiresReason: true,
    isCritical: true,
    title: 'Confirm Remove from Position',
    confirmLabel: 'Remove from Position',
    describe: (name) =>
      `Remove ${name} from their current organizational position and record the change in Position & Access History.`,
  },
  {
    key: 'reset_password',
    label: 'Reset password',
    permission: 'users:reset_password',
    requiresReason: true,
    isCritical: true,
    title: 'Confirm Admin Password Reset',
    confirmLabel: 'Send Temporary Password',
    describe: (name) =>
      `Generate a temporary password, email it directly to ${name} (never displayed to you), require password change on next login, and revoke active sessions.`,
  },
  {
    key: 'reset_mfa',
    label: 'Reset MFA',
    permission: 'mfa:manage',
    requiresReason: true,
    isCritical: true,
    title: 'Confirm Admin MFA Reset',
    confirmLabel: 'Reset MFA Enrollment',
    describe: (name) =>
      `Clear ${name}'s authenticator enrollment and recovery codes, revoke active sessions, and require MFA re-enrollment.`,
  },
]

export function getVisibleSensitiveProfileActions(
  hasPermission: (perm: string) => boolean,
): SensitiveProfileActionMeta[] {
  return SENSITIVE_PROFILE_ACTIONS.filter((action) => hasPermission(action.permission))
}

