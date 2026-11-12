import React, { useState } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { StatusPill } from '../../components/common/StatusPill'
import { usePmData } from '../../hooks/usePmData'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/formatters'
import type { Report } from '../../types'
import {
  Send,
  Lightbulb,
  AlertTriangle,
  ExternalLink,
  FileText,
  UserCheck,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react'

export function PmReportsPage() {
  const { pm, team, resolvers } = usePmData()
  const { data, addSubmission, addComplaint, forwardSubmissionToCLevel, updateComplaintStatus } =
    useApp()

  const [activeTab, setActiveTab] = useState<
    'submission' | 'complaint' | 'review_dev' | 'team_complaints'
  >('submission')

  // Form State: New Project Idea Submission (Same as Dev)
  const [projectTitle, setProjectTitle] = useState('')
  const [docsUrl, setDocsUrl] = useState('')
  const [projectDesc, setProjectDesc] = useState('')

  // Form State: General Complaint (Same as Dev)
  const [complainTo, setComplainTo] = useState('Chief Technology Officer (CTO)')
  const [complaintTitle, setComplaintTitle] = useState('')
  const [complaintDesc, setComplaintDesc] = useState('')

  // Forwarding State for Developer Submissions
  const [forwardingId, setForwardingId] = useState<string | null>(null)
  const [forwardRecipient, setForwardRecipient] = useState('Chief Technology Officer (CTO)')
  const [forwardEndorsement, setForwardEndorsement] = useState('')

  // Responding to Developer Complaints
  const [respondingComplaintId, setRespondingComplaintId] = useState<string | null>(null)
  const [responseStatus, setResponseStatus] = useState<string>('under_investigation')
  const [responseComment, setResponseComment] = useState<string>('')

  const pmId = pm?.id || ''

  // Filter current PM's personal submissions & complaints
  const pmUserReports = data.reports.filter((r) => r.userId === pmId)
  const pmProjectSubmissions = pmUserReports.filter((r) => r.type === 'project_submission')
  const pmComplaints = pmUserReports.filter((r) => r.type === 'complaint')

  // Developer project submissions from PM's team
  const teamMemberIds = team?.memberIds || []
  const teamDevSubmissions = data.reports.filter(
    (r) =>
      r.type === 'project_submission' &&
      (teamMemberIds.includes(r.userId) || r.teamId === team?.id) &&
      r.userId !== pmId,
  )

  // Developer complaints routed to PM or from PM's team (excluding confidential CHRO/CEO grievances)
  const devComplaintsToPm = data.reports.filter(
    (r) =>
      r.type === 'complaint' &&
      !r.isConfidential &&
      !r.confidentialTo &&
      (r.complainTo?.toLowerCase().includes('pm') ||
        r.complainTo?.toLowerCase().includes('project manager') ||
        teamMemberIds.includes(r.userId)) &&
      r.userId !== pmId,
  )

  // Submit New Project Idea
  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pmId || !projectTitle.trim() || !docsUrl.trim() || !projectDesc.trim()) return

    const newReport: Report = {
      id: `pm_prop_${Date.now()}`,
      userId: pmId,
      teamId: team?.id || 'team_01',
      type: 'project_submission',
      title: projectTitle.trim(),
      docsUrl: docsUrl.trim(),
      description: projectDesc.trim(),
      date: new Date().toISOString().split('T')[0],
      submittedAt: new Date().toISOString(),
      status: 'pending_review',
      feedback: 'Awaiting C-Level Executive review and roadmap allocation.',
    }
    addSubmission(newReport)

    setProjectTitle('')
    setDocsUrl('')
    setProjectDesc('')
  }

  // Submit General Complaint
  const handleComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pmId || !complaintTitle.trim() || !complaintDesc.trim() || !complainTo.trim()) return

    const newComplaint: Report = {
      id: `pm_cmp_${Date.now()}`,
      userId: pmId,
      teamId: team?.id || 'team_01',
      type: 'complaint',
      complainTo: complainTo.trim(),
      title: complaintTitle.trim(),
      description: complaintDesc.trim(),
      date: new Date().toISOString().split('T')[0],
      submittedAt: new Date().toISOString(),
      status: 'pending',
      feedback: `Complaint logged and routed to ${complainTo.trim()}. Executive response pending.`,
    }
    addComplaint(newComplaint)

    setComplaintTitle('')
    setComplaintDesc('')
  }

  // Handle Forward Developer Submission to C-Level
  const handleConfirmForward = (submissionId: string) => {
    if (!forwardEndorsement.trim()) return
    forwardSubmissionToCLevel(submissionId, forwardRecipient, forwardEndorsement.trim())
    setForwardingId(null)
    setForwardEndorsement('')
  }

  // Handle PM response/status update to a developer complaint
  const handleSaveComplaintResponse = (complaintId: string) => {
    updateComplaintStatus(complaintId, responseStatus, responseComment.trim())
    setRespondingComplaintId(null)
    setResponseComment('')
  }

  return (
    <div className="space-y-6">
      {/* Header - Renamed to same as Dev */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
          Submissions & Complaints
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Submit new project ideas, file workplace grievances, or manage team developer complaints
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('submission')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'submission'
              ? 'bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          <span>New Project Submission</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 dark:bg-black/10">
            {pmProjectSubmissions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('complaint')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'complaint'
              ? 'bg-rose-600 text-white dark:bg-rose-500 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>General Complaint</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 dark:bg-black/10">
            {pmComplaints.length}
          </span>
        </button>

        {/* Developer Submissions to Review & Forward */}
        <button
          onClick={() => setActiveTab('review_dev')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'review_dev'
              ? 'bg-sky-600 text-white dark:bg-sky-500 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Forward Dev Ideas</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-sky-500/20 dark:bg-sky-900/60 font-bold">
            {teamDevSubmissions.length}
          </span>
        </button>

        {/* Developer Complaints to PM */}
        <button
          onClick={() => setActiveTab('team_complaints')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'team_complaints'
              ? 'bg-amber-600 text-white dark:bg-amber-500 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Dev Complaints to PM</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 dark:bg-amber-900/60 font-bold">
            {devComplaintsToPm.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activeTab === 'submission' && (
            /* New Project Idea Form - Exactly same as Dev */
            <Card title="Submit New Project Idea" icon={Lightbulb}>
              <form onSubmit={handleProjectSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Project Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Realtime Webhook Dispatcher Engine"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-850 focus:outline-none focus:border-slate-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Documentation Link (Google Docs, Notion, or Spec URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                      <FileText className="w-4 h-4" />
                    </span>
                    <input
                      type="url"
                      required
                      placeholder="https://docs.google.com/document/d/... or notion link"
                      value={docsUrl}
                      onChange={(e) => setDocsUrl(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-850 focus:outline-none focus:border-slate-400 font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Project Description & Architecture Overview
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe what this project accomplishes, problem statement, key dependencies, and expected business/engineering impact..."
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-850 focus:outline-none focus:border-slate-400 resize-none leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" variant="lime" size="sm" icon={Send}>
                    Submit Project Idea
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'complaint' && (
            /* General Complaint Form - Exactly same as Dev */
            <Card title="File General Complaint" icon={AlertTriangle}>
              <form onSubmit={handleComplaintSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Complain To
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                      <UserCheck className="w-4 h-4" />
                    </span>
                    <select
                      value={complainTo}
                      onChange={(e) => setComplainTo(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 cursor-pointer font-medium"
                    >
                      <option value="Chief Technology Officer (CTO)">
                        Chief Technology Officer (CTO)
                      </option>
                      <option value="Chief Financial Officer (CFO)">
                        Chief Financial Officer (CFO)
                      </option>
                      <option value="Chief People Officer (CPO)">
                        Chief People Officer (CPO / HR)
                      </option>
                      <option value="Chief Executive Officer (CEO)">
                        Chief Executive Officer (CEO)
                      </option>
                      <option value="Executive Management">Executive Management Committee</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Complaint Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Unclear sprint targets causing misaligned cross-team deliverables"
                    value={complaintTitle}
                    onChange={(e) => setComplaintTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-850 focus:outline-none focus:border-slate-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Detailed Description
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide details about the issue (e.g. cross-team dependency blocker, budget friction, or system blocker)..."
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-850 focus:outline-none focus:border-slate-400 resize-none leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" variant="danger" size="sm" icon={Send}>
                    Submit Complaint
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === 'review_dev' && (
            /* Review Developer Submissions & Option to Forward to C-Level */
            <Card title="Review Developer Submissions & Forward to C-Level" icon={Sparkles}>
              <div className="space-y-4">
                {teamDevSubmissions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No developer proposals currently submitted from this squad.
                  </div>
                ) : (
                  teamDevSubmissions.map((sub) => {
                    const author = resolvers.getUser(sub.userId)
                    const isForwarded = sub.status === 'forwarded_to_c_level'
                    const isForwardingThis = forwardingId === sub.id

                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                              {author?.initials || 'DEV'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {sub.title}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Submitted by{' '}
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {author?.name || 'Developer'}
                                </span>{' '}
                                · {formatDate(sub.date, 'short')}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                            {isForwarded ? (
                              <Badge variant="emerald" size="xs" dot>
                                Forwarded to {sub.forwardedTo?.split(' ')[0] || 'C-Suite'}
                              </Badge>
                            ) : (
                              <StatusPill status={sub.status} size="sm" />
                            )}
                          </div>
                        </div>

                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                          {sub.description}
                        </p>

                        {sub.docsUrl && (
                          <div className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 font-mono">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <a
                              href={sub.docsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline truncate"
                            >
                              {sub.docsUrl}
                            </a>
                          </div>
                        )}

                        {isForwarded && (
                          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 space-y-1">
                            <div className="flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Forwarded to {sub.forwardedTo}</span>
                            </div>
                            {sub.pmEndorsement && (
                              <p className="italic pl-4 text-emerald-700 dark:text-emerald-400">
                                "{sub.pmEndorsement}"
                              </p>
                            )}
                          </div>
                        )}

                        {!isForwarded && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                            {!isForwardingThis ? (
                              <Button
                                variant="lime"
                                size="xs"
                                icon={ArrowUpRight}
                                onClick={() => {
                                  setForwardingId(sub.id)
                                  setForwardEndorsement(
                                    `Endorsed by ${pm?.name || 'Project Manager'} (${pm?.title || 'PM'}). Reviewed architecture documentation and recommend greenlighting as an R&D prototype.`,
                                  )
                                }}
                              >
                                Forward to C-Level
                              </Button>
                            ) : (
                              <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-3">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 block text-[11px]">
                                  Forward Proposal to Executive Leadership
                                </span>

                                <div>
                                  <label className="block text-slate-600 dark:text-slate-400 text-[11px] mb-1">
                                    Recipient Desk
                                  </label>
                                  <select
                                    value={forwardRecipient}
                                    onChange={(e) => setForwardRecipient(e.target.value)}
                                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                                  >
                                    <option value="Chief Technology Officer (CTO)">
                                      Chief Technology Officer (CTO)
                                    </option>
                                    <option value="Chief Executive Officer (CEO)">
                                      Chief Executive Officer (CEO)
                                    </option>
                                    <option value="Chief Financial Officer (CFO)">
                                      Chief Financial Officer (CFO)
                                    </option>
                                    <option value="Chief People Officer (CPO)">
                                      Chief People Officer (CPO)
                                    </option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-slate-600 dark:text-slate-400 text-[11px] mb-1">
                                    PM Endorsement & Evaluation Note
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={forwardEndorsement}
                                    onChange={(e) => setForwardEndorsement(e.target.value)}
                                    placeholder="Add recommendation and strategic justification for C-Suite..."
                                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none resize-none"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    onClick={() => setForwardingId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="lime"
                                    size="xs"
                                    icon={Send}
                                    onClick={() => handleConfirmForward(sub.id)}
                                  >
                                    Confirm & Forward
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          )}

          {activeTab === 'team_complaints' && (
            /* Developer Complaints to PM: PM can Comment & Change Status */
            <Card title="Manage Developer Complaints" icon={MessageSquare}>
              <div className="space-y-4">
                {devComplaintsToPm.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No developer complaints currently routed to you.
                  </div>
                ) : (
                  devComplaintsToPm.map((cmp) => {
                    const devUser = resolvers.getUser(cmp.userId)
                    const isResponding = respondingComplaintId === cmp.id

                    return (
                      <div
                        key={cmp.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {cmp.title}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Filed by{' '}
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {devUser?.name || 'Developer'}
                              </span>{' '}
                              ({devUser?.title}) · {formatDate(cmp.date, 'short')}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <StatusPill status={cmp.status} size="sm" />
                          </div>
                        </div>

                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                          {cmp.description}
                        </p>

                        {/* Existing PM feedback/comment */}
                        {cmp.feedback && (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/70 dark:border-slate-750 text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                            <span className="font-semibold text-slate-900 dark:text-white block text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
                              Current Resolution Status & Comments:
                            </span>
                            <p>{cmp.feedback}</p>
                          </div>
                        )}

                        {/* Action Box to Change Status & Comment */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                          {!isResponding ? (
                            <Button
                              variant="secondary"
                              size="xs"
                              icon={MessageSquare}
                              onClick={() => {
                                setRespondingComplaintId(cmp.id)
                                setResponseStatus(cmp.status || 'under_investigation')
                                setResponseComment('')
                              }}
                            >
                              Update Status & Respond
                            </Button>
                          ) : (
                            <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-3">
                              <span className="font-semibold text-slate-900 dark:text-white block text-xs">
                                Resolve Grievance & Provide PM Response
                              </span>

                              <div>
                                <label className="block text-slate-600 dark:text-slate-400 text-[11px] mb-1">
                                  Update Complaint Status
                                </label>
                                <select
                                  value={responseStatus}
                                  onChange={(e) => setResponseStatus(e.target.value)}
                                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                                >
                                  <option value="under_investigation">Under Investigation</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="pending">Pending</option>
                                  <option value="rejected">Rejected / Out of Scope</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-slate-600 dark:text-slate-400 text-[11px] mb-1">
                                  PM Response / Action Plan Comment
                                </label>
                                <textarea
                                  rows={3}
                                  value={responseComment}
                                  onChange={(e) => setResponseComment(e.target.value)}
                                  placeholder="e.g. Conducted a sprint 1-on-1 and rebalanced PR review rotation to unblock developer."
                                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none resize-none"
                                />
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => setRespondingComplaintId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="lime"
                                  size="xs"
                                  onClick={() => handleSaveComplaintResponse(cmp.id)}
                                >
                                  Save & Update Status
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Status Log (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title={
              activeTab === 'team_complaints'
                ? 'Grievance Resolution Summary'
                : activeTab === 'review_dev'
                  ? 'Squad Proposal Pipeline'
                  : activeTab === 'submission'
                    ? 'Your Project Submissions'
                    : 'Your Complaints Log'
            }
            icon={FileText}
          >
            <div className="space-y-3 text-xs">
              {activeTab === 'submission' &&
                (pmProjectSubmissions.length === 0 ? (
                  <p className="text-slate-400 text-center py-6">No project ideas submitted yet.</p>
                ) : (
                  pmProjectSubmissions.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white leading-snug">
                          {r.title}
                        </span>
                        <StatusPill status={r.status} size="sm" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-2">
                        {r.description}
                      </p>
                      {r.feedback && (
                        <div className="p-2 rounded-xl bg-white dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                          {r.feedback}
                        </div>
                      )}
                    </div>
                  ))
                ))}

              {activeTab === 'complaint' &&
                (pmComplaints.length === 0 ? (
                  <p className="text-slate-400 text-center py-6">No complaints logged.</p>
                ) : (
                  pmComplaints.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white leading-snug">
                          {r.title}
                        </span>
                        <StatusPill status={r.status} size="sm" />
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Routed to:{' '}
                        <strong className="text-slate-600 dark:text-slate-300">
                          {r.complainTo}
                        </strong>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-2">
                        {r.description}
                      </p>
                    </div>
                  ))
                ))}

              {activeTab === 'review_dev' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 space-y-1.5">
                    <span className="font-bold text-sky-900 dark:text-sky-300 text-xs block">
                      Executive Review Protocol
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      As PM, you act as the gatekeeper for team innovation proposals. Reviewing and
                      forwarding developer proposals ensures leadership visibility for high-impact
                      architecture initiatives.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">
                        Total Squad Proposals
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        {teamDevSubmissions.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Forwarded to C-Level</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                        {
                          teamDevSubmissions.filter((s) => s.status === 'forwarded_to_c_level')
                            .length
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'team_complaints' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 space-y-1.5">
                    <span className="font-bold text-amber-900 dark:text-amber-300 text-xs block">
                      Team Morale & Dispute Handling
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      Developer complaints routed to PM represent sprint friction points such as PR
                      turnaround delays, scope creeps, or workload imbalances. Updating statuses
                      keeps engineers informed.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Total Complaints</span>
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        {devComplaintsToPm.length}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Resolved</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                        {devComplaintsToPm.filter((c) => c.status === 'resolved').length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default PmReportsPage
