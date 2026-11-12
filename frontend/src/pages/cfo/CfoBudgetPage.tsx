import React, { useState, useMemo } from 'react'
import {
  DollarSign,
  TrendingUp,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  CreditCard,
  Briefcase,
} from 'lucide-react'
import { useExecutiveData } from '../../hooks/useExecutiveData'
import { useApp } from '../../context/AppContext'
import { Modal } from '../../components/common/Modal'
import { Button } from '../../components/common/Button'
import { PageHeader } from '../../components/common/PageHeader'
import { SecurityConfirmModal } from '../../components/common/SecurityConfirmModal'
import { MoneyInput } from '../../components/common/MoneyInput'
import { formatCurrency } from '../../utils/formatters'
import { formatBDT, moneyToneClass } from '../../utils/money'

export function CfoBudgetPage() {
  const {
    treasury,
    projectBudgets,
    pendingBudgetRequests,
    financialTransactions,
    developers,
    projectManagers,
  } = useExecutiveData()

  const {
    allocateProjectBudget,
    approveBudgetRequest,
    rejectBudgetRequest,
    issueFinancialAdjustment,
  } = useApp()

  // Tabs
  const [activeTab, setActiveTab] = useState<'allocations' | 'requests' | 'adjustments' | 'ledger'>(
    'allocations',
  )

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all')

  // Modals state
  const [adjustProjectModal, setAdjustProjectModal] = useState<any>(null)
  const [newBudgetInput, setNewBudgetInput] = useState<number>(0)
  const [budgetReasonInput, setBudgetReasonInput] = useState('')

  const [approveRequestModal, setApproveRequestModal] = useState<any>(null)
  const [approvedAmountInput, setApprovedAmountInput] = useState<number>(0)
  const [approvalNoteInput, setApprovalNoteInput] = useState('')

  const [rejectRequestModal, setRejectRequestModal] = useState<any>(null)
  const [rejectionFeedbackInput, setRejectionFeedbackInput] = useState('')

  const [isBonusPenaltyModalOpen, setIsBonusPenaltyModalOpen] = useState(false)
  const [targetUserId, setTargetUserId] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'bonus' | 'penalty'>('bonus')
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(500)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [pendingFinanceConfirm, setPendingFinanceConfirm] = useState<{
    title: string
    details: string
    whatWillHappen: string
    severity: 'standard' | 'danger'
    isCritical: boolean
    onRun: () => void
  } | null>(null)

  // Combined staff for bonus/penalty dropdown
  const allStaff = useMemo(() => {
    return [...projectManagers, ...developers]
  }, [projectManagers, developers])

  // Filtered Project Budgets
  const filteredProjects = useMemo(() => {
    return projectBudgets.filter((pb) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        pb.project.name.toLowerCase().includes(q) ||
        pb.project.code.toLowerCase().includes(q) ||
        pb.project.pm?.name.toLowerCase().includes(q)
      )
    })
  }, [projectBudgets, searchQuery])

  // Filtered Ledger Transactions
  const filteredTransactions = useMemo(() => {
    return financialTransactions.filter((tx) => {
      if (ledgerTypeFilter !== 'all' && tx.type !== ledgerTypeFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          tx.description.toLowerCase().includes(q) ||
          tx.type.toLowerCase().includes(q) ||
          tx.id.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [financialTransactions, ledgerTypeFilter, searchQuery])

  // Open adjust budget modal
  const handleOpenAdjustBudget = (pb: any) => {
    setAdjustProjectModal(pb)
    setNewBudgetInput(pb.approvedBudget)
    setBudgetReasonInput('')
  }

  const handleSaveBudgetAdjustment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustProjectModal) return
    const targetProj = adjustProjectModal.project
    const amt = Number(newBudgetInput)
    const reason = budgetReasonInput
    setAdjustProjectModal(null)
    setPendingFinanceConfirm({
      title: `Confirm Budget Allocation: ${targetProj.code}`,
      details: `Set approved budget pool for "${targetProj.name}" to ${formatBDT(amt)}.`,
      whatWillHappen: `Updates project capital pool to ${formatBDT(amt)} and records an immutable treasury allocation audit event.`,
      severity: 'standard',
      isCritical: amt >= 50_000,
      onRun: () => allocateProjectBudget(targetProj.id, amt, reason),
    })
  }

  // Open approve request modal
  const handleOpenApproveRequest = (req: any) => {
    setApproveRequestModal(req)
    const match = req.title.match(/[৳$]([0-9,]+)/)
    const parsedAmt = match ? Number(match[1].replace(/,/g, '')) : 5000
    setApprovedAmountInput(parsedAmt)
    setApprovalNoteInput('Approved by CFO. Funds transferred to squad project pool.')
  }

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault()
    if (!approveRequestModal) return
    const req = approveRequestModal
    const amt = Number(approvedAmountInput)
    const note = approvalNoteInput
    setApproveRequestModal(null)
    setPendingFinanceConfirm({
      title: 'Confirm Budget Disbursement',
      details: `Approve and disburse ${formatBDT(amt)} for request "${req.title}".`,
      whatWillHappen: `Transfers ${formatBDT(amt)} from Treasury Reserves to the squad project pool immediately.`,
      severity: 'standard',
      isCritical: amt >= 50_000,
      onRun: () => approveBudgetRequest(req.id, amt, note),
    })
  }

  // Open reject request modal
  const handleOpenRejectRequest = (req: any) => {
    setRejectRequestModal(req)
    setRejectionFeedbackInput(
      'Budget request exceeds current quarterly reserve allocation parameters.',
    )
  }

  const handleConfirmRejection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectRequestModal) return
    const req = rejectRequestModal
    const note = rejectionFeedbackInput
    setRejectRequestModal(null)
    setPendingFinanceConfirm({
      title: 'Confirm Budget Rejection',
      details: `Reject budget request "${req.title}".`,
      whatWillHappen: `Marks this request as rejected with feedback: "${note}".`,
      severity: 'danger',
      isCritical: false,
      onRun: () => rejectBudgetRequest(req.id, note),
    })
  }

  // Issue Bonus / Penalty
  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetUserId || adjustmentAmount <= 0) return
    const uid = targetUserId
    const amt = adjustmentAmount
    const type = adjustmentType
    const reason = adjustmentReason || `CFO financial ${adjustmentType}`
    const staffName = allStaff.find((u) => u.id === uid)?.name || uid
    setIsBonusPenaltyModalOpen(false)
    setPendingFinanceConfirm({
      title: `Confirm Financial ${type === 'bonus' ? 'Bonus' : 'Deduction'}`,
      details: `${type === 'bonus' ? 'Credit' : 'Deduct'} ${formatBDT(amt)} ${type === 'bonus' ? 'to' : 'from'} ${staffName}'s wallet.`,
      whatWillHappen: `Posts a permanent ${type} ledger entry of ${formatBDT(amt)} (${reason}).`,
      severity: type === 'penalty' ? 'danger' : 'standard',
      isCritical: type === 'penalty' || amt >= 25_000,
      onRun: () => {
        issueFinancialAdjustment(uid, amt, type, reason)
        setTargetUserId('')
        setAdjustmentAmount(500)
        setAdjustmentReason('')
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treasury & Budgets"
        subtitle="Manage project allocations, review budget requests, and track BDT disbursements."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={PlusCircle}
            onClick={() => {
              if (allStaff.length > 0) setTargetUserId(allStaff[0].id)
              setIsBonusPenaltyModalOpen(true)
            }}
          >
            Issue Bonus / Penalty
          </Button>
        }
      />

      {/* Top Treasury Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Initial Capital */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Initial Capital
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(treasury?.initialCapital ?? 0)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            CEO Seed Authorization
          </p>
        </div>

        {/* Approved Project Budgets */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Allocated Budgets
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(treasury?.totalApprovedBudgets ?? 0)}
          </div>
          <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-1 font-medium">
            Active Squad Commitments
          </p>
        </div>

        {/* Distributed to Developers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Disbursed to Staff
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(treasury?.totalDistributedToDevs ?? 0)}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            Credited to Wallets
          </p>
        </div>

        {/* Unallocated Reserves */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Treasury Reserves
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(treasury?.unallocatedReserves ?? 0)}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Uncommitted Buffer</p>
        </div>

        {/* Client Revenue Invoiced */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Client Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(treasury?.totalClientRevenue ?? 0)}
          </div>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 font-medium">
            70% Company / 20% Squad
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        {/* Navigation Tabs and Action Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('allocations')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'allocations'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              Project Allocations ({projectBudgets.length})
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'requests'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              PM Budget Requests
              {pendingBudgetRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {pendingBudgetRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('adjustments')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'adjustments'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              Incentives & Penalties
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              Financial Ledger ({financialTransactions.length})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              variant="primary"
              size="sm"
              icon={PlusCircle}
              onClick={() => {
                if (allStaff.length > 0) setTargetUserId(allStaff[0].id)
                setIsBonusPenaltyModalOpen(true)
              }}
            >
              Issue Bonus / Penalty
            </Button>
          </div>
        </div>

        {/* TAB 1: PROJECT BUDGET ALLOCATIONS */}
        {activeTab === 'allocations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by project name, code or PM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reserves buffer:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(treasury?.unallocatedReserves ?? 0)}
                </span>
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-4 px-6">Project &amp; Code</th>
                    <th className="py-4 px-6">Squad / PM</th>
                    <th className="py-4 px-6 text-right">Approved Budget</th>
                    <th className="py-4 px-6 text-right">Disbursed to Devs</th>
                    <th className="py-4 px-6 text-right">Remaining Pool</th>
                    <th className="py-4 px-6">Utilization</th>
                    <th className="py-4 px-6 text-right">Client Revenue</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProjects.map((pb) => (
                    <tr
                      key={pb.project.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {pb.project.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{pb.project.code}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-slate-900 dark:text-slate-200 font-medium">
                          {pb.project.pm?.name || 'Assigned PM'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {pb.project.assignedDevs?.length || 4} Devs Assigned
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(pb.approvedBudget)}
                      </td>
                      <td className="py-4 px-6 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(pb.distributedToDevs)}
                      </td>
                      <td className="py-4 px-6 text-right tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {formatCurrency(pb.remainingBudget)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pb.utilizationRate > 90
                                  ? 'bg-rose-500'
                                  : pb.utilizationRate > 75
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, pb.utilizationRate)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                            {pb.utilizationRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right tabular-nums font-medium text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(pb.clientRevenue)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenAdjustBudget(pb)}
                        >
                          Adjust Budget
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                        No projects match your current budget filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PENDING PM BUDGET REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {pendingBudgetRequests.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                  No Pending Budget Requests
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  All PM budget requests have been reviewed and adjudicated.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingBudgetRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          {req.category}
                        </span>
                        <span className="text-xs text-slate-400">{req.date}</span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                        {req.title}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                        {req.description}
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Submitted by:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {req.authorName || 'Project Manager'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/40">
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                        icon={CheckCircle2}
                        onClick={() => handleOpenApproveRequest(req)}
                      >
                        Approve Request
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="flex-1"
                        icon={XCircle}
                        onClick={() => handleOpenRejectRequest(req)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INCENTIVES & PENALTIES */}
        {activeTab === 'adjustments' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Discretionary Executive Compensation
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Directly disburse milestone bonuses or enforce SLA deductions on developer/PM
                  wallets.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={PlusCircle}
                onClick={() => {
                  if (allStaff.length > 0) setTargetUserId(allStaff[0].id)
                  setIsBonusPenaltyModalOpen(true)
                }}
              >
                New Adjustment
              </Button>
            </div>

            {/* Recent Adjustments */}
            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {financialTransactions
                    .filter((tx) => tx.type === 'bonus' || tx.type === 'deduction')
                    .slice(0, 10)
                    .map((tx) => {
                      const recipient = allStaff.find((u) => u.id === tx.userId)
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="py-3 px-4 text-xs text-slate-500">{tx.date}</td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                            {recipient?.name || tx.userId}
                            <span className="text-xs text-slate-400 ml-1.5 font-mono">
                              ({recipient?.role.toUpperCase()})
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                tx.type === 'bonus'
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              }`}
                            >
                              {tx.type === 'bonus' ? 'Bonus' : 'Deduction'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-semibold">
                            <span className={moneyToneClass(tx.type === 'bonus' ? Math.abs(tx.amount) : -Math.abs(tx.amount))}>
                              {tx.type === 'bonus' ? '+' : '-'}
                              {formatBDT(Math.abs(tx.amount))}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                            {tx.description}
                          </td>
                        </tr>
                      )
                    })}
                  {financialTransactions.filter(
                    (tx) => tx.type === 'bonus' || tx.type === 'deduction',
                  ).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                        No discretionary bonus or deduction adjustments recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: FINANCIAL LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search ledger entries..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <select
                  value={ledgerTypeFilter}
                  onChange={(e) => setLedgerTypeFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="budget_allocation">Budget Allocations</option>
                  <option value="bonus">Incentives</option>
                  <option value="deduction">Penalties</option>
                  <option value="milestone_payout">Milestones</option>
                </select>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total ledger records:{' '}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {filteredTransactions.length}
                </span>
              </div>
            </div>

            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{tx.id}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">{tx.date}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        {tx.description}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums font-semibold ${moneyToneClass(tx.amount)}`}
                      >
                        {formatBDT(tx.amount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                        No ledger transactions match the active criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Adjust Project Budget */}
      {adjustProjectModal && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustProjectModal(null)}
          title={`Adjust Project Budget: ${adjustProjectModal.project.name}`}
        >
          <form onSubmit={handleSaveBudgetAdjustment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Project Code & Squad
              </label>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {adjustProjectModal.project.code} — {adjustProjectModal.project.pm?.name}
              </div>
            </div>

            <MoneyInput
              label="New Approved Budget (BDT)"
              min={adjustProjectModal.distributedToDevs}
              value={newBudgetInput}
              onChangeDigits={(val) => setNewBudgetInput(val)}
              hint={`Minimum allowed: ${formatBDT(adjustProjectModal.distributedToDevs)} (already disbursed to devs).`}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Adjustment Reason / Note
              </label>
              <input
                type="text"
                placeholder="e.g., Expanded scope for Q4 deliverables"
                value={budgetReasonInput}
                onChange={(e) => setBudgetReasonInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setAdjustProjectModal(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save Allocation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Approve Budget Request */}
      {approveRequestModal && (
        <Modal
          isOpen={true}
          onClose={() => setApproveRequestModal(null)}
          title="Approve PM Budget Request"
        >
          <form onSubmit={handleConfirmApproval} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 font-medium">Request Title</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {approveRequestModal.title}
              </div>
            </div>

            <MoneyInput
              label="Approved Amount (BDT)"
              min={100}
              value={approvedAmountInput}
              onChangeDigits={(val) => setApprovedAmountInput(val)}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                CFO Feedback / Note to PM
              </label>
              <textarea
                rows={3}
                value={approvalNoteInput}
                onChange={(e) => setApprovalNoteInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setApproveRequestModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirm Approval & Disburse
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: Reject Budget Request */}
      {rejectRequestModal && (
        <Modal
          isOpen={true}
          onClose={() => setRejectRequestModal(null)}
          title="Reject Budget Request"
        >
          <form onSubmit={handleConfirmRejection} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 font-medium">Request Title</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {rejectRequestModal.title}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Rejection Reason (visible to PM)
              </label>
              <textarea
                rows={3}
                value={rejectionFeedbackInput}
                onChange={(e) => setRejectionFeedbackInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setRejectRequestModal(null)}>
                Cancel
              </Button>
              <Button variant="danger" type="submit">
                Confirm Rejection
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 4: Issue Bonus / Penalty */}
      {isBonusPenaltyModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsBonusPenaltyModalOpen(false)}
          title="Issue Financial Adjustment (Bonus / Penalty)"
        >
          <form onSubmit={handleConfirmAdjustment} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Adjustment Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('bonus')}
                  className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    adjustmentType === 'bonus'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Performance Bonus (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('penalty')}
                  className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                    adjustmentType === 'penalty'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  SLA Deduction (-)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Target Staff Member
              </label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              >
                {allStaff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.toUpperCase()} — {u.title})
                  </option>
                ))}
              </select>
            </div>

            <MoneyInput
              label="Amount (BDT)"
              min={50}
              value={adjustmentAmount}
              onChangeDigits={(val) => setAdjustmentAmount(val)}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                Justification / Reason
              </label>
              <input
                type="text"
                placeholder="e.g., Exceptional sprint milestone delivery"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setIsBonusPenaltyModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Review Adjustment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {pendingFinanceConfirm && (
        <SecurityConfirmModal
          isOpen={!!pendingFinanceConfirm}
          onClose={() => setPendingFinanceConfirm(null)}
          onConfirm={() => {
            pendingFinanceConfirm.onRun()
            setPendingFinanceConfirm(null)
          }}
          title={pendingFinanceConfirm.title}
          details={pendingFinanceConfirm.details}
          whatWillHappen={pendingFinanceConfirm.whatWillHappen}
          severity={pendingFinanceConfirm.severity}
          isCritical={pendingFinanceConfirm.isCritical}
          confirmLabel="Confirm Transaction"
        />
      )}
    </div>
  )
}
