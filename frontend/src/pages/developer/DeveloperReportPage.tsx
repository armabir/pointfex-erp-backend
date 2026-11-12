import React, { useState } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { StatusPill } from '../../components/common/StatusPill'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/formatters'
import { Send, Lightbulb, AlertTriangle, ExternalLink, FileText, UserCheck } from 'lucide-react'
import type { Report } from '../../types'

export function DeveloperReportPage() {
  const { data, addSubmission, addComplaint, currentDevId, currentUser, currentTeam } = useApp()
  const activeDevId = currentUser?.id || currentDevId
  const activeTeamId = currentUser?.teamId || currentTeam?.id || 'team_01'

  const [activeTab, setActiveTab] = useState<'submission' | 'complaint'>('submission')

  // Form State: New Project Idea Submission
  const [projectTitle, setProjectTitle] = useState('')
  const [docsUrl, setDocsUrl] = useState('')
  const [projectDesc, setProjectDesc] = useState('')

  // Form State: General Complaint (complain to | title | desc)
  const [complainTo, setComplainTo] = useState('Project Manager (PM)')
  const [complaintTitle, setComplaintTitle] = useState('')
  const [complaintDesc, setComplaintDesc] = useState('')

  // Filter current developer's items
  const userReports = data.reports.filter((r) => r.userId === activeDevId)
  const projectSubmissions = userReports.filter((r) => r.type === 'project_submission')
  const complaints = userReports.filter((r) => r.type === 'complaint')

  // Submit New Project Idea
  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectTitle.trim() || !docsUrl.trim() || !projectDesc.trim()) return

    const submission: Report = {
      id: `prop_${Date.now()}`,
      userId: activeDevId,
      teamId: activeTeamId,
      type: 'project_submission',
      title: projectTitle.trim(),
      docsUrl: docsUrl.trim(),
      description: projectDesc.trim(),
      date: new Date().toISOString().split('T')[0],
      submittedAt: new Date().toISOString(),
      status: 'pending_review',
      feedback: 'Awaiting review from Project Management & Architecture committee.',
    }

    addSubmission(submission)

    setProjectTitle('')
    setDocsUrl('')
    setProjectDesc('')
  }

  // Submit General Complaint
  const handleComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!complaintTitle.trim() || !complaintDesc.trim() || !complainTo.trim()) return

    const complaint: Report = {
      id: `cmp_${Date.now()}`,
      userId: activeDevId,
      teamId: activeTeamId,
      type: 'complaint',
      complainTo: complainTo.trim(),
      title: complaintTitle.trim(),
      description: complaintDesc.trim(),
      date: new Date().toISOString().split('T')[0],
      submittedAt: new Date().toISOString(),
      status: 'pending',
      feedback: `Complaint logged and routed to ${complainTo.trim()}. Response pending review.`,
    }

    addComplaint(complaint)

    setComplaintTitle('')
    setComplaintDesc('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
          Submissions & Complaints
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Submit new project ideas or file workplace grievances to leadership
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('submission')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'submission'
              ? 'bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>New Project Submission</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 dark:bg-black/10">
            {projectSubmissions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('complaint')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'complaint'
              ? 'bg-rose-600 text-white dark:bg-rose-500 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>General Complaint</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 dark:bg-black/10">
            {complaints.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activeTab === 'submission' ? (
            /* New Project Idea Form */
            <Card title="Submit New Project Idea" icon={Lightbulb}>
              <form onSubmit={handleProjectSubmit} className="space-y-4 text-xs">
                {/* Project Title */}
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

                {/* Docs Link */}
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

                {/* Description */}
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
          ) : (
            /* General Complaint Form: complain to | title | desc */
            <Card title="File General Complaint" icon={AlertTriangle}>
              <form onSubmit={handleComplaintSubmit} className="space-y-4 text-xs">
                {/* Complain To */}
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
                      <option value="Project Manager (PM)">Project Manager (PM)</option>
                      <option value="Team Lead">Team Lead</option>
                      <option value="CTO">Chief Technology Officer (CTO)</option>
                      <option value="People Operations (CPO)">People Operations (CPO / HR)</option>
                      <option value="Team Member (Peer Conflict)">
                        Team Member (Peer Conflict)
                      </option>
                      <option value="Executive Management">Executive Management</option>
                    </select>
                  </div>
                </div>

                {/* Complaint Title */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Complaint Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Unclear requirements causing continuous rework"
                    value={complaintTitle}
                    onChange={(e) => setComplaintTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-850 focus:outline-none focus:border-slate-400 font-medium"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1.5">
                    Detailed Description
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide details about the issue (e.g. workload, communication barrier, team member friction, or system blocker)..."
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
        </div>

        {/* Right Column: Trackers & History (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title={
              activeTab === 'submission' ? 'Submitted Project Proposals' : 'Submitted Complaints'
            }
            icon={activeTab === 'submission' ? Lightbulb : AlertTriangle}
          >
            {activeTab === 'submission' ? (
              <div className="space-y-3">
                {projectSubmissions.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                    No project proposals submitted yet.
                  </p>
                ) : (
                  projectSubmissions.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white leading-snug">
                          {prop.title}
                        </span>
                        <StatusPill status={prop.status} size="sm" />
                      </div>

                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {prop.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                        {prop.docsUrl && (
                          <a
                            href={prop.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-mono"
                          >
                            <span>Documentation</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <span className="text-slate-400 dark:text-slate-500">
                          {formatDate(prop.date, 'short')}
                        </span>
                      </div>

                      {prop.feedback && (
                        <div className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Feedback:
                          </span>{' '}
                          {prop.feedback}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                    No complaints filed.
                  </p>
                ) : (
                  complaints.map((comp) => (
                    <div
                      key={comp.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="purple" size="xs">
                              To: {comp.complainTo}
                            </Badge>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white leading-snug">
                            {comp.title}
                          </span>
                        </div>
                        <StatusPill status={comp.status} size="sm" />
                      </div>

                      <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                        {comp.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400 dark:text-slate-500">
                        <span>Submitted by Developer</span>
                        <span>{formatDate(comp.date, 'short')}</span>
                      </div>

                      {comp.feedback && (
                        <div className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Response:
                          </span>{' '}
                          {comp.feedback}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
