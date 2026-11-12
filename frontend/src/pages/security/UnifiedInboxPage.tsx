import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import {
  buildUnifiedInboxItems,
  filterUnifiedInboxItems,
  INBOX_TYPE_LABELS,
  loadReadInboxIds,
  saveReadInboxIds,
  type UnifiedInboxItem,
  type UnifiedInboxItemType,
} from '../../services/unified-inbox'
import { formatDate } from '../../utils/formatters'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { SkeletonCard } from '../../components/common/Skeleton'
import { Tabs } from '../../components/common/Tabs'
import { SecurityConfirmModal } from '../../components/common/SecurityConfirmModal'
import { ApprovalInboxPage } from './ApprovalInboxPage'

export function UnifiedInboxPage() {
  const { currentUser, data, showToast, refreshPermissions, setRoute, markNotificationRead } =
    useApp()
  const { can, canAny } = usePermissions()

  const canUseWorkflowConsole = canAny([
    'approvals:read',
    'approvals:create',
    'approvals:approve',
    'governance:approve_request',
  ])

  const [tab, setTab] = useState<'queue' | 'workflows'>('queue')
  const [typeFilter, setTypeFilter] = useState<UnifiedInboxItemType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadInboxIds(currentUser?.id))
  const [focusedIndex, setFocusedIndex] = useState<number>(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  const [approvals, setApprovals] = useState<any[]>([])
  const [accessRequests, setAccessRequests] = useState<any[]>([])
  const [emailRequests, setEmailRequests] = useState<any[]>([])
  const [myReceivedDelegations, setMyReceivedDelegations] = useState<any[]>([])
  const [pendingDelegations, setPendingDelegations] = useState<any[]>([])
  const [budgetRequests, setBudgetRequests] = useState<any[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{
    items: UnifiedInboxItem[]
    decision: 'approve' | 'reject'
  } | null>(null)

  const canApproveTasks = canAny(['tasks:approve', 'tasks:reject'])
  const canApproveBudgets = canAny(['budgets:approve_request', 'budgets:reject_request', 'budgets:read_requests'])
  const canApproveAccess = canAny(['users:assign_role', 'governance:approve_request', 'roles:update'])
  const canApproveEmailRequests = can('login_allowlist:manage')
  const canApproveDelegations = can('delegations:approve')
  const canTriageReports = canAny(['reports:triage', 'reports:read_standard'])

  const fetchSources = useCallback(async () => {
    const [approvalsRes, accessRes, emailReqRes, myDelRes, allDelRes, budgetsRes] = await Promise.all([
      canUseWorkflowConsole ? erpApi.getApprovalInbox().catch(() => []) : Promise.resolve([]),
      canApproveAccess
        ? erpApi.listAccessRequests({ status: 'PENDING' }).catch(() => [])
        : Promise.resolve([]),
      canApproveEmailRequests ? erpApi.listAllowlistEmailRequests().catch(() => []) : Promise.resolve([]),
      erpApi.listMyDelegations().catch(() => ({ created: [], received: [] })),
      canApproveDelegations ? erpApi.listAllDelegations().catch(() => []) : Promise.resolve([]),
      canApproveBudgets ? erpApi.getBudgetRequests().catch(() => []) : Promise.resolve([]),
    ])

    return {
      approvals: Array.isArray(approvalsRes) ? approvalsRes : [],
      accessRequests: Array.isArray(accessRes) ? accessRes : [],
      emailRequests: Array.isArray(emailReqRes) ? emailReqRes : [],
      receivedDelegations: Array.isArray(myDelRes?.received) ? myDelRes.received : [],
      allDelegations: Array.isArray(allDelRes) ? allDelRes : [],
      budgets: Array.isArray(budgetsRes) ? budgetsRes : [],
    }
  }, [canUseWorkflowConsole, canApproveAccess, canApproveEmailRequests, canApproveDelegations, canApproveBudgets])

  const reloadInbox = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchSources()
      setApprovals(res.approvals)
      setAccessRequests(res.accessRequests)
      setEmailRequests(res.emailRequests)
      setMyReceivedDelegations(res.receivedDelegations)
      setPendingDelegations(res.allDelegations)
      setBudgetRequests(res.budgets)
    } finally {
      setIsLoading(false)
    }
  }, [fetchSources])

  useEffect(() => {
    let cancelled = false
    fetchSources()
      .then((res) => {
        if (cancelled) return
        setApprovals(res.approvals)
        setAccessRequests(res.accessRequests)
        setEmailRequests(res.emailRequests)
        setMyReceivedDelegations(res.receivedDelegations)
        setPendingDelegations(res.allDelegations)
        setBudgetRequests(res.budgets)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchSources])

  const allItems = useMemo(
    () =>
      buildUnifiedInboxItems({
        approvals,
        accessRequests,
        emailRequests,
        myReceivedDelegations,
        pendingDelegations,
        budgetRequests,
        tasks: data.tasks,
        reports: data.reports,
        notifications: data.notifications,
        canApproveTasks,
        canApproveBudgets,
        canApproveAccess,
        canApproveEmailRequests,
        canApproveDelegations,
        canTriageReports,
      }),
    [
      approvals,
      accessRequests,
      emailRequests,
      myReceivedDelegations,
      pendingDelegations,
      budgetRequests,
      data.tasks,
      data.reports,
      data.notifications,
      canApproveTasks,
      canApproveBudgets,
      canApproveAccess,
      canApproveEmailRequests,
      canApproveDelegations,
      canTriageReports,
    ],
  )

  const filteredItems = useMemo(
    () => filterUnifiedInboxItems(allItems, typeFilter, search),
    [allItems, typeFilter, search],
  )

  const countsByType = useMemo(() => {
    const counts: Partial<Record<UnifiedInboxItemType | 'all', number>> = { all: allItems.length }
    for (const item of allItems) {
      counts[item.type] = (counts[item.type] ?? 0) + 1
    }
    return counts
  }, [allItems])

  const markReadState = useCallback(
    (ids: string[], isRead: boolean) => {
      setReadIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) {
          if (isRead) next.add(id)
          else next.delete(id)
        }
        saveReadInboxIds(currentUser?.id, next)
        return next
      })
      for (const id of ids) {
        if (id.startsWith('mention:') && isRead) {
          markNotificationRead(id.replace('mention:', ''))
        }
      }
    },
    [currentUser?.id, markNotificationRead],
  )

  const executeDecisionForItems = useCallback(
    async (items: UnifiedInboxItem[], decision: 'approve' | 'reject', mfaCode?: string) => {
      setIsMutating(true)
      let okCount = 0
      try {
        for (const item of items) {
          const reason =
            reasonDrafts[item.id]?.trim() ||
            (decision === 'approve' ? 'Approved via Unified Inbox' : 'Rejected via Unified Inbox')

          if (item.type === 'approval') {
            if (decision === 'approve') await erpApi.approveWorkflowStep(item.sourceId, reason)
            else await erpApi.rejectWorkflowStep(item.sourceId, reason)
          } else if (item.type === 'task_review') {
            if (decision === 'approve') await erpApi.approveTask(item.sourceId, { feedback: reason })
            else await erpApi.rejectTask(item.sourceId, reason)
          } else if (item.type === 'access_request') {
            if (decision === 'approve') await erpApi.approveAccessRequest(item.sourceId, reason)
            else await erpApi.rejectAccessRequest(item.sourceId, reason)
          } else if (item.type === 'email_request') {
            if (decision === 'approve') {
              await erpApi.approveAllowlistEmailRequest(item.sourceId, mfaCode || '', reason)
            } else {
              await erpApi.rejectAllowlistEmailRequest(item.sourceId, mfaCode || '', reason)
            }
          } else if (item.type === 'delegation' && item.id.startsWith('delegation_approve:')) {
            if (decision === 'approve') await erpApi.approveDelegation(item.sourceId)
            else await erpApi.revokeDelegation(item.sourceId, reason)
          } else if (item.type === 'budget_request') {
            if (decision === 'approve') {
              await erpApi.approveBudgetRequest(item.sourceId, {
                approvedAmount: item.amountBDT ?? 0,
                feedback: reason,
              })
            } else {
              await erpApi.rejectBudgetRequest(item.sourceId, reason)
            }
          }
          okCount++
        }
        markReadState(
          items.map((i) => i.id),
          true,
        )
        setSelectedIds(new Set())
        setPendingConfirm(null)
        showToast(
          `${decision === 'approve' ? 'Approved' : 'Rejected'} ${okCount} item${okCount === 1 ? '' : 's'}.`,
          decision === 'approve' ? 'success' : 'info',
        )
        await Promise.all([reloadInbox(), refreshPermissions()])
      } catch (err: any) {
        showToast(err?.message || 'Action blocked by policy or SoD rule.', 'error')
      } finally {
        setIsMutating(false)
      }
    },
    [reasonDrafts, markReadState, showToast, reloadInbox, refreshPermissions],
  )

  const requestDecision = useCallback(
    (items: UnifiedInboxItem[], decision: 'approve' | 'reject') => {
      const actionable = items.filter((i) => (decision === 'approve' ? i.canApprove : i.canReject))
      if (actionable.length === 0) return
      const needsConfirm = decision === 'reject' || actionable.some((i) => i.isCritical)
      if (needsConfirm) {
        setPendingConfirm({ items: actionable, decision })
        return
      }
      void executeDecisionForItems(actionable, decision)
    },
    [executeDecisionForItems],
  )

  // Keyboard shortcuts: j/k move, a approve, r reject, Enter open/expand
  useEffect(() => {
    if (tab !== 'queue') return
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (filteredItems.length === 0) return

      const clampedIndex = Math.min(focusedIndex, filteredItems.length - 1)
      const currentItem = filteredItems[clampedIndex]

      if (e.key === 'j') {
        e.preventDefault()
        setFocusedIndex((prev) => Math.min(filteredItems.length - 1, prev + 1))
      } else if (e.key === 'k') {
        e.preventDefault()
        setFocusedIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'a' && currentItem?.canApprove) {
        e.preventDefault()
        requestDecision([currentItem], 'approve')
      } else if (e.key === 'r' && currentItem?.canReject) {
        e.preventDefault()
        requestDecision([currentItem], 'reject')
      } else if (e.key === 'Enter' && currentItem) {
        e.preventDefault()
        markReadState([currentItem.id], true)
        setExpandedId((prev) => (prev === currentItem.id ? null : currentItem.id))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [tab, filteredItems, focusedIndex, requestDecision, markReadState])

  const selectedItems = useMemo(
    () => filteredItems.filter((i) => selectedIds.has(i.id)),
    [filteredItems, selectedIds],
  )

  const filterTypes: Array<UnifiedInboxItemType | 'all'> = [
    'all',
    'approval',
    'task_review',
    'access_request',
    ...(canApproveEmailRequests ? (['email_request'] as const) : []),
    'delegation',
    'budget_request',
    'mention',
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Needs My Action"
        subtitle="Everything waiting on your decision or review across approvals, tasks, delegations, and mentions."
        action={
          <Button variant="secondary" size="sm" onClick={() => void reloadInbox()} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {canUseWorkflowConsole && (
        <Tabs
          tabs={[
            { id: 'queue', label: 'Action Queue', count: allItems.length },
            { id: 'workflows', label: 'Workflow Initiator & SoD' },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as 'queue' | 'workflows')}
        />
      )}

      {tab === 'workflows' && canUseWorkflowConsole ? (
        <ApprovalInboxPage />
      ) : (
        <div className="space-y-4">
          {/* Search + Filter Chips */}
          <Card>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter inbox items..."
                    aria-label="Filter inbox items"
                    className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>
                <div className="text-[12px] text-[var(--muted)] hidden md:flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">j/k</kbd>
                  <span>move</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">a</kbd>
                  <span>approve</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">r</kbd>
                  <span>reject</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">Enter</kbd>
                  <span>open</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {filterTypes.map((ft) => {
                  const count = countsByType[ft] ?? 0
                  if (ft !== 'all' && count === 0) return null
                  const active = typeFilter === ft
                  return (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => {
                        setTypeFilter(ft)
                        setFocusedIndex(0)
                      }}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-colors ${
                        active
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {INBOX_TYPE_LABELS[ft]} ({count})
                    </button>
                  )
                })}
              </div>

              {selectedItems.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--text)]">
                    {selectedItems.length} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        markReadState(
                          selectedItems.map((i) => i.id),
                          true,
                        )
                      }
                    >
                      Mark Read
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={isMutating || !selectedItems.some((i) => i.canReject)}
                      onClick={() => requestDecision(selectedItems, 'reject')}
                    >
                      Bulk Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={isMutating || !selectedItems.some((i) => i.canApprove)}
                      onClick={() => requestDecision(selectedItems, 'approve')}
                    >
                      Bulk Approve
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {isLoading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <EmptyState
                icon={Inbox}
                title="All caught up"
                description="Nothing is waiting for your approval or review right now."
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {filteredItems.map((item, idx) => {
                const isFocused = idx === Math.min(focusedIndex, filteredItems.length - 1)
                const isRead = readIds.has(item.id)
                const isSelected = selectedIds.has(item.id)
                const isExpanded = expandedId === item.id

                return (
                  <div
                    key={item.id}
                    onClick={() => setFocusedIndex(idx)}
                    className={`rounded-[var(--radius-card)] border bg-[var(--surface)] p-4 transition-colors ${
                      isFocused
                        ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`Select ${item.title}`}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(item.id)
                            else next.delete(item.id)
                            return next
                          })
                        }}
                        className="mt-1 cursor-pointer"
                      />

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {!isRead && (
                                <span
                                  className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0"
                                  title="Unread"
                                />
                              )}
                              <span
                                className={`text-[14px] ${
                                  isRead ? 'font-medium text-[var(--muted)]' : 'font-semibold text-[var(--text)]'
                                }`}
                              >
                                {item.title}
                              </span>
                              <Badge variant="default" size="xs">
                                {INBOX_TYPE_LABELS[item.type]}
                              </Badge>
                              {item.isCritical && (
                                <Badge variant="warning" size="xs">
                                  <ShieldAlert className="w-3 h-3 inline mr-1" />
                                  Critical
                                </Badge>
                              )}
                            </div>
                            <p className="text-[13px] text-[var(--muted)] mt-0.5">{item.subtitle}</p>
                            <p className="text-[12px] text-[var(--muted)] mt-0.5">
                              {item.requesterName ? `${item.requesterName} • ` : ''}
                              {formatDate(item.createdAt, 'short')}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => markReadState([item.id], !isRead)}
                              className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                              title={isRead ? 'Mark unread' : 'Mark read'}
                              aria-label={isRead ? 'Mark unread' : 'Mark read'}
                            >
                              {isRead ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                            </button>

                            {item.routeHint && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  markReadState([item.id], true)
                                  setRoute(item.routeHint!)
                                }}
                              >
                                Open
                              </Button>
                            )}
                          </div>
                        </div>

                        {(item.canApprove || item.canReject || isExpanded) && (
                          <div className="pt-2 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-2">
                            {(item.canApprove || item.canReject) && (
                              <input
                                type="text"
                                value={reasonDrafts[item.id] || ''}
                                onChange={(e) =>
                                  setReasonDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                placeholder="Optional note or rejection reason..."
                                className="flex-1 px-3 py-1.5 text-[13px] rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                              />
                            )}
                            <div className="flex items-center gap-2 justify-end">
                              {item.canReject && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  disabled={isMutating}
                                  onClick={() => requestDecision([item], 'reject')}
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              )}
                              {item.canApprove && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={isMutating}
                                  onClick={() => requestDecision([item], 'approve')}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {pendingConfirm && (
        <SecurityConfirmModal
          isOpen={!!pendingConfirm}
          onClose={() => setPendingConfirm(null)}
          onConfirm={(_phrase, _pwd, mfaCode) =>
            void executeDecisionForItems(pendingConfirm.items, pendingConfirm.decision, mfaCode)
          }
          isSubmitting={isMutating}
          isCritical={pendingConfirm.items.some((i) => i.isCritical)}
          severity={pendingConfirm.decision === 'reject' ? 'danger' : 'standard'}
          title={`${pendingConfirm.decision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'} (${pendingConfirm.items.length})`}
          details={pendingConfirm.items.map((i) => i.title).slice(0, 3).join(', ')}
          whatWillHappen={`Applies ${pendingConfirm.decision} to ${pendingConfirm.items.length} selected item(s) and writes an audit record.`}
          confirmLabel={pendingConfirm.decision === 'approve' ? 'Approve Selected' : 'Reject Selected'}
        />
      )}
    </div>
  )
}
