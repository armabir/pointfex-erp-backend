import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  KeyRound,
  Shield,
  Plus,
  Search,
  Save,
  Trash2,
  UserPlus,
  Check,
  ShieldAlert,
  Lock,
  RefreshCw,
  Users,
  X,
  Sparkles,
  UserCheck,
  Crown,
  XCircle,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { useExecutiveData } from '../../hooks/useExecutiveData'
import {
  CORPORATE_DEPARTMENTS,
  DEPARTMENT_SUBTITLES,
  getPermissionDisplay,
  type CorporateDepartment,
} from '../../utils/permission-dictionary'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { SecurityConfirmModal } from '../../components/common/SecurityConfirmModal'
import { PermissionCartBuilder } from '../../components/ceo/PermissionCartBuilder'
import { EffectiveAuthzPanel } from '../../components/ceo/EffectiveAuthzPanel'

interface PermissionItem {
  id: string
  code: string
  resource: string
  action: string
  module: string
  name?: string | null
  description: string
  isSensitive: boolean
  isCritical?: boolean
}

interface RoleItem {
  id: string
  slug: string
  name: string
  description?: string | null
  isSystemDefault: boolean
  isActive: boolean
  rolePermissions: Array<{
    id: string
    permissionId: string
    permission: PermissionItem
  }>
  employeeRoles?: Array<{
    id: string
    employeeId: string
    isActive: boolean
    expiresAt?: string | null
    employee: {
      id: string
      name: string
      email: string
      title: string
      initials: string
    }
  }>
  _count?: {
    employeeRoles: number
  }
}

type MatrixConfirmState =
  | { kind: 'save_permissions'; role: RoleItem; codes: string[] }
  | { kind: 'delete_role'; role: RoleItem }
  | {
      kind: 'assign_role'
      employeeId: string
      employeeName: string
      roleId: string
      roleName: string
      scope: string
      scopeIds: string[]
    }
  | {
      kind: 'revoke_role'
      employeeId: string
      employeeName: string
      roleId: string
      roleName: string
    }
  | { kind: 'approve_request'; requestId: string; targetName: string; roleName: string }
  | { kind: 'reject_request'; requestId: string; targetName: string; roleName: string }
  | {
      kind: 'transfer_ceo'
      successorId: string
      successorName: string
      fallbackSlug: string
      reason?: string
    }

export function CeoRoleMatrixPage() {
  const { showToast, currentUser, refreshData } = useApp()
  const { allUsers } = useExecutiveData()

  const [activeTab, setActiveTab] = useState<
    'matrix' | 'cart' | 'assignments' | 'approvals' | 'debugger'
  >('matrix')
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [accessRequests, setAccessRequests] = useState<any[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [draftOverrides, setDraftOverrides] = useState<{
    roleId: string
    codes: Set<string>
  } | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<'all' | CorporateDepartment>('all')
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // CEO Succession Transfer State
  const [successorId, setSuccessorId] = useState('')
  const [outgoingRoleSlug, setOutgoingRoleSlug] = useState('developer')
  const [transferReason, setTransferReason] = useState('')
  const [matrixConfirm, setMatrixConfirm] = useState<MatrixConfirmState | null>(null)
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false)

  // Quick Create Role Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newRolePresetId, setNewRolePresetId] = useState('')

  // Assign Role Modal
  const [assignTargetUser, setAssignTargetUser] = useState<{
    id: string
    name: string
    title: string
  } | null>(null)
  const [assignRoleId, setAssignRoleId] = useState('')
  const [assignScope, setAssignScope] = useState<
    'SELF' | 'ASSIGNED' | 'SQUAD' | 'DEPARTMENT' | 'PROJECT' | 'ORG'
  >('ORG')
  const [assignScopeIdsRaw, setAssignScopeIdsRaw] = useState('')

  const fetchRbacBundle = useCallback(async () => {
    const [permRes, rolesRes, reqRes] = await Promise.all([
      erpApi.listPermissions(),
      erpApi.listRoles(),
      erpApi.listAccessRequests().catch(() => []),
    ])
    return { permRes, rolesRes, reqRes }
  }, [])

  const loadRbacData = useCallback(
    async (preserveSelection = true) => {
      setIsLoading(true)
      try {
        const { permRes, rolesRes, reqRes } = await fetchRbacBundle()
        setPermissions(permRes.permissions || [])
        setRoles(rolesRes || [])
        setAccessRequests(reqRes || [])
        setDraftOverrides(null)

        setSelectedRoleId((prev) => {
          if (preserveSelection && prev && rolesRes.some((r: RoleItem) => r.id === prev)) {
            return prev
          }
          return rolesRes[0]?.id || ''
        })
      } catch (err: any) {
        showToast(err?.message || 'Unable to load roles and system capabilities', 'error')
      } finally {
        setIsLoading(false)
      }
    },
    [fetchRbacBundle, showToast],
  )

  useEffect(() => {
    let cancelled = false
    fetchRbacBundle()
      .then(({ permRes, rolesRes, reqRes }) => {
        if (cancelled) return
        setPermissions(permRes.permissions || [])
        setRoles(rolesRes || [])
        setAccessRequests(reqRes || [])
        setSelectedRoleId(rolesRes[0]?.id || '')
      })
      .catch((err: any) => {
        if (!cancelled)
          showToast(err?.message || 'Unable to load roles and system capabilities', 'error')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchRbacBundle, showToast])

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  )

  const originalCodes = useMemo(() => {
    if (!selectedRole) return new Set<string>()
    return new Set(selectedRole.rolePermissions.map((rp) => rp.permission.code))
  }, [selectedRole])

  const draftCodes = useMemo(() => {
    if (draftOverrides && draftOverrides.roleId === selectedRoleId) {
      return draftOverrides.codes
    }
    return originalCodes
  }, [draftOverrides, selectedRoleId, originalCodes])

  const diffStats = useMemo(() => {
    const addedList: string[] = []
    const removedList: string[] = []
    for (const c of draftCodes) {
      if (!originalCodes.has(c)) addedList.push(c)
    }
    for (const c of originalCodes) {
      if (!draftCodes.has(c)) removedList.push(c)
    }
    const criticalSet = new Set(permissions.filter((p) => p.isCritical).map((p) => p.code))
    const criticalChangedCount = [...addedList, ...removedList].filter((c) =>
      criticalSet.has(c),
    ).length
    return {
      added: addedList.length,
      removed: removedList.length,
      addedList,
      removedList,
      criticalChangedCount,
      isDirty: addedList.length > 0 || removedList.length > 0,
    }
  }, [draftCodes, originalCodes, permissions])

  const affectedEmployeesForSelectedRole = useMemo(() => {
    if (!selectedRole) return []
    const userById = new Map(allUsers.map((u) => [u.id, u]))
    const activeIds = (selectedRole.employeeRoles || [])
      .filter((er) => er.isActive)
      .map((er) => er.employeeId)
    return activeIds
      .map((id) => userById.get(id)?.name || id)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
  }, [selectedRole, allUsers])

  const enrichedPermissions = useMemo(() => {
    return permissions.map((p) => {
      const display = getPermissionDisplay(p.code, p.description)
      return {
        ...p,
        displayLabel: display.label,
        displayDesc: display.description,
        department: display.department,
      }
    })
  }, [permissions])

  const groupedByDepartment = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = enrichedPermissions.filter((p) => {
      if (departmentFilter !== 'all' && p.department !== departmentFilter) return false
      if (!q) return true
      return (
        p.displayLabel.toLowerCase().includes(q) ||
        p.displayDesc.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
      )
    })

    return CORPORATE_DEPARTMENTS.map((dept) => ({
      department: dept,
      subtitle: DEPARTMENT_SUBTITLES[dept],
      items: filtered
        .filter((p) => p.department === dept)
        .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel)),
    })).filter((group) => group.items.length > 0)
  }, [enrichedPermissions, searchQuery, departmentFilter])

  // Map employeeId -> active organizational roles
  const employeeRolesMap = useMemo(() => {
    const map = new Map<string, Array<{ roleId: string; name: string; isSystemDefault: boolean }>>()
    for (const role of roles) {
      for (const er of role.employeeRoles || []) {
        if (!er.isActive) continue
        const list = map.get(er.employeeId) || []
        list.push({
          roleId: role.id,
          name: role.name,
          isSystemDefault: role.isSystemDefault,
        })
        map.set(er.employeeId, list)
      }
    }
    return map
  }, [roles])

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase()
    return allUsers.filter((u) => {
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q)
      )
    })
  }, [allUsers, userSearchQuery])

  const toggleCapability = (code: string) => {
    const next = new Set(draftCodes)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setDraftOverrides({ roleId: selectedRoleId, codes: next })
  }

  const toggleDepartmentAll = (items: typeof enrichedPermissions) => {
    const allSelected = items.every((p) => draftCodes.has(p.code))
    const next = new Set(draftCodes)
    for (const p of items) {
      if (allSelected) next.delete(p.code)
      else next.add(p.code)
    }
    setDraftOverrides({ roleId: selectedRoleId, codes: next })
  }

  const handleSavePermissions = () => {
    if (!selectedRole) return
    setMatrixConfirm({
      kind: 'save_permissions',
      role: selectedRole,
      codes: Array.from(draftCodes),
    })
  }

  const handleQuickCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleName.trim()) return

    const presetPerms = newRolePresetId
      ? roles
          .find((r) => r.id === newRolePresetId)
          ?.rolePermissions.map((rp) => rp.permission.code) || []
      : []

    try {
      const created = await erpApi.createRole({
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || undefined,
        permissionCodes: presetPerms,
      })
      setIsCreateOpen(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setNewRolePresetId('')
      await loadRbacData(false)
      if (created?.id) setSelectedRoleId(created.id)
      showToast(`New role "${created.name}" successfully saved to the system.`, 'success')
    } catch (err: any) {
      showToast(err?.message || 'Unable to save new role', 'error')
    }
  }

  const handleDeleteRole = (role: RoleItem) => {
    if (role.isSystemDefault || role.slug === 'ceo') {
      showToast('Core company roles cannot be deleted', 'warning')
      return
    }
    setMatrixConfirm({ kind: 'delete_role', role })
  }

  const handleAssignRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignTargetUser || !assignRoleId) return
    const targetRole = roles.find((r) => r.id === assignRoleId)
    const scopeIds = assignScopeIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    setMatrixConfirm({
      kind: 'assign_role',
      employeeId: assignTargetUser.id,
      employeeName: assignTargetUser.name,
      roleId: assignRoleId,
      roleName: targetRole?.name || 'Role',
      scope: assignScope,
      scopeIds,
    })
  }

  const handleRevokeRole = (
    employeeId: string,
    roleId: string,
    employeeName: string,
    roleName: string,
  ) => {
    setMatrixConfirm({
      kind: 'revoke_role',
      employeeId,
      employeeName,
      roleId,
      roleName,
    })
  }

  const handleTransferCeoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!successorId) return
    const successor = allUsers.find((u) => u.id === successorId)
    setMatrixConfirm({
      kind: 'transfer_ceo',
      successorId,
      successorName: successor?.name || successorId,
      fallbackSlug: outgoingRoleSlug,
      reason: transferReason.trim() || undefined,
    })
  }

  const executeMatrixConfirm = async (_stepUpPhrase?: string, passwordConfirm?: string) => {
    if (!matrixConfirm) return
    setIsConfirmSubmitting(true)
    if (matrixConfirm.kind === 'save_permissions') setIsSaving(true)
    try {
      if (matrixConfirm.kind === 'save_permissions') {
        await erpApi.replaceRolePermissions(matrixConfirm.role.id, matrixConfirm.codes)
        showToast(
          `Role capabilities for "${matrixConfirm.role.name}" successfully saved to the system.`,
          'success',
        )
      } else if (matrixConfirm.kind === 'delete_role') {
        await erpApi.deleteRole(matrixConfirm.role.id, passwordConfirm)
        showToast(`Removed custom role "${matrixConfirm.role.name}" from the system.`, 'info')
      } else if (matrixConfirm.kind === 'assign_role') {
        const res = await erpApi.assignRoleToEmployee(matrixConfirm.employeeId, {
          roleId: matrixConfirm.roleId,
          scope: matrixConfirm.scope,
          scopeIds: matrixConfirm.scopeIds,
        })
        setAssignTargetUser(null)
        setAssignRoleId('')
        setAssignScopeIdsRaw('')
        showToast(
          res?.pendingApproval
            ? `Role change request (${matrixConfirm.roleName}) submitted for CHRO/CEO approval.`
            : `System access updated for ${matrixConfirm.employeeName}.`,
          res?.pendingApproval ? 'info' : 'success',
        )
      } else if (matrixConfirm.kind === 'revoke_role') {
        await erpApi.revokeRoleFromEmployee(matrixConfirm.employeeId, matrixConfirm.roleId)
        showToast(
          `Removed "${matrixConfirm.roleName}" access from ${matrixConfirm.employeeName}.`,
          'info',
        )
      } else if (matrixConfirm.kind === 'approve_request') {
        await erpApi.approveAccessRequest(matrixConfirm.requestId)
        showToast(
          `Approved ${matrixConfirm.roleName} role assignment for ${matrixConfirm.targetName}.`,
          'success',
        )
      } else if (matrixConfirm.kind === 'reject_request') {
        await erpApi.rejectAccessRequest(matrixConfirm.requestId)
        showToast(
          `Declined ${matrixConfirm.roleName} request for ${matrixConfirm.targetName}.`,
          'info',
        )
      } else if (matrixConfirm.kind === 'transfer_ceo') {
        await erpApi.transferCeo({
          newCeoEmployeeId: matrixConfirm.successorId,
          demoteToRoleSlug: matrixConfirm.fallbackSlug,
          passwordConfirm,
          reason: matrixConfirm.reason,
        })
        setSuccessorId('')
        setTransferReason('')
        showToast(
          `CEO succession complete. Executive authority transferred to ${matrixConfirm.successorName}.`,
          'warning',
        )
      }

      setMatrixConfirm(null)
      await Promise.all([loadRbacData(matrixConfirm.kind !== 'delete_role'), refreshData()])
    } catch (err: any) {
      showToast(err?.message || 'Unable to complete governance action', 'error')
    } finally {
      setIsConfirmSubmitting(false)
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-display">
              Roles &amp; Access Governance
            </h2>
            <Badge variant="indigo" size="xs">
              Live Access Policy
            </Badge>
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Design organizational roles, tailor departmental capabilities across{' '}
            {permissions.length} business functions, and manage employee system access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => void loadRbacData(true)}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button variant="lime" size="sm" icon={Sparkles} onClick={() => setActiveTab('cart')}>
            Custom Role Creator
          </Button>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsCreateOpen(true)}>
            Quick Create Role
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Role Capability Matrix ({roles.length} Roles)</span>
        </button>

        <button
          onClick={() => setActiveTab('cart')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
            activeTab === 'cart'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Custom Role Creator</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
            activeTab === 'assignments'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Employee System Access ({allUsers.length} Staff)</span>
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>
            Approvals &amp; Succession (
            {accessRequests.filter((r) => r.status === 'PENDING').length})
          </span>
        </button>

        <button
          onClick={() => setActiveTab('debugger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
            activeTab === 'debugger'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Lifecycle, Templates &amp; Debugger</span>
        </button>
      </div>

      {activeTab === 'debugger' ? (
        <EffectiveAuthzPanel
          roles={roles}
          users={allUsers}
          permissions={permissions}
          onRolesChanged={async () => {
            await loadRbacData(true)
          }}
        />
      ) : activeTab === 'approvals' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <Card
              title="Pending Role Change Approvals"
              icon={UserCheck}
              subtitle="Maker-Checker governance queue requiring CHRO or CEO authorization"
            >
              {accessRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No organizational role change requests on record.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {accessRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {req.targetEmployee?.name || req.targetEmployeeId}
                          </span>
                          <span className="text-slate-400">→</span>
                          <Badge variant="indigo" size="xs">
                            {req.requestedRole?.name || req.requestedRoleId}
                          </Badge>
                          <Badge
                            variant={
                              req.status === 'PENDING'
                                ? 'amber'
                                : req.status === 'APPROVED'
                                  ? 'emerald'
                                  : 'rose'
                            }
                            size="xs"
                          >
                            {req.status === 'PENDING' ? 'Pending CHRO/CEO Approval' : req.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Requested by {req.requester?.name || req.requesterId}
                          {req.reason ? ` · "${req.reason}"` : ''}
                        </p>
                      </div>

                      {req.status === 'PENDING' &&
                        req.requesterId !== currentUser?.id &&
                        req.targetEmployeeId !== currentUser?.id && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              variant="lime"
                              size="xs"
                              icon={UserCheck}
                              onClick={() =>
                                setMatrixConfirm({
                                  kind: 'approve_request',
                                  requestId: req.id,
                                  targetName: req.targetEmployee?.name || req.targetEmployeeId,
                                  roleName: req.requestedRole?.name || 'Role',
                                })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              icon={XCircle}
                              onClick={() =>
                                setMatrixConfirm({
                                  kind: 'reject_request',
                                  requestId: req.id,
                                  targetName: req.targetEmployee?.name || req.targetEmployeeId,
                                  roleName: req.requestedRole?.name || 'Role',
                                })
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card
              title="CEO Succession Handover"
              icon={Crown}
              subtitle="Atomically transfer Chief Executive Officer authority to a verified successor"
            >
              <form onSubmit={handleTransferCeoSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Successor Executive
                  </label>
                  <select
                    required
                    value={successorId}
                    onChange={(e) => setSuccessorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Choose new CEO...</option>
                    {allUsers
                      .filter((u) => u.id !== currentUser?.id && !u.isSuspended)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.title})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Post-Transfer Role
                  </label>
                  <select
                    value={outgoingRoleSlug}
                    onChange={(e) => setOutgoingRoleSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="developer">Developer (Standard Baseline)</option>
                    <option value="pm">Project Manager</option>
                    <option value="cto">Chief Technology Officer (CTO)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transition Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="e.g. Board-approved leadership transition"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  icon={Crown}
                  disabled={!successorId}
                  className="w-full justify-center"
                >
                  Transfer CEO Authority
                </Button>
              </form>
            </Card>
          </div>
        </div>
      ) : activeTab === 'cart' ? (
        <PermissionCartBuilder
          permissions={permissions}
          existingRoles={roles}
          onRoleCreated={async (created) => {
            await loadRbacData(false)
            if (created?.id) setSelectedRoleId(created.id)
            setActiveTab('matrix')
          }}
        />
      ) : activeTab === 'matrix' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Rail: Role Selector */}
          <div className="lg:col-span-4 space-y-3">
            <Card title="Organizational & Custom Roles" icon={Shield}>
              <div className="space-y-2">
                {roles.map((role) => {
                  const isSelected = role.id === selectedRoleId
                  const permCount = role.rolePermissions?.length || 0
                  const userCount = role._count?.employeeRoles ?? role.employeeRoles?.length ?? 0

                  return (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-slate-800 border-slate-900 dark:border-lime-500/60 text-white shadow-sm'
                          : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold truncate">{role.name}</span>
                            {role.isSystemDefault ? (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
                                  isSelected
                                    ? 'bg-white/15 text-slate-200'
                                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                <Lock className="w-2.5 h-2.5" />
                                Core Role
                              </span>
                            ) : (
                              <Badge variant="lime" size="xs">
                                Custom
                              </Badge>
                            )}
                          </div>
                        </div>

                        {!role.isSystemDefault && (
                          <button
                            type="button"
                            title="Delete custom role"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDeleteRole(role)
                            }}
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {role.description && (
                        <p
                          className={`text-[11px] mt-1.5 line-clamp-2 ${
                            isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {role.description}
                        </p>
                      )}

                      <div
                        className={`mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] ${
                          isSelected
                            ? 'border-white/10 text-slate-300'
                            : 'border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <span>{permCount} capabilities</span>
                        <span>{userCount} staff assigned</span>
                      </div>
                    </div>
                  )
                })}

                {!isLoading && roles.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                    No organizational roles found.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Right Main Area: Capability Checkboxes Grouped by Corporate Department */}
          <div className="lg:col-span-8 space-y-4">
            {selectedRole ? (
              <>
                <div className="bg-white dark:bg-[#131722] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {selectedRole.name}
                        </h3>
                        <Badge variant="indigo" size="xs">
                          {draftCodes.size} / {permissions.length} active
                        </Badge>
                        {diffStats.isDirty && (
                          <Badge variant="amber" size="xs">
                            +{diffStats.added} / -{diffStats.removed} unsaved
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedRole.description ||
                          'Configure operational capabilities for this role.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {diffStats.isDirty && (
                        <Button variant="ghost" size="sm" onClick={() => setDraftOverrides(null)}>
                          Discard
                        </Button>
                      )}
                      <Button
                        variant="lime"
                        size="sm"
                        icon={Save}
                        onClick={() => void handleSavePermissions()}
                        disabled={!diffStats.isDirty || isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>

                  {diffStats.isDirty && (
                    <div className="p-3 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[12px]">
                      <div>
                        <span className="font-semibold text-[var(--text)]">
                          Who is affected ({affectedEmployeesForSelectedRole.length} active staff):{' '}
                        </span>
                        <span className="text-[var(--muted)]">
                          {affectedEmployeesForSelectedRole.length === 0
                            ? 'No active employees hold this role yet.'
                            : affectedEmployeesForSelectedRole.slice(0, 4).join(', ') +
                              (affectedEmployeesForSelectedRole.length > 4
                                ? ` +${affectedEmployeesForSelectedRole.length - 4} more`
                                : '')}
                        </span>
                      </div>
                      {diffStats.criticalChangedCount > 0 && (
                        <Badge variant="danger" size="xs">
                          ⚠ {diffStats.criticalChangedCount} critical change
                          {diffStats.criticalChangedCount === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Filter Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="sm:col-span-2 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search business capabilities..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-slate-400"
                      />
                    </div>

                    <select
                      value={departmentFilter}
                      onChange={(e) =>
                        setDepartmentFilter(e.target.value as 'all' | CorporateDepartment)
                      }
                      className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="all">All Departments ({CORPORATE_DEPARTMENTS.length})</option>
                      {CORPORATE_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Department Cards */}
                <div className="space-y-4">
                  {groupedByDepartment.map(({ department, subtitle, items }) => {
                    const selectedInDept = items.filter((p) => draftCodes.has(p.code)).length
                    const allSelected = selectedInDept === items.length

                    return (
                      <Card
                        key={department}
                        title={department}
                        subtitle={`${subtitle} • ${selectedInDept} of ${items.length} enabled`}
                        action={
                          <button
                            type="button"
                            onClick={() => toggleDepartmentAll(items)}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            {allSelected ? 'Clear Department' : 'Select All'}
                          </button>
                        }
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {items.map((perm) => {
                            const checked = draftCodes.has(perm.code)
                            return (
                              <label
                                key={perm.id}
                                title={perm.displayDesc}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                  checked
                                    ? 'bg-indigo-50/60 dark:bg-indigo-950/25 border-indigo-300 dark:border-indigo-800/70'
                                    : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                    checked
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700'
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3" />}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCapability(perm.code)}
                                  className="sr-only"
                                />

                                <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                    {perm.name || perm.displayLabel}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {perm.code}
                                  </span>
                                  {perm.isCritical && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                                      ⚠ Critical
                                    </span>
                                  )}
                                  {perm.isSensitive && !perm.isCritical && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                                      <ShieldAlert className="w-2.5 h-2.5" />
                                      Sensitive
                                    </span>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </>
            ) : (
              <Card title="Select a Role">
                <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                  {isLoading
                    ? 'Loading organizational capabilities...'
                    : 'Select a role on the left to review and update its capabilities.'}
                </p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Tab 3: Employee System Access */
        <Card
          title="Manage Employee System Access"
          subtitle="Assign organizational or custom roles to any staff member"
          icon={Users}
          action={
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search staff by name or title..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/70 dark:bg-slate-900/50">
                  <th className="py-3.5 px-6">Employee</th>
                  <th className="py-3.5 px-6">Title</th>
                  <th className="py-3.5 px-6">Assigned System Roles</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {filteredUsers.map((emp) => {
                  const assigned = employeeRolesMap.get(emp.id) || []
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-700 dark:text-slate-200">
                            {emp.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-slate-400">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300">{emp.title}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {assigned.map((r) => (
                            <span
                              key={r.roleId}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
                                r.isSystemDefault
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                              }`}
                            >
                              <span>{r.name}</span>
                              <button
                                type="button"
                                title={`Remove ${r.name}`}
                                onClick={() =>
                                  void handleRevokeRole(emp.id, r.roleId, emp.name, r.name)
                                }
                                className="hover:text-rose-500 transition-colors cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          {assigned.length === 0 && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400">
                              No active roles
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={UserPlus}
                          onClick={() => {
                            setAssignTargetUser({ id: emp.id, name: emp.name, title: emp.title })
                            setAssignRoleId(roles[0]?.id || '')
                          }}
                        >
                          Assign Role
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Quick Create Role */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Quick Create Custom Role"
        subtitle="Create a new organizational role and refine its capabilities later"
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="lime" size="sm" icon={Plus} onClick={handleQuickCreateRole}>
              Save Role
            </Button>
          </>
        }
      >
        <form onSubmit={handleQuickCreateRole} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Role Title *
            </label>
            <input
              type="text"
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Compliance Reviewer"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Executive Summary
            </label>
            <textarea
              rows={2}
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="Describe the scope and responsibilities of this role..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Start from an Existing Role (Optional)
            </label>
            <select
              value={newRolePresetId}
              onChange={(e) => setNewRolePresetId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="">Start empty (0 capabilities)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.rolePermissions?.length || 0} capabilities)
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Role to Employee */}
      <Modal
        isOpen={Boolean(assignTargetUser)}
        onClose={() => setAssignTargetUser(null)}
        title={`Assign Role to ${assignTargetUser?.name || ''}`}
        subtitle={assignTargetUser?.title}
        maxWidth="max-w-sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAssignTargetUser(null)}>
              Cancel
            </Button>
            <Button variant="lime" size="sm" icon={UserPlus} onClick={handleAssignRoleSubmit}>
              Assign Role
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssignRoleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Organizational Role
            </label>
            <select
              value={assignRoleId}
              onChange={(e) => setAssignRoleId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {roles
                .filter((r) => r.isActive && r.slug !== 'ceo')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.rolePermissions?.length || 0} capabilities
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ABAC Scope Boundary
            </label>
            <select
              value={assignScope}
              onChange={(e) => setAssignScope(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="ORG">ORG (Whole Organization)</option>
              <option value="PROJECT">PROJECT (Specific Project IDs)</option>
              <option value="SQUAD">SQUAD (Specific Squad IDs)</option>
              <option value="DEPARTMENT">DEPARTMENT</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="SELF">SELF</option>
            </select>
          </div>
          {(assignScope === 'PROJECT' || assignScope === 'SQUAD' || assignScope === 'DEPARTMENT') && (
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Scope IDs (comma-separated, optional)
              </label>
              <input
                type="text"
                value={assignScopeIdsRaw}
                onChange={(e) => setAssignScopeIdsRaw(e.target.value)}
                placeholder="e.g. proj_01, proj_02"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Mandatory Security Interceptor & Step-Up Auth Modal */}
      {matrixConfirm && (
        <SecurityConfirmModal
          isOpen={!!matrixConfirm}
          onClose={() => setMatrixConfirm(null)}
          onConfirm={(stepUpPhrase, passwordConfirm) =>
            void executeMatrixConfirm(stepUpPhrase, passwordConfirm)
          }
          isSubmitting={isConfirmSubmitting}
          severity={
            ['delete_role', 'revoke_role', 'reject_request', 'transfer_ceo'].includes(
              matrixConfirm.kind,
            ) ||
            (matrixConfirm.kind === 'save_permissions' && diffStats.criticalChangedCount > 0)
              ? 'danger'
              : 'standard'
          }
          isCritical={
            matrixConfirm.kind === 'transfer_ceo' ||
            matrixConfirm.kind === 'delete_role' ||
            (matrixConfirm.kind === 'save_permissions' && diffStats.criticalChangedCount > 0)
          }
          requirePhrase={
            matrixConfirm.kind === 'delete_role'
              ? 'CONFIRM DELETE'
              : matrixConfirm.kind === 'transfer_ceo'
                ? 'CONFIRM TRANSFER'
                : undefined
          }
          requirePassword={
            ['delete_role', 'transfer_ceo'].includes(matrixConfirm.kind) ||
            (matrixConfirm.kind === 'save_permissions' && diffStats.criticalChangedCount > 0)
          }
          whatWillHappen={
            matrixConfirm.kind === 'save_permissions'
              ? `Updates ${diffStats.added} added and ${diffStats.removed} removed permissions, affecting ${affectedEmployeesForSelectedRole.length} employee${affectedEmployeesForSelectedRole.length === 1 ? '' : 's'}${affectedEmployeesForSelectedRole.length > 0 ? ` (${affectedEmployeesForSelectedRole.slice(0, 3).join(', ')})` : ''}.`
              : undefined
          }
          title={
            matrixConfirm.kind === 'save_permissions'
              ? 'Confirm Role Capability Update'
              : matrixConfirm.kind === 'delete_role'
                ? 'Confirm Custom Role Deletion'
                : matrixConfirm.kind === 'assign_role'
                  ? 'Confirm Organizational Role Assignment'
                  : matrixConfirm.kind === 'revoke_role'
                    ? 'Confirm Revoke Organizational Role'
                    : matrixConfirm.kind === 'approve_request'
                      ? 'Confirm Approve Role Change'
                      : matrixConfirm.kind === 'reject_request'
                        ? 'Confirm Reject Role Change'
                        : 'Confirm CEO Succession Transfer'
          }
          details={
            matrixConfirm.kind === 'save_permissions'
              ? `Update capabilities attached to "${matrixConfirm.role.name}" (${matrixConfirm.codes.length} enabled capabilities).`
              : matrixConfirm.kind === 'delete_role'
                ? `Permanently delete custom role "${matrixConfirm.role.name}". Employees holding this role will lose its permissions immediately.`
                : matrixConfirm.kind === 'assign_role'
                  ? `Assign "${matrixConfirm.roleName}" access to ${matrixConfirm.employeeName}.`
                  : matrixConfirm.kind === 'revoke_role'
                    ? `Remove "${matrixConfirm.roleName}" access from ${matrixConfirm.employeeName}.`
                    : matrixConfirm.kind === 'approve_request'
                      ? `Approve and grant "${matrixConfirm.roleName}" access to ${matrixConfirm.targetName}.`
                      : matrixConfirm.kind === 'reject_request'
                        ? `Decline "${matrixConfirm.roleName}" access request for ${matrixConfirm.targetName}.`
                        : `Transfer CEO ownership to ${matrixConfirm.successorName} and transition your account to ${matrixConfirm.fallbackSlug.toUpperCase()} in a single atomic operation.`
          }
          confirmLabel={
            matrixConfirm.kind === 'save_permissions'
              ? 'Save Capabilities'
              : matrixConfirm.kind === 'delete_role'
                ? 'Delete Custom Role'
                : matrixConfirm.kind === 'assign_role'
                  ? 'Assign Role'
                  : matrixConfirm.kind === 'revoke_role'
                    ? 'Revoke Role'
                    : matrixConfirm.kind === 'approve_request'
                      ? 'Approve Change'
                      : matrixConfirm.kind === 'reject_request'
                        ? 'Reject Request'
                        : 'Transfer CEO Authority'
          }
        />
      )}
    </div>
  )
}
