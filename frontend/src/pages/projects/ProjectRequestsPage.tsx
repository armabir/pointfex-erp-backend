import { useCallback, useEffect, useState } from 'react'
import {
  FolderPlus,
  Vote,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Send,
  Crown,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { MfaConfirmModal } from '../../components/common/MfaConfirmModal'
import { formatDate } from '../../utils/formatters'
import { formatBDT } from '../../utils/money'
import { EmptyState } from '../../components/common/EmptyState'
import { SkeletonCard } from '../../components/common/Skeleton'

const STEPS = [
  'Details & Scope',
  'Deliverables & Timeline',
  'Team Staffing',
  'Risks & Success',
  'Budget & Justification',
]

export function ProjectRequestsPage() {
  const { showToast, currentUser } = useApp()
  const { can, canAny } = usePermissions()

  const isCeo =
    currentUser?.role === 'system:root' ||
    Boolean((currentUser as any)?.roles?.includes('system:root'))
  const canCastVote = can('votes:cast') || isCeo
  const canCreateRequest = canAny(['projects:request', 'projects:create']) || isCeo

  const [activeTab, setActiveTab] = useState<'queue' | 'new'>('queue')
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Stepper State
  const [currentStep, setCurrentStep] = useState(0)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState('')
  const [deliverables, setDeliverables] = useState('')
  const [targetCompletionDate, setTargetCompletionDate] = useState('')
  const [pmId, setPmId] = useState('')
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const [risks, setRisks] = useState('')
  const [successCriteria, setSuccessCriteria] = useState('')
  const [businessJustification, setBusinessJustification] = useState('')
  const [initialBudgetBDT, setInitialBudgetBDT] = useState<number>(500000)
  const [urgency, setUrgency] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const voteDeadlineDays = 7
  const [isSubmitting, setIsSubmitting] = useState(false)

  // MFA Confirm State for Voting or Override
  const [voteTarget, setVoteTarget] = useState<{
    request: any
    choice: 'APPROVE' | 'REJECT'
  } | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<{
    request: any
    decision: 'APPROVE' | 'REJECT'
  } | null>(null)
  const [isVoting, setIsVoting] = useState(false)

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await erpApi.listProjectCreationRequests()
      setRequests(Array.isArray(res) ? res : [])
    } catch (err: any) {
      showToast(err?.message || 'Failed to load project requests.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const handleNextStep = () => {
    if (currentStep === 0 && (!name.trim() || !code.trim())) {
      showToast('Project name and code are required.', 'error')
      return
    }
    if (currentStep === 1 && !targetCompletionDate) {
      showToast('Target completion date is required.', 'error')
      return
    }
    setCurrentStep((prev) => Math.min(STEPS.length - 1, prev + 1))
  }

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  const handleSubmitRequest = async (mfaCode?: string) => {
    if (businessJustification.trim().length < 20) {
      showToast('Business justification must be at least 20 characters.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        scope: scope.trim(),
        deliverables: deliverables.trim(),
        targetCompletionDate,
        pmId: pmId || undefined,
        teamMemberIds,
        risks: risks.trim(),
        successCriteria: successCriteria.trim(),
        businessJustification: businessJustification.trim(),
        initialBudgetBDT: Number(initialBudgetBDT),
        urgency,
        voteDeadlineDays,
      }

      await erpApi.createProjectCreationRequest(payload, mfaCode)
      showToast(
        isCeo
          ? 'Project approved and created immediately in Planning under CEO direct power.'
          : 'Project request submitted for Executive Voting.',
        'success',
      )
      // Reset form
      setName('')
      setCode('')
      setDescription('')
      setScope('')
      setDeliverables('')
      setTargetCompletionDate('')
      setRisks('')
      setSuccessCriteria('')
      setBusinessJustification('')
      setCurrentStep(0)
      setActiveTab('queue')
      void loadRequests()
    } catch (err: any) {
      showToast(err?.message || 'Submission failed.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const executeCastVote = async (mfaCode: string, reason?: string) => {
    if (!voteTarget) return
    setIsVoting(true)
    try {
      await erpApi.castVoteOnProjectRequest(
        voteTarget.request.id,
        { choice: voteTarget.choice, reason },
        mfaCode,
      )
      showToast(`Vote cast: ${voteTarget.choice}.`, 'success')
      setVoteTarget(null)
      void loadRequests()
    } finally {
      setIsVoting(false)
    }
  }

  const executeCeoOverride = async (mfaCode: string, reason?: string) => {
    if (!overrideTarget) return
    setIsVoting(true)
    try {
      await erpApi.decideProjectCreationRequest(
        overrideTarget.request.id,
        {
          decision: overrideTarget.decision,
          reason: reason || 'CEO Direct Override',
        },
        mfaCode,
      )
      showToast(`CEO Override applied: Project ${overrideTarget.decision}D.`, 'success')
      setOverrideTarget(null)
      void loadRequests()
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Governance &amp; Voting"
        subtitle="Executive voting engine for project proposals, initial BDT budget allocations, and CEO direct oversight."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'queue' ? 'primary' : 'secondary'}
              size="sm"
              icon={Vote}
              onClick={() => setActiveTab('queue')}
            >
              Voting Queue ({requests.filter((r) => r.status === 'VOTING').length})
            </Button>
            {canCreateRequest && (
              <Button
                variant={activeTab === 'new' ? 'primary' : 'secondary'}
                size="sm"
                icon={FolderPlus}
                onClick={() => setActiveTab('new')}
              >
                New Project Request
              </Button>
            )}
          </div>
        }
      />

      {activeTab === 'queue' ? (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <EmptyState
                icon={Vote}
                title="No active project voting requests"
                description="Project proposals awaiting Executive voting will appear here."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const totalEligible = req.totalEligibleVoters || 1
                const approveVotes = (req.votes || []).filter((v: any) => v.choice === 'APPROVE').length
                const rejectVotes = (req.votes || []).filter((v: any) => v.choice === 'REJECT').length
                const approvePct = Math.round((approveVotes / totalEligible) * 100)
                const neededVotes = Math.floor(totalEligible / 2) + 1
                const myVote = (req.votes || []).find((v: any) => v.voterId === currentUser?.id)

                return (
                  <Card key={req.id} className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--muted)] border border-[var(--border)]">
                            {req.code}
                          </span>
                          <h3 className="font-semibold text-base text-[var(--text)]">{req.name}</h3>
                          <Badge
                            variant={
                              req.status === 'APPROVED'
                                ? 'success'
                                : req.status === 'REJECTED' || req.status === 'EXPIRED'
                                  ? 'danger'
                                  : 'warning'
                            }
                            size="xs"
                          >
                            {req.status}
                          </Badge>
                          <Badge variant="indigo" size="xs">
                            {req.urgency} URGENCY
                          </Badge>
                        </div>
                        <p className="text-[13px] text-[var(--muted)]">{req.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-medium text-[var(--muted)]">Initial Budget</p>
                        <p className="text-lg font-bold text-[var(--text)] text-emerald-600 dark:text-emerald-400">
                          {formatBDT(req.initialBudgetBDT)}
                        </p>
                      </div>
                    </div>

                    {/* Voting Progress Bar */}
                    <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold text-[var(--text)]">
                          Executive Vote Tally: {approveVotes} Approve · {rejectVotes} Reject · {totalEligible} Eligible
                        </span>
                        <span className="text-[var(--muted)]">
                          {neededVotes} votes needed to pass ({approvePct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[var(--surface-muted)] overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all"
                          style={{ width: `${(approveVotes / totalEligible) * 100}%` }}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all"
                          style={{ width: `${(rejectVotes / totalEligible) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1">
                        <span>
                          Requester: {req.requester?.name || req.requesterId}
                          {req.proposedByDeveloper && ` (Developer Proposal: ${req.proposedByDeveloper.name})`}
                        </span>
                        {req.voteDeadline && (
                          <span className="flex items-center gap-1 text-[var(--warning)]">
                            <Clock className="w-3 h-3" />
                            Vote Closes: {formatDate(req.voteDeadline, 'short')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    {req.status === 'VOTING' && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                        <div>
                          {myVote ? (
                            <span className="text-[12px] text-[var(--muted)]">
                              You voted: <strong className={myVote.choice === 'APPROVE' ? 'text-emerald-500' : 'text-rose-500'}>{myVote.choice}</strong>. You may update your vote until closure.
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--muted)]">
                              Fresh 6-digit MFA code required to cast executive vote.
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {canCastVote && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={XCircle}
                                onClick={() => setVoteTarget({ request: req, choice: 'REJECT' })}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                icon={CheckCircle2}
                                onClick={() => setVoteTarget({ request: req, choice: 'APPROVE' })}
                              >
                                Approve
                              </Button>
                            </>
                          )}

                          {isCeo && (
                            <div className="pl-2 border-l border-[var(--border)] flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="danger"
                                icon={Crown}
                                onClick={() =>
                                  setOverrideTarget({ request: req, decision: 'REJECT' })
                                }
                              >
                                CEO Override (Reject)
                              </Button>
                              <Button
                                size="sm"
                                variant="lime"
                                icon={Crown}
                                onClick={() =>
                                  setOverrideTarget({ request: req, decision: 'APPROVE' })
                                }
                              >
                                CEO Override (Approve)
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Stepper Form */
        <Card className="p-6 space-y-6 max-w-3xl mx-auto">
          {/* Stepper Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            {STEPS.map((stepLabel, idx) => {
              const isActive = idx === currentStep
              const isPast = idx < currentStep
              return (
                <div key={stepLabel} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isActive
                        ? 'bg-[var(--primary)] text-white ring-4 ring-[var(--primary)]/20'
                        : isPast
                          ? 'bg-emerald-500 text-white'
                          : 'bg-[var(--surface-muted)] text-[var(--muted)]'
                    }`}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isActive ? 'text-[var(--text)] font-bold' : 'text-[var(--muted)]'
                    }`}
                  >
                    {stepLabel}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Step 1: Details & Scope */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-[var(--text)]">Project Details &amp; Scope</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. NextGen Core Banking"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                    Project Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. PRJ-BANK"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Executive Overview
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="High-level description of what this project aims to achieve..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Scope Boundaries
                </label>
                <textarea
                  rows={2}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="Define what is explicitly in-scope and out-of-scope..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            </div>
          )}

          {/* Step 2: Deliverables & Timeline */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-[var(--text)]">Deliverables &amp; Timeline</h3>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Key Deliverables
                </label>
                <textarea
                  rows={3}
                  value={deliverables}
                  onChange={(e) => setDeliverables(e.target.value)}
                  placeholder="List verifiable milestones and architectural deliverables..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Target Completion Date * (Asia/Dhaka)
                </label>
                <input
                  type="date"
                  required
                  value={targetCompletionDate}
                  onChange={(e) => setTargetCompletionDate(e.target.value)}
                  className="w-full sm:w-64 px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            </div>
          )}

          {/* Step 3: Team Staffing */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-[var(--text)]">Team &amp; Leadership</h3>
              <p className="text-xs text-[var(--muted)]">
                Assign initial leadership and cross-functional capacity for this initiative.
              </p>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Lead Project Manager (ID or Name)
                </label>
                <input
                  type="text"
                  value={pmId}
                  onChange={(e) => setPmId(e.target.value)}
                  placeholder="Assign PM..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Assigned Team Staff / Squads (comma separated)
                </label>
                <input
                  type="text"
                  value={teamMemberIds.join(', ')}
                  onChange={(e) =>
                    setTeamMemberIds(
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="e.g. dev_01, dev_02, squad_alpha"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            </div>
          )}

          {/* Step 4: Risks & Success */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-[var(--text)]">Risks &amp; Success Criteria</h3>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Identified Risks &amp; Mitigation Strategy
                </label>
                <textarea
                  rows={2}
                  value={risks}
                  onChange={(e) => setRisks(e.target.value)}
                  placeholder="Dependencies, technical hurdles, and mitigation plans..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Measurable Success Criteria
                </label>
                <textarea
                  rows={2}
                  value={successCriteria}
                  onChange={(e) => setSuccessCriteria(e.target.value)}
                  placeholder="KPIs, latency reductions, user targets, or deliverables..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            </div>
          )}

          {/* Step 5: Budget & Justification */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-[var(--text)]">Initial Budget &amp; Business Case</h3>
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300">
                <strong>Governance Rule:</strong> This stepper is the ONLY place where a project's initial budget is allocated. Subsequent increases require an Executive Budget Request.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                    Initial Budget (BDT) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    required
                    value={initialBudgetBDT}
                    onChange={(e) => setInitialBudgetBDT(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-semibold"
                  />
                  <span className="text-[11px] text-[var(--muted)] mt-1 inline-block">
                    {formatBDT(initialBudgetBDT)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                    Urgency Level
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] cursor-pointer"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Business Justification * (minimum 20 characters)
                </label>
                <textarea
                  rows={3}
                  required
                  value={businessJustification}
                  onChange={(e) => setBusinessJustification(e.target.value)}
                  placeholder="Detail the expected ROI, strategic alignment, and operational necessity..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
                />
                {businessJustification.trim().length > 0 && businessJustification.trim().length < 20 && (
                  <p className="text-[11px] text-[var(--warning)] mt-1">
                    {20 - businessJustification.trim().length} more character(s) required.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
            <Button
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
              disabled={currentStep === 0 || isSubmitting}
              onClick={handlePrevStep}
            >
              Back
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button variant="primary" size="sm" icon={ChevronRight} onClick={handleNextStep}>
                Next Step
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={Send}
                disabled={businessJustification.trim().length < 20 || isSubmitting}
                onClick={() => void handleSubmitRequest()}
              >
                {isSubmitting
                  ? 'Submitting...'
                  : isCeo
                    ? 'Approve & Create Project (Immediate)'
                    : 'Submit for Executive Voting'}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* MFA Modal for Casting Vote */}
      {voteTarget && (
        <MfaConfirmModal
          isOpen={!!voteTarget}
          onClose={() => setVoteTarget(null)}
          onConfirm={({ mfaCode, reason }) => void executeCastVote(mfaCode, reason)}
          isSubmitting={isVoting}
          title={`Cast Executive Vote: ${voteTarget.choice}`}
          actionSummary={`Record immutable vote ${voteTarget.choice} for project "${voteTarget.request.name}" (${voteTarget.request.code}).`}
          requiresReason={false}
          confirmLabel={`Submit Vote (${voteTarget.choice})`}
        />
      )}

      {/* MFA Modal for CEO Override */}
      {overrideTarget && (
        <MfaConfirmModal
          isOpen={!!overrideTarget}
          onClose={() => setOverrideTarget(null)}
          onConfirm={({ mfaCode, reason }) => void executeCeoOverride(mfaCode, reason)}
          isSubmitting={isVoting}
          isCritical
          title={`CEO Direct Override: ${overrideTarget.decision}`}
          actionSummary={`Under CEO emergency authority, directly ${overrideTarget.decision} project "${overrideTarget.request.name}" immediately, bypassing remaining vote deadlines.`}
          requiresReason={true}
          confirmLabel={`Execute CEO Override (${overrideTarget.decision})`}
        />
      )}
    </div>
  )
}
