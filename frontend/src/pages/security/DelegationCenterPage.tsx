import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Share2,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState } from '../../components/common/EmptyState'
import { SkeletonCard } from '../../components/common/Skeleton'
import { MfaConfirmModal } from '../../components/common/MfaConfirmModal'
import { PERMISSION_PACKS } from '../../config/permission-packs'
import { getPermissionDisplay } from '../../utils/permission-dictionary'

function formatCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h left`
  }
  return `${hours}h ${mins}m left`
}

export function DelegationCenterPage() {
  const { data, currentUser, showToast, refreshPermissions } = useApp()
  const { can, canAny } = usePermissions()

  const canCreate = canAny(['delegations:create', 'permissions:delegate'])
  const canApprove = can('delegations:approve')
  const canReadOrg = canAny(['delegations:read_all', 'permissions:read', 'audit_logs:read'])

  const [created, setCreated] = useState<any[]>([])
  const [received, setReceived] = useState<any[]>([])
  const [allDelegations, setAllDelegations] = useState<any[]>([])
  const [delegatablePerms, setDelegatablePerms] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [delegateeId, setDelegateeId] = useState('')
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [pickMode, setPickMode] = useState<'packs' | 'individual'>('packs')
  const [scope, setScope] = useState<'SELF' | 'ASSIGNED' | 'SQUAD' | 'DEPARTMENT' | 'PROJECT' | 'ORG'>('PROJECT')
  const [scopeIdsRaw, setScopeIdsRaw] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('7')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<any | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const fetchAll = useCallback(async () => {
    const [mine, delegatable, orgAll] = await Promise.all([
      erpApi.listMyDelegations().catch(() => ({ created: [], received: [] })),
      canCreate
        ? erpApi.getDelegatablePermissions().catch(() => ({ permissions: [] }))
        : Promise.resolve({ permissions: [] }),
      canReadOrg ? erpApi.listAllDelegations().catch(() => []) : Promise.resolve([]),
    ])
    return {
      created: mine.created || [],
      received: mine.received || [],
      delegatable: (delegatable.permissions || []).filter((p: any) => !p.isCritical && !p.isSystemRoot),
      orgAll: Array.isArray(orgAll) ? orgAll : [],
    }
  }, [canCreate, canReadOrg])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchAll()
      setCreated(res.created)
      setReceived(res.received)
      setDelegatablePerms(res.delegatable)
      setAllDelegations(res.orgAll)
    } finally {
      setIsLoading(false)
    }
  }, [fetchAll])

  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then((res) => {
        if (cancelled) return
        setCreated(res.created)
        setReceived(res.received)
        setDelegatablePerms(res.delegatable)
        setAllDelegations(res.orgAll)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchAll])

  const eligibleEmployees = useMemo(
    () => data.users.filter((u) => u.id !== currentUser?.id),
    [data.users, currentUser?.id],
  )

  const [pendingCreateOpen, setPendingCreateOpen] = useState(false)
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!delegateeId || selectedCodes.length === 0 || reason.trim().length < 3) {
      showToast('Select a recipient, at least one permission, and provide a clear reason.', 'error')
      return
    }
    setPendingCreateOpen(true)
  }

  const executeCreate = async (mfaCode: string) => {
    const days = Math.min(30, Math.max(1, Number(expiresInDays) || 7))
    const startsAt = new Date()
    const expiresAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000)
    const scopeIds = scopeIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    setIsSubmitting(true)
    try {
      await erpApi.createDelegation(
        {
          delegateeId,
          permissionCodes: selectedCodes,
          scope,
          scopeIds,
          reason: reason.trim(),
          startsAt: startsAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        mfaCode,
      )
      showToast('Temporary delegation granted.', 'success')
      setPendingCreateOpen(false)
      setSelectedCodes([])
      setScopeIdsRaw('')
      setReason('')
      await Promise.all([loadData(), refreshPermissions()])
    } catch (err: any) {
      showToast(err?.message || 'Delegation blocked by authorization policy.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const executeRevoke = async (mfaCode: string, revokeReason?: string) => {
    if (!revokeTarget) return
    setIsRevoking(true)
    try {
      await erpApi.revokeDelegation(
        revokeTarget.id,
        revokeReason || 'Revoked via Delegation Center',
        mfaCode,
      )
      showToast('Delegation revoked immediately.', 'info')
      setRevokeTarget(null)
      await Promise.all([loadData(), refreshPermissions()])
    } catch (err: any) {
      showToast(err?.message || 'Failed to revoke delegation.', 'error')
    } finally {
      setIsRevoking(false)
    }
  }

  const handleApprove = (id: string) => {
    setApproveTargetId(id)
  }

  const executeApprove = async (mfaCode: string) => {
    if (!approveTargetId) return
    setIsApproving(true)
    try {
      await erpApi.approveDelegation(approveTargetId, mfaCode)
      showToast('Delegation approved and activated.', 'success')
      setApproveTargetId(null)
      await Promise.all([loadData(), refreshPermissions()])
    } catch (err: any) {
      showToast(err?.message || 'Approval denied.', 'error')
    } finally {
      setIsApproving(false)
    }
  }

  const renderDelegationCard = (del: any, showRevoke: boolean, showApprove: boolean) => {
    const perms = (del.permissions || []).map((p: any) => p.permission?.code || p.code).filter(Boolean)
    const scopeList = (del.scopes || [])
      .map((s: any) => `${s.scope}${s.scopeIds?.length ? ` (${s.scopeIds.join(', ')})` : ''}`)
      .join(', ')

    return (
      <div
        key={del.id}
        className="p-3.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-[13px] font-semibold text-[var(--text)]">
              {del.delegator?.name || del.delegatorId} → {del.delegatee?.name || del.delegateeId}
            </p>
            <p className="text-[12px] text-[var(--muted)] mt-0.5">{del.reason}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                del.status === 'ACTIVE'
                  ? 'success'
                  : del.status === 'PENDING_APPROVAL'
                    ? 'warning'
                    : 'danger'
              }
            >
              {del.status}
            </Badge>
            {del.status === 'ACTIVE' && (
              <span className="text-[12px] text-[var(--primary)] font-medium flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" />
                {formatCountdown(del.expiresAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {perms.map((code: string) => (
            <span
              key={code}
              className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-[var(--primary)]/10 text-[var(--primary)]"
            >
              {code}
            </span>
          ))}
          {scopeList && (
            <span className="text-[12px] text-[var(--muted)] ml-1">Scope: {scopeList}</span>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1">
          <span>
            Expires {new Date(del.expiresAt).toLocaleString()}
            {del.revocationTrigger ? ` • Trigger: ${del.revocationTrigger}` : ''}
          </span>
          <div className="flex items-center gap-2">
            {showApprove && del.status === 'PENDING_APPROVAL' && (
              <Button size="sm" variant="primary" onClick={() => void handleApprove(del.id)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            )}
            {showRevoke && (del.status === 'ACTIVE' || del.status === 'PENDING_APPROVAL') && (
              <Button size="sm" variant="danger" onClick={() => setRevokeTarget(del)}>
                <XCircle className="w-3.5 h-3.5 mr-1" /> Revoke
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delegations"
        subtitle="Time-boxed, scope-limited authority delegation. Critical powers and re-delegation stay blocked."
        action={
          <Button variant="secondary" size="sm" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {canCreate && (
        <Card
          title="Grant Scoped Temporary Delegation"
          subtitle="Maximum 30 days • Limited to non-critical permissions you actively hold"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                  Recipient Employee
                </label>
                <select
                  value={delegateeId}
                  onChange={(e) => setDelegateeId(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                >
                  <option value="">Select recipient...</option>
                  {eligibleEmployees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                  Boundary Scope
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                >
                  <option value="PROJECT">PROJECT</option>
                  <option value="SQUAD">SQUAD</option>
                  <option value="DEPARTMENT">DEPARTMENT</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="SELF">SELF</option>
                  <option value="ORG">ORG</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                  Duration (Days, max 30)
                </label>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '1d', value: '1' },
                    { label: '3d', value: '3' },
                    { label: '1w', value: '7' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setExpiresInDays(preset.value)}
                      className={`px-2.5 py-2 rounded-[8px] border text-[12px] font-semibold cursor-pointer ${
                        expiresInDays === preset.value
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    className="w-20 px-2.5 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                  Target Scope IDs (optional comma-separated)
                </label>
                <input
                  type="text"
                  value={scopeIdsRaw}
                  onChange={(e) => setScopeIdsRaw(e.target.value)}
                  placeholder="e.g. proj_01"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
                  Business Justification *
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Sprint backup while on leave"
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <p className="text-[12px] font-medium text-[var(--muted)] flex items-center gap-1.5">
                  Delegate Authority ({delegatablePerms.length} eligible capabilities)
                  <span className="text-[11px] text-[var(--warning)] inline-flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> ⚠ Critical codes excluded
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={pickMode === 'packs' ? 'primary' : 'secondary'}
                    onClick={() => setPickMode('packs')}
                  >
                    By Pack
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={pickMode === 'individual' ? 'primary' : 'secondary'}
                    onClick={() => setPickMode('individual')}
                  >
                    Individual Permissions
                  </Button>
                </div>
              </div>

              {pickMode === 'packs' ? (
                <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 rounded-[10px] border border-[var(--border)] bg-[var(--bg)]">
                  {PERMISSION_PACKS.filter((pack) => pack.riskLevel !== 'critical').map((pack) => {
                    const heldSet = new Set(delegatablePerms.map((p: any) => p.code))
                    const eligibleInPack = pack.codes.filter((c) => heldSet.has(c))
                    if (eligibleInPack.length === 0) return null
                    const active = eligibleInPack.every((c) => selectedCodes.includes(c))
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() =>
                          setSelectedCodes((prev) =>
                            active
                              ? prev.filter((c) => !eligibleInPack.includes(c))
                              : Array.from(new Set([...prev, ...eligibleInPack])),
                          )
                        }
                        className={`text-left p-2.5 rounded-[8px] border cursor-pointer ${
                          active
                            ? 'bg-[var(--primary-soft)] border-[var(--primary)]'
                            : 'bg-[var(--surface)] border-[var(--border)]'
                        }`}
                      >
                        <div className="text-[12px] font-semibold text-[var(--text)]">
                          {pack.name} ({eligibleInPack.length})
                        </div>
                        <div className="text-[11px] text-[var(--muted)] truncate">
                          {pack.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-2 rounded-[10px] border border-[var(--border)] bg-[var(--bg)]">
                  {delegatablePerms.map((p: any) => {
                    const checked = selectedCodes.includes(p.code)
                    return (
                      <label
                        key={p.code}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-[12px] cursor-pointer ${
                          checked ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium' : 'text-[var(--text)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedCodes((prev) =>
                              checked ? prev.filter((c) => c !== p.code) : [...prev, p.code],
                            )
                          }
                        />
                        <span className="truncate font-mono">{p.code}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {selectedCodes.length > 0 && (
              <div className="p-3 rounded-[10px] bg-[var(--info)]/10 border border-[var(--info)]/30 text-[12px] space-y-1">
                <div className="font-semibold text-[var(--text)]">
                  Live Preview: What{' '}
                  {eligibleEmployees.find((u) => u.id === delegateeId)?.name || 'the recipient'}{' '}
                  gains for {expiresInDays || 7} day(s) ({scope} scope)
                </div>
                <p className="text-[var(--muted)]">
                  {selectedCodes
                    .slice(0, 5)
                    .map((c) => getPermissionDisplay(c).label)
                    .join(', ')}
                  {selectedCodes.length > 5 ? ` (+${selectedCodes.length - 5} more)` : ''}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {isSubmitting ? 'Granting...' : `Create Delegation (${selectedCodes.length})`}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title={`Received Delegations (${received.length})`}>
            <div className="space-y-2.5">
              {received.length === 0 ? (
                <EmptyState
                  icon={Share2}
                  title="No received delegations"
                  description="Temporary authority delegated to you by teammates will appear here."
                />
              ) : (
                received.map((d) => renderDelegationCard(d, can('delegations:revoke'), false))
              )}
            </div>
          </Card>

          <Card title={`Created by Me (${created.length})`}>
            <div className="space-y-2.5">
              {created.length === 0 ? (
                <EmptyState
                  title="No outgoing delegations"
                  description="Grant scoped backup permissions above when you are away."
                />
              ) : (
                created.map((d) => renderDelegationCard(d, true, false))
              )}
            </div>
          </Card>
        </div>
      )}

      {allDelegations.length > 0 && (
        <Card title={`Organization Delegation Ledger (${allDelegations.length})`}>
          <div className="space-y-2.5">
            {allDelegations.map((d) => renderDelegationCard(d, can('delegations:revoke'), canApprove))}
          </div>
        </Card>
      )}

      {pendingCreateOpen && (
        <MfaConfirmModal
          isOpen={pendingCreateOpen}
          onClose={() => setPendingCreateOpen(false)}
          onConfirm={({ mfaCode }) => void executeCreate(mfaCode)}
          isSubmitting={isSubmitting}
          title="Verify MFA to Grant Delegation"
          actionSummary={`Grant ${selectedCodes.length} temporary permission(s) (${selectedCodes.join(', ')}) for ${expiresInDays} day(s).`}
          whoAffected={
            eligibleEmployees.find((u) => u.id === delegateeId)?.name || delegateeId
          }
          confirmLabel="Verify MFA & Grant"
        />
      )}

      {approveTargetId && (
        <MfaConfirmModal
          isOpen={!!approveTargetId}
          onClose={() => setApproveTargetId(null)}
          onConfirm={({ mfaCode }) => void executeApprove(mfaCode)}
          isSubmitting={isApproving}
          title="Verify MFA to Approve Delegation"
          actionSummary="Approve and activate this pending temporary delegation."
          confirmLabel="Verify MFA & Approve"
        />
      )}

      {revokeTarget && (
        <MfaConfirmModal
          isOpen={!!revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onConfirm={({ mfaCode, reason: r }) => void executeRevoke(mfaCode, r)}
          isSubmitting={isRevoking}
          isCritical
          title="Revoke Temporary Delegation"
          actionSummary={`Immediately end delegated access granted to ${revokeTarget.delegatee?.name || revokeTarget.delegateeId}. Recomputes effective permissions immediately.`}
          whoAffected={revokeTarget.delegatee?.name || revokeTarget.delegateeId}
          confirmLabel="Verify MFA & Revoke"
        />
      )}
    </div>
  )
}
