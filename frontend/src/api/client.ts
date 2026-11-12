// Pointfex ERP API Client — HttpOnly Cookie JWT Authentication + Single-Flight Refresh Rotation

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let onUnauthorizedCallback: (() => void) | null = null
let refreshInFlight: Promise<boolean> | null = null

export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorizedCallback = cb
}

async function attemptSessionRefresh(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

async function parseErrorMessage(res: Response): Promise<string> {
  let message = `Request failed (${res.status})`
  try {
    const errBody = await res.json()
    if (Array.isArray(errBody?.message)) {
      message = errBody.message.join(', ')
    } else if (typeof errBody?.message === 'string') {
      message = errBody.message
    }
  } catch {
    // ignore non-JSON errors
  }
  return message
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  const isAuthLifecycleRoute =
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/refresh') ||
    path.startsWith('/auth/logout')

  if (res.status === 401 && !isAuthLifecycleRoute && !_retried) {
    const refreshed = await attemptSessionRefresh()
    if (refreshed) {
      return apiRequest<T>(path, options, true)
    }
    onUnauthorizedCallback?.()
    throw new ApiError('Session expired. Please sign in again.', 401)
  }

  if (!res.ok) {
    const message = await parseErrorMessage(res)
    if (res.status === 401 && !isAuthLifecycleRoute) {
      onUnauthorizedCallback?.()
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export interface AuthSessionUser {
  id: string
  email: string
  name: string
  title: string
  initials: string
  avatarUrl?: string | null
  status: string
  isSuspended: boolean
  mustChangePassword?: boolean
  mustEnrollMfa?: boolean
  mfaEnabled?: boolean
  role: string
  roles: Array<{ id: string; slug: string; name: string }>
  permissions: string[]
}

export const erpApi = {
  // Authentication (HttpOnly SameSite=Strict Cookies + Refresh Rotation)
  login: (
    email: string,
    password: string,
    options?: { mfaCode?: string; recoveryCode?: string },
  ) =>
    apiRequest<{
      authenticated: boolean
      mfaRequired?: boolean
      methods?: string[]
      user?: AuthSessionUser
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        ...(options?.mfaCode ? { mfaCode: options.mfaCode } : {}),
        ...(options?.recoveryCode ? { recoveryCode: options.recoveryCode } : {}),
      }),
    }),
  getGoogleAuthUrl: () => apiRequest<{ url: string }>('/auth/google'),
  exchangeGoogleCode: (body: {
    code?: string
    pendingToken?: string
    mfaCode?: string
    recoveryCode?: string
  }) =>
    apiRequest<{
      authenticated: boolean
      mfaRequired?: boolean
      pendingToken?: string
      methods?: string[]
      user?: AuthSessionUser
    }>('/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  refreshSession: () =>
    apiRequest<{
      authenticated: boolean
      user: AuthSessionUser
    }>('/auth/refresh', {
      method: 'POST',
    }),
  logoutSession: () =>
    apiRequest<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
    }),
  getAuthMe: () => apiRequest<AuthSessionUser>('/auth/me'),
  changePassword: (currentPassword?: string, newPassword?: string, mfaCode?: string) =>
    apiRequest<{ changed: boolean; mustChangePassword: boolean; mustEnrollMfa: boolean }>(
      '/auth/change-password',
      {
        method: 'POST',
        headers: mfaCode ? { 'X-MFA-Code': mfaCode } : undefined,
        body: JSON.stringify({
          ...(currentPassword ? { currentPassword } : {}),
          newPassword,
          ...(mfaCode ? { mfaCode } : {}),
        }),
      },
    ),
  enrollMfa: () =>
    apiRequest<{
      enrolled: boolean
      secretHex: string
      base32Secret?: string
      otpauthUrl?: string
      previewCurrentCode?: string
    }>('/rbac/security/mfa/enroll', { method: 'POST' }),
  verifyMfa: (code: string) =>
    apiRequest<{ verified: boolean; method: string; mustEnrollMfa?: boolean }>(
      '/rbac/security/mfa/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
    ),

  // Employees & Positions
  getEmployees: () => apiRequest<any[]>('/employees'),
  createEmployee: (
    body: {
      name: string
      email: string
      title: string
      roleSlug?: string
      teamId?: string
      skills?: string[]
      timezone?: string
      bio?: string
      reason?: string
    },
    mfaCode?: string,
  ) =>
    apiRequest<{
      employee: any
      deliveryStatus: 'queued' | 'sent' | 'failed'
      emailSent: boolean
      deliveryError?: string | null
    }>('/employees', {
      method: 'POST',
      headers: mfaCode
        ? {
            'X-MFA-Code': mfaCode,
            'X-MFA-Action': 'users:assign_role',
            'X-MFA-Target': 'global',
          }
        : undefined,
      body: JSON.stringify(body),
    }),
  updateEmployee: (id: string, body: Record<string, unknown>) =>
    apiRequest<any>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getPositions: () => apiRequest<any[]>('/positions'),
  assignPosition: (body: { employeeId: string; positionId: string }) =>
    apiRequest<any>('/positions/assignments', { method: 'POST', body: JSON.stringify(body) }),

  // Teams
  getTeams: () => apiRequest<any[]>('/teams'),
  createTeam: (body: Record<string, unknown>) =>
    apiRequest<any>('/teams', { method: 'POST', body: JSON.stringify(body) }),
  updateTeam: (id: string, body: Record<string, unknown>) =>
    apiRequest<any>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  addTeamMember: (teamId: string, body: { employeeId: string; isLead?: boolean }) =>
    apiRequest<any>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(body) }),
  removeTeamMember: (teamId: string, employeeId: string) =>
    apiRequest<any>(`/teams/${teamId}/members/${employeeId}`, { method: 'DELETE' }),

  // Projects & Milestones
  getProjects: () => apiRequest<any[]>('/projects'),
  createProject: (body: Record<string, unknown>) =>
    apiRequest<any>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id: string, body: Record<string, unknown>) =>
    apiRequest<any>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  addMilestone: (projectId: string, body: Record<string, unknown>) =>
    apiRequest<any>(`/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMilestoneStatus: (projectId: string, milestoneId: string, status: string) =>
    apiRequest<any>(`/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  assignProjectTeam: (projectId: string, teamId: string) =>
    apiRequest<any>(`/projects/${projectId}/assign-team`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),

  // Tasks
  getTasks: () => apiRequest<any[]>('/tasks'),
  createTask: (body: Record<string, unknown>) =>
    apiRequest<any>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTaskStatus: (id: string, status: string) =>
    apiRequest<any>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  approveTask: (id: string, body: { feedback?: string; payoutAmount?: number }) =>
    apiRequest<any>(`/tasks/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  rejectTask: (id: string, feedback: string) =>
    apiRequest<any>(`/tasks/${id}/reject`, { method: 'POST', body: JSON.stringify({ feedback }) }),
  reassignTask: (id: string, newAssigneeId: string) =>
    apiRequest<any>(`/tasks/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ newAssigneeId }),
    }),
  toggleChecklistItem: (taskId: string, itemId: string, completed?: boolean) =>
    apiRequest<any>(`/tasks/${taskId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }),
  submitTaskWork: (taskId: string, body: { prUrl?: string; demoUrl?: string; notes?: string }) =>
    apiRequest<any>(`/tasks/${taskId}/submissions`, { method: 'POST', body: JSON.stringify(body) }),
  addTaskComment: (taskId: string, content: string) =>
    apiRequest<any>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Finance
  getTreasury: () => apiRequest<any>('/finance/treasury'),
  getWallets: () => apiRequest<any[]>('/finance/wallets'),
  getWallet: (employeeId: string) => apiRequest<any>(`/finance/wallets/${employeeId}`),
  getTransactions: () => apiRequest<any[]>('/finance/transactions'),
  getBudgetRequests: () => apiRequest<any[]>('/finance/budget-requests'),
  allocateDeveloperBudget: (body: Record<string, unknown>) =>
    apiRequest<any>('/finance/allocate-developer', { method: 'POST', body: JSON.stringify(body) }),
  allocateProjectBudget: (body: Record<string, unknown>) =>
    apiRequest<any>('/finance/allocate-project', { method: 'POST', body: JSON.stringify(body) }),
  requestBudgetIncrease: (body: Record<string, unknown>) =>
    apiRequest<any>('/finance/request-budget', { method: 'POST', body: JSON.stringify(body) }),
  approveBudgetRequest: (requestId: string, body: { approvedAmount: number; feedback?: string }) =>
    apiRequest<any>(`/finance/approve-budget/${requestId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  rejectBudgetRequest: (requestId: string, feedback: string) =>
    apiRequest<any>(`/finance/reject-budget/${requestId}`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),
  issueFinancialAdjustment: (body: {
    userId: string
    amount: number
    type: 'bonus' | 'penalty'
    reason: string
  }) => apiRequest<any>('/finance/adjustment', { method: 'POST', body: JSON.stringify(body) }),

  // Performance
  getPerformance: () => apiRequest<any[]>('/performance'),
  recordEvaluation: (body: Record<string, unknown>) =>
    apiRequest<any>('/performance/evaluations', { method: 'POST', body: JSON.stringify(body) }),
  issueRecognition: (body: Record<string, unknown>) =>
    apiRequest<any>('/performance/recognition', { method: 'POST', body: JSON.stringify(body) }),
  issueDisciplinary: (body: Record<string, unknown>) =>
    apiRequest<any>('/performance/discipline', { method: 'POST', body: JSON.stringify(body) }),

  // Reports
  getReports: () => apiRequest<any[]>('/reports'),
  createReport: (body: Record<string, unknown>) =>
    apiRequest<any>('/reports', { method: 'POST', body: JSON.stringify(body) }),
  updateReportStatus: (id: string, body: { status: string; feedback?: string }) =>
    apiRequest<any>(`/reports/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
  forwardReport: (id: string, body: { recipient: string; endorsement: string }) =>
    apiRequest<any>(`/reports/${id}/forward`, { method: 'POST', body: JSON.stringify(body) }),
  adjudicateConfidential: (id: string, body: { status: string; mediationNotes: string }) =>
    apiRequest<any>(`/reports/${id}/confidential`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Audit Logs
  getAuditLogs: () => apiRequest<any[]>('/audit-logs'),

  // Engineering
  getQualityGates: () => apiRequest<any[]>('/engineering/quality-gates'),
  getSecurityAlerts: () => apiRequest<any[]>('/engineering/security-alerts'),
  createSecurityAlert: (body: Record<string, unknown>) =>
    apiRequest<any>('/engineering/security-alerts', { method: 'POST', body: JSON.stringify(body) }),
  updateSecurityAlertStatus: (id: string, status: string) =>
    apiRequest<any>(`/engineering/security-alerts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getTestRuns: () => apiRequest<any[]>('/engineering/test-runs'),

  // Consultancy
  getConsultancy: () => apiRequest<any[]>('/consultancy'),
  updateConsultancy: (id: string, body: Record<string, unknown>) =>
    apiRequest<any>(`/consultancy/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Governance
  getDirectives: () => apiRequest<any[]>('/governance/directives'),
  dispatchDirective: (body: Record<string, unknown>) =>
    apiRequest<any>('/governance/directives', { method: 'POST', body: JSON.stringify(body) }),
  ratifyDecision: (body: { actionType: string; entityId: string; notes?: string }) =>
    apiRequest<any>('/governance/ratify', { method: 'POST', body: JSON.stringify(body) }),

  // Communications
  getAnnouncements: () => apiRequest<any[]>('/announcements'),
  getNotifications: () => apiRequest<any[]>('/notifications'),
  markNotificationRead: (id: string) =>
    apiRequest<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => apiRequest<any>('/notifications/read-all', { method: 'PATCH' }),

  // Dynamic RBAC / PBAC Management (CEO Admin & C-Level Delegation)
  getMyPermissions: () =>
    apiRequest<{
      employeeId: string
      roles: any[]
      rolePermissions: string[]
      directPermissions: any[]
      permissions: string[]
    }>('/rbac/me/permissions'),
  getMyEffectiveAuthz: () => apiRequest<any>('/rbac/me/effective'),
  getUserEffectiveAuthz: (employeeId: string) =>
    apiRequest<any>(`/rbac/users/${employeeId}/effective`),
  listPermissions: () =>
    apiRequest<{ total: number; permissions: any[]; groupedByModule: Record<string, any[]> }>(
      '/rbac/permissions',
    ),
  listRoleTemplates: () => apiRequest<any[]>('/rbac/role-templates'),
  createRoleFromTemplate: (
    code: string,
    body?: { name?: string; slug?: string; description?: string },
  ) =>
    apiRequest<any>(`/rbac/roles/from-template/${code}`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  getDelegatablePermissions: () =>
    apiRequest<{ permissions: any[]; groupedByModule: Record<string, any[]> }>(
      '/rbac/delegatable-permissions',
    ),
  listRoles: () => apiRequest<any[]>('/rbac/roles'),
  getRole: (id: string) => apiRequest<any>(`/rbac/roles/${id}`),
  getRoleVersions: (id: string) => apiRequest<any[]>(`/rbac/roles/${id}/versions`),
  createRole: (body: {
    name: string
    slug?: string
    description?: string
    permissionCodes?: string[]
    wildcards?: string[]
    includeCritical?: boolean
  }) => apiRequest<any>('/rbac/roles', { method: 'POST', body: JSON.stringify(body) }),
  cloneRole: (id: string, body: { name: string; slug?: string; description?: string }) =>
    apiRequest<any>(`/rbac/roles/${id}/clone`, { method: 'POST', body: JSON.stringify(body) }),
  activateRole: (id: string, reason?: string) =>
    apiRequest<any>(`/rbac/roles/${id}/activate`, {
      method: 'PATCH',
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  deactivateRole: (id: string, reason?: string) =>
    apiRequest<any>(`/rbac/roles/${id}/deactivate`, {
      method: 'PATCH',
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  updateRole: (id: string, body: { name?: string; description?: string; isActive?: boolean; wildcards?: string[] }) =>
    apiRequest<any>(`/rbac/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRole: (id: string, passwordConfirm?: string) =>
    apiRequest<any>(`/rbac/roles/${id}`, {
      method: 'DELETE',
      headers: passwordConfirm ? { 'x-password-confirm': passwordConfirm } : undefined,
      body: passwordConfirm ? JSON.stringify({ passwordConfirm }) : undefined,
    }),
  replaceRolePermissions: (
    id: string,
    permissionCodes: string[],
    wildcards?: string[],
    changeReason?: string,
  ) =>
    apiRequest<any>(`/rbac/roles/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionCodes, wildcards, changeReason }),
    }),
  listUserRoleAssignments: (employeeId: string) =>
    apiRequest<any[]>(`/rbac/users/${employeeId}/role-assignments`),
  getEmployeePermissions: (employeeId: string) =>
    apiRequest<{
      employeeId: string
      roles: any[]
      rolePermissions: string[]
      directPermissions: any[]
      permissions: string[]
    }>(`/rbac/users/${employeeId}/permissions`),
  assignRoleToEmployee: (
    employeeId: string,
    body: {
      roleId?: string
      roleSlug?: string
      scope?: string
      scopeIds?: string[]
      expiresAt?: string
      reason?: string
    },
  ) =>
    apiRequest<any>(`/rbac/users/${employeeId}/roles`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  grantDenial: (
    employeeId: string,
    body: { permissionCode: string; scope?: string; scopeIds?: string[]; reason?: string; expiresAt?: string },
  ) =>
    apiRequest<any>(`/rbac/users/${employeeId}/denials`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revokeDenial: (denialId: string) =>
    apiRequest<any>(`/rbac/denials/${denialId}`, { method: 'DELETE' }),
  // Delegations Engine
  listMyDelegations: () => apiRequest<{ created: any[]; received: any[] }>('/rbac/delegations/mine'),
  listAllDelegations: () => apiRequest<any[]>('/rbac/delegations'),
  createDelegation: (
    body: {
      delegateeId: string
      permissionCodes: string[]
      scope?: string
      scopeIds?: string[]
      reason: string
      startsAt?: string
      expiresAt: string
      requireApproval?: boolean
    },
    mfaCode?: string,
  ) =>
    apiRequest<any>('/rbac/delegations', {
      method: 'POST',
      headers: mfaCode
        ? {
            'X-MFA-Code': mfaCode,
            'X-MFA-Action': 'delegations:create',
            'X-MFA-Target': body.delegateeId,
          }
        : undefined,
      body: JSON.stringify(body),
    }),
  approveDelegation: (id: string, mfaCode?: string) =>
    apiRequest<any>(`/rbac/delegations/${id}/approve`, {
      method: 'POST',
      headers: mfaCode
        ? {
            'X-MFA-Code': mfaCode,
            'X-MFA-Action': 'delegations:approve',
            'X-MFA-Target': id,
          }
        : undefined,
      body: '{}',
    }),
  revokeDelegation: (id: string, reason?: string, mfaCode?: string) =>
    apiRequest<any>(`/rbac/delegations/${id}/revoke`, {
      method: 'POST',
      headers: mfaCode
        ? {
            'X-MFA-Code': mfaCode,
            'X-MFA-Action': 'delegations:revoke',
            'X-MFA-Target': id,
          }
        : undefined,
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  // Approvals & SoD Engine
  listSodRules: () => apiRequest<any[]>('/rbac/sod-rules'),
  getApprovalInbox: () => apiRequest<any[]>('/rbac/approvals/inbox'),
  getMyApprovals: () => apiRequest<any[]>('/rbac/approvals/mine'),
  initiateApproval: (body: {
    actionCode: string
    entityType: string
    entityId: string
    amount?: number
    reason?: string
    mode?: string
  }) => apiRequest<any>('/rbac/approvals', { method: 'POST', body: JSON.stringify(body) }),
  approveWorkflowStep: (id: string, notes?: string) =>
    apiRequest<any>(`/rbac/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(notes ? { notes } : {}),
    }),
  rejectWorkflowStep: (id: string, notes?: string) =>
    apiRequest<any>(`/rbac/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(notes ? { notes } : {}),
    }),
  // Audit Chain & Security Sessions
  verifyAuditChain: () =>
    apiRequest<{ valid: boolean; checkedCount: number; headSequence?: number; headHash?: string; brokenAtId?: string; brokenReason?: string }>('/audit-logs/verify'),
  listMySecuritySessions: () => apiRequest<any[]>('/rbac/security-sessions/mine'),
  revokeSecuritySession: (id: string) =>
    apiRequest<any>(`/rbac/security-sessions/${id}/revoke`, { method: 'POST', body: '{}' }),
  revokeRoleFromEmployee: (employeeId: string, roleId: string) =>
    apiRequest<any>(`/rbac/users/${employeeId}/roles/${roleId}`, { method: 'DELETE' }),
  grantDirectPermission: (
    employeeId: string,
    body: { permissionCode?: string; permissionId?: string; expiresAt?: string; reason?: string },
    mfaCode?: string,
  ) =>
    apiRequest<any>(`/rbac/users/${employeeId}/direct-permissions`, {
      method: 'POST',
      headers: mfaCode
        ? {
            'X-MFA-Code': mfaCode,
            'X-MFA-Action': 'permissions:grant_direct',
            'X-MFA-Target': employeeId,
          }
        : undefined,
      body: JSON.stringify(body),
    }),
  revokeDirectPermission: (employeeId: string, permissionId: string, mfaCode?: string) =>
    apiRequest<any>(`/rbac/users/${employeeId}/direct-permissions/${permissionId}`, {
      method: 'DELETE',
      headers: mfaCode
        ? {
            'X-MFA-Code': mfaCode,
            'X-MFA-Action': 'permissions:grant_direct',
            'X-MFA-Target': employeeId,
          }
        : undefined,
    }),
  suspendEmployee: (
    employeeId: string,
    body?: { reason?: string; passwordConfirm?: string; verificationToken?: string },
  ) =>
    apiRequest<any>(`/users/${employeeId}/suspend`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  unsuspendEmployee: (employeeId: string, reason?: string) =>
    apiRequest<any>(`/users/${employeeId}/unsuspend`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  demoteEmployee: (
    employeeId: string,
    body?: { reason?: string; passwordConfirm?: string; verificationToken?: string },
  ) =>
    apiRequest<any>(`/users/${employeeId}/demote`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),

  // Governance: Maker-Checker & CEO Succession
  transferCeo: (body: {
    newCeoEmployeeId: string
    demoteToRoleSlug?: string
    passwordConfirm?: string
    verificationToken?: string
    reason?: string
  }) =>
    apiRequest<any>('/governance/transfer-ceo', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listAccessRequests: (params?: { status?: string; targetEmployeeId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.targetEmployeeId) qs.set('targetEmployeeId', params.targetEmployeeId)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest<any[]>(`/governance/access-requests${suffix}`)
  },
  createAccessRequest: (body: {
    targetEmployeeId: string
    requestedRoleId?: string
    requestedRoleSlug?: string
    reason?: string
  }) =>
    apiRequest<any>('/governance/access-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  approveAccessRequest: (requestId: string, reviewNotes?: string) =>
    apiRequest<any>(`/governance/access-requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify(reviewNotes ? { reviewNotes } : {}),
    }),
  rejectAccessRequest: (requestId: string, reviewNotes?: string) =>
    apiRequest<any>(`/governance/access-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(reviewNotes ? { reviewNotes } : {}),
    }),

  // Phase 4B: Fresh MFA & Employee Lifecycle Controls
  mfaHeaders: (mfaCode: string, actionKey?: string, targetId?: string) => ({
    'X-MFA-Code': mfaCode,
    ...(actionKey ? { 'X-MFA-Action': actionKey } : {}),
    ...(targetId ? { 'X-MFA-Target': targetId } : {}),
  }),
  adminResetPassword: (employeeId: string, reason: string, mfaCode: string) =>
    apiRequest<any>(`/users/${employeeId}/reset-password`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'users:reset_password',
        'X-MFA-Target': employeeId,
      },
      body: JSON.stringify({ reason }),
    }),
  getMfaSecurityOverview: () =>
    apiRequest<{
      summary: {
        totalUsers: number
        mfaEnabledCount: number
        mfaEnabledPct: number
        lockedUsersCount: number
        resetsThisMonth: number
      }
      employees: Array<{
        id: string
        name: string
        email: string
        title: string
        role: string
        mfaEnabled: boolean
        mustEnrollMfa: boolean
        isLocked: boolean
        mfaLockedUntil?: string | null
        isSuspended: boolean
        lastMfaResetAt?: string | null
      }>
    }>('/users/security/mfa-overview'),
  revokeEmployeeSessions: (employeeId: string, reason: string, mfaCode: string) =>
    apiRequest<any>(`/users/${employeeId}/sessions/revoke`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'mfa:manage',
        'X-MFA-Target': employeeId,
      },
      body: JSON.stringify({ reason }),
    }),
  adminResetMfa: (employeeId: string, reason: string, mfaCode: string) =>
    apiRequest<any>(`/users/${employeeId}/mfa/reset`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'mfa:manage',
        'X-MFA-Target': employeeId,
      },
      body: JSON.stringify({ reason }),
    }),
  unlockSensitiveProfile: (employeeId: string, mfaCode: string) =>
    apiRequest<{ viewToken: string; expiresAt: string }>(
      `/employees/${employeeId}/sensitive-profile/unlock`,
      {
        method: 'POST',
        headers: {
          'X-MFA-Code': mfaCode,
          'X-MFA-Action': 'employees:read_sensitive',
          'X-MFA-Target': employeeId,
        },
        body: '{}',
      },
    ),
  getSensitiveProfile: (employeeId: string, viewToken: string) =>
    apiRequest<any>(`/employees/${employeeId}/sensitive-profile`, {
      headers: { 'X-Profile-View-Token': viewToken },
    }),
  getEmployeeChangeHistory: (employeeId: string) =>
    apiRequest<any[]>(`/employees/${employeeId}/change-history`),
  promoteEmployee: (
    employeeId: string,
    body: { newTitle: string; reason: string; effectiveDate?: string },
    mfaCode: string,
  ) =>
    apiRequest<any>(`/employees/${employeeId}/promotions/approve`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'promotions:approve',
        'X-MFA-Target': employeeId,
      },
      body: JSON.stringify(body),
    }),
  removePosition: (employeeId: string, reason: string, mfaCode: string, positionId?: string) =>
    apiRequest<any>(`/positions/assignments/${employeeId}/remove`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'positions:remove',
        'X-MFA-Target': employeeId,
      },
      body: JSON.stringify({ reason, positionId }),
    }),
  forgotPassword: (email: string) =>
    apiRequest<any>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPasswordWithToken: (body: { token: string; newPassword: string; mfaCode?: string }) =>
    apiRequest<any>('/auth/reset-password', {
      method: 'POST',
      headers: body.mfaCode ? { 'X-MFA-Code': body.mfaCode } : undefined,
      body: JSON.stringify(body),
    }),
  regenerateRecoveryCodes: (body: { currentPassword?: string; mfaCode?: string }) =>
    apiRequest<{ recoveryCodes: string[] }>('/auth/recovery-codes/regenerate', {
      method: 'POST',
      headers: body.mfaCode ? { 'X-MFA-Code': body.mfaCode } : undefined,
      body: JSON.stringify(body),
    }),

  // CEO-only Login Allowlist & My Account
  getMySessions: () =>
    apiRequest<{
      sessions: Array<{
        id: string
        deviceLabel: string
        ipAddress?: string | null
        lastActiveAt: string
        mfaVerified: boolean
      }>
      externalIdentities: Array<{
        id: string
        provider: string
        email: string
        emailVerified: boolean
        lastLoginAt?: string | null
      }>
      hasPassword: boolean
      mfaEnabled: boolean
    }>('/auth/me/sessions'),
  revokeMySession: (id: string) =>
    apiRequest<{ revoked: boolean }>(`/auth/me/sessions/${id}`, { method: 'DELETE' }),
  unlinkGoogleIdentity: () =>
    apiRequest<{ unlinked: boolean }>('/auth/google/unlink', { method: 'POST' }),
  listLoginAllowlist: () =>
    apiRequest<{
      allowlistRequired: boolean
      allowDomainRules: boolean
      canManage: boolean
      summary: {
        allowedEmails: number
        readyToOnboard: number
        activeEmployees: number
        blockedLast7Days: number
      }
      entries: Array<{
        id: string
        pattern: string
        isDomain: boolean
        isActive: boolean
        note?: string | null
        createdAt: string
        employeeId?: string | null
        employeeName?: string | null
        employeeSuspended?: boolean
        lastLoginAt?: string | null
        lastLoginMethod?: string | null
        inviteDeliveryStatus?: string | null
      }>
      blockedAttempts: Array<{
        id: string
        maskedEmail: string
        provider: string
        reason: string
        ipAddress?: string | null
        createdAt: string
      }>
      pendingRequests: Array<{
        id: string
        email: string
        fullName: string
        reason: string
        requesterId: string
        status: string
        createdAt: string
      }>
    }>('/auth/allowlist'),
  getReadyToOnboardEmails: () =>
    apiRequest<Array<{ email: string }>>('/auth/allowlist/ready-emails'),
  addLoginAllowlistEntry: (
    pattern: string,
    note: string | undefined,
    mfaCode: string,
    reason?: string,
  ) =>
    apiRequest<any>('/auth/allowlist', {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'login_allowlist:manage',
        'X-MFA-Target': 'global',
      },
      body: JSON.stringify({ pattern, note, reason }),
    }),
  importLoginAllowlist: (
    entries: string[] | string,
    note: string | undefined,
    mfaCode: string,
    reason?: string,
  ) =>
    apiRequest<{ imported: number; patterns: string[] }>('/auth/allowlist/import', {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'login_allowlist:manage',
        'X-MFA-Target': 'global',
      },
      body: JSON.stringify({ entries, note, reason }),
    }),
  toggleLoginAllowlistEntry: (
    id: string,
    isActive: boolean,
    mfaCode: string,
    reason?: string,
  ) =>
    apiRequest<any>(`/auth/allowlist/${id}`, {
      method: 'PATCH',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'login_allowlist:manage',
        'X-MFA-Target': id,
      },
      body: JSON.stringify({ isActive, reason }),
    }),
  removeLoginAllowlistEntry: (id: string, mfaCode: string, reason?: string) =>
    apiRequest<any>(`/auth/allowlist/${id}`, {
      method: 'DELETE',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'login_allowlist:manage',
        'X-MFA-Target': id,
      },
      body: JSON.stringify({ reason }),
    }),
  requestAllowlistEmail: (body: { email: string; fullName: string; reason: string }) =>
    apiRequest<any>('/auth/allowlist/requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listAllowlistEmailRequests: () => apiRequest<any[]>('/auth/allowlist/requests'),
  approveAllowlistEmailRequest: (id: string, mfaCode: string, reason?: string) =>
    apiRequest<any>(`/auth/allowlist/requests/${id}/approve`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'login_allowlist:manage',
        'X-MFA-Target': id,
      },
      body: JSON.stringify({ reason }),
    }),
  rejectAllowlistEmailRequest: (id: string, mfaCode: string, reason: string) =>
    apiRequest<any>(`/auth/allowlist/requests/${id}/reject`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'login_allowlist:manage',
        'X-MFA-Target': id,
      },
      body: JSON.stringify({ reason }),
    }),
  resendEmployeeInvite: (employeeId: string, mfaCode: string, reason?: string) =>
    apiRequest<{
      employeeId: string
      deliveryStatus: string
      emailSent: boolean
      deliveryError?: string | null
    }>(`/employees/${employeeId}/resend-invite`, {
      method: 'POST',
      headers: {
        'X-MFA-Code': mfaCode,
        'X-MFA-Action': 'users:reset_password',
        'X-MFA-Target': employeeId,
      },
      body: JSON.stringify({ reason }),
    }),
}
