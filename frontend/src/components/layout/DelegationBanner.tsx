import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, Share2 } from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { Button } from '../common/Button'
import { getPermissionDisplay } from '../../utils/permission-dictionary'

interface ActiveDelegationItem {
  id: string
  status: string
  expiresAt: string
  delegator?: { name?: string }
  delegatorId?: string
  permissions?: Array<{ permission?: { code?: string }; code?: string }>
  scopes?: Array<{ scope?: string; scopeIds?: string[] }>
}

function formatLiveRemaining(ms: number): string {
  if (ms <= 0) return 'Expired'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86_400)
  const hours = Math.floor((totalSec % 86_400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${mins}m remaining`
  return `${mins}m ${String(secs).padStart(2, '0')}s remaining`
}

/**
 * Global banner shown across all authenticated pages whenever the signed-in
 * user holds active temporary delegated authority from another staff member.
 */
export function DelegationBanner() {
  const { activeDelegationsCount, currentUser, setRoute } = useApp()
  const [received, setReceived] = useState<ActiveDelegationItem[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!currentUser?.id || activeDelegationsCount <= 0) {
      return
    }
    let cancelled = false
    erpApi
      .listMyDelegations()
      .then((res) => {
        if (cancelled) return
        const rows = Array.isArray(res?.received) ? res.received : []
        setReceived(rows)
      })
      .catch(() => {
        if (!cancelled) setReceived([])
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, activeDelegationsCount])

  const activeItems = useMemo(() => {
    if (!currentUser?.id || activeDelegationsCount <= 0) return []
    return received.filter((d) => {
      if (d.status !== 'ACTIVE') return false
      if (!d.expiresAt) return true
      return new Date(d.expiresAt).getTime() > nowMs
    })
  }, [received, nowMs, currentUser?.id, activeDelegationsCount])

  const soonestExpiryMs = useMemo(() => {
    if (activeItems.length === 0) return null
    const times = activeItems
      .map((d) => (d.expiresAt ? new Date(d.expiresAt).getTime() : Number.POSITIVE_INFINITY))
      .filter((t) => Number.isFinite(t))
    return times.length > 0 ? Math.min(...times) : null
  }, [activeItems])

  const remainingMs = soonestExpiryMs !== null ? soonestExpiryMs - nowMs : null
  const isExpiringSoon = remainingMs !== null && remainingMs < 60 * 60 * 1000

  useEffect(() => {
    if (activeItems.length === 0) return
    const timer = window.setInterval(
      () => setNowMs(Date.now()),
      isExpiringSoon ? 1000 : 30_000,
    )
    return () => window.clearInterval(timer)
  }, [activeItems.length, isExpiringSoon])

  if (activeDelegationsCount <= 0 && activeItems.length === 0) return null
  if (activeItems.length === 0) return null

  const primary = activeItems[0]
  const delegatorName = primary.delegator?.name || primary.delegatorId || 'A team member'
  const codes = (primary.permissions || [])
    .map((p) => p.permission?.code || p.code)
    .filter((c): c is string => Boolean(c))
  const scopes = (primary.scopes || [])
    .map((s) => (s.scope ? s.scope + (s.scopeIds?.length ? ` (${s.scopeIds.join(', ')})` : '') : ''))
    .filter(Boolean)

  const sampleSummary =
    codes.length > 0
      ? codes
          .slice(0, 2)
          .map((c) => getPermissionDisplay(c).label)
          .join(', ') + (codes.length > 2 ? ` +${codes.length - 2} more` : '')
      : `${activeItems.length} delegated grant${activeItems.length === 1 ? '' : 's'}`

  return (
    <div
      role="status"
      className={`mb-5 rounded-[12px] border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        isExpiringSoon
          ? 'bg-[var(--warning)]/10 border-[var(--warning)]/40 text-[var(--text)]'
          : 'bg-[var(--info)]/10 border-[var(--info)]/30 text-[var(--text)]'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${
            isExpiringSoon
              ? 'bg-[var(--warning)]/15 text-[var(--warning)]'
              : 'bg-[var(--info)]/15 text-[var(--info)]'
          }`}
        >
          {isExpiringSoon ? <AlertTriangle className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            <span>Acting under temporary delegation from {delegatorName}</span>
            {activeItems.length > 1 && (
              <span className="text-[12px] font-medium text-[var(--muted)]">
                ({activeItems.length} active grants)
              </span>
            )}
          </div>
          <p className="text-[12px] text-[var(--muted)] mt-0.5 truncate">
            Powers: {sampleSummary}
            {scopes.length > 0 ? ` • Scope: ${scopes.join(', ')}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
        {remainingMs !== null && (
          <span
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums px-2.5 py-1 rounded-[8px] ${
              isExpiringSoon
                ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {isExpiringSoon ? `Expiring soon: ${formatLiveRemaining(remainingMs)}` : formatLiveRemaining(remainingMs)}
          </span>
        )}
        <Button variant="secondary" size="sm" onClick={() => setRoute('delegations')}>
          View Delegations
        </Button>
      </div>
    </div>
  )
}
