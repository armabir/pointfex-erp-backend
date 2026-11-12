import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { EmptyState } from '../../components/common/EmptyState'
import { Avatar } from '../../components/common/Avatar'
import { SecurityConfirmModal } from '../../components/common/SecurityConfirmModal'
import { MfaConfirmModal, type MfaConfirmPayload } from '../../components/common/MfaConfirmModal'
import { EmployeeHistoryTimeline } from '../../components/common/EmployeeHistoryTimeline'
import {
  getVisibleSensitiveProfileActions,
  type SensitiveProfileActionMeta,
} from '../../config/sensitive-actions'
import { useCtoData } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { erpApi } from '../../api/client'
import { getPermissionDisplay } from '../../utils/permission-dictionary'
import type { User, UserRole } from '../../types'
import {
  Search,
  Edit2,
  Users,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Ban,
  RotateCcw,
  XCircle,
  Briefcase,
  UserCheck,
  Lock,
  Crown,
  TrendingUp,
  UserMinus,
  Unlock,
  Mail,
  Info,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from 'lucide-react'

const isCeoTargetUser = (user: Pick<User, 'role' | 'activeRoleSlugs'>) =>
  user.role === 'ceo' || Boolean(user.activeRoleSlugs?.includes('ceo'))

interface PendingRoleRequestItem {
  id: string
  requestedRoleId: string
  requesterId: string
  reason?: string | null
  createdAt: string
  requestedRole: { id: string; slug: string; name: string }
  requester: { id: string; name: string; title: string }
}

type LifecycleConfirmState =
  | { kind: 'suspend'; user: User }
  | { kind: 'unsuspend'; user: User }
  | { kind: 'demote'; user: User }
  | { kind: 'revoke_single'; user: User; permissionId: string; label: string }
  | {
      kind: 'grant_direct'
      user: User
      permissionCode: string
      label: string
      expiresAt?: string
      reason?: string
    }
  | {
      kind: 'request_role_change'
      user: User
      roleSlug: string
      roleName: string
      reason?: string
    }
  | {
      kind: 'approve_role_request'
      user: User
      requestId: string
      roleName: string
    }
  | {
      kind: 'reject_role_request'
      user: User
      requestId: string
      roleName: string
    }
  | {
      kind: 'save_edit'
      user: User
      nextRole: UserRole
      teamId?: string
      title: string
      skills: string[]
      roleChanged: boolean
    }

interface DirectPermissionItem {
  id: string
  permissionId: string
  code: string
  module: string
  description: string
  isSensitive: boolean
  grantedById?: string | null
  grantedAt: string
  expiresAt?: string | null
  reason?: string | null
}

interface DelegatablePermission {
  id: string
  code: string
  module: string
  description: string
  isSensitive: boolean
}

export function CtoPeoplePage() {
  const { tasks, teams } = useCtoData()
  const { data, updateUser, showToast, currentRole, currentUser, refreshData } = useApp()
  const { hasPermission, hasAnyPermission } = usePermissions()

  const canDelegate = hasPermission('permissions:delegate')
  const canGrantAccess = hasAnyPermission('permissions:delegate', 'users:assign_role')
  const canEditProfiles = hasPermission('employees:update_any')
  const canSuspendAccount = hasPermission('employees:suspend')
  const canResetAccess = hasPermission('users:assign_role')
  const canApproveRoleRequests = hasAnyPermission('users:assign_role', 'employees:suspend')
  const canCreateEmployee = hasAnyPermission('employees:create', 'users:assign_role')
  const canRequestRoleChange = hasAnyPermission(
    'employees:update_any',
    'positions:assign',
    'users:assign_role',
    'permissions:delegate',
  )

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(
    () => Boolean(sessionStorage.getItem('pointfex_onboard_email')),
  )
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState(
    () => sessionStorage.getItem('pointfex_onboard_email') || '',
  )
  const [createTitle, setCreateTitle] = useState('')
  const [createRoleSlug, setCreateRoleSlug] = useState('developer')
  const [createTeamId, setCreateTeamId] = useState('')
  const [createSkills, setCreateSkills] = useState('')
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string
    email: string
    roleName: string
    deliveryStatus: string
    deliveryError?: string | null
  } | null>(null)
  const [readyEmails, setReadyEmails] = useState<Array<{ email: string }>>([])
  const [emailPickerFilter, setEmailPickerFilter] = useState('')
  const [isEmailLocked, setIsEmailLocked] = useState(
    () => Boolean(sessionStorage.getItem('pointfex_onboard_email')),
  )
  const [showRequestEmailForm, setShowRequestEmailForm] = useState(false)
  const [reqEmail, setReqEmail] = useState('')
  const [reqFullName, setReqFullName] = useState('')
  const [reqReason, setReqReason] = useState('')
  const [isRequestingEmail, setIsRequestingEmail] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    sessionStorage.removeItem('pointfex_onboard_email')
  }, [])

  useEffect(() => {
    if (!isCreateModalOpen || !canCreateEmployee) return
    void erpApi
      .getReadyToOnboardEmails()
      .then((list) => {
        setReadyEmails(list || [])
        if (!isEmailLocked && list && list.length > 0 && !createEmail) {
          setCreateEmail(list[0].email)
        }
      })
      .catch(() => setReadyEmails([]))
  }, [isCreateModalOpen, canCreateEmployee, isEmailLocked, createEmail])
  const [roleFilter, setRoleFilter] = useState<'all' | 'developer' | 'pm' | 'executive'>('all')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Direct Delegation, Maker-Checker & Lifecycle State
  const [delegatablePermissions, setDelegatablePermissions] = useState<DelegatablePermission[]>([])
  const [targetDirectPerms, setTargetDirectPerms] = useState<DirectPermissionItem[]>([])
  const [targetRoleNames, setTargetRoleNames] = useState<string[]>([])
  const [pendingRoleRequests, setPendingRoleRequests] = useState<PendingRoleRequestItem[]>([])
  const [selectedDelegationCode, setSelectedDelegationCode] = useState('')
  const [delegationExpiry, setDelegationExpiry] = useState('')
  const [delegationReason, setDelegationReason] = useState('')
  const [requestedRoleSlug, setRequestedRoleSlug] = useState('pm')
  const [roleChangeReason, setRoleChangeReason] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<LifecycleConfirmState | null>(null)
  const [isActionSubmitting, setIsActionSubmitting] = useState(false)
  const [pendingMfaAction, setPendingMfaAction] = useState<{
    meta: SensitiveProfileActionMeta
    user: User
    newTitle?: string
  } | null>(null)
  const [pendingDirectPermMfa, setPendingDirectPermMfa] = useState<
    | {
        mode: 'grant'
        user: User
        permissionCode: string
        label: string
        expiresAt?: string
        reason?: string
      }
    | {
        mode: 'revoke'
        user: User
        permissionId: string
        label: string
      }
    | null
  >(null)
  const [isDirectPermSubmitting, setIsDirectPermSubmitting] = useState(false)
  const [pendingCreatePayload, setPendingCreatePayload] = useState<{
    name: string
    email: string
    title: string
    roleSlug: string
    teamId?: string
    skills: string[]
  } | null>(null)
  const [isMfaActionSubmitting, setIsMfaActionSubmitting] = useState(false)
  const [pendingResendUser, setPendingResendUser] = useState<User | null>(null)
  const [isResendingInvite, setIsResendingInvite] = useState(false)
  const [showPromoteInput, setShowPromoteInput] = useState(false)
  const [promoteNewTitle, setPromoteNewTitle] = useState('')
  const [sensitiveProfileView, setSensitiveProfileView] = useState<{
    employeeId: string
    expiresAt: string
    profile: Record<string, any>
  } | null>(null)

  const visibleSensitiveActions = useMemo(
    () => getVisibleSensitiveProfileActions(hasPermission),
    [hasPermission],
  )

  const loadDelegationPanel = useCallback(
    async (employeeId: string) => {
      try {
        const [delegatableRes, empAccessRes] = await Promise.all([
          canDelegate
            ? erpApi.getDelegatablePermissions().catch(() => ({ permissions: [] }))
            : Promise.resolve({ permissions: [] }),
          hasAnyPermission('permissions:delegate', 'users:assign_role')
            ? erpApi
                .getEmployeePermissions(employeeId)
                .catch(() => ({ roles: [], directPermissions: [], pendingRoleRequests: [] }))
            : Promise.resolve({ roles: [], directPermissions: [], pendingRoleRequests: [] }),
        ])
        const delegatable = delegatableRes.permissions || []
        setDelegatablePermissions(delegatable)
        setSelectedDelegationCode((prev) =>
          prev && delegatable.some((p: DelegatablePermission) => p.code === prev)
            ? prev
            : delegatable[0]?.code || '',
        )
        setTargetDirectPerms(empAccessRes.directPermissions || [])
        setTargetRoleNames((empAccessRes.roles || []).map((r: any) => r.name))
        setPendingRoleRequests((empAccessRes as any).pendingRoleRequests || [])
      } catch {
        // ignore fallback errors
      }
    },
    [canDelegate, hasAnyPermission],
  )

  useEffect(() => {
    if (!selectedUser) return
    let cancelled = false
    const isSelfInspect = selectedUser.id === currentUser?.id
    Promise.all([
      erpApi.getMyPermissions().catch(() => ({
        permissions: [] as string[],
        roles: [] as any[],
        directPermissions: [] as any[],
      })),
      canDelegate
        ? erpApi.getDelegatablePermissions().catch(() => ({ permissions: [] }))
        : Promise.resolve({ permissions: [] }),
      isSelfInspect || !canGrantAccess
        ? Promise.resolve(null)
        : erpApi
            .getEmployeePermissions(selectedUser.id)
            .catch(() => ({ roles: [], directPermissions: [], pendingRoleRequests: [] })),
    ])
      .then(([myPermsRes, delegatableRes, empAccessRes]) => {
        if (cancelled) return
        const delegatable = delegatableRes.permissions || []
        setDelegatablePermissions(delegatable)
        setSelectedDelegationCode(delegatable[0]?.code || '')
        const resolvedAccess = empAccessRes ?? (isSelfInspect ? myPermsRes : null)
        setTargetDirectPerms(resolvedAccess?.directPermissions || [])
        setTargetRoleNames((resolvedAccess?.roles || []).map((r: any) => r.name))
        setPendingRoleRequests((resolvedAccess as any)?.pendingRoleRequests || [])
      })
      .catch(() => {
        // individual API calls already fallback inside Promise.all
      })
    return () => {
      cancelled = true
    }
  }, [selectedUser, currentUser?.id, canDelegate, canGrantAccess])

  const handleGrantDirectPermission = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !selectedDelegationCode) return
    const display = getPermissionDisplay(selectedDelegationCode)
    setPendingDirectPermMfa({
      mode: 'grant',
      user: selectedUser,
      permissionCode: selectedDelegationCode,
      label: display.label,
      expiresAt: delegationExpiry ? new Date(delegationExpiry).toISOString() : undefined,
      reason: delegationReason.trim() || undefined,
    })
  }

  const handleRequestRoleChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !requestedRoleSlug) return
    const roleLabelMap: Record<string, string> = {
      developer: 'Developer',
      pm: 'Project Manager',
      cto: 'Chief Technology Officer',
      cfo: 'Chief Financial Officer',
      chro: 'Chief Human Resources Officer',
    }
    setPendingConfirm({
      kind: 'request_role_change',
      user: selectedUser,
      roleSlug: requestedRoleSlug,
      roleName: roleLabelMap[requestedRoleSlug] || requestedRoleSlug.toUpperCase(),
      reason: roleChangeReason.trim() || undefined,
    })
  }

  const handleExecuteConfirmedAction = async (_stepUpPhrase?: string, passwordConfirm?: string) => {
    if (!pendingConfirm) return
    setIsActionSubmitting(true)
    const targetUser = pendingConfirm.user
    try {
      if (pendingConfirm.kind === 'suspend') {
        await erpApi.suspendEmployee(targetUser.id, { passwordConfirm })
        showToast(`${targetUser.name}'s account has been suspended immediately.`, 'warning')
        setSelectedUser((prev) =>
          prev && prev.id === targetUser.id ? { ...prev, isSuspended: true } : prev,
        )
      } else if (pendingConfirm.kind === 'unsuspend') {
        await erpApi.unsuspendEmployee(targetUser.id)
        showToast(`${targetUser.name}'s account has been reactivated.`, 'success')
        setSelectedUser((prev) =>
          prev && prev.id === targetUser.id ? { ...prev, isSuspended: false } : prev,
        )
      } else if (pendingConfirm.kind === 'demote') {
        await erpApi.demoteEmployee(targetUser.id, { passwordConfirm })
        showToast(
          `${targetUser.name} has been reset to Base Access. All elevated roles and special exceptions were removed.`,
          'warning',
        )
      } else if (pendingConfirm.kind === 'revoke_single') {
        await erpApi.revokeDirectPermission(targetUser.id, pendingConfirm.permissionId)
        showToast(`Revoked "${pendingConfirm.label}" access from ${targetUser.name}.`, 'info')
      } else if (pendingConfirm.kind === 'grant_direct') {
        await erpApi.grantDirectPermission(targetUser.id, {
          permissionCode: pendingConfirm.permissionCode,
          expiresAt: pendingConfirm.expiresAt,
          reason: pendingConfirm.reason,
        })
        showToast(`Granted "${pendingConfirm.label}" access to ${targetUser.name}.`, 'success')
        setDelegationReason('')
        setDelegationExpiry('')
      } else if (pendingConfirm.kind === 'request_role_change') {
        await erpApi.createAccessRequest({
          targetEmployeeId: targetUser.id,
          requestedRoleSlug: pendingConfirm.roleSlug,
          reason: pendingConfirm.reason,
        })
        showToast(
          `Role change to ${pendingConfirm.roleName} for ${targetUser.name} submitted for CHRO/CEO approval.`,
          'info',
        )
        setRoleChangeReason('')
      } else if (pendingConfirm.kind === 'approve_role_request') {
        await erpApi.approveAccessRequest(pendingConfirm.requestId)
        showToast(
          `Approved role promotion to ${pendingConfirm.roleName} for ${targetUser.name}.`,
          'success',
        )
      } else if (pendingConfirm.kind === 'reject_role_request') {
        await erpApi.rejectAccessRequest(pendingConfirm.requestId)
        showToast(
          `Declined role change request (${pendingConfirm.roleName}) for ${targetUser.name}.`,
          'info',
        )
      } else if (pendingConfirm.kind === 'save_edit') {
        updateUser(targetUser.id, {
          teamId: pendingConfirm.teamId,
          title: pendingConfirm.title,
          skills: pendingConfirm.skills,
        })
        if (pendingConfirm.roleChanged) {
          const targetSlug =
            pendingConfirm.nextRole === 'cpo' ? 'chro' : String(pendingConfirm.nextRole)
          await erpApi.createAccessRequest({
            targetEmployeeId: targetUser.id,
            requestedRoleSlug: targetSlug,
            reason: `Requested via Personnel Edit modal by ${currentUser?.name || currentRole}`,
          })
          showToast(
            `Personnel details saved. Role change submitted for CHRO/CEO Maker-Checker approval.`,
            'info',
          )
        } else {
          showToast(`Updated personnel record for ${targetUser.name}`, 'success')
        }
        setEditingUser(null)
      }

      setPendingConfirm(null)
      await Promise.all([refreshData(), loadDelegationPanel(targetUser.id)])
    } catch (err: any) {
      showToast(err?.message || 'Unable to complete security action', 'error')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const handleExecuteMfaAction = async ({ mfaCode, reason }: MfaConfirmPayload) => {
    if (!pendingMfaAction) return
    setIsMfaActionSubmitting(true)
    const { meta, user, newTitle } = pendingMfaAction
    try {
      if (meta.key === 'reset_password') {
        await erpApi.adminResetPassword(user.id, reason || '', mfaCode)
        showToast(
          `Temporary password emailed to ${user.name} (${user.email}). Active sessions were revoked.`,
          'success',
        )
      } else if (meta.key === 'reset_mfa') {
        await erpApi.adminResetMfa(user.id, reason || '', mfaCode)
        showToast(
          `MFA enrollment reset for ${user.name}. They must re-enroll on next login.`,
          'warning',
        )
      } else if (meta.key === 'unlock_sensitive') {
        const unlocked = await erpApi.unlockSensitiveProfile(user.id, mfaCode)
        const profile = await erpApi.getSensitiveProfile(user.id, unlocked.viewToken)
        setSensitiveProfileView({
          employeeId: user.id,
          expiresAt: unlocked.expiresAt,
          profile,
        })
        showToast(`Sensitive profile unlocked for 5 minutes for ${user.name}.`, 'info')
      } else if (meta.key === 'promote') {
        const titleToApply = (newTitle || promoteNewTitle).trim()
        await erpApi.promoteEmployee(
          user.id,
          { newTitle: titleToApply, reason: reason || '' },
          mfaCode,
        )
        showToast(`${user.name} promoted to ${titleToApply}.`, 'success')
        setShowPromoteInput(false)
        setPromoteNewTitle('')
      } else if (meta.key === 'remove_position') {
        await erpApi.removePosition(user.id, reason || '', mfaCode)
        showToast(`${user.name} removed from current organizational position.`, 'warning')
      }
      setPendingMfaAction(null)
      await Promise.all([refreshData(), loadDelegationPanel(user.id)])
    } catch (err: any) {
      showToast(err?.message || 'Unable to complete MFA-protected action', 'error')
    } finally {
      setIsMfaActionSubmitting(false)
    }
  }

  // Edit Member Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('developer')
  const [editTeamId, setEditTeamId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editSkills, setEditSkills] = useState('')

  const allUsers = data.users
  const canInspectFullRoster = hasAnyPermission(
    'employees:update_any',
    'employees:create',
    'employees:suspend',
    'permissions:delegate',
    'users:assign_role',
    'positions:assign',
    'roles:read',
    'teams:read_all',
  )

  const visibleDirectoryUsers = useMemo(() => {
    if (canInspectFullRoster) return allUsers
    // Standard users without elevated people/governance permissions see leadership directory only
    return allUsers.filter(
      (u) => ['ceo', 'cto', 'cfo', 'cpo', 'chro'].includes(u.role) || isCeoTargetUser(u),
    )
  }, [allUsers, canInspectFullRoster])

  const [showBioDetails, setShowBioDetails] = useState(false)

  const inspectedUser = useMemo(
    () => (selectedUser ? allUsers.find((u) => u.id === selectedUser.id) || selectedUser : null),
    [allUsers, selectedUser],
  )

  const filteredUsers = useMemo(() => {
    return visibleDirectoryUsers.filter((u) => {
      if (canInspectFullRoster) {
        if (roleFilter === 'developer' && u.role !== 'developer') return false
        if (roleFilter === 'pm' && u.role !== 'pm') return false
        if (roleFilter === 'executive' && ['developer', 'pm'].includes(u.role)) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = u.name.toLowerCase().includes(q)
        const titleMatch = u.title.toLowerCase().includes(q)
        const emailMatch = u.email.toLowerCase().includes(q)
        const skillMatch = u.skills?.some((s) => s.toLowerCase().includes(q))
        if (!nameMatch && !titleMatch && !emailMatch && !skillMatch) return false
      }
      return true
    })
  }, [visibleDirectoryUsers, canInspectFullRoster, roleFilter, searchQuery])

  const getUserTasks = (userId: string) => {
    return tasks.filter((t) => t.assigneeId === userId)
  }

  const getUserTeam = (teamId?: string) => {
    if (!teamId) return null
    return teams.find((t) => t.id === teamId)
  }

  const handleOpenEdit = (user: User) => {
    setEditingUser(user)
    setEditRole(user.role)
    setEditTeamId(user.teamId || '')
    setEditTitle(user.title)
    setEditSkills(user.skills?.join(', ') || '')
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    const skillsArray = editSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    setPendingConfirm({
      kind: 'save_edit',
      user: editingUser,
      nextRole: editRole,
      teamId: editTeamId || undefined,
      title: editTitle.trim() || editingUser.title,
      skills: skillsArray,
      roleChanged: editRole !== editingUser.role,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-display">
            People Directory
          </h2>
          <Badge variant="indigo" size="xs">
            {visibleDirectoryUsers.length} {canInspectFullRoster ? 'Personnel' : 'Leadership'}
          </Badge>
        </div>

        {canCreateEmployee && (
          <Button
            variant="primary"
            size="sm"
            icon={UserPlus}
            onClick={() => {
              setCreatedCredentials(null)
              setIsEmailLocked(false)
              setCreateName('')
              setCreateEmail('')
              setCreateTitle('')
              setCreateRoleSlug('developer')
              setCreateTeamId('')
              setCreateSkills('')
              setIsCreateModalOpen(true)
            }}
          >
            Add Employee
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#0f1422] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search directory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Role Tabs (Executives Only) */}
        {canInspectFullRoster && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({visibleDirectoryUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('developer')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                roleFilter === 'developer'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Developers ({visibleDirectoryUsers.filter((u) => u.role === 'developer').length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('pm')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                roleFilter === 'pm'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              PMs ({visibleDirectoryUsers.filter((u) => u.role === 'pm').length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('executive')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                roleFilter === 'executive'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              C-Suite (
              {visibleDirectoryUsers.filter((u) => !['developer', 'pm'].includes(u.role)).length})
            </button>
          </div>
        )}
      </div>

      {/* People Grid (Responsive 1->2->3->4 cols, generous spacing) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredUsers.map((user) => {
          const team = getUserTeam(user.teamId)
          const activeTasks = getUserTasks(user.id)
          const isTargetCeo = isCeoTargetUser(user)
          const isTargetCLevel = ['ceo', 'cto', 'cfo', 'chro', 'cpo'].includes(user.role)
          const showGrantOnCard = canGrantAccess
          const showEditOnCard = canEditProfiles
          const roleDisplayBadge = user.role === 'cpo' ? 'CHRO' : user.role.toUpperCase()

          return (
            <div
              key={user.id}
              className={`p-6 rounded-2xl transition-all duration-200 flex flex-col justify-between group space-y-5 border ${
                user.isSuspended
                  ? 'bg-rose-50/50 dark:bg-rose-950/15 border-rose-300 dark:border-rose-900/70 shadow-sm'
                  : isTargetCeo
                    ? 'bg-gradient-to-br from-amber-50/75 via-white to-yellow-50/40 dark:from-amber-950/30 dark:via-[#0f1422] dark:to-amber-950/15 border-amber-200 dark:border-amber-700/70 shadow-md hover:shadow-lg'
                    : isTargetCLevel
                      ? 'bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-[#131a2b] dark:via-[#0f1422] dark:to-indigo-950/20 border-indigo-300/80 dark:border-indigo-800/70 shadow-md hover:shadow-lg'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700'
              }`}
            >
              {/* Top Row: Avatar + Name + Top-Right Authority Pill */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="relative shrink-0">
                    <Avatar
                      src={user.avatarUrl || user.avatar}
                      name={user.name}
                      initials={user.initials}
                      size="lg"
                      className={`border-2 ${
                        user.isSuspended
                          ? 'border-rose-300 dark:border-rose-800 opacity-75 grayscale'
                          : isTargetCeo
                            ? 'border-amber-300 dark:border-amber-600'
                            : isTargetCLevel
                              ? 'border-indigo-300 dark:border-indigo-700'
                              : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    <span
                      className={`w-3 h-3 rounded-full ring-2 ring-white dark:ring-[#0f1422] absolute -bottom-0.5 -right-0.5 ${
                        user.isSuspended ? 'bg-rose-600' : 'bg-emerald-500'
                      }`}
                      title={user.isSuspended ? 'Account Suspended' : 'Online'}
                    />
                  </div>

                  {/* Top-Right Hierarchical Role Pill */}
                  <div className="flex flex-col items-end gap-1">
                    {isTargetCeo ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-950 shadow-sm pointer-events-none select-none"
                        title="Supreme Organizational Authority"
                      >
                        <Crown className="w-2.5 h-2.5" />
                        CEO
                      </span>
                    ) : isTargetCLevel ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-sm select-none">
                        {roleDisplayBadge}
                      </span>
                    ) : (
                      <Badge variant={user.role === 'pm' ? 'purple' : 'slate'} size="xs">
                        {roleDisplayBadge}
                      </Badge>
                    )}

                    {isTargetCeo && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 pointer-events-none select-none">
                        SUPREME AUTHORITY
                      </span>
                    )}
                    {user.isSuspended && (
                      <Badge variant="rose" size="xs">
                        SUSPENDED
                      </Badge>
                    )}
                    {user.pendingAccessRequest && (
                      <Badge variant="amber" size="xs" title="Pending CHRO/CEO Approval">
                        PENDING APPROVAL
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Identity Info (Concise) */}
                <div className="min-w-0">
                  <h4
                    onClick={() => {
                      setShowBioDetails(false)
                      setSelectedUser(user)
                    }}
                    className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer truncate"
                  >
                    {user.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {user.title}
                  </p>
                </div>

                {/* Icon-driven quick metadata */}
                <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                  <span
                    className="inline-flex items-center gap-1 min-w-0 truncate"
                    title={team?.name || 'Executive / Unassigned Squad'}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {team?.code || team?.name?.split('—')[0]?.trim() || 'HQ'}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 min-w-0 truncate"
                    title={user.email}
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  </span>
                </div>

                {/* Stat Blocks */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-center">
                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                      {activeTasks.length}
                    </div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                      Active Tasks
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-center">
                    <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white leading-tight">
                      {user.skills?.length || 0}
                    </div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                      Core Skills
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-end gap-1.5">
                {showGrantOnCard && (
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={KeyRound}
                    title="Grant temporary capability"
                    onClick={() => {
                      setShowBioDetails(false)
                      setSelectedUser(user)
                    }}
                  >
                    Access
                  </Button>
                )}
                {showEditOnCard && (
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={Edit2}
                    title="Edit employee profile"
                    onClick={() => handleOpenEdit(user)}
                  />
                )}
                <Button
                  variant={isTargetCeo ? 'brand' : 'secondary'}
                  size="xs"
                  onClick={() => {
                    setShowBioDetails(false)
                    setSelectedUser(user)
                  }}
                >
                  Inspect
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Member Modal */}
      {editingUser && (
        <Modal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          title={`Edit Personnel — ${editingUser.name}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <Avatar
                src={editingUser.avatarUrl || editingUser.avatar}
                name={editingUser.name}
                initials={editingUser.initials}
                size="lg"
                className="border border-slate-200 dark:border-slate-700"
              />
              <div>
                <div className="font-bold text-slate-900 dark:text-white">{editingUser.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">{editingUser.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Role Assignment
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="developer">Developer</option>
                  <option value="pm">Project Manager (PM)</option>
                  <option value="cto">CTO</option>
                  <option value="ceo">CEO</option>
                  <option value="cfo">CFO</option>
                  <option value="cpo">CPO</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Assigned Squad
                </label>
                <select
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="">No Squad (Floating)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Job Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Senior Full-Stack Engineer"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Skills / Competencies (comma separated)
              </label>
              <input
                type="text"
                value={editSkills}
                onChange={(e) => setEditSkills(e.target.value)}
                placeholder="e.g. React, TypeScript, Rust, Docker"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm" icon={CheckCircle2}>
                Save Member Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* User Inspect Modal */}
      {inspectedUser && (
        <Modal
          isOpen={
            !!inspectedUser &&
            !pendingMfaAction &&
            !pendingConfirm &&
            !pendingResendUser &&
            !pendingDirectPermMfa
          }
          onClose={() => setSelectedUser(null)}
          title={`${inspectedUser.name} — Profile & Workload`}
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Avatar
                src={inspectedUser.avatarUrl || inspectedUser.avatar}
                name={inspectedUser.name}
                initials={inspectedUser.initials}
                className={`w-14 h-14 text-base border-2 ${
                  inspectedUser.isSuspended
                    ? 'border-rose-300 dark:border-rose-800 opacity-75 grayscale'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                    {inspectedUser.name}
                  </h3>
                  {isCeoTargetUser(inspectedUser) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-amber-950 shadow-sm pointer-events-none select-none">
                      <Crown className="w-2.5 h-2.5" />
                      SUPREME AUTHORITY
                    </span>
                  )}
                  {inspectedUser.isSuspended && (
                    <Badge variant="rose" size="xs">
                      ACCOUNT SUSPENDED
                    </Badge>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {inspectedUser.title}
                </p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <Badge variant="indigo" size="xs">
                    {inspectedUser.role === 'cpo' ? 'CHRO' : inspectedUser.role.toUpperCase()}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <Mail className="w-3 h-3" />
                    {inspectedUser.email}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge
                    variant={
                      inspectedUser.inviteTokenUsedAt || inspectedUser.mfaEnabled
                        ? 'emerald'
                        : inspectedUser.inviteDeliveryStatus === 'failed'
                          ? 'rose'
                          : 'amber'
                    }
                    size="xs"
                  >
                    {inspectedUser.inviteTokenUsedAt
                      ? `Setup link used (${new Intl.DateTimeFormat('en-BD', { timeZone: 'Asia/Dhaka', dateStyle: 'short', timeStyle: 'short' }).format(new Date(inspectedUser.inviteTokenUsedAt))})`
                      : inspectedUser.mfaEnabled
                        ? 'Account activated & secured'
                        : inspectedUser.inviteDeliveryStatus === 'failed'
                          ? 'Invitation not delivered'
                          : 'Setup link pending (unused)'}
                  </Badge>
                  {!inspectedUser.inviteTokenUsedAt &&
                    !inspectedUser.mfaEnabled &&
                    hasAnyPermission('employees:create', 'users:reset_password') &&
                    !isCeoTargetUser(inspectedUser) && (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() => setPendingResendUser(inspectedUser)}
                      >
                        Resend 24h link
                      </Button>
                    )}
                </div>
              </div>
            </div>

            {/* Progressive Disclosure Toggle for Bio & Full Skill Stack */}
            {(inspectedUser.bio || (inspectedUser.skills && inspectedUser.skills.length > 0)) && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowBioDetails((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>
                    {showBioDetails ? 'Hide Bio & Skill Stack' : 'View Bio & Skill Stack'}
                  </span>
                  {showBioDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showBioDetails && (
                  <div className="mt-2.5 space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
                    {inspectedUser.bio && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {inspectedUser.bio}
                      </p>
                    )}
                    {inspectedUser.skills && inspectedUser.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {inspectedUser.skills.map((skill) => (
                          <span
                            key={skill}
                            className="text-[11px] px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Assigned Tasks */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Current Assigned Deliverables ({getUserTasks(inspectedUser.id).length})
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {getUserTasks(inspectedUser.id).length === 0 ? (
                  <span className="text-xs text-slate-400">No active tasks assigned.</span>
                ) : (
                  getUserTasks(inspectedUser.id).map((task) => (
                    <div
                      key={task.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px]">
                        {task.title}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Segment 1: Core Organizational Position (Maker-Checker Protected) */}
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Segment 1: Core Organizational Position</span>
                </h4>
                {(pendingRoleRequests.length > 0 || inspectedUser.pendingAccessRequest) && (
                  <Badge variant="amber" size="xs" dot>
                    Pending CHRO/CEO Approval
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Assigned Organizational Role(s)
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {targetRoleNames.length > 0
                      ? targetRoleNames.join(' · ')
                      : inspectedUser.role.toUpperCase()}
                  </div>
                </div>
                <Badge variant="indigo" size="xs">
                  Governance Controlled
                </Badge>
              </div>

              {/* Active Pending Maker-Checker Request */}
              {pendingRoleRequests.map((reqItem) => {
                const canApproveThis =
                  canApproveRoleRequests &&
                  reqItem.requesterId !== currentUser?.id &&
                  inspectedUser.id !== currentUser?.id
                return (
                  <div
                    key={reqItem.id}
                    className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="amber" size="xs">
                          Pending CHRO/CEO Approval
                        </Badge>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Requested Change → {reqItem.requestedRole.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Initiated by {reqItem.requester.name}
                        {reqItem.reason ? ` · "${reqItem.reason}"` : ''}
                      </p>
                    </div>
                    {canApproveThis && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          variant="lime"
                          size="xs"
                          icon={UserCheck}
                          onClick={() =>
                            setPendingConfirm({
                              kind: 'approve_role_request',
                              user: inspectedUser,
                              requestId: reqItem.id,
                              roleName: reqItem.requestedRole.name,
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="xs"
                          icon={XCircle}
                          onClick={() =>
                            setPendingConfirm({
                              kind: 'reject_role_request',
                              user: inspectedUser,
                              requestId: reqItem.id,
                              roleName: reqItem.requestedRole.name,
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Request Core Role / Position Change (Maker-Checker Initiation — authorized managers only) */}
              {currentUser?.id === inspectedUser.id ? (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Zero-Trust protection: You cannot modify your own organizational role or
                    permissions.
                  </span>
                </div>
              ) : (
                canRequestRoleChange &&
                !isCeoTargetUser(inspectedUser) && (
                  <form
                    onSubmit={handleRequestRoleChange}
                    className="p-3 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                  >
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Propose Role / Position Change (Requires CHRO or CEO Sign-Off)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={requestedRoleSlug}
                        onChange={(e) => setRequestedRoleSlug(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
                      >
                        <option value="developer">Developer</option>
                        <option value="pm">Project Manager</option>
                        <option value="cto">Chief Technology Officer (CTO)</option>
                        <option value="cfo">Chief Financial Officer (CFO)</option>
                        <option value="chro">Chief Human Resources Officer (CHRO)</option>
                      </select>
                      <input
                        type="text"
                        value={roleChangeReason}
                        onChange={(e) => setRoleChangeReason(e.target.value)}
                        placeholder="Business justification (optional)"
                        className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" variant="secondary" size="xs" icon={Briefcase}>
                        Request Role Change
                      </Button>
                    </div>
                  </form>
                )
              )}
            </div>

            {/* Segment 2: Additional Granted Access (Direct Discretionary Exceptions) */}
            <div className="p-4 rounded-2xl bg-amber-50/30 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                    <span>Segment 2: Additional Granted Access</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Discretionary temporary capabilities delegated directly within your executive
                    authority.
                  </p>
                </div>
              </div>

              {/* Active Special Access Exceptions */}
              {targetDirectPerms.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {targetDirectPerms.map((dp) => {
                    const display = getPermissionDisplay(dp.code, dp.description)
                    return (
                      <div
                        key={dp.id}
                        className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {display.label}
                            </span>
                            {dp.expiresAt ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                                <Calendar className="w-2.5 h-2.5" />
                                Expires {new Date(dp.expiresAt).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Ongoing access</span>
                            )}
                          </div>
                          {dp.reason && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {dp.reason}
                            </p>
                          )}
                        </div>
                        {canDelegate && (
                          <Button
                            type="button"
                            variant="danger"
                            size="xs"
                            icon={XCircle}
                            onClick={() =>
                              setPendingDirectPermMfa({
                                mode: 'revoke',
                                user: inspectedUser,
                                permissionId: dp.permissionId,
                                label: display.label,
                              })
                            }
                            className="shrink-0"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="No active delegations at this time."
                  description={`No temporary access exceptions are currently assigned to ${inspectedUser.name}.`}
                  className="py-5"
                />
              )}

              {/* Grant Temporary Access Form (scoped strictly to executive's own authority, never targeting CEO) */}
              {isCeoTargetUser(inspectedUser) ? (
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    The CEO holds absolute system authority across all modules and cannot be
                    modified or delegated access by subordinates.
                  </span>
                </div>
              ) : (
                canDelegate &&
                delegatablePermissions.length > 0 &&
                currentUser?.id !== inspectedUser.id && (
                  <form
                    onSubmit={handleGrantDirectPermission}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Grant Temporary Capability ({delegatablePermissions.length} capabilities
                      available under your authority)
                    </div>

                    <select
                      value={selectedDelegationCode}
                      onChange={(e) => setSelectedDelegationCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
                    >
                      {delegatablePermissions.map((p) => {
                        const display = getPermissionDisplay(p.code, p.description)
                        return (
                          <option key={p.id} value={p.code}>
                            [{display.department}] {display.label}
                          </option>
                        )
                      })}
                    </select>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                          Access Expires On (Optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={delegationExpiry}
                          onChange={(e) => setDelegationExpiry(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                          Business Reason (Optional)
                        </label>
                        <input
                          type="text"
                          value={delegationReason}
                          onChange={(e) => setDelegationReason(e.target.value)}
                          placeholder="e.g. Covering executive leave"
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="lime"
                        size="xs"
                        icon={KeyRound}
                        disabled={!selectedDelegationCode}
                      >
                        Grant Access
                      </Button>
                    </div>
                  </form>
                )
              )}
            </div>

            {/* Danger Zone: Account Actions (HR / CEO Lifecycle & RBAC Controls) */}
            {(canSuspendAccount || canResetAccess) && (
              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Account Actions</span>
                    </h4>
                    <p className="text-[11px] text-rose-600/90 dark:text-rose-300/80 mt-0.5">
                      {isCeoTargetUser(inspectedUser)
                        ? 'The system:root executive account is protected against suspension or access reset.'
                        : inspectedUser.id === currentUser?.id
                          ? 'Zero-Trust protection prevents suspending or demoting your own active account.'
                          : 'Immediately block system sign-in or strip elevated privileges back to baseline staff access.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canSuspendAccount &&
                    (inspectedUser.isSuspended ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        icon={ShieldCheck}
                        disabled={
                          isCeoTargetUser(inspectedUser) ||
                          inspectedUser.id === currentUser?.id
                        }
                        onClick={() =>
                          setPendingConfirm({ kind: 'unsuspend', user: inspectedUser })
                        }
                        className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                      >
                        Reactivate Account
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="danger"
                        size="xs"
                        icon={Ban}
                        disabled={
                          isCeoTargetUser(inspectedUser) ||
                          inspectedUser.id === currentUser?.id
                        }
                        onClick={() => setPendingConfirm({ kind: 'suspend', user: inspectedUser })}
                      >
                        Suspend Account
                      </Button>
                    ))}

                  {canResetAccess && (
                    <Button
                      type="button"
                      variant="danger"
                      size="xs"
                      icon={RotateCcw}
                      disabled={
                        isCeoTargetUser(inspectedUser) ||
                        inspectedUser.id === currentUser?.id
                      }
                      onClick={() => setPendingConfirm({ kind: 'demote', user: inspectedUser })}
                    >
                      Reset to Base Access
                    </Button>
                  )}
                </div>
              </div>
            )}

            {visibleSensitiveActions.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Executive &amp; Sensitive Actions (Fresh MFA Required)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {visibleSensitiveActions.map((action) => {
                    const isSelf = inspectedUser.id === currentUser?.id
                    const isCeo = isCeoTargetUser(inspectedUser)
                    const disabled =
                      (action.key === 'reset_password' ||
                        action.key === 'reset_mfa' ||
                        action.key === 'remove_position') &&
                      (isSelf || isCeo)
                    const iconMap = {
                      unlock_sensitive: Unlock,
                      promote: TrendingUp,
                      remove_position: UserMinus,
                      reset_password: KeyRound,
                      reset_mfa: ShieldCheck,
                    } as const
                    return (
                      <Button
                        key={action.key}
                        type="button"
                        variant={
                          action.key === 'reset_mfa' || action.key === 'remove_position'
                            ? 'danger'
                            : 'secondary'
                        }
                        size="xs"
                        icon={iconMap[action.key]}
                        disabled={disabled}
                        onClick={() => {
                          if (action.key === 'promote') {
                            setPromoteNewTitle(inspectedUser.title || '')
                            setShowPromoteInput((prev) => !prev)
                            return
                          }
                          setPendingMfaAction({ meta: action, user: inspectedUser })
                        }}
                      >
                        {action.label}
                      </Button>
                    )
                  })}
                </div>

                {showPromoteInput &&
                  visibleSensitiveActions.some((a) => a.key === 'promote') && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                          New Promotion Title *
                        </label>
                        <input
                          type="text"
                          value={promoteNewTitle}
                          onChange={(e) => setPromoteNewTitle(e.target.value)}
                          placeholder="e.g. Principal Engineer"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="xs"
                        disabled={promoteNewTitle.trim().length < 2}
                        onClick={() => {
                          const promoteMeta = visibleSensitiveActions.find(
                            (a) => a.key === 'promote',
                          )
                          if (!promoteMeta) return
                          setPendingMfaAction({
                            meta: promoteMeta,
                            user: inspectedUser,
                            newTitle: promoteNewTitle.trim(),
                          })
                        }}
                      >
                        Continue to MFA
                      </Button>
                    </div>
                  )}

                {sensitiveProfileView &&
                  sensitiveProfileView.employeeId === inspectedUser.id && (
                    <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          Sensitive Profile Unlocked (5-min view)
                        </span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-400">
                          Expires {new Date(sensitiveProfileView.expiresAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="text-slate-500">Status:</span>{' '}
                          {sensitiveProfileView.profile.isSuspended ? 'Suspended' : 'Active'}
                        </div>
                        <div>
                          <span className="text-slate-500">MFA Enabled:</span>{' '}
                          {sensitiveProfileView.profile.mfaEnabled ? 'Yes' : 'No'}
                        </div>
                        <div>
                          <span className="text-slate-500">Hourly Rate:</span>{' '}
                          {sensitiveProfileView.profile.hourlyRate ?? 'Not set'}
                        </div>
                        <div>
                          <span className="text-slate-500">Monthly Cap:</span>{' '}
                          {sensitiveProfileView.profile.monthlyCap ?? 'Not set'}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Position &amp; Access History
              </div>
              <EmployeeHistoryTimeline employeeId={inspectedUser.id} />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedUser(null)
                  setShowPromoteInput(false)
                  setSensitiveProfileView(null)
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Global Security Interceptor & Step-Up Auth Modal */}
      {pendingConfirm && (
        <SecurityConfirmModal
          isOpen={!!pendingConfirm}
          onClose={() => setPendingConfirm(null)}
          onConfirm={(stepUpPhrase, passwordConfirm) =>
            void handleExecuteConfirmedAction(stepUpPhrase, passwordConfirm)
          }
          isSubmitting={isActionSubmitting}
          severity={
            ['suspend', 'demote', 'revoke_single', 'reject_role_request'].includes(
              pendingConfirm.kind,
            )
              ? 'danger'
              : 'standard'
          }
          requirePhrase={
            pendingConfirm.kind === 'demote'
              ? 'CONFIRM DEMOTE'
              : pendingConfirm.kind === 'suspend'
                ? 'CONFIRM SUSPEND'
                : undefined
          }
          requirePassword={['suspend', 'demote'].includes(pendingConfirm.kind)}
          title={
            pendingConfirm.kind === 'suspend'
              ? 'Confirm Account Suspension'
              : pendingConfirm.kind === 'unsuspend'
                ? 'Confirm Account Reactivation'
                : pendingConfirm.kind === 'demote'
                  ? 'Confirm Reset to Base Access'
                  : pendingConfirm.kind === 'revoke_single'
                    ? 'Confirm Revoke Special Access'
                    : pendingConfirm.kind === 'grant_direct'
                      ? 'Confirm Grant Temporary Access'
                      : pendingConfirm.kind === 'request_role_change'
                        ? 'Confirm Organizational Role Request'
                        : pendingConfirm.kind === 'approve_role_request'
                          ? 'Confirm Approve Role Change'
                          : pendingConfirm.kind === 'reject_role_request'
                            ? 'Confirm Reject Role Change'
                            : 'Confirm Personnel Update'
          }
          details={
            pendingConfirm.kind === 'suspend'
              ? `Suspend ${pendingConfirm.user.name}'s account. They will lose all access to the ERP immediately.`
              : pendingConfirm.kind === 'unsuspend'
                ? `Reactivate ${pendingConfirm.user.name}'s account and restore ERP access.`
                : pendingConfirm.kind === 'demote'
                  ? `Reset ${pendingConfirm.user.name} to Base Access. All elevated roles and special access exceptions will be permanently removed immediately.`
                  : pendingConfirm.kind === 'revoke_single'
                    ? `Revoke "${pendingConfirm.label}" from ${pendingConfirm.user.name}. They will lose this capability immediately.`
                    : pendingConfirm.kind === 'grant_direct'
                      ? `Grant temporary capability "${pendingConfirm.label}" to ${pendingConfirm.user.name}.`
                      : pendingConfirm.kind === 'request_role_change'
                        ? `Submit a Maker-Checker role change request moving ${pendingConfirm.user.name} to ${pendingConfirm.roleName} (requires CHRO or CEO approval).`
                        : pendingConfirm.kind === 'approve_role_request'
                          ? `Approve and immediately apply the ${pendingConfirm.roleName} organizational role to ${pendingConfirm.user.name}.`
                          : pendingConfirm.kind === 'reject_role_request'
                            ? `Decline the pending role change request (${pendingConfirm.roleName}) for ${pendingConfirm.user.name}.`
                            : pendingConfirm.roleChanged
                              ? `Save personnel updates for ${pendingConfirm.user.name} and submit a Maker-Checker approval request for role change to ${String(pendingConfirm.nextRole).toUpperCase()}.`
                              : `Update personnel details (title, squad, skills) for ${pendingConfirm.user.name}.`
          }
          confirmLabel={
            pendingConfirm.kind === 'suspend'
              ? 'Suspend Account'
              : pendingConfirm.kind === 'unsuspend'
                ? 'Reactivate Account'
                : pendingConfirm.kind === 'demote'
                  ? 'Reset to Base Access'
                  : pendingConfirm.kind === 'revoke_single'
                    ? 'Revoke Access'
                    : pendingConfirm.kind === 'grant_direct'
                      ? 'Grant Access'
                      : pendingConfirm.kind === 'request_role_change'
                        ? 'Submit for Approval'
                        : pendingConfirm.kind === 'approve_role_request'
                          ? 'Approve Role Change'
                          : pendingConfirm.kind === 'reject_role_request'
                            ? 'Reject Request'
                            : 'Save Changes'
          }
        />
      )}

      {pendingMfaAction && (
        <MfaConfirmModal
          isOpen={!!pendingMfaAction}
          onClose={() => setPendingMfaAction(null)}
          onConfirm={(payload) => void handleExecuteMfaAction(payload)}
          title={pendingMfaAction.meta.title}
          actionSummary={pendingMfaAction.meta.describe(
            pendingMfaAction.user.name,
            pendingMfaAction.newTitle,
          )}
          whoAffected={`${pendingMfaAction.user.name} (${pendingMfaAction.user.email})`}
          requiresReason={pendingMfaAction.meta.requiresReason}
          isCritical={pendingMfaAction.meta.isCritical}
          confirmLabel={pendingMfaAction.meta.confirmLabel}
          isSubmitting={isMfaActionSubmitting}
        />
      )}

      {pendingDirectPermMfa && (
        <MfaConfirmModal
          isOpen={!!pendingDirectPermMfa}
          onClose={() => setPendingDirectPermMfa(null)}
          onConfirm={async ({ mfaCode, reason }) => {
            if (!pendingDirectPermMfa) return
            setIsDirectPermSubmitting(true)
            const targetUser = pendingDirectPermMfa.user
            try {
              if (pendingDirectPermMfa.mode === 'grant') {
                await erpApi.grantDirectPermission(
                  targetUser.id,
                  {
                    permissionCode: pendingDirectPermMfa.permissionCode,
                    expiresAt: pendingDirectPermMfa.expiresAt,
                    reason: reason || pendingDirectPermMfa.reason,
                  },
                  mfaCode,
                )
                showToast(
                  `Granted "${pendingDirectPermMfa.label}" access to ${targetUser.name}.`,
                  'success',
                )
                setDelegationReason('')
                setDelegationExpiry('')
              } else {
                await erpApi.revokeDirectPermission(
                  targetUser.id,
                  pendingDirectPermMfa.permissionId,
                  mfaCode,
                )
                showToast(
                  `Revoked "${pendingDirectPermMfa.label}" access from ${targetUser.name}.`,
                  'info',
                )
              }
              setPendingDirectPermMfa(null)
              await Promise.all([refreshData(), loadDelegationPanel(targetUser.id)])
            } catch (err: any) {
              showToast(err?.message || 'Unable to complete MFA-protected access change.', 'error')
            } finally {
              setIsDirectPermSubmitting(false)
            }
          }}
          title={
            pendingDirectPermMfa.mode === 'grant'
              ? 'Verify MFA to Grant Temporary Access'
              : 'Verify MFA to Revoke Special Access'
          }
          actionSummary={
            pendingDirectPermMfa.mode === 'grant'
              ? `Grant temporary capability "${pendingDirectPermMfa.label}" to ${pendingDirectPermMfa.user.name}.`
              : `Revoke "${pendingDirectPermMfa.label}" from ${pendingDirectPermMfa.user.name}. They will lose this capability immediately.`
          }
          whoAffected={`${pendingDirectPermMfa.user.name} (${pendingDirectPermMfa.user.email})`}
          isCritical={pendingDirectPermMfa.mode === 'revoke'}
          confirmLabel={
            pendingDirectPermMfa.mode === 'grant' ? 'Verify MFA & Grant' : 'Verify MFA & Revoke'
          }
          isSubmitting={isDirectPermSubmitting}
        />
      )}

      {pendingResendUser && (
        <MfaConfirmModal
          isOpen={!!pendingResendUser}
          onClose={() => setPendingResendUser(null)}
          onConfirm={async ({ mfaCode, reason }) => {
            if (!pendingResendUser) return
            setIsResendingInvite(true)
            try {
              const res = await erpApi.resendEmployeeInvite(
                pendingResendUser.id,
                mfaCode,
                reason || 'Resend 24h onboarding activation link',
              )
              const nextStatus = res.deliveryStatus || (res.emailSent ? 'sent' : 'failed')
              setSelectedUser((prev) =>
                prev && prev.id === pendingResendUser.id
                  ? {
                      ...prev,
                      inviteDeliveryStatus: nextStatus,
                      inviteTokenUsedAt: null,
                    }
                  : prev,
              )
              showToast(
                nextStatus === 'failed'
                  ? `Delivery failed: ${res.deliveryError || 'Check mail configuration.'}`
                  : `New 24-hour one-time link emailed to ${pendingResendUser.email}.`,
                nextStatus === 'failed' ? 'warning' : 'success',
              )
              setPendingResendUser(null)
              await refreshData()
            } catch (err: any) {
              showToast(err?.message || 'Unable to resend onboarding link.', 'error')
            } finally {
              setIsResendingInvite(false)
            }
          }}
          title="Resend 24h Onboarding Link"
          actionSummary={`Invalidate any previous unused onboarding link for ${pendingResendUser.name} (${pendingResendUser.email}) and email a new 24-hour one-time activation link.`}
          whoAffected={`${pendingResendUser.name} (${pendingResendUser.email})`}
          requiresReason
          isCritical
          confirmLabel="Send 24h Link"
          isSubmitting={isResendingInvite}
        />
      )}

      {pendingCreatePayload && (
        <MfaConfirmModal
          isOpen={!!pendingCreatePayload}
          onClose={() => setPendingCreatePayload(null)}
          onConfirm={async ({ mfaCode, reason }) => {
            if (!pendingCreatePayload) return
            setIsCreatingEmployee(true)
            try {
              const res = await erpApi.createEmployee({ ...pendingCreatePayload, reason }, mfaCode)
              const roleLabel =
                res.employee?.employeeRoles?.[0]?.role?.name ||
                pendingCreatePayload.roleSlug.toUpperCase()
              setCreatedCredentials({
                name: res.employee?.name || pendingCreatePayload.name,
                email: res.employee?.email || pendingCreatePayload.email,
                roleName: roleLabel,
                deliveryStatus: res.deliveryStatus || 'sent',
                deliveryError: res.deliveryError,
              })
              showToast(
                res.deliveryStatus === 'failed'
                  ? 'Employee created, but invitation email failed to deliver.'
                  : `Onboarded ${pendingCreatePayload.name} and sent welcome email.`,
                res.deliveryStatus === 'failed' ? 'warning' : 'success',
              )
              setPendingCreatePayload(null)
              await refreshData()
            } catch (err: any) {
              showToast(err?.message || 'Failed to onboard employee', 'error')
            } finally {
              setIsCreatingEmployee(false)
            }
          }}
          title="Confirm Employee Onboarding"
          actionSummary={`Create employee account for ${pendingCreatePayload.name} (${pendingCreatePayload.email}) with role "${pendingCreatePayload.roleSlug}" and email a 24-hour one-time activation link to set their password.`}
          whoAffected={`${pendingCreatePayload.name} (${pendingCreatePayload.email})`}
          requiresReason
          isCritical
          confirmLabel="Verify MFA & Onboard"
          isSubmitting={isCreatingEmployee}
        />
      )}

      {/* Strictly Gated Employee Onboarding Modal */}
      <Modal
        isOpen={isCreateModalOpen && !pendingCreatePayload}
        onClose={() => {
          setIsCreateModalOpen(false)
          setCreatedCredentials(null)
        }}
        title={createdCredentials ? 'Employee Onboarded' : 'Onboard New Employee'}
        maxWidth="max-w-xl"
      >
        {createdCredentials ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {createdCredentials.name} has been provisioned
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Login ID:{' '}
                  <span className="font-mono font-medium">{createdCredentials.email}</span> (
                  {createdCredentials.roleName})
                </p>
              </div>
            </div>

            {createdCredentials.deliveryStatus === 'failed' ? (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <div className="font-semibold">Invitation not delivered</div>
                <p>{createdCredentials.deliveryError || 'Email delivery failed. You can resend a new invitation from the employee profile.'}</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-700 dark:text-indigo-300">
                A <strong>24-hour one-time activation link</strong> was emailed to{' '}
                <span className="font-mono font-medium">{createdCredentials.email}</span> so they can set their own password. No temporary password is generated or shown.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  setIsCreateModalOpen(false)
                  setCreatedCredentials(null)
                  setIsEmailLocked(false)
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const cleanName = createName.trim()
              const cleanEmail = createEmail.trim()
              const cleanTitle = createTitle.trim()
              if (cleanName.length < 2 || cleanName.length > 120 || /^\d+$/.test(cleanName)) {
                showToast('Full name must be 2–120 characters and include letters.', 'warning')
                return
              }
              if (!cleanEmail) {
                showToast('Approved email is required.', 'warning')
                return
              }
              if (cleanTitle.length < 2 || cleanTitle.length > 120 || /^\d+$/.test(cleanTitle)) {
                showToast('Job title must be 2–120 characters and include letters.', 'warning')
                return
              }
              const skillsArray = createSkills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 30)
              setPendingCreatePayload({
                name: createName.trim(),
                email: createEmail.trim(),
                title: createTitle.trim(),
                roleSlug: createRoleSlug,
                teamId: createTeamId || undefined,
                skills: skillsArray,
              })
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Nusrat Jahan"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Approved Email *
                </label>
                {isEmailLocked ? (
                  <input
                    type="email"
                    disabled
                    value={createEmail}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500"
                  />
                ) : readyEmails.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 space-y-2">
                    <p>No approved emails yet. Ask the CEO to add the email first.</p>
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      onClick={() => setShowRequestEmailForm((prev) => !prev)}
                    >
                      Request an email
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={emailPickerFilter}
                      onChange={(e) => setEmailPickerFilter(e.target.value)}
                      placeholder="Filter approved emails..."
                      className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                    <select
                      required
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {readyEmails
                        .filter(
                          (item) =>
                            !emailPickerFilter.trim() ||
                            item.email.includes(emailPickerFilter.trim().toLowerCase()),
                        )
                        .map((item) => (
                          <option key={item.email} value={item.email}>
                            {item.email}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {showRequestEmailForm && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  Request CEO Allowlist Approval
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="Candidate email"
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                  <input
                    type="text"
                    value={reqFullName}
                    onChange={(e) => setReqFullName(e.target.value)}
                    placeholder="Candidate full name"
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <input
                  type="text"
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Reason (min 10 chars)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                />
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  disabled={isRequestingEmail || !reqEmail.trim() || reqReason.trim().length < 10}
                  onClick={async () => {
                    setIsRequestingEmail(true)
                    try {
                      await erpApi.requestAllowlistEmail({
                        email: reqEmail.trim(),
                        fullName: reqFullName.trim() || reqEmail.trim(),
                        reason: reqReason.trim(),
                      })
                      showToast('Email request sent to the CEO Inbox.', 'success')
                      setShowRequestEmailForm(false)
                      setReqEmail('')
                      setReqFullName('')
                      setReqReason('')
                    } catch (err: any) {
                      showToast(err?.message || 'Unable to submit request.', 'error')
                    } finally {
                      setIsRequestingEmail(false)
                    }
                  }}
                >
                  Submit Request to CEO
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Senior Backend Engineer"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Initial Role *
                </label>
                <select
                  value={createRoleSlug}
                  onChange={(e) => setCreateRoleSlug(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="developer">Developer</option>
                  <option value="pm">Project Manager</option>
                  {hasPermission('roles:create') && (
                    <option value="cto">Chief Technology Officer (CTO)</option>
                  )}
                  {hasPermission('roles:create') && (
                    <option value="cfo">Chief Financial Officer (CFO)</option>
                  )}
                  {hasPermission('roles:create') && (
                    <option value="chro">Chief Human Resources Officer (CHRO)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Initial Squad (Optional)
                </label>
                <select
                  value={createTeamId}
                  onChange={(e) => setCreateTeamId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  value={createSkills}
                  onChange={(e) => setCreateSkills(e.target.value)}
                  placeholder="TypeScript, NestJS, Postgres"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isCreatingEmployee}>
                {isCreatingEmployee ? 'Provisioning...' : 'Provision Account'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
