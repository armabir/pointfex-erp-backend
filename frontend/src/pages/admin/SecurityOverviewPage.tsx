import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Lock, RefreshCw, Search, ShieldCheck, ShieldOff } from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { StatCard } from '../../components/common/StatCard'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { EmptyState } from '../../components/common/EmptyState'
import { MfaConfirmModal, type MfaConfirmPayload } from '../../components/common/MfaConfirmModal'

function formatDhaka(iso?: string | null): string {
  if (!iso) return 'Never'
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

type SecurityFilter = 'all' | 'enabled' | 'disabled' | 'enforced' | 'locked'

export function SecurityOverviewPage() {
  const { currentUser, showToast } = useApp()
  const { hasPermission } = usePermissions()
  const canManageMfa = hasPermission('mfa:manage')

  const [data, setData] = useState<Awaited<ReturnType<typeof erpApi.getMfaSecurityOverview>> | null>(
    null,
  )
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<SecurityFilter>('all')
  const [pendingAction, setPendingAction] = useState<{
    kind: 'reset_mfa' | 'revoke_sessions'
    employeeId: string
    name: string
    email: string
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reload = useCallback(async () => {
    try {
      const res = await erpApi.getMfaSecurityOverview()
      setData(res)
    } catch (err: any) {
      showToast(err?.message || 'Unable to load MFA security overview.', 'error')
    }
  }, [showToast])

  useEffect(() => {
    let cancelled = false
    void erpApi
      .getMfaSecurityOverview()
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.employees || []).filter((e) => {
      if (filter === 'enabled' && !e.mfaEnabled) return false
      if (filter === 'disabled' && e.mfaEnabled) return false
      if (filter === 'enforced' && !e.mustEnrollMfa) return false
      if (filter === 'locked' && !e.isLocked) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q)
      )
    })
  }, [data?.employees, filter, search])

  const handleConfirm = async ({ mfaCode, reason }: MfaConfirmPayload) => {
    if (!pendingAction) return
    setIsSubmitting(true)
    try {
      if (pendingAction.kind === 'reset_mfa') {
        await erpApi.adminResetMfa(pendingAction.employeeId, reason || '', mfaCode)
        showToast(
          `MFA reset for ${pendingAction.name}. Sessions revoked and notification emailed.`,
          'success',
        )
      } else {
        await erpApi.revokeEmployeeSessions(pendingAction.employeeId, reason || '', mfaCode)
        showToast(`All active sessions revoked for ${pendingAction.name}.`, 'info')
      }
      setPendingAction(null)
      await reload()
    } catch (err: any) {
      showToast(err?.message || 'Security action failed.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & MFA Governance"
        subtitle="Monitor multi-factor enrollment, locked accounts, and perform audited MFA or session resets."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="MFA Enabled"
          value={`${data?.summary.mfaEnabledPct ?? 0}%`}
          icon={ShieldCheck}
        />
        <StatCard
          label="Locked Users"
          value={data?.summary.lockedUsersCount ?? 0}
          icon={Lock}
        />
        <StatCard
          label="Resets This Month"
          value={data?.summary.resetsThisMonth ?? 0}
          icon={RefreshCw}
        />
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'All'],
                ['enabled', 'Enabled'],
                ['disabled', 'Not enabled'],
                ['enforced', 'Enforced'],
                ['locked', 'Locked'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  filter === key
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee or email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No employees match"
            description="Adjust your MFA status filter or search query."
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((emp) => {
              const isSelfOrCeo = emp.id === currentUser?.id || emp.role === 'ceo'
              return (
                <div
                  key={emp.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--text)]">{emp.name}</span>
                      <span className="font-mono text-[11px] text-[var(--muted)]">{emp.email}</span>
                      <Badge variant={emp.mfaEnabled ? 'success' : 'neutral'}>
                        {emp.mfaEnabled ? 'MFA Enabled' : 'Not Enabled'}
                      </Badge>
                      {emp.mustEnrollMfa && <Badge variant="warning">Enforced</Badge>}
                      {emp.isLocked && <Badge variant="danger">Locked</Badge>}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {emp.title} · Last MFA reset: {formatDhaka(emp.lastMfaResetAt)}
                    </div>
                  </div>

                  {canManageMfa && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        icon={ShieldOff}
                        disabled={isSelfOrCeo}
                        onClick={() =>
                          setPendingAction({
                            kind: 'revoke_sessions',
                            employeeId: emp.id,
                            name: emp.name,
                            email: emp.email,
                          })
                        }
                      >
                        Revoke sessions
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="danger"
                        icon={KeyRound}
                        disabled={isSelfOrCeo}
                        onClick={() =>
                          setPendingAction({
                            kind: 'reset_mfa',
                            employeeId: emp.id,
                            name: emp.name,
                            email: emp.email,
                          })
                        }
                      >
                        Reset MFA
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {pendingAction && (
        <MfaConfirmModal
          isOpen={!!pendingAction}
          onClose={() => setPendingAction(null)}
          onConfirm={handleConfirm}
          title={
            pendingAction.kind === 'reset_mfa'
              ? 'Confirm Admin MFA Reset'
              : 'Confirm Session Revocation'
          }
          actionSummary={
            pendingAction.kind === 'reset_mfa'
              ? `Clear ${pendingAction.name}'s authenticator secret and recovery codes, revoke all active sessions, email them a reset notice, and require re-enrollment if policy requires.`
              : `Revoke all active sessions and refresh tokens for ${pendingAction.name}.`
          }
          whoAffected={`${pendingAction.name} (${pendingAction.email})`}
          requiresReason
          isCritical
          confirmLabel={
            pendingAction.kind === 'reset_mfa' ? 'Reset MFA' : 'Revoke Sessions'
          }
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}
