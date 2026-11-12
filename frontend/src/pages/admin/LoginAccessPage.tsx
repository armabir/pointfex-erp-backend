import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  Copy,
  Download,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { StatCard } from '../../components/common/StatCard'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { EmptyState } from '../../components/common/EmptyState'
import { MfaConfirmModal, type MfaConfirmPayload } from '../../components/common/MfaConfirmModal'
import { parseAllowlistInput } from '../../utils/allowlist'

function formatDhaka(iso?: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

type AllowlistTab = 'ready' | 'onboarded' | 'disabled' | 'blocked'

type PendingAction =
  | { kind: 'import'; emails: string[]; note?: string }
  | { kind: 'toggle'; id: string; pattern: string; nextActive: boolean }
  | { kind: 'remove'; id: string; pattern: string }
  | { kind: 'approve_request'; id: string; email: string }
  | { kind: 'reject_request'; id: string; email: string }

export function LoginAccessPage() {
  const { setRoute, showToast } = useApp()
  const [data, setData] = useState<Awaited<ReturnType<typeof erpApi.listLoginAllowlist>> | null>(
    null,
  )
  const [rawEmails, setRawEmails] = useState('')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<AllowlistTab>('ready')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const res = await erpApi.listLoginAllowlist()
      setData(res)
    } catch (err: any) {
      showToast(err?.message || 'Unable to load login access list.', 'error')
    }
  }, [showToast])

  useEffect(() => {
    let cancelled = false
    void erpApi
      .listLoginAllowlist()
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err: any) => {
        if (!cancelled) showToast(err?.message || 'Unable to load login access list.', 'error')
      })
    return () => {
      cancelled = true
    }
  }, [showToast])

  const existingPatterns = useMemo(
    () => new Set((data?.entries || []).map((e) => e.pattern.toLowerCase())),
    [data?.entries],
  )

  const preview = useMemo(
    () => parseAllowlistInput(rawEmails, existingPatterns),
    [rawEmails, existingPatterns],
  )

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = data?.entries || []
    return list.filter((e) => {
      if (tab === 'ready' && !(e.isActive && !e.employeeId)) return false
      if (tab === 'onboarded' && !(e.isActive && e.employeeId)) return false
      if (tab === 'disabled' && e.isActive) return false
      if (!q) return true
      return (
        e.pattern.toLowerCase().includes(q) ||
        (e.note || '').toLowerCase().includes(q) ||
        (e.employeeName || '').toLowerCase().includes(q)
      )
    })
  }, [data?.entries, search, tab])

  const handleConfirm = async ({ mfaCode, reason }: MfaConfirmPayload) => {
    if (!pendingAction) return
    setIsSubmitting(true)
    try {
      if (pendingAction.kind === 'import') {
        const res = await erpApi.importLoginAllowlist(
          pendingAction.emails,
          pendingAction.note,
          mfaCode,
          reason,
        )
        showToast(`Added ${res.imported} email(s) to the login allowlist.`, 'success')
        setRawEmails('')
        setNote('')
      } else if (pendingAction.kind === 'toggle') {
        await erpApi.toggleLoginAllowlistEntry(
          pendingAction.id,
          pendingAction.nextActive,
          mfaCode,
          reason,
        )
        showToast(
          `${pendingAction.nextActive ? 'Enabled' : 'Disabled'} ${pendingAction.pattern}.`,
          'info',
        )
      } else if (pendingAction.kind === 'remove') {
        await erpApi.removeLoginAllowlistEntry(pendingAction.id, mfaCode, reason)
        showToast(`Removed ${pendingAction.pattern} and revoked active sessions.`, 'warning')
      } else if (pendingAction.kind === 'approve_request') {
        await erpApi.approveAllowlistEmailRequest(pendingAction.id, mfaCode, reason)
        showToast(`Approved ${pendingAction.email} and added to allowlist.`, 'success')
      } else if (pendingAction.kind === 'reject_request') {
        await erpApi.rejectAllowlistEmailRequest(pendingAction.id, mfaCode, reason || 'Declined')
        showToast(`Declined request for ${pendingAction.email}.`, 'info')
      }
      setPendingAction(null)
      await loadData()
    } catch (err: any) {
      showToast(err?.message || 'Allowlist action failed.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCsv = () => {
    const rows = [
      ['email', 'status', 'note', 'added_on', 'last_login', 'login_method'].join(','),
      ...(data?.entries || []).map((e) =>
        [
          e.pattern,
          e.isActive ? (e.employeeId ? 'Onboarded' : 'Ready') : 'Disabled',
          JSON.stringify(e.note || ''),
          e.createdAt,
          e.lastLoginAt || '',
          e.lastLoginMethod || '',
        ].join(','),
      ),
    ].join('\n')
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pointfex-login-allowlist.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOnboardNow = (email: string) => {
    sessionStorage.setItem('pointfex_onboard_email', email)
    setRoute('cto-people')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Login access"
        subtitle="CEO-controlled allowlist of exact verified emails allowed to sign in or be onboarded."
        action={
          <Button type="button" size="sm" variant="secondary" icon={Download} onClick={handleExportCsv}>
            Export CSV
          </Button>
        }
      />

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Allowed emails" value={data?.summary.allowedEmails ?? 0} icon={Shield} />
        <StatCard label="Ready to onboard" value={data?.summary.readyToOnboard ?? 0} icon={UserPlus} />
        <StatCard label="Active employees" value={data?.summary.activeEmployees ?? 0} icon={CheckCircle2} />
        <StatCard
          label="Blocked attempts (7d)"
          value={data?.summary.blockedLast7Days ?? 0}
          icon={Ban}
        />
      </div>

      {/* Big Add Email box (CEO only) */}
      {data?.canManage && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">Add email(s)</h2>
          <p className="text-xs text-[var(--muted)]">
            Type or paste one or many exact emails (Gmail, Outlook, Yahoo, company, or university).
          </p>
          <textarea
            rows={3}
            value={rawEmails}
            onChange={(e) => setRawEmails(e.target.value)}
            placeholder="alice@gmail.com&#10;bob@outlook.com, carol@company.com"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (e.g. Q4 Engineering Cohort)"
              className="flex-1 px-3 py-2 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <Button
              type="button"
              size="sm"
              variant="primary"
              icon={Plus}
              disabled={preview.toAdd.length === 0}
              onClick={() =>
                setPendingAction({
                  kind: 'import',
                  emails: preview.toAdd,
                  note: note.trim() || undefined,
                })
              }
            >
              Add {preview.toAdd.length} email(s)
            </Button>
          </div>
          {rawEmails.trim().length > 0 && (
            <p className="text-xs text-[var(--muted)]">
              Preview: will add <strong>{preview.toAdd.length}</strong>, skip{' '}
              <strong>{preview.duplicates}</strong> duplicates,{' '}
              <strong>{preview.invalid.length}</strong> invalid.
            </p>
          )}
        </Card>
      )}

      {/* Pending Email Requests */}
      {data?.canManage && data.pendingRequests.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            Pending email requests ({data.pendingRequests.length})
          </h2>
          <div className="divide-y divide-[var(--border)]">
            {data.pendingRequests.map((req) => (
              <div key={req.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-mono font-medium text-[var(--text)]">
                    {req.email} ({req.fullName})
                  </div>
                  <div className="text-[var(--muted)]">{req.reason}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="primary"
                    onClick={() =>
                      setPendingAction({ kind: 'approve_request', id: req.id, email: req.email })
                    }
                  >
                    Approve &amp; Add
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="danger"
                    onClick={() =>
                      setPendingAction({ kind: 'reject_request', id: req.id, email: req.email })
                    }
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs + Search */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ready', 'Ready to onboard'],
                ['onboarded', 'Onboarded'],
                ['disabled', 'Disabled'],
                ['blocked', 'Blocked attempts'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  tab === id
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab !== 'blocked' && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, name, or note..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          )}
        </div>

        {tab === 'blocked' ? (
          data?.blockedAttempts && data.blockedAttempts.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {data.blockedAttempts.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-mono text-[var(--text)]">{b.maskedEmail}</div>
                    <div className="text-[var(--muted)]">
                      {b.provider} · {b.reason}
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">{formatDhaka(b.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Shield}
              title="No blocked attempts in the last 7 days"
              description="Blocked password, Google, and forgot-password attempts appear here."
            />
          )
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No matching emails"
            description={
              tab === 'ready'
                ? 'Add an email above to prepare it for onboarding.'
                : 'No entries match your current filter.'
            }
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-[var(--text)]">{entry.pattern}</span>
                    <Badge variant={entry.isActive ? (entry.employeeId ? 'success' : 'info') : 'neutral'}>
                      {entry.isActive ? (entry.employeeId ? 'Onboarded' : 'Ready') : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Added {formatDhaka(entry.createdAt)}
                    {entry.note ? ` · ${entry.note}` : ''}
                    {entry.lastLoginAt
                      ? ` · Last login ${formatDhaka(entry.lastLoginAt)} (${entry.lastLoginMethod || 'password'})`
                      : ''}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.isActive && !entry.employeeId && (
                    <Button
                      type="button"
                      size="xs"
                      variant="primary"
                      onClick={() => handleOnboardNow(entry.pattern)}
                    >
                      Onboard now
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    icon={Copy}
                    onClick={() => {
                      void navigator.clipboard?.writeText(entry.pattern)
                      showToast('Email copied.', 'info')
                    }}
                  >
                    Copy
                  </Button>
                  {data?.canManage && (
                    <>
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          setPendingAction({
                            kind: 'toggle',
                            id: entry.id,
                            pattern: entry.pattern,
                            nextActive: !entry.isActive,
                          })
                        }
                      >
                        {entry.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="danger"
                        icon={Trash2}
                        onClick={() =>
                          setPendingAction({
                            kind: 'remove',
                            id: entry.id,
                            pattern: entry.pattern,
                          })
                        }
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {pendingAction && (
        <MfaConfirmModal
          isOpen={!!pendingAction}
          onClose={() => setPendingAction(null)}
          onConfirm={handleConfirm}
          title="Confirm Login Access Change"
          actionSummary={
            pendingAction.kind === 'import'
              ? `Add ${pendingAction.emails.length} exact email(s) to the login allowlist.`
              : pendingAction.kind === 'toggle'
                ? `${pendingAction.nextActive ? 'Enable' : 'Disable'} "${pendingAction.pattern}" on the login allowlist${!pendingAction.nextActive ? ' and revoke active sessions' : ''}.`
                : pendingAction.kind === 'remove'
                  ? `Remove "${pendingAction.pattern}" from the login allowlist and revoke active sessions immediately.`
                  : pendingAction.kind === 'approve_request'
                    ? `Approve request and add "${pendingAction.email}" to the login allowlist.`
                    : `Decline email allowlist request for "${pendingAction.email}".`
          }
          whoAffected="Organization login allowlist (CEO-only)"
          requiresReason
          isCritical
          confirmLabel="Verify & Apply"
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}
