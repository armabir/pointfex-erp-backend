import React, { useCallback, useEffect, useState } from 'react'
import {
  ClipboardCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Scale,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { PageHeader } from '../../components/common/PageHeader'
import { EmptyState } from '../../components/common/EmptyState'
import { SkeletonCard } from '../../components/common/Skeleton'
import { MoneyInput } from '../../components/common/MoneyInput'
import { SecurityConfirmModal } from '../../components/common/SecurityConfirmModal'
import { formatBDT } from '../../utils/money'

export function ApprovalInboxPage() {
  const { showToast, refreshPermissions } = useApp()
  const [inbox, setInbox] = useState<any[]>([])
  const [mine, setMine] = useState<any[]>([])
  const [sodRules, setSodRules] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [actionCode, setActionCode] = useState('payroll:approve_batch')
  const [entityType, setEntityType] = useState('payroll_batch')
  const [entityId, setEntityId] = useState('batch_2026_11')
  const [amount, setAmount] = useState('150000')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<{
    req: any
    decision: 'approve' | 'reject'
  } | null>(null)
  const [isDeciding, setIsDeciding] = useState(false)

  const fetchAll = useCallback(async () => {
    const [inboxRes, mineRes, sodRes] = await Promise.all([
      erpApi.getApprovalInbox().catch(() => []),
      erpApi.getMyApprovals().catch(() => []),
      erpApi.listSodRules().catch(() => []),
    ])
    return {
      inbox: Array.isArray(inboxRes) ? inboxRes : [],
      mine: Array.isArray(mineRes) ? mineRes : [],
      sodRules: Array.isArray(sodRes) ? sodRes : [],
    }
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchAll()
      setInbox(res.inbox)
      setMine(res.mine)
      setSodRules(res.sodRules)
    } finally {
      setIsLoading(false)
    }
  }, [fetchAll])

  useEffect(() => {
    let cancelled = false
    fetchAll()
      .then((res) => {
        if (cancelled) return
        setInbox(res.inbox)
        setMine(res.mine)
        setSodRules(res.sodRules)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchAll])

  const executeDecision = async (requestId: string, decision: 'approve' | 'reject') => {
    setIsDeciding(true)
    try {
      if (decision === 'approve') {
        await erpApi.approveWorkflowStep(requestId, 'Approved via Approval Inbox')
        showToast('Approval step signed.', 'success')
      } else {
        await erpApi.rejectWorkflowStep(requestId, 'Rejected via Approval Inbox')
        showToast('Workflow rejected.', 'info')
      }
      setPendingDecision(null)
      await Promise.all([loadData(), refreshPermissions()])
    } catch (err: any) {
      showToast(err?.message || 'Decision blocked by Separation of Duties rule.', 'error')
    } finally {
      setIsDeciding(false)
    }
  }

  const handleDecisionClick = (req: any, decision: 'approve' | 'reject') => {
    if (decision === 'reject' || req.requiresDualApproval) {
      setPendingDecision({ req, decision })
      return
    }
    void executeDecision(req.id, 'approve')
  }

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entityId.trim()) {
      showToast('Enter a target Entity ID before initiating.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await erpApi.initiateApproval({
        actionCode,
        entityType,
        entityId: entityId.trim(),
        amount: amount ? Number(amount) : undefined,
        reason: reason.trim() || undefined,
      })
      showToast('Approval workflow initiated.', 'success')
      setReason('')
      await loadData()
    } catch (err: any) {
      showToast(err?.message || 'Workflow initiation blocked.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderRequest = (req: any, actionable: boolean) => (
    <div
      key={req.id}
      className="p-3.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-mono font-semibold text-[var(--primary)]">
              {req.actionCode}
            </span>
            <Badge variant="info">{req.mode}</Badge>
            {req.requiresDualApproval && (
              <Badge variant="warning">
                <ShieldAlert className="w-3 h-3 inline mr-1" />
                Dual Approval
              </Badge>
            )}
          </div>
          <p className="text-[13px] text-[var(--text)] mt-1">
            {req.entityType}:{req.entityId}
            {req.amount ? ` • ${formatBDT(Number(req.amount))}` : ''}
            {req.requester?.name ? ` • Requested by ${req.requester.name}` : ''}
          </p>
          {req.reason && <p className="text-[12px] text-[var(--muted)] mt-0.5">{req.reason}</p>}
        </div>
        <Badge
          variant={
            req.status === 'APPROVED'
              ? 'success'
              : req.status === 'REJECTED' || req.status === 'TIMED_OUT'
                ? 'danger'
                : 'warning'
          }
        >
          {req.status}
        </Badge>
      </div>

      <div className="space-y-1">
        {(req.steps || []).map((st: any) => (
          <div
            key={st.id}
            className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)]"
          >
            <span className="text-[var(--text)]">
              Step {st.stepOrder}: <strong>{st.stepName}</strong> ({st.requiredPermission})
            </span>
            <span className="text-[var(--muted)]">
              {st.status}
              {st.approver?.name ? ` by ${st.approver.name}` : ''}
            </span>
          </div>
        ))}
      </div>

      {actionable && (
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="danger" onClick={() => handleDecisionClick(req, 'reject')}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
          </Button>
          <Button size="sm" variant="primary" onClick={() => handleDecisionClick(req, 'approve')}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve Step
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Inbox"
        subtitle="Sequential, threshold, and dual-approval workflows guarded by Separation of Duties."
        action={
          <Button variant="secondary" size="sm" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title={`Actionable Inbox (${inbox.length})`} subtitle="Pending steps eligible for your signature">
            <div className="space-y-2.5">
              {inbox.length === 0 ? (
                <EmptyState
                  icon={ClipboardCheck}
                  title="Inbox is clear"
                  description="No pending approvals require your signature right now."
                />
              ) : (
                inbox.map((req) => renderRequest(req, true))
              )}
            </div>
          </Card>

          <Card title={`My Submitted Workflows (${mine.length})`} subtitle="Self-approval blocked by SoD policy">
            <div className="space-y-2.5">
              {mine.length === 0 ? (
                <EmptyState
                  title="No submitted requests"
                  description="Workflows you initiate for dual-control sign-off will appear here."
                />
              ) : (
                mine.map((req) => renderRequest(req, false))
              )}
            </div>
          </Card>
        </div>
      )}

      <Card
        title="Initiate Approval Workflow"
        subtitle="Submit Payroll, Treasury, Purchase Order, Expense, or Compensation approvals"
      >
        <form onSubmit={handleInitiate} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Action Code
            </label>
            <select
              value={actionCode}
              onChange={(e) => {
                setActionCode(e.target.value)
                const map: Record<string, string> = {
                  'payroll:approve_batch': 'payroll_batch',
                  'treasury:transfer': 'treasury_transfer',
                  'purchase_orders:approve': 'purchase_order',
                  'expenses:approve': 'expense_claim',
                  'compensation:approve_changes': 'salary_change',
                }
                setEntityType(map[e.target.value] || 'workflow_item')
              }}
              className="w-full px-3 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            >
              <option value="payroll:approve_batch">payroll:approve_batch (⚠ Dual)</option>
              <option value="treasury:transfer">treasury:transfer (⚠ Dual)</option>
              <option value="purchase_orders:approve">purchase_orders:approve (≥ ৳50,000)</option>
              <option value="expenses:approve">expenses:approve (≥ ৳25,000)</option>
              <option value="compensation:approve_changes">compensation:approve_changes (⚠ Dual)</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Entity ID
            </label>
            <input
              type="text"
              required
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="w-full px-3 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
          <div>
            <MoneyInput
              label="Amount (BDT)"
              value={Number(amount) || 0}
              onChangeDigits={(val) => setAmount(String(val))}
              placeholder="150000"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--muted)] mb-1">
              Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Business justification"
              className="w-full px-3 py-2 text-[13px] rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Initiate
          </Button>
        </form>
      </Card>

      {sodRules.length > 0 && (
        <Card title={`Active Separation of Duties (SoD) Matrix (${sodRules.length})`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sodRules.map((rule) => (
              <div
                key={rule.code}
                className="p-3 rounded-[10px] border border-[var(--border)] flex items-start gap-2.5 bg-[var(--bg)]"
              >
                <Scale className="w-4 h-4 text-[var(--danger)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text)]">
                    {rule.code} — {rule.name}
                  </p>
                  <p className="text-[12px] text-[var(--muted)] mt-0.5">{rule.description}</p>
                  <p className="text-[11px] font-mono text-[var(--primary)] mt-1">
                    {(rule.actionCodes || []).join(' / ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pendingDecision && (
        <SecurityConfirmModal
          isOpen={!!pendingDecision}
          onClose={() => setPendingDecision(null)}
          onConfirm={() => void executeDecision(pendingDecision.req.id, pendingDecision.decision)}
          isSubmitting={isDeciding}
          isCritical={!!pendingDecision.req.requiresDualApproval}
          severity={pendingDecision.decision === 'reject' ? 'danger' : 'standard'}
          title={
            pendingDecision.decision === 'approve'
              ? `Confirm Approval: ${pendingDecision.req.actionCode}`
              : `Reject Workflow: ${pendingDecision.req.actionCode}`
          }
          details={`${pendingDecision.decision === 'approve' ? 'Sign approval step' : 'Reject workflow'} for ${pendingDecision.req.entityType}:${pendingDecision.req.entityId}${pendingDecision.req.amount ? ` (${formatBDT(Number(pendingDecision.req.amount))})` : ''}.`}
          whatWillHappen={
            pendingDecision.decision === 'approve'
              ? 'Records your cryptographic signature on this workflow step and advances or completes authorization.'
              : 'Immediately halts the workflow and notifies the requester.'
          }
          confirmLabel={pendingDecision.decision === 'approve' ? 'Sign Approval' : 'Reject Workflow'}
        />
      )}
    </div>
  )
}
