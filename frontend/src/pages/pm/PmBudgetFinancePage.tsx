import React, { useState, useMemo } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { StatusPill } from '../../components/common/StatusPill'
import { usePmData } from '../../hooks/usePmData'
import { useApp } from '../../context/AppContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { MoneyInput } from '../../components/common/MoneyInput'
import type { Project, Transaction } from '../../types'
import {
  Wallet,
  Coins,
  ShieldCheck,
  Plus,
  Send,
  ArrowUpRight,
  FolderGit2,
  Layers,
} from 'lucide-react'

interface ScopedFinancialData {
  authorizedBudget: number
  allocated: number
  released: number
  remaining: number
  utilization: number
  transactions: Transaction[]
  projects: Project[]
}

export function PmBudgetFinancePage() {
  const { financials, teamProjects, teamMembers, team } = usePmData()
  const { allocateBudget, requestBudgetIncrease } = useApp()

  // Project Filter State (Left column filter like Dev task panel)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')

  // Modals state
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)

  // Allocation Form State
  const [allocDevId, setAllocDevId] = useState(teamMembers[0]?.id || '')
  const [allocProjectId, setAllocProjectId] = useState(teamProjects[0]?.id || '')
  const [allocAmount, setAllocAmount] = useState('1200')
  const [allocWeek, setAllocWeek] = useState('3')
  const [allocDesc, setAllocDesc] = useState('')

  // Budget Request Form State
  const [reqProjectId, setReqProjectId] = useState(teamProjects[0]?.id || '')
  const [reqAmount, setReqAmount] = useState('5000')
  const [reqReason, setReqReason] = useState('')

  // Scoped calculation based on selected project
  const currentProject = useMemo(() => {
    if (selectedProjectId === 'all') return null
    return teamProjects.find((p) => p.id === selectedProjectId) || null
  }, [selectedProjectId, teamProjects])

  const scopedData: ScopedFinancialData = useMemo(() => {
    if (!currentProject) {
      // Aggregated across all team projects
      return {
        authorizedBudget: financials.totalApprovedBudget,
        allocated: financials.totalAllocated,
        released: financials.totalReleased,
        remaining: financials.remainingBudget,
        utilization:
          financials.totalApprovedBudget > 0
            ? Math.round((financials.totalAllocated / financials.totalApprovedBudget) * 100)
            : 0,
        transactions: financials.teamTransactions,
        projects: teamProjects,
      }
    }

    // Filtered by selected project
    const projBudget = Number(currentProject.budget) || 0
    const projTransactions = financials.teamTransactions.filter(
      (tx) => tx.projectId === currentProject.id,
    )
    const projTxAllocated = projTransactions
      .filter((tx) => tx.type === 'budget_allocation')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    const projAllocated = Math.max(projTxAllocated, currentProject.allocatedBudget || 0)
    const projReleased =
      projTransactions
        .filter((tx) => tx.amount > 0 && tx.status === 'completed')
        .reduce((sum, tx) => sum + tx.amount, 0) || Math.round(projAllocated * 0.7)
    const projRemaining = Math.max(0, projBudget - projAllocated)
    const projUtilization = projBudget > 0 ? Math.round((projAllocated / projBudget) * 100) : 0

    return {
      authorizedBudget: projBudget,
      allocated: projAllocated,
      released: projReleased,
      remaining: projRemaining,
      utilization: projUtilization,
      transactions: projTransactions,
      projects: [currentProject],
    }
  }, [currentProject, financials, teamProjects])

  // Total summary stats for sidebar
  const totalApproved = teamProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0)
  const totalAllocatedAll = teamProjects.reduce((sum, p) => {
    const pTxAlloc = financials.teamTransactions
      .filter((tx) => tx.projectId === p.id && tx.type === 'budget_allocation')
      .reduce((s, tx) => s + (tx.amount || 0), 0)
    return sum + Math.max(pTxAlloc, p.allocatedBudget || 0)
  }, 0)
  const overallUtilization =
    totalApproved > 0 ? Math.round((totalAllocatedAll / totalApproved) * 100) : 0

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!allocDevId || !allocProjectId || !allocAmount) return

    allocateBudget({
      developerId: allocDevId,
      projectId: allocProjectId,
      amount: allocAmount,
      week: allocWeek,
      description: allocDesc || `Sprint Week ${allocWeek} developer allocation`,
    })

    setIsAllocateModalOpen(false)
    setAllocDesc('')
  }

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqProjectId || !reqAmount || !reqReason.trim()) return

    requestBudgetIncrease({
      projectId: reqProjectId,
      amount: reqAmount,
      reason: reqReason.trim(),
    })

    setIsRequestModalOpen(false)
    setReqReason('')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Project Budgets & Resource Allocations
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            CFO-authorized budgets, developer allocations, and escrow releases for{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {team?.name || 'Squad'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={Send}
            onClick={() => {
              if (currentProject) setReqProjectId(currentProject.id)
              setIsRequestModalOpen(true)
            }}
          >
            Request CFO Increase
          </Button>
          <Button
            variant="lime"
            size="sm"
            icon={Plus}
            onClick={() => {
              if (currentProject) setAllocProjectId(currentProject.id)
              setIsAllocateModalOpen(true)
            }}
          >
            Allocate to Developer
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid: Left Project Filter Sidebar + Right Data View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (3 cols): Project Filter Cards (Like Developer Tasks Page) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
              Project Filter
            </span>
            <span className="text-[11px] text-slate-400">{teamProjects.length + 1} options</span>
          </div>

          {/* "All Projects" Card */}
          <button
            type="button"
            onClick={() => setSelectedProjectId('all')}
            className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
              selectedProjectId === 'all'
                ? 'bg-white dark:bg-slate-900 border-lime-400 dark:border-lime-400/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] ring-1 ring-lime-400'
                : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    selectedProjectId === 'all'
                      ? 'bg-lime-400 text-slate-950 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    All Projects
                  </span>
                  <span className="text-[10px] text-slate-400">Aggregated Squad Total</span>
                </div>
              </div>
              <Badge variant="lime" size="xs">
                Active
              </Badge>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Total Budget</span>
                <span className="font-bold text-slate-900 dark:text-white font-display">
                  {formatCurrency(totalApproved)}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-lime-500 h-1.5 rounded-full"
                  style={{ width: `${overallUtilization}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{overallUtilization}% Allocated</span>
                <span>{formatCurrency(totalAllocatedAll)}</span>
              </div>
            </div>
          </button>

          {/* Individual Project Cards */}
          {teamProjects.map((proj) => {
            const isSelected = selectedProjectId === proj.id
            const pBudget = Number(proj.budget) || 0
            const pTxAlloc = financials.teamTransactions
              .filter((tx) => tx.projectId === proj.id && tx.type === 'budget_allocation')
              .reduce((s, tx) => s + (tx.amount || 0), 0)
            const pAllocated = Math.max(pTxAlloc, proj.allocatedBudget || 0)
            const pUtilization = pBudget > 0 ? Math.round((pAllocated / pBudget) * 100) : 0

            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => setSelectedProjectId(proj.id)}
                className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-lime-400 dark:border-lime-400/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] ring-1 ring-lime-400'
                    : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
                      {proj.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{proj.code}</span>
                  </div>
                  <StatusPill status={proj.status} size="sm" />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Budget</span>
                    <span className="font-bold text-slate-900 dark:text-white font-display">
                      {formatCurrency(pBudget)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full"
                      style={{ width: `${pUtilization}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{pUtilization}% Allocated</span>
                    <span>{formatCurrency(pAllocated)}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right Column (9 cols): Data Scoped to Selected Project */}
        <div className="lg:col-span-9 space-y-6">
          {/* Active Filter Scope Pill */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-850 px-4 py-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Active Financial Scope:</span>
              <strong className="text-slate-900 dark:text-white">
                {currentProject
                  ? currentProject.name
                  : `All Projects (${teamProjects.length} Managed)`}
              </strong>
            </div>
            {currentProject && (
              <button
                onClick={() => setSelectedProjectId('all')}
                className="text-[11px] font-semibold text-lime-600 dark:text-lime-400 hover:underline cursor-pointer"
              >
                Reset to All Projects
              </button>
            )}
          </div>

          {/* 4 Top Metric Cards (Starline Soft Pastel) - Scoped to Selected Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Authorized Budget */}
            <div className="bg-[#fff8f2] dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/40 rounded-3xl p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Authorized Budget</span>
                <div className="p-2 rounded-xl bg-amber-100/80 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">
                {formatCurrency(scopedData.authorizedBudget)}
              </div>
              <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                Authorized by CFO
              </div>
            </div>

            {/* 2. Allocated to Devs */}
            <div className="bg-[#faf6ff] dark:bg-purple-950/20 border border-purple-100/80 dark:border-purple-900/40 rounded-3xl p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Allocated to Devs</span>
                <div className="p-2 rounded-xl bg-purple-100/80 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">
                {formatCurrency(scopedData.allocated)}
              </div>
              <div className="mt-2 text-[11px] text-purple-700 dark:text-purple-400 font-medium">
                {scopedData.utilization}% of authorized pool
              </div>
            </div>

            {/* 3. Released to Wallets */}
            <div className="bg-[#f0fdf9] dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/40 rounded-3xl p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Released / Paid</span>
                <div className="p-2 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">
                {formatCurrency(scopedData.released)}
              </div>
              <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                Disbursed upon completed tasks
              </div>
            </div>

            {/* 4. Unallocated Reserve */}
            <div className="bg-[#eff6ff] dark:bg-sky-950/20 border border-sky-100/80 dark:border-sky-900/40 rounded-3xl p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>Remaining Reserve</span>
                <div className="p-2 rounded-xl bg-sky-100/80 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">
                {formatCurrency(scopedData.remaining)}
              </div>
              <div className="mt-2 text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                Available for Sprint 4 & 5
              </div>
            </div>
          </div>

          {/* Allocation & Transaction Ledger - Scoped */}
          <Card title="Allocation & Payment Ledger" icon={Wallet}>
            <div className="space-y-3 text-xs">
              {scopedData.transactions.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  No transactions recorded for this scope yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scopedData.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>Date: {formatDate(tx.date, 'short')}</span>
                          <span>•</span>
                          <span className="capitalize">{tx.type.replace('_', ' ')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <span
                          className={`font-bold font-display text-sm ${
                            tx.amount >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatCurrency(tx.amount)}
                        </span>
                        <Badge variant={tx.status === 'completed' ? 'emerald' : 'amber'} size="xs">
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal: Allocate Budget to Developer */}
      <Modal
        isOpen={isAllocateModalOpen}
        onClose={() => setIsAllocateModalOpen(false)}
        title="Allocate Weekly Budget to Developer"
      >
        <form onSubmit={handleAllocateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Developer <span className="text-rose-500">*</span>
            </label>
            <select
              value={allocDevId}
              onChange={(e) => setAllocDevId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {teamMembers.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name} ({dev.title})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Associated Project <span className="text-rose-500">*</span>
            </label>
            <select
              value={allocProjectId}
              onChange={(e) => setAllocProjectId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {teamProjects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} ({proj.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MoneyInput
              label="Allocation Amount (BDT)"
              min={100}
              value={allocAmount}
              onChangeDigits={(val) => setAllocAmount(String(val))}
              required
            />
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sprint Week
              </label>
              <select
                value={allocWeek}
                onChange={(e) => setAllocWeek(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="1">Week 1</option>
                <option value="2">Week 2</option>
                <option value="3">Week 3 (Current)</option>
                <option value="4">Week 4</option>
                <option value="5">Week 5</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Allocation Note / Description
            </label>
            <input
              type="text"
              placeholder="e.g. Sprint 3 Canvas rendering milestone allocation"
              value={allocDesc}
              onChange={(e) => setAllocDesc(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAllocateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="lime" size="sm">
              Confirm Allocation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Request Budget Increase from CFO */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="Request Project Budget Increase from CFO"
      >
        <form onSubmit={handleRequestSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Project <span className="text-rose-500">*</span>
            </label>
            <select
              value={reqProjectId}
              onChange={(e) => setReqProjectId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {teamProjects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} ({proj.code}) — Current Budget: {formatCurrency(proj.budget)}
                </option>
              ))}
            </select>
          </div>

          <MoneyInput
            label="Requested Increase Amount (BDT)"
            min={500}
            value={reqAmount}
            onChangeDigits={(val) => setReqAmount(String(val))}
            required
          />

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Business & Technical Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={reqReason}
              onChange={(e) => setReqReason(e.target.value)}
              placeholder="Explain why this budget increase is required (e.g. additional infrastructure stress testing nodes, third-party API quotas, scope expansion)..."
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsRequestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="lime" size="sm" icon={Send}>
              Send Request to CFO
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PmBudgetFinancePage
