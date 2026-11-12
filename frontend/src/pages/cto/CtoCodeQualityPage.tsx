import { useState } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { useCtoData } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import type { PullRequest } from '../../types'
import { GitPullRequest, ShieldCheck, Zap, Clock, GitMerge } from 'lucide-react'

export function CtoCodeQualityPage() {
  const { pullRequests, codeQualityGates, projects } = useCtoData()
  const { reviewPullRequest } = useApp()

  const [activeTab, setActiveTab] = useState<'prs' | 'quality_gates'>('prs')
  const [prFilter, setPrFilter] = useState<string>('all')
  const [selectedPr, setSelectedPr] = useState<PullRequest | null>(null)
  const [reviewComment, setReviewComment] = useState('')

  const filteredPrs = pullRequests.filter((pr) => {
    if (prFilter !== 'all' && pr.status !== prFilter) return false
    return true
  })

  const handlePrAction = (action: 'approved' | 'merged' | 'changes_requested') => {
    if (!selectedPr) return
    reviewPullRequest(selectedPr.id, action)
    setSelectedPr(null)
    setReviewComment('')
  }

  const getPrStatusBadge = (status: string) => {
    switch (status) {
      case 'merged':
        return (
          <Badge variant="purple" size="xs">
            Merged
          </Badge>
        )
      case 'approved':
        return (
          <Badge variant="emerald" size="xs">
            Approved
          </Badge>
        )
      case 'in_review':
        return (
          <Badge variant="sky" size="xs">
            In Review
          </Badge>
        )
      case 'changes_requested':
        return (
          <Badge variant="rose" size="xs">
            Changes Requested
          </Badge>
        )
      default:
        return (
          <Badge variant="slate" size="xs">
            Open
          </Badge>
        )
    }
  }

  const avgQuality = Math.round(
    codeQualityGates.reduce((acc, g) => acc + g.complianceScore, 0) /
      (codeQualityGates.length || 1),
  )
  const avgCoverage = Math.round(
    codeQualityGates.reduce((acc, g) => acc + g.testCoverage, 0) / (codeQualityGates.length || 1),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Code Review & Quality Gates
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="emerald" size="sm" dot>
            {avgQuality}% Avg Quality Score
          </Badge>
          <Badge variant="indigo" size="sm">
            {avgCoverage}% Test Coverage
          </Badge>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <GitPullRequest className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {pullRequests.length}
            </div>
            <div className="text-[11px] text-slate-400">Total PRs</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {avgCoverage}%
            </div>
            <div className="text-[11px] text-slate-400">Test Coverage</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-950/40 text-lime-600 dark:text-lime-400 flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              100% Passed
            </div>
            <div className="text-[11px] text-slate-400">Quality Gates</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">18.4 hrs</div>
            <div className="text-[11px] text-slate-400">Technical Debt</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('prs')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'prs'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <GitPullRequest className="w-3.5 h-3.5" />
          Pull Requests Review ({pullRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('quality_gates')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'quality_gates'
              ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Sonar Quality Gates ({codeQualityGates.length})
        </button>
      </div>

      {/* Tab 1: Pull Requests */}
      {activeTab === 'prs' && (
        <div className="space-y-4">
          {/* PR Filter Pills */}
          <div className="flex items-center gap-1.5">
            {['all', 'open', 'in_review', 'approved', 'merged'].map((f) => (
              <button
                key={f}
                onClick={() => setPrFilter(f)}
                className={`px-3 py-1 rounded-xl text-xs font-medium capitalize transition-colors ${
                  prFilter === f
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredPrs.map((pr) => {
              const project = projects.find((p) => p.id === pr.projectId)

              return (
                <div
                  key={pr.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="indigo" size="xs">
                        {project?.code || 'REPO'}
                      </Badge>
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {pr.title}
                      </span>
                      {getPrStatusBadge(pr.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                        {pr.branch} → {pr.baseBranch}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                        +{pr.additions}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 font-mono">
                        -{pr.deletions}
                      </span>
                      {pr.qualityScore && (
                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                          Sonar: {pr.qualityScore}/100
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="primary" size="xs" onClick={() => setSelectedPr(pr)}>
                      Review PR
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Sonar Quality Gates */}
      {activeTab === 'quality_gates' && (
        <Card title="Project Quality Scorecards & Maintainability" icon={ShieldCheck}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold text-[11px]">
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Quality Score</th>
                  <th className="py-2.5 px-3">Test Coverage</th>
                  <th className="py-2.5 px-3">Bugs</th>
                  <th className="py-2.5 px-3">Code Smells</th>
                  <th className="py-2.5 px-3">Vulnerabilities</th>
                  <th className="py-2.5 px-3">Tech Debt</th>
                  <th className="py-2.5 px-3">Gate Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {codeQualityGates.map((gate) => {
                  const project = projects.find((p) => p.id === gate.projectId)

                  return (
                    <tr
                      key={gate.projectId}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {project?.code} — {project?.name}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={gate.complianceScore >= 95 ? 'emerald' : 'amber'} size="xs">
                          {gate.complianceScore}/100
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-sky-500 h-1.5 rounded-full"
                              style={{ width: `${gate.testCoverage}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {gate.testCoverage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-mono ${gate.bugsDetected > 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}
                        >
                          {gate.bugsDetected}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">{gate.codeSmellsCount}</td>
                      <td className="py-3 px-3">
                        {gate.vulnerabilitiesCount > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            {gate.vulnerabilitiesCount} Alert
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {gate.techDebtHours} hrs
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            gate.status === 'passed'
                              ? 'emerald'
                              : gate.status === 'warning'
                                ? 'amber'
                                : 'rose'
                          }
                          size="xs"
                        >
                          {gate.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
                {codeQualityGates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                      No code quality telemetry records available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Review PR Modal */}
      <Modal
        isOpen={!!selectedPr}
        onClose={() => setSelectedPr(null)}
        title={selectedPr ? `Review PR: ${selectedPr.title}` : 'Review'}
      >
        {selectedPr && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Branch: <span className="font-mono">{selectedPr.branch}</span> into{' '}
                <span className="font-mono">{selectedPr.baseBranch}</span>
              </div>
              <div className="text-slate-500">
                Diff: +{selectedPr.additions} lines / -{selectedPr.deletions} lines
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Executive Review Comments (optional)
              </label>
              <textarea
                rows={3}
                placeholder="Architecture feedback, security sign-off note, or requested changes..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500 resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => setSelectedPr(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handlePrAction('changes_requested')}
              >
                Request Changes
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handlePrAction('approved')}>
                Approve
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={GitMerge}
                onClick={() => handlePrAction('merged')}
              >
                Approve & Merge
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
