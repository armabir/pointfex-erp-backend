import React, { useState } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { StatusPill } from '../../components/common/StatusPill'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { usePmData } from '../../hooks/usePmData'
import { useApp } from '../../context/AppContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import type { ProjectMilestone } from '../../types'
import {
  FolderGit2,
  FileCode,
  Plus,
  CheckCircle2,
  Clock,
  Circle,
  GitBranch,
  Globe,
  Tag,
} from 'lucide-react'

export function PmProjectsPage() {
  const { teamProjects, team } = usePmData()
  const { addProjectMilestone, updateMilestoneStatus } = useApp()

  // Add Milestone Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [targetProjectId, setTargetProjectId] = useState(teamProjects[0]?.id || '')
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDueDate, setMilestoneDueDate] = useState('')
  const [milestoneStatus, setMilestoneStatus] = useState<'pending' | 'in_progress' | 'completed'>(
    'pending',
  )

  const handleOpenAddModal = (projId: string) => {
    setTargetProjectId(projId)
    setMilestoneTitle('')
    setMilestoneDueDate('')
    setMilestoneStatus('pending')
    setIsAddModalOpen(true)
  }

  const handleSaveMilestone = (e: React.FormEvent) => {
    e.preventDefault()
    if (!milestoneTitle.trim() || !targetProjectId) return

    addProjectMilestone(targetProjectId, {
      title: milestoneTitle.trim(),
      dueDate: milestoneDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: milestoneStatus,
    })

    setIsAddModalOpen(false)
    setMilestoneTitle('')
  }

  // Helper to cycle milestone status
  const handleCycleStatus = (projId: string, msId: string, currentStatus: string) => {
    const nextStatus =
      currentStatus === 'pending'
        ? 'in_progress'
        : currentStatus === 'in_progress'
          ? 'completed'
          : 'pending'
    updateMilestoneStatus(projId, msId, nextStatus)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Project Management & Milestones
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active projects assigned to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {team?.name || 'Squad'}
            </span>{' '}
            · Sprint Week {team?.currentSprintWeek || 3} of 5
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="indigo" size="sm">
            {teamProjects.length} Managed Projects
          </Badge>
          <Badge variant="emerald" size="sm" dot>
            Sprint Health: On Track
          </Badge>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {teamProjects.map((project) => {
          const srs = project.srs
          const milestones: ProjectMilestone[] = project.milestones || []

          return (
            <Card
              key={project.id}
              title={project.name}
              subtitle={
                project.client ? `Client: ${project.client}` : `Project Code: ${project.code}`
              }
              icon={FolderGit2}
            >
              <div className="space-y-4 text-xs">
                {/* Description */}
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {project.description}
                </p>

                {/* Progress Bar */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      Sprint Delivery Progress
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-display">
                      {project.progress}% Complete
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/80 dark:bg-slate-700/80 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>{project.completedTasksCount || 0} completed</span>
                    <span>{project.inReviewTasksCount || 0} in review</span>
                  </div>
                </div>

                {/* Key Fields Grid */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Status</span>
                    <StatusPill status={project.status} size="sm" className="mt-1" />
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Budget</span>
                    <span className="font-bold text-slate-900 dark:text-white block mt-1">
                      {formatCurrency(project.budget)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Due Date</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 block mt-1">
                      {formatDate(project.deadline, 'short')}
                    </span>
                  </div>
                </div>

                {/* Simple Tech Stack & Links */}
                <div className="space-y-2 pt-1">
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" /> Stack:
                      </span>
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    {project.repositoryUrl && (
                      <a
                        href={project.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        <GitBranch className="w-3 h-3" /> Repository
                      </a>
                    )}
                    {project.demoUrl && (
                      <a
                        href={project.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        <Globe className="w-3 h-3" /> Live Demo
                      </a>
                    )}
                    {srs && (
                      <a
                        href={srs.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <FileCode className="w-3 h-3" /> SRS Specs ({srs.version})
                      </a>
                    )}
                  </div>

                  {srs?.overview && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      <strong className="text-slate-700 dark:text-slate-300 block mb-0.5">
                        SRS Overview:
                      </strong>
                      {srs.overview}
                    </div>
                  )}

                  {/* Assigned Engineers */}
                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Assigned Squad Engineers
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {project.assignedDevs?.map((dev) => (
                        <span
                          key={dev.id}
                          className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {dev.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Milestones Section */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Milestones ({milestones.length})
                    </span>
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={Plus}
                      onClick={() => handleOpenAddModal(project.id)}
                    >
                      Add Milestone
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {milestones.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        No milestones added yet. Click "+ Add Milestone" to define sprint
                        deliverables.
                      </div>
                    ) : (
                      milestones.map((ms) => {
                        const isDone = ms.status === 'completed'
                        const isInProgress = ms.status === 'in_progress'

                        return (
                          <div
                            key={ms.id}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                title="Click to cycle status"
                                onClick={() => handleCycleStatus(project.id, ms.id, ms.status)}
                                className="cursor-pointer text-slate-400 hover:scale-110 transition-transform shrink-0"
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                ) : isInProgress ? (
                                  <Clock className="w-4 h-4 text-sky-500" />
                                ) : (
                                  <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <span
                                  className={`font-medium block truncate ${
                                    isDone
                                      ? 'text-slate-400 dark:text-slate-500 line-through'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {ms.title}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Due {formatDate(ms.dueDate, 'short')}
                                </span>
                              </div>
                            </div>

                            {/* Status pill with click to cycle */}
                            <button
                              type="button"
                              onClick={() => handleCycleStatus(project.id, ms.id, ms.status)}
                              title="Click to change status"
                              className="cursor-pointer shrink-0"
                            >
                              <Badge
                                variant={isDone ? 'emerald' : isInProgress ? 'sky' : 'slate'}
                                size="xs"
                              >
                                {ms.status.replace('_', ' ')}
                              </Badge>
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Modal: Add Milestone */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Project Milestone"
      >
        <form onSubmit={handleSaveMilestone} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Project <span className="text-rose-500">*</span>
            </label>
            <select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {teamProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Milestone Deliverable Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., M5: End-to-End Security Audit & Penetration Sign-Off"
              value={milestoneTitle}
              onChange={(e) => setMilestoneTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Due Date
              </label>
              <input
                type="date"
                value={milestoneDueDate}
                onChange={(e) => setMilestoneDueDate(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Initial Status
              </label>
              <select
                value={milestoneStatus}
                onChange={(e) =>
                  setMilestoneStatus(e.target.value as 'pending' | 'in_progress' | 'completed')
                }
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="lime" size="sm" icon={Plus}>
              Save Milestone
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PmProjectsPage
