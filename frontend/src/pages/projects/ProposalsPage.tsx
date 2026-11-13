import { useCallback, useEffect, useState } from 'react'
import {
  Lightbulb,
  Send,
  CornerUpRight,
  RotateCcw,
  XCircle,
  ShieldAlert,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { EmptyState } from '../../components/common/EmptyState'
import { SkeletonCard } from '../../components/common/Skeleton'
import { formatDate } from '../../utils/formatters'

export function ProposalsPage() {
  const { showToast, currentUser, data } = useApp()
  const { canAny } = usePermissions()

  const canForward = canAny(['projects:propose', 'projects:request', 'projects:create'])
  const [activeTab, setActiveTab] = useState<'my' | 'inbox' | 'submit'>('my')

  const [myProposals, setMyProposals] = useState<any[]>([])
  const [inboxProposals, setInboxProposals] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Submit Form State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('FEATURE')
  const [targetManagerId, setTargetManagerId] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [proposedSolution, setProposedSolution] = useState('')
  const [expectedBenefits, setExpectedBenefits] = useState('')
  const [isConfidentialGrievance, setIsConfidentialGrievance] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Review State
  const [reviewAction, setReviewAction] = useState<{
    proposal: any
    action: 'FORWARD' | 'RETURN' | 'DECLINE'
  } | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [initialBudget, setInitialBudget] = useState<number>(300000)
  const [isReviewing, setIsReviewing] = useState(false)

  const loadProposals = useCallback(async () => {
    setIsLoading(true)
    try {
      const [myRes, inboxRes] = await Promise.all([
        erpApi.listProjectProposals({ role: 'requester' }).catch(() => []),
        canForward
          ? erpApi.listProjectProposals({ role: 'reviewer' }).catch(() => [])
          : Promise.resolve([]),
      ])
      setMyProposals(Array.isArray(myRes) ? myRes : [])
      setInboxProposals(Array.isArray(inboxRes) ? inboxRes : [])
    } catch (err: any) {
      showToast(err?.message || 'Failed to load proposals.', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [canForward, showToast])

  useEffect(() => {
    void loadProposals()
  }, [loadProposals])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !problemStatement.trim() || !proposedSolution.trim()) {
      showToast('Please fill out all required fields.', 'error')
      return
    }
    if (!isConfidentialGrievance && !targetManagerId) {
      showToast('Please select a reviewing Project Manager or Squad Lead.', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      await erpApi.createProjectProposal({
        title: title.trim(),
        category,
        targetManagerId: isConfidentialGrievance ? 'hr-direct' : targetManagerId,
        problemStatement: problemStatement.trim(),
        proposedSolution: proposedSolution.trim(),
        expectedBenefits: expectedBenefits.trim(),
        isConfidentialGrievance,
      })

      showToast(
        isConfidentialGrievance
          ? 'Confidential report sent directly to HR leadership. PM bypassed.'
          : 'Proposal submitted to Project Manager.',
        'success',
      )
      setTitle('')
      setProblemStatement('')
      setProposedSolution('')
      setExpectedBenefits('')
      setIsConfidentialGrievance(false)
      setActiveTab('my')
      void loadProposals()
    } catch (err: any) {
      showToast(err?.message || 'Submission failed.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExecuteReview = async () => {
    if (!reviewAction) return
    if (reviewNotes.trim().length < 5) {
      showToast('Review notes must be at least 5 characters.', 'error')
      return
    }
    setIsReviewing(true)
    try {
      await erpApi.reviewProjectProposal(reviewAction.proposal.id, {
        action: reviewAction.action,
        reviewNotes: reviewNotes.trim(),
        initialBudget: reviewAction.action === 'FORWARD' ? initialBudget : undefined,
      })
      showToast(
        reviewAction.action === 'FORWARD'
          ? 'Proposal forwarded to Executive Voting with developer credit.'
          : `Proposal ${reviewAction.action === 'RETURN' ? 'returned for revision' : 'declined'}.`,
        'success',
      )
      setReviewAction(null)
      setReviewNotes('')
      void loadProposals()
    } catch (err: any) {
      showToast(err?.message || 'Review action failed.', 'error')
    } finally {
      setIsReviewing(false)
    }
  }

  const managers = data.users.filter(
    (u) =>
      u.id !== currentUser?.id &&
      (u.role === 'pm' || u.role === 'cto' || u.role === 'cpo' || u.title?.toLowerCase().includes('manager')),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Proposals &amp; Ideas"
        subtitle="Submit technical proposals, architectural improvements, or confidential workplace reports."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'my' ? 'primary' : 'secondary'}
              size="sm"
              icon={Lightbulb}
              onClick={() => setActiveTab('my')}
            >
              My Proposals ({myProposals.length})
            </Button>
            {canForward && (
              <Button
                variant={activeTab === 'inbox' ? 'primary' : 'secondary'}
                size="sm"
                icon={CornerUpRight}
                onClick={() => setActiveTab('inbox')}
              >
                Manager Triage ({inboxProposals.filter((p) => p.status === 'SUBMITTED').length})
              </Button>
            )}
            <Button
              variant={activeTab === 'submit' ? 'primary' : 'secondary'}
              size="sm"
              icon={Send}
              onClick={() => setActiveTab('submit')}
            >
              Submit Idea
            </Button>
          </div>
        }
      />

      {activeTab === 'my' ? (
        <div className="space-y-4">
          {isLoading ? (
            <SkeletonCard />
          ) : myProposals.length === 0 ? (
            <Card>
              <EmptyState
                icon={Lightbulb}
                title="No proposals submitted yet"
                description="Have an architectural optimization or feature proposal? Submit it for PM triage and executive backing."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {myProposals.map((prop) => (
                <Card key={prop.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[var(--text)]">{prop.title}</span>
                        <Badge
                          variant={
                            prop.status === 'FORWARDED'
                              ? 'success'
                              : prop.status === 'RETURNED'
                                ? 'warning'
                                : prop.status === 'DECLINED'
                                  ? 'danger'
                                  : 'indigo'
                          }
                          size="xs"
                        >
                          {prop.status}
                        </Badge>
                        {prop.isConfidentialGrievance && (
                          <Badge variant="danger" size="xs">
                            <Lock className="w-3 h-3 inline mr-1" />
                            Confidential HR Report
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Reviewed by: {prop.targetManager?.name || prop.targetManagerId || 'HR Leadership'} · Submitted {formatDate(prop.createdAt, 'short')}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs space-y-1.5">
                    <p>
                      <strong>Problem:</strong> {prop.problemStatement}
                    </p>
                    <p>
                      <strong>Proposed Solution:</strong> {prop.proposedSolution}
                    </p>
                    {prop.expectedBenefits && (
                      <p>
                        <strong>Expected Benefits:</strong> {prop.expectedBenefits}
                      </p>
                    )}
                  </div>

                  {prop.reviewNotes && (
                    <div className="p-2.5 rounded-lg bg-[var(--surface-muted)] text-xs border border-[var(--border)]">
                      <span className="font-semibold text-[var(--text)]">Manager Feedback: </span>
                      <span className="text-[var(--muted)]">"{prop.reviewNotes}"</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'inbox' ? (
        <div className="space-y-4">
          {isLoading ? (
            <SkeletonCard />
          ) : inboxProposals.length === 0 ? (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title="Triage inbox empty"
                description="No team proposals are currently awaiting your evaluation."
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {inboxProposals.map((prop) => (
                <Card key={prop.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base text-[var(--text)]">{prop.title}</span>
                        <Badge variant="indigo" size="xs">
                          {prop.category || 'TECHNICAL'}
                        </Badge>
                        <Badge variant={prop.status === 'SUBMITTED' ? 'warning' : 'default'} size="xs">
                          {prop.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Submitted by: <strong className="text-[var(--text)]">{prop.requester?.name || prop.requesterId}</strong> ({prop.requester?.title || 'Developer'}) · {formatDate(prop.createdAt, 'short')}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-xs space-y-2">
                    <p>
                      <strong className="text-[var(--text)]">Problem Statement:</strong>{' '}
                      <span className="text-[var(--muted)]">{prop.problemStatement}</span>
                    </p>
                    <p>
                      <strong className="text-[var(--text)]">Proposed Solution:</strong>{' '}
                      <span className="text-[var(--muted)]">{prop.proposedSolution}</span>
                    </p>
                    {prop.expectedBenefits && (
                      <p>
                        <strong className="text-[var(--text)]">Expected Benefits:</strong>{' '}
                        <span className="text-[var(--muted)]">{prop.expectedBenefits}</span>
                      </p>
                    )}
                  </div>

                  {prop.status === 'SUBMITTED' && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={XCircle}
                        onClick={() => setReviewAction({ proposal: prop, action: 'DECLINE' })}
                      >
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={RotateCcw}
                        onClick={() => setReviewAction({ proposal: prop, action: 'RETURN' })}
                      >
                        Return with Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={CornerUpRight}
                        onClick={() => setReviewAction({ proposal: prop, action: 'FORWARD' })}
                      >
                        Forward to Executive Vote
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Submit Idea Form */
        <Card className="p-6 max-w-2xl mx-auto space-y-4">
          <h3 className="font-semibold text-base text-[var(--text)]">Submit Engineering Proposal</h3>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[var(--muted)] mb-1">Proposal Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Migrate Session Store to Redis Cluster"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-[var(--muted)] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] cursor-pointer"
                >
                  <option value="ARCHITECTURE">Architecture &amp; Infra</option>
                  <option value="FEATURE">Product Feature</option>
                  <option value="DEV_EXPERIENCE">Developer Experience</option>
                  <option value="PROCESS">Process Improvement</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[var(--muted)] mb-1">
                  Target Project Manager / Squad Lead
                </label>
                <select
                  disabled={isConfidentialGrievance}
                  value={targetManagerId}
                  onChange={(e) => setTargetManagerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] cursor-pointer disabled:opacity-50"
                >
                  <option value="">Select Reviewing Manager...</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.title})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Confidential Grievance Checkbox */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isConfidentialGrievance}
                    onChange={(e) => setIsConfidentialGrievance(e.target.checked)}
                    className="rounded border-[var(--border)] cursor-pointer"
                  />
                  <span>Confidential Workplace Grievance (Bypass PM directly to HR)</span>
                </label>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  When checked, this submission is routed confidentially to HR leadership and CHRO. Your direct Project Manager and squad will not see it.
                </p>
              </div>
            </div>

            <div>
              <label className="block font-medium text-[var(--muted)] mb-1">
                Problem Statement *
              </label>
              <textarea
                rows={3}
                required
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="What operational pain point, technical bottleneck, or opportunity does this address?"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="block font-medium text-[var(--muted)] mb-1">
                Proposed Technical Solution *
              </label>
              <textarea
                rows={3}
                required
                value={proposedSolution}
                onChange={(e) => setProposedSolution(e.target.value)}
                placeholder="How do you propose solving this? Detail architectural concepts and implementation path..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="block font-medium text-[var(--muted)] mb-1">
                Expected Benefits &amp; Impact
              </label>
              <textarea
                rows={2}
                value={expectedBenefits}
                onChange={(e) => setExpectedBenefits(e.target.value)}
                placeholder="Expected latency improvements, developer time saved, or business value..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" icon={Send} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Review Modal */}
      {reviewAction && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full space-y-4">
            <h4 className="font-bold text-base text-[var(--text)]">
              {reviewAction.action === 'FORWARD'
                ? 'Forward Proposal to Executive Vote'
                : reviewAction.action === 'RETURN'
                  ? 'Return Proposal for Revision'
                  : 'Decline Proposal'}
            </h4>
            <p className="text-xs text-[var(--muted)]">
              {reviewAction.action === 'FORWARD'
                ? `Initiates an Executive Voting project request for "${reviewAction.proposal.title}". Developer ${reviewAction.proposal.requester?.name || 'requester'} will be credited as original ideator.`
                : `Provide actionable guidance for ${reviewAction.proposal.requester?.name || 'the requester'}.`}
            </p>

            {reviewAction.action === 'FORWARD' && (
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Proposed Initial Budget (BDT)
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={initialBudget}
                  onChange={(e) => setInitialBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                Feedback &amp; Rationale * (minimum 5 characters)
              </label>
              <textarea
                rows={3}
                required
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Explain why this is being forwarded, returned, or declined..."
                className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReviewAction(null)}
                disabled={isReviewing}
              >
                Cancel
              </Button>
              <Button
                variant={reviewAction.action === 'DECLINE' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleExecuteReview}
                disabled={reviewNotes.trim().length < 5 || isReviewing}
              >
                {isReviewing ? 'Processing...' : 'Confirm Decision'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
