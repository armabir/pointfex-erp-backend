import { useState, useMemo } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { StatusPill } from '../../components/common/StatusPill'
import { useCtoData } from '../../hooks/useCtoData'
import { formatCurrency, formatDate } from '../../utils/formatters'
import {
  Wallet,
  ShieldCheck,
  AlertTriangle,
  ShoppingBag,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react'

export function CtoEarningsPage() {
  const { ctoWallet, ctoTransactions } = useCtoData()
  const [filterType, setFilterType] = useState<'all' | 'payout' | 'penalty'>('all')

  const totalPenalties = ctoWallet?.totalPenalties || 0
  const totalSpendings = ctoWallet?.totalSpendings || 0

  const filteredTransactions = useMemo(() => {
    return ctoTransactions.filter((tx) => {
      if (filterType === 'payout' && tx.type === 'penalty') return false
      if (filterType === 'penalty' && tx.type !== 'penalty') return false
      return true
    })
  }, [ctoTransactions, filterType])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
          Earnings & Virtual Wallet
        </h2>
      </div>

      {/* Top 4 Metric Cards: Balance, Total Earned, Penalty, Spendings (Matching Dev & PM) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Balance */}
        <div className="bg-[#fff8f2] dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/40 rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Balance</span>
            <div className="p-2 rounded-xl bg-amber-100/80 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">
            {formatCurrency(ctoWallet?.balance ?? 0)}
          </div>
          <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            Available in executive wallet
          </div>
        </div>

        {/* 2. Total Earned */}
        <div className="bg-[#f0fdf9] dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/40 rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Total Earned</span>
            <div className="p-2 rounded-xl bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">
            {formatCurrency(ctoWallet?.totalEarnedToDate ?? 0)}
          </div>
          <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            Cumulative executive earnings
          </div>
        </div>

        {/* 3. Penalty */}
        <div className="bg-[#fff1f2] dark:bg-rose-950/20 border border-rose-100/80 dark:border-rose-900/40 rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Penalty</span>
            <div className="p-2 rounded-xl bg-rose-100/80 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-display text-rose-600 dark:text-rose-400">
            -{formatCurrency(totalPenalties)}
          </div>
          <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3" />
            Deductions & SLA penalties
          </div>
        </div>

        {/* 4. Spendings */}
        <div className="bg-[#f2f7ff] dark:bg-sky-950/20 border border-sky-100/80 dark:border-sky-900/40 rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Spendings</span>
            <div className="p-2 rounded-xl bg-sky-100/80 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">
            {formatCurrency(totalSpendings)}
          </div>
          <div className="mt-2 text-[11px] text-sky-700 dark:text-sky-400 font-medium">
            Internal perk store (catalog coming soon)
          </div>
        </div>
      </div>

      {/* Transactions & Ledger */}
      <Card
        title="Ledger & Transactions"
        icon={Wallet}
        action={
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('payout')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'payout'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              Payouts
            </button>
            <button
              onClick={() => setFilterType('penalty')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'penalty'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              Penalties
            </button>
          </div>
        }
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-850">
                <th className="py-3 px-5 font-medium">Description</th>
                <th className="py-3 px-3 font-medium">Type</th>
                <th className="py-3 px-3 font-medium">Date</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-5 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPenalty = tx.type === 'penalty'

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          {isPenalty && (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          )}
                          <span>{tx.description}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={isPenalty ? 'rose' : tx.type === 'bonus' ? 'amber' : 'emerald'}
                          size="xs"
                        >
                          {isPenalty ? 'Penalty' : tx.type === 'bonus' ? 'Bonus' : 'Payout'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-400 dark:text-slate-500">
                        {formatDate(tx.date, 'short')}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <StatusPill status={tx.status} size="sm" />
                      </td>
                      <td
                        className={`py-3.5 px-5 whitespace-nowrap text-right font-semibold ${
                          isPenalty
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isPenalty
                          ? `-${formatCurrency(Math.abs(tx.amount))}`
                          : `+${formatCurrency(tx.amount)}`}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Performance Section below table */}
      <Card title="Performance & Engineering Oversight Metrics" icon={Award}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Metric 1: Quality Score */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Overall Quality</span>
              </div>
              <div className="text-2xl font-bold font-display text-slate-900 dark:text-white">
                98/100
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Executive Top Tier
              </div>
            </div>

            {/* Metric 2: On-Time Delivery */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>Architecture SLA</span>
              </div>
              <div className="text-2xl font-bold font-display text-slate-900 dark:text-white">
                100%
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Flawless Delivery
              </div>
            </div>

            {/* Metric 3: Weekly Velocity */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                <Zap className="w-4 h-4 text-lime-500" />
                <span>Division Velocity</span>
              </div>
              <div className="text-2xl font-bold font-display text-slate-900 dark:text-white">
                240 pts
              </div>
              <div className="text-[10px] text-lime-600 dark:text-lime-400 font-semibold">
                Across 6 Squads
              </div>
            </div>

            {/* Metric 4: PR Review Turnaround */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500 text-[11px] font-medium">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>PR Turnaround</span>
              </div>
              <div className="text-2xl font-bold font-display text-slate-900 dark:text-white">
                3.8 hrs
              </div>
              <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                Rapid Clearance
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
