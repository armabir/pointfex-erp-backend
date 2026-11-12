import React, { useState } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { StatusPill } from '../../components/common/StatusPill'
import { useCtoData } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { formatDate } from '../../utils/formatters'
import type { Report, ReportStatus } from '../../types'
import {
  Send,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageSquare,
  UserCheck,
  Building,
} from 'lucide-react'

export function CtoReportsPage() {
  const { allReports } = useCtoData()
  const {
    currentRole,
    currentUser,
    addComplaint,
    updateComplaintStatusGeneral,
    reviewProjectIdea,
    showToast,
  } = useApp()
  const { hasAnyPermission } = usePermissions()

  const [activeTab, setActiveTab] = useState<
    'submit_c_level' | 'review_complaints' | 'review_project_ideas'
  >('submit_c_level')

  // Submit Complain to C-Level Form State
  const [complainTo, setComplainTo] = useState('CEO — Victoria Sterling-Fox')
  const [complainTitle, setComplainTitle] = useState('')
  const [complainDesc, setComplainDesc] = useState('')

  // Review Complaint Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<Report | null>(null)
  const [complaintStatus, setComplaintStatus] = useState<ReportStatus>('under_investigation')
  const [complaintFeedback, setComplaintFeedback] = useState('')

  // Review Project Idea Modal State
  const [selectedIdea, setSelectedIdea] = useState<Report | null>(null)
  const [ideaStatus, setIdeaStatus] = useState<'approved' | 'rejected' | 'under_review'>('approved')
  const [ideaFeedback, setIdeaFeedback] = useState('')

  // Filter current executive's submitted complaints
  const myComplaints = allReports.filter(
    (r) =>
      (r.userId === currentUser?.id ||
        r.authorId === currentUser?.id ||
        r.authorRole === currentRole) &&
      (r.type === 'complaint' ||
        r.category?.includes('Complain') ||
        r.category?.includes('Escalation')),
  )

  // Filter complaints from colleagues (and exclude confidential unless granted confidential grievance permission)
  const canViewConfidential = hasAnyPermission(
    'grievances:read_confidential',
    'grievances:adjudicate_confidential',
  )
  const teamComplaints = allReports.filter((r) => {
    if (r.type !== 'complaint') return false
    if (r.authorId === currentUser?.id) return false
    if (r.isConfidential && !canViewConfidential) return false
    return true
  })

  // Filter project proposals from PM & Dev
  const projectIdeas = allReports.filter((r) => r.type === 'project_submission')

  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault()
    if (!complainTitle.trim() || !complainDesc.trim()) {
      showToast('Please provide a complaint title and detailed description.', 'error')
      return
    }

    const newComplaint: Report = {
      id: `report_${currentRole || 'cto'}_${Date.now()}`,
      userId: currentUser?.id || 'user_cto_01',
      date: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      authorId: currentUser?.id || 'user_cto_01',
      authorName: currentUser?.name || 'Dr. Arthur Sterling',
      authorRole: currentRole || 'cto',
      targetUserName: complainTo,
      type: 'complaint',
      title: complainTitle.trim(),
      description: complainDesc.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      category: 'Executive Grievance / C-Level Escalation',
    }

    addComplaint(newComplaint)
    setComplainTitle('')
    setComplainDesc('')
    showToast(`Complaint submitted directly to ${complainTo}`, 'success')
  }

  const handleSaveComplaintReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedComplaint) return

    updateComplaintStatusGeneral(
      selectedComplaint.id,
      complaintStatus,
      complaintFeedback.trim() || undefined,
    )

    showToast(`Complaint status updated to ${complaintStatus.replace('_', ' ')}`, 'success')
    setSelectedComplaint(null)
    setComplaintFeedback('')
  }

  const handleSaveIdeaReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIdea) return

    reviewProjectIdea(selectedIdea.id, ideaStatus, ideaFeedback.trim() || undefined)

    showToast(`Project idea status updated to ${ideaStatus.replace('_', ' ')}`, 'success')
    setSelectedIdea(null)
    setIdeaFeedback('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Reports & Governance
          </h2>
        </div>

        {/* 3 Tab Navigation Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('submit_c_level')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'submit_c_level'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Submit Complaint to C-Level
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review_complaints')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'review_complaints'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Review PM & Dev Complaints
            {teamComplaints.filter((c) => c.status === 'pending').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review_project_ideas')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'review_project_ideas'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Review & Select Project Ideas
            {projectIdeas.filter((p) => p.status === 'pending').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-lime-500" />
            )}
          </button>
        </div>
      </div>

      {/* PANEL 1: Submit Complaint to other C-levels */}
      {activeTab === 'submit_c_level' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Submission Form */}
          <div className="lg:col-span-5">
            <Card title="File C-Level Complaint / Escalation" icon={AlertTriangle}>
              <form onSubmit={handleSubmitComplaint} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Complain To (C-Level Executive)
                  </label>
                  <select
                    value={complainTo}
                    onChange={(e) => setComplainTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                  >
                    <option value="CEO — Chief Executive Officer">
                      CEO — Chief Executive Officer (Strategy &amp; Resource Allocation)
                    </option>
                    <option value="CFO — Chief Financial Officer">
                      CFO — Chief Financial Officer (Budgetary &amp; Capital Approval)
                    </option>
                    <option value="CPO — Chief People Officer">
                      CPO — Chief People Officer (People, Talent &amp; Culture)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Complaint Subject / Title
                  </label>
                  <input
                    type="text"
                    value={complainTitle}
                    onChange={(e) => setComplainTitle(e.target.value)}
                    placeholder="e.g., Delay in Q4 infrastructure capital allocation sign-off"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Executive Statement & Context
                  </label>
                  <textarea
                    rows={4}
                    value={complainDesc}
                    onChange={(e) => setComplainDesc(e.target.value)}
                    placeholder="Explain the background, operational blockage, cross-departmental impact, and desired executive remedy..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 placeholder:text-slate-400 leading-relaxed resize-none"
                  />
                </div>

                <Button type="submit" variant="lime" size="sm" className="w-full" icon={Send}>
                  Submit Complaint
                </Button>
              </form>
            </Card>
          </div>

          {/* Submitted Complaints History */}
          <div className="lg:col-span-7">
            <Card title="My Filed C-Level Complaints" icon={Building}>
              {myComplaints.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No complaints filed yet by the CTO office.
                </div>
              ) : (
                <div className="space-y-3">
                  {myComplaints.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <StatusPill status={item.status} size="sm" />
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 gap-2">
                        <span>
                          Submitted to:{' '}
                          <strong className="text-slate-700 dark:text-slate-300">
                            {item.targetUserName || 'Executive Office'}
                          </strong>
                        </span>
                        <span>{formatDate(item.createdAt, 'short')}</span>
                      </div>

                      {item.feedback && (
                        <div className="p-2.5 rounded-xl bg-lime-50/60 dark:bg-lime-950/20 border border-lime-200/50 dark:border-lime-900/40 text-[11px] text-slate-700 dark:text-slate-300">
                          <strong className="text-lime-700 dark:text-lime-400 block mb-0.5">
                            Executive Response:
                          </strong>
                          {item.feedback}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* PANEL 2: Review & update submitted complaints from PM & Dev */}
      {activeTab === 'review_complaints' && (
        <Card title="Submitted Complaints from PM & Engineering Teams" icon={UserCheck}>
          {teamComplaints.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No pending complaints filed by developers or project managers.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {teamComplaints.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={item.authorRole === 'pm' ? 'purple' : 'sky'} size="xs">
                        From {item.authorRole?.toUpperCase() || 'ENGINEER'}
                      </Badge>
                      <StatusPill status={item.status} size="sm" />
                    </div>

                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      {item.title}
                    </h4>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {item.description}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                      <span>
                        Author:{' '}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {item.authorName}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>Target: {item.targetUserName || 'CTO Office'}</span>
                      <span>•</span>
                      <span>{formatDate(item.createdAt, 'short')}</span>
                    </div>

                    {item.feedback && (
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-slate-200 block mb-0.5">
                          CTO Feedback:
                        </strong>
                        {item.feedback}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={MessageSquare}
                      onClick={() => {
                        setSelectedComplaint(item)
                        setComplaintStatus(item.status as ReportStatus)
                        setComplaintFeedback(item.feedback || '')
                      }}
                    >
                      Update Status & Feedback
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* PANEL 3: Review & select project ideas from PM & Dev */}
      {activeTab === 'review_project_ideas' && (
        <Card title="Project Proposals & Innovation Submissions" icon={Lightbulb}>
          {projectIdeas.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No project ideas submitted yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {projectIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-3 shadow-2xs group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={idea.authorRole === 'pm' ? 'purple' : 'emerald'} size="xs">
                        {idea.authorRole === 'pm' ? 'PM Proposal' : 'Dev Proposal'}
                      </Badge>
                      <StatusPill status={idea.status} size="sm" />
                    </div>

                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-xs group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                      {idea.title}
                    </h4>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {idea.description}
                    </p>

                    {/* Docs / SRS link */}
                    {idea.docsUrl && (
                      <div className="pt-1">
                        <a
                          href={idea.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200/60 dark:border-indigo-800/60 text-[11px] font-medium transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View SRS / Concept Docs</span>
                        </a>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                      <span>
                        Proposer:{' '}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {idea.authorName}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>{formatDate(idea.createdAt, 'short')}</span>
                    </div>

                    {idea.feedback && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-900 dark:text-slate-200 block mb-0.5">
                          CTO Adjudication:
                        </strong>
                        {idea.feedback}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        setSelectedIdea(idea)
                        setIdeaStatus(
                          idea.status === 'approved'
                            ? 'approved'
                            : idea.status === 'rejected'
                              ? 'rejected'
                              : 'under_review',
                        )
                        setIdeaFeedback(idea.feedback || '')
                      }}
                    >
                      Review & Comment
                    </Button>

                    <div className="flex items-center gap-1.5">
                      {idea.status !== 'rejected' && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          icon={XCircle}
                          onClick={() => {
                            reviewProjectIdea(idea.id, 'rejected', 'Archived by CTO')
                            showToast('Project idea archived/rejected', 'info')
                          }}
                        >
                          Reject
                        </Button>
                      )}

                      {idea.status !== 'approved' && (
                        <Button
                          variant="lime"
                          size="xs"
                          icon={CheckCircle2}
                          onClick={() => {
                            reviewProjectIdea(
                              idea.id,
                              'approved',
                              'Selected by CTO for upcoming development sprint',
                            )
                            showToast('Project idea approved and selected!', 'success')
                          }}
                        >
                          Select Idea
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Review Complaint Modal */}
      {selectedComplaint && (
        <Modal
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          title="Review Team Complaint / Grievance"
        >
          <form onSubmit={handleSaveComplaintReview} className="space-y-4 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Complaint Subject
              </span>
              <div className="font-bold text-slate-900 dark:text-white">
                {selectedComplaint.title}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                {selectedComplaint.description}
              </p>
              <div className="text-[10px] text-slate-400 pt-1">
                Filer:{' '}
                <strong className="text-slate-700 dark:text-slate-300">
                  {selectedComplaint.authorName}
                </strong>{' '}
                ({selectedComplaint.authorRole?.toUpperCase()})
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Investigation / Resolution Status
              </label>
              <select
                value={complaintStatus}
                onChange={(e) => setComplaintStatus(e.target.value as ReportStatus)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
              >
                <option value="pending">Pending</option>
                <option value="under_investigation">Under Investigation</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                CTO Feedback & Resolution Notes
              </label>
              <textarea
                rows={3}
                value={complaintFeedback}
                onChange={(e) => setComplaintFeedback(e.target.value)}
                placeholder="Enter actions taken, meeting summaries, or resolution guidance..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedComplaint(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm" icon={CheckCircle2}>
                Save Status
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Project Idea Modal */}
      {selectedIdea && (
        <Modal
          isOpen={!!selectedIdea}
          onClose={() => setSelectedIdea(null)}
          title="Review & Adjudicate Project Idea"
        >
          <form onSubmit={handleSaveIdeaReview} className="space-y-4 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Idea Title
              </span>
              <div className="font-bold text-slate-900 dark:text-white">{selectedIdea.title}</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                {selectedIdea.description}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                CTO Decision
              </label>
              <select
                value={ideaStatus}
                onChange={(e) =>
                  setIdeaStatus(e.target.value as 'approved' | 'rejected' | 'under_review')
                }
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
              >
                <option value="under_review">Under Review</option>
                <option value="approved">Approved / Selected for Roadmap</option>
                <option value="rejected">Rejected / Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Technical Feedback for Author
              </label>
              <textarea
                rows={3}
                value={ideaFeedback}
                onChange={(e) => setIdeaFeedback(e.target.value)}
                placeholder="Notes on feasibility, architecture alignment, or required changes..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedIdea(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm" icon={CheckCircle2}>
                Save Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
