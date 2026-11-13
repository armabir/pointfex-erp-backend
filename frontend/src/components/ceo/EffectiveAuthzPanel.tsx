import React, { useEffect, useState } from 'react'
import {
  Copy,
  History,
  Power,
  Search,
  ShieldBan,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { Card } from '../common/Card'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'
import { SecurityConfirmModal } from '../common/SecurityConfirmModal'
import { getPermissionDisplay } from '../../utils/permission-dictionary'

interface EffectiveAuthzPanelProps {
  roles: any[]
  users: any[]
  permissions: any[]
  onRolesChanged: () => Promise<void>
}

export function EffectiveAuthzPanel({
  roles,
  users,
  permissions,
  onRolesChanged,
}: EffectiveAuthzPanelProps) {
  const { showToast } = useApp()
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateCode, setSelectedTemplateCode] = useState('')
  const [templateRoleName, setTemplateRoleName] = useState('')
  const [selectedRoleForLifecycle, setSelectedRoleForLifecycle] = useState(roles[0]?.id || '')
  const [cloneName, setCloneName] = useState('')
  const [versions, setVersions] = useState<any[]>([])
  const [selectedDiffIdx, setSelectedDiffIdx] = useState<number>(0)

  const [debugUserId, setDebugUserId] = useState(users[0]?.id || '')
  const [effectiveData, setEffectiveData] = useState<any>(null)
  const [debugFilter, setDebugFilter] = useState('')
  const [whyCode, setWhyCode] = useState(permissions[0]?.code || 'payroll:approve_batch')
  const [denyCode, setDenyCode] = useState(permissions[0]?.code || 'tasks:approve')
  const [denyReason, setDenyReason] = useState('')

  // Confirmation Modal State
  const [lifecycleConfirm, setLifecycleConfirm] = useState<
    | { kind: 'template'; templateCode: string; roleName?: string }
    | { kind: 'clone'; sourceRoleId: string; sourceRoleName: string; cloneName: string }
    | { kind: 'activate'; roleId: string; roleName: string }
    | { kind: 'deactivate'; roleId: string; roleName: string }
    | { kind: 'denial'; userId: string; userName: string; code: string; reason: string }
    | null
  >(null)
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false)

  useEffect(() => {
    erpApi
      .listRoleTemplates()
      .then((res) => setTemplates(Array.isArray(res) ? res : []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!selectedRoleForLifecycle) return
    erpApi
      .getRoleVersions(selectedRoleForLifecycle)
      .then((res) => setVersions(Array.isArray(res) ? res : []))
      .catch(() => setVersions([]))
  }, [selectedRoleForLifecycle])

  const loadEffective = async (uid: string) => {
    if (!uid) return
    try {
      const res = await erpApi.getUserEffectiveAuthz(uid)
      setEffectiveData(res)
    } catch (err: any) {
      showToast(err?.message || 'Unable to inspect user permissions', 'error')
    }
  }

  useEffect(() => {
    if (debugUserId) void loadEffective(debugUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugUserId])

  const handleInstantiateTemplate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplateCode) return
    const tmpl = templates.find((t) => t.code === selectedTemplateCode)
    setLifecycleConfirm({
      kind: 'template',
      templateCode: selectedTemplateCode,
      roleName: templateRoleName.trim() || tmpl?.name || selectedTemplateCode,
    })
  }

  const handleClone = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRoleForLifecycle || !cloneName.trim()) return
    const role = roles.find((r) => r.id === selectedRoleForLifecycle)
    setLifecycleConfirm({
      kind: 'clone',
      sourceRoleId: selectedRoleForLifecycle,
      sourceRoleName: role?.name || 'Role',
      cloneName: cloneName.trim(),
    })
  }

  const handleToggleActive = (role: any) => {
    if (!role) return
    if (role.isActive) {
      setLifecycleConfirm({
        kind: 'deactivate',
        roleId: role.id,
        roleName: role.name,
      })
    } else {
      setLifecycleConfirm({
        kind: 'activate',
        roleId: role.id,
        roleName: role.name,
      })
    }
  }

  const handleAddDenial = (e: React.FormEvent) => {
    e.preventDefault()
    if (!debugUserId || !denyCode) return
    const user = users.find((u) => u.id === debugUserId)
    setLifecycleConfirm({
      kind: 'denial',
      userId: debugUserId,
      userName: user?.name || 'User',
      code: denyCode,
      reason: denyReason.trim() || 'Explicit administrative denial',
    })
  }

  const executeLifecycleConfirm = async (mfaCode?: string) => {
    if (!lifecycleConfirm) return
    setIsConfirmSubmitting(true)
    try {
      if (lifecycleConfirm.kind === 'template') {
        await erpApi.createRoleFromTemplate(
          lifecycleConfirm.templateCode,
          { name: lifecycleConfirm.roleName },
          mfaCode,
        )
        showToast(`Role instantiated from template ${lifecycleConfirm.templateCode}`, 'success')
        setTemplateRoleName('')
        await onRolesChanged()
      } else if (lifecycleConfirm.kind === 'clone') {
        await erpApi.cloneRole(
          lifecycleConfirm.sourceRoleId,
          { name: lifecycleConfirm.cloneName },
          mfaCode,
        )
        showToast(`Cloned role as "${lifecycleConfirm.cloneName}"`, 'success')
        setCloneName('')
        await onRolesChanged()
      } else if (lifecycleConfirm.kind === 'activate') {
        await erpApi.activateRole(lifecycleConfirm.roleId, 'Reactivated via Governance console', mfaCode)
        showToast(`Role "${lifecycleConfirm.roleName}" activated.`, 'success')
        await onRolesChanged()
      } else if (lifecycleConfirm.kind === 'deactivate') {
        await erpApi.deactivateRole(lifecycleConfirm.roleId, 'Deactivated via Governance console', mfaCode)
        showToast(`Role "${lifecycleConfirm.roleName}" deactivated.`, 'info')
        await onRolesChanged()
      } else if (lifecycleConfirm.kind === 'denial') {
        await erpApi.grantDenial(
          lifecycleConfirm.userId,
          {
            permissionCode: lifecycleConfirm.code,
            scope: 'ORG',
            reason: lifecycleConfirm.reason,
          },
          mfaCode,
        )
        showToast(`Added explicit denial for "${lifecycleConfirm.code}"`, 'warning')
        setDenyReason('')
        await loadEffective(lifecycleConfirm.userId)
      }
      setLifecycleConfirm(null)
    } catch (err: any) {
      showToast(err?.message || 'Action blocked or failed', 'error')
    } finally {
      setIsConfirmSubmitting(false)
    }
  }

  const activeLifecycleRole = roles.find((r) => r.id === selectedRoleForLifecycle)
  const filteredGrants = (effectiveData?.grants || []).filter(
    (g: any) => !debugFilter.trim() || g.code.toLowerCase().includes(debugFilter.toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Authority Templates (Section C)"
          icon={Sparkles}
          subtitle="Instantiate editable runtime roles from Pointfex Default Authority Map"
        >
          <form onSubmit={handleInstantiateTemplate} className="space-y-3 text-xs">
            <select
              value={selectedTemplateCode}
              onChange={(e) => setSelectedTemplateCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <option value="">Select Authority Template...</option>
              {templates
                .filter((t) => t.code !== 'CEO')
                .map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.code} — {t.name} ({t.defaultScope})
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={templateRoleName}
              onChange={(e) => setTemplateRoleName(e.target.value)}
              placeholder="Optional custom role name"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
            <Button type="submit" size="sm" disabled={!selectedTemplateCode}>
              Instantiate Role from Template
            </Button>
          </form>
        </Card>

        <Card
          title="Role Lifecycle: Clone, Activate/Deactivate & Version History"
          icon={History}
          subtitle="system:root CEO role cannot be cloned or deactivated"
        >
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <select
                value={selectedRoleForLifecycle}
                onChange={(e) => setSelectedRoleForLifecycle(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (v{r.version || 1} · {r.isActive ? 'Active' : 'Inactive'})
                  </option>
                ))}
              </select>
              {activeLifecycleRole && (
                <Button
                  size="sm"
                  variant={activeLifecycleRole.isActive ? 'secondary' : 'lime'}
                  icon={Power}
                  onClick={() => void handleToggleActive(activeLifecycleRole)}
                >
                  {activeLifecycleRole.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </div>

            <form onSubmit={handleClone} className="flex items-center gap-2">
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="New cloned role name..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
              <Button type="submit" size="sm" icon={Copy} disabled={!cloneName.trim()}>
                Clone
              </Button>
            </form>

            <div className="max-h-32 overflow-y-auto space-y-1">
              {versions.map((v, idx) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedDiffIdx(idx)}
                  className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                    selectedDiffIdx === idx
                      ? 'bg-[var(--primary)]/10 border-[var(--primary)]/40 text-[var(--text)]'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span>
                    <strong>v{v.version}</strong> — {v.changeReason || 'Update'} ({v.permissionCodes?.length || 0} perms)
                  </span>
                  <span className="text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>

            {versions.length > 0 && (() => {
              const current = versions[Math.min(selectedDiffIdx, versions.length - 1)]
              const previous = versions[Math.min(selectedDiffIdx, versions.length - 1) + 1]
              const curSet = new Set<string>(current?.permissionCodes || [])
              const prevSet = new Set<string>(previous?.permissionCodes || [])
              const added = Array.from(curSet).filter((c) => !prevSet.has(c))
              const removed = Array.from(prevSet).filter((c) => !curSet.has(c))
              return (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-200">
                    <span>
                      Version Diff: v{current.version}
                      {previous ? ` vs v${previous.version}` : ' (initial snapshot)'}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-emerald-600 dark:text-emerald-400">+{added.length} added</span>
                      <span className="text-rose-600 dark:text-rose-400">-{removed.length} removed</span>
                    </span>
                  </div>
                  {(added.length > 0 || removed.length > 0) ? (
                    <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 pt-1">
                      {added.slice(0, 15).map((code) => (
                        <span
                          key={`add-${code}`}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]"
                        >
                          + {code}
                        </span>
                      ))}
                      {removed.slice(0, 15).map((code) => (
                        <span
                          key={`rem-${code}`}
                          className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono text-[10px]"
                        >
                          - {code}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">No permission code differences between these versions.</p>
                  )}
                </div>
              )
            })()}
          </div>
        </Card>
      </div>

      <Card
        title="Effective Permissions Debugger & Explicit Denials"
        icon={ShieldCheck}
        subtitle="(Role Perms ∪ Wildcards ∪ Direct Grants ∪ Delegations) − Explicit Denials"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={debugUserId}
              onChange={(e) => setDebugUserId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
            <div className="relative md:col-span-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={debugFilter}
                onChange={(e) => setDebugFilter(e.target.value)}
                placeholder="Filter resolved grants (e.g. payroll, tasks:approve)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          {effectiveData && (
            <>
              {/* Plain-English "Why can/can't this person do X?" Explainer */}
              {(() => {
                const selectedUser = users.find((u) => u.id === debugUserId)
                const matchingGrant = (effectiveData.grants || []).find(
                  (g: any) => g.code === whyCode,
                )
                const matchingDenial = (effectiveData.denials || []).find(
                  (d: any) => d.code === whyCode || d.permissionCode === whyCode,
                )
                const isRoot = Boolean(effectiveData.isRoot)
                const permLabel = getPermissionDisplay(whyCode).label

                return (
                  <div className="p-3.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[var(--text)]">
                        Why can / can&apos;t {selectedUser?.name || 'this user'} do X?
                      </span>
                      <select
                        value={whyCode}
                        onChange={(e) => setWhyCode(e.target.value)}
                        className="px-2.5 py-1.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[12px] max-w-xs"
                      >
                        {permissions.slice(0, 250).map((p) => (
                          <option key={p.code} value={p.code}>
                            {getPermissionDisplay(p.code).label} ({p.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    {matchingDenial ? (
                      <p className="text-[12px] text-[var(--danger)]">
                        <strong>Blocked:</strong> Explicit denial override is active for{' '}
                        <strong>{permLabel}</strong> ({matchingDenial.reason || 'Administrative denial'}).
                      </p>
                    ) : isRoot ? (
                      <p className="text-[12px] text-[var(--success)]">
                        <strong>Allowed:</strong> Holds supreme CEO authority (<code>system:root</code>), which permits <strong>{permLabel}</strong>.
                      </p>
                    ) : matchingGrant ? (
                      <p className="text-[12px] text-[var(--success)]">
                        <strong>Allowed:</strong> Granted <strong>{permLabel}</strong> via{' '}
                        <strong>{matchingGrant.sourceType}</strong> ({matchingGrant.scope} scope).
                      </p>
                    ) : (
                      <p className="text-[12px] text-[var(--muted)]">
                        <strong>Not permitted:</strong> None of {selectedUser?.name || 'this user'}&apos;s active roles, direct grants, or delegations include <strong>{permLabel}</strong>.
                      </p>
                    )}
                  </div>
                )
              })()}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={effectiveData.isRoot ? 'amber' : 'indigo'}>
                  {effectiveData.isRoot ? 'system:root SUPREME AUTHORITY' : `authVersion v${effectiveData.authVersion}`}
                </Badge>
                <Badge variant="emerald">{effectiveData.effectiveCodes?.length || 0} effective codes</Badge>
                <Badge variant="rose">{effectiveData.denials?.length || 0} explicit denials</Badge>
                <Badge variant="sky">Roles: {(effectiveData.roleSlugs || []).join(', ') || 'None'}</Badge>
              </div>

              <form onSubmit={handleAddDenial} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                <select
                  value={denyCode}
                  onChange={(e) => setDenyCode(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                >
                  {permissions.slice(0, 200).map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder="Denial reason..."
                  className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
                <Button type="submit" size="sm" variant="danger" icon={ShieldBan}>
                  Add Denial Override
                </Button>
              </form>

              <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {filteredGrants.slice(0, 120).map((g: any, idx: number) => (
                  <div
                    key={`${g.code}-${g.sourceId}-${idx}`}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/40"
                  >
                    <span className="font-mono text-[11px] truncate">{g.code}</span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 shrink-0">
                      {g.sourceType} · {g.scope}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      {lifecycleConfirm && (
        <SecurityConfirmModal
          isOpen={!!lifecycleConfirm}
          onClose={() => setLifecycleConfirm(null)}
          onConfirm={(_phrase, _pwd, mfaCode) => void executeLifecycleConfirm(mfaCode)}
          isSubmitting={isConfirmSubmitting}
          severity={
            lifecycleConfirm.kind === 'deactivate' || lifecycleConfirm.kind === 'denial'
              ? 'danger'
              : 'standard'
          }
          isCritical={lifecycleConfirm.kind === 'deactivate' || lifecycleConfirm.kind === 'denial'}
          title={
            lifecycleConfirm.kind === 'template'
              ? 'Confirm Instantiate Role Template'
              : lifecycleConfirm.kind === 'clone'
                ? 'Confirm Clone Role'
                : lifecycleConfirm.kind === 'activate'
                  ? 'Confirm Activate Role'
                  : lifecycleConfirm.kind === 'deactivate'
                    ? 'Confirm Deactivate Role'
                    : 'Confirm Explicit Denial Override'
          }
          details={
            lifecycleConfirm.kind === 'template'
              ? `Instantiate editable runtime role "${lifecycleConfirm.roleName}" from template "${lifecycleConfirm.templateCode}".`
              : lifecycleConfirm.kind === 'clone'
                ? `Create a full clone of role "${lifecycleConfirm.sourceRoleName}" as "${lifecycleConfirm.cloneName}".`
                : lifecycleConfirm.kind === 'activate'
                  ? `Activate role "${lifecycleConfirm.roleName}". Users with this role will immediately regain its capabilities.`
                  : lifecycleConfirm.kind === 'deactivate'
                    ? `Deactivate role "${lifecycleConfirm.roleName}". Users with this role will temporarily lose its capabilities.`
                    : `Apply explicit administrative denial for "${lifecycleConfirm.code}" on ${lifecycleConfirm.userName}.`
          }
          whatWillHappen="This administrative governance action requires a fresh 6-digit authenticator code and takes effect immediately."
          confirmLabel={
            lifecycleConfirm.kind === 'template'
              ? 'Instantiate Role'
              : lifecycleConfirm.kind === 'clone'
                ? 'Clone Role'
                : lifecycleConfirm.kind === 'activate'
                  ? 'Activate Role'
                  : lifecycleConfirm.kind === 'deactivate'
                    ? 'Deactivate Role'
                    : 'Apply Denial'
          }
        />
      )}
    </div>
  )
}
