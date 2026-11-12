import { useState, useMemo } from 'react'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { Avatar } from '../../components/common/Avatar'
import { useCtoData } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/formatters'
import type { TaskPriority, TaskStatus, EnrichedTask } from '../../types'
import { Plus, Search, CheckCircle2, XCircle, Clock, Users, Send } from 'lucide-react'

interface ColumnDef {
  id: TaskStatus
  label: string
  dot: string
  isReview?: boolean
}

export function CtoTaskManagementPage() {
  const { ctoEngineeringTasks, projects, projectManagers } = useCtoData()
  const {
    createCtoEngineeringTask,
    reviewCtoTaskSubmission,
    updateTaskStatus,
    setSelectedTaskModal,
    showToast,
  } = useApp()

  // Filters (PM filter on left + Search on right)
  const [selectedPmId, setSelectedPmId] = useState<string>('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [reviewingTask, setReviewingTask] = useState<EnrichedTask | null>(null)
  const [feedbackNotes, setFeedbackNotes] = useState<string>('')

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)

  // New Directive form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [pmId, setPmId] = useState(projectManagers[0]?.id || '')
  const [priority, setPriority] = useState<TaskPriority>('high')
  const [deadline, setDeadline] = useState('')
  const [tagsInput, setTagsInput] = useState('Architecture, Security')

  const columns: ColumnDef[] = [
    { id: 'todo', label: 'Assigned', dot: 'bg-slate-400 dark:bg-slate-500' },
    { id: 'in_progress', label: 'In Progress', dot: 'bg-sky-500' },
    { id: 'in_review', label: 'Deliverable Review', dot: 'bg-purple-500', isReview: true },
    { id: 'completed', label: 'Verified & Merged', dot: 'bg-emerald-500' },
    { id: 'blocked', label: 'Escalated / Blocked', dot: 'bg-rose-500' },
  ]

  // Filter tasks based on PM selection + Project selection + search
  const filteredTasks = useMemo(() => {
    return ctoEngineeringTasks.filter((task) => {
      if (selectedPmId !== 'all' && task.assigneeId !== selectedPmId) return false
      if (selectedProjectId !== 'all' && task.projectId !== selectedProjectId) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = task.title.toLowerCase().includes(q)
        const descMatch = task.description?.toLowerCase().includes(q)
        const tagMatch = task.tags?.some((t) => t.toLowerCase().includes(q))
        if (!titleMatch && !descMatch && !tagMatch) return false
      }
      return true
    })
  }, [ctoEngineeringTasks, selectedPmId, selectedProjectId, searchQuery])

  // Overall stats
  const totalCount = ctoEngineeringTasks.length
  const completedCount = ctoEngineeringTasks.filter((t) => t.status === 'completed').length
  const inReviewCount = ctoEngineeringTasks.filter((t) => t.status === 'in_review').length
  const activeCount = totalCount - completedCount
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverColId(null)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColId !== colId) {
      setDragOverColId(colId)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColId: TaskStatus) => {
    e.preventDefault()
    setDragOverColId(null)
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId
    if (!taskId) return

    const task = ctoEngineeringTasks.find((t) => t.id === taskId)
    if (!task || task.status === targetColId) return

    updateTaskStatus(taskId, targetColId)
    showToast(`Task status updated to ${targetColId.replace('_', ' ')}`, 'success')
    setDraggedTaskId(null)
  }

  // Handle create directive
  const handleCreateDirective = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !projectId || !pmId) {
      showToast('Please fill in all required fields.', 'error')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    createCtoEngineeringTask({
      projectId,
      pmId,
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: deadline || new Date(Date.now() + 14 * 86400000).toISOString(),
      tags,
    })

    showToast('Technical directive assigned to PM successfully.', 'success')
    setTitle('')
    setDescription('')
    setIsCreateModalOpen(false)
  }

  // Handle deliverable review (Approve / Reject)
  const handleReviewAction = (approved: boolean) => {
    if (!reviewingTask) return
    reviewCtoTaskSubmission(reviewingTask.id, approved, feedbackNotes.trim() || undefined)
    setReviewingTask(null)
    setFeedbackNotes('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Technical Directives & PM Assignments
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {inReviewCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              {inReviewCount} Deliverable{inReviewCount > 1 ? 's' : ''} Awaiting Review
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Assign Directive
          </Button>
        </div>
      </div>

      {/* Main Layout: Left PM Filter Column + Right Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (3 cols): PM Cards */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Project Managers
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {projectManagers.length} PMs
            </span>
          </div>

          {/* "All PMs" Card */}
          <div
            onClick={() => setSelectedPmId('all')}
            className={`p-3.5 rounded-2xl cursor-pointer transition-all duration-150 border ${
              selectedPmId === 'all'
                ? 'bg-lime-50/70 dark:bg-lime-950/20 border-lime-300 dark:border-lime-700/60 shadow-xs'
                : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    selectedPmId === 'all'
                      ? 'bg-lime-500 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    All Project Managers
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {activeCount} Active • {completedCount} Completed
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Completion</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {overallProgress}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-lime-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Individual PM Cards */}
          {projectManagers.map((pm) => {
            const isSelected = selectedPmId === pm.id
            const pmTasks = ctoEngineeringTasks.filter((t) => t.assigneeId === pm.id)
            const pmCompleted = pmTasks.filter((t) => t.status === 'completed').length
            const pmInReview = pmTasks.filter((t) => t.status === 'in_review').length
            const pmProgress =
              pmTasks.length > 0 ? Math.round((pmCompleted / pmTasks.length) * 100) : 0

            return (
              <div
                key={pm.id}
                onClick={() => setSelectedPmId(pm.id)}
                className={`p-3 rounded-2xl cursor-pointer transition-all duration-150 border ${
                  isSelected
                    ? 'bg-lime-50/70 dark:bg-lime-950/20 border-lime-300 dark:border-lime-700/60 shadow-xs'
                    : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={pm.avatarUrl || pm.avatar}
                      name={pm.name}
                      initials={pm.initials}
                      size="sm"
                      className="border border-slate-200 dark:border-slate-700"
                    />
                    <div>
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {pm.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                        {pm.title}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {pmInReview > 0 && (
                      <span className="w-2 h-2 rounded-full bg-purple-500" title="Review waiting" />
                    )}
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      {pmTasks.length}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1 mt-2 overflow-hidden">
                  <div
                    className="bg-sky-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${pmProgress}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Right Column (9 cols): Search bar + Kanban Columns */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search directives by title, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-lime-500"
              />
            </div>

            {/* Project Filter Dropdown */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-lime-500"
            >
              <option value="all">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Kanban Board */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 items-start min-w-[1150px]">
              {columns.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.id)
                const isOver = dragOverColId === col.id

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`flex-1 min-w-[220px] rounded-2xl p-3.5 border transition-colors min-h-[500px] flex flex-col ${
                      isOver
                        ? 'border-lime-500 bg-lime-50/20 dark:bg-lime-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {col.label}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {colTasks.length}
                      </span>
                    </div>

                    {/* Tasks List */}
                    <div className="space-y-2.5 flex-1">
                      {colTasks.length === 0 ? (
                        <div className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center p-3 text-center">
                          <span className="text-[11px] text-slate-400">No directives</span>
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedTaskModal(task)}
                            className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/70 hover:border-lime-400 dark:hover:border-lime-500 hover:shadow-xs transition-all duration-150 cursor-grab active:cursor-grabbing group space-y-2"
                          >
                            {/* Top Row: Project code & Priority */}
                            <div className="flex items-center justify-between gap-1">
                              <Badge variant="indigo" size="xs">
                                {task.project?.code || 'TECH'}
                              </Badge>
                              {task.priority && (
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    task.priority === 'urgent'
                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                      : task.priority === 'high'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {task.priority}
                                </span>
                              )}
                            </div>

                            {/* Task Title */}
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors line-clamp-2">
                              {task.title}
                            </h4>

                            {/* Description snippet */}
                            {task.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            {/* Assignee PM pill */}
                            {task.assignee && (
                              <div className="flex items-center gap-1.5 pt-1">
                                <Avatar
                                  src={task.assignee.avatarUrl || task.assignee.avatar}
                                  name={task.assignee.name}
                                  initials={task.assignee.initials}
                                  className="w-4 h-4 text-[9px]"
                                />
                                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
                                  {task.assignee.name}
                                </span>
                              </div>
                            )}

                            {/* In-Review Actions: Approve / Request Changes */}
                            {col.isReview && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="pt-2 border-t border-purple-100 dark:border-purple-900/40 flex items-center gap-1.5"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    reviewCtoTaskSubmission(task.id, true)
                                    showToast(
                                      'Directive deliverable approved & verified.',
                                      'success',
                                    )
                                  }}
                                  className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewingTask(task)
                                    setFeedbackNotes('')
                                  }}
                                  className="flex-1 py-1.5 px-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                                >
                                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Changes</span>
                                </button>
                              </div>
                            )}

                            {/* Footer */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{formatDate(task.dueDate, 'short')}</span>
                              </div>
                              <span className="font-mono">{task.project?.code}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create Technical Directive */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Assign Technical Directive to Project Manager"
      >
        <form onSubmit={handleCreateDirective} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Directive Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Implement Distributed Redis Cache Layer & Tenant Nonce Guard"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Project *
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assignee PM *
              </label>
              <select
                value={pmId}
                onChange={(e) => setPmId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500"
              >
                {projectManagers.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} ({pm.title})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500"
              >
                <option value="urgent">Urgent (Immediate sprint focus)</option>
                <option value="high">High (Sprint milestone)</option>
                <option value="medium">Medium (Standard directive)</option>
                <option value="low">Low (Backlog refinement)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Technical Specification / Acceptance Criteria
            </label>
            <textarea
              rows={3}
              placeholder="Outline architecture requirements, quality gates, test coverage thresholds, and security deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="Architecture, Security, Docker, Redis"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-lime-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={Send}>
              Issue Directive
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Request Changes Feedback */}
      <Modal
        isOpen={!!reviewingTask}
        onClose={() => setReviewingTask(null)}
        title="Request Changes on PM Deliverable"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Provide technical feedback or specify unresolved security/architecture requirements for{' '}
            <strong className="text-slate-800 dark:text-slate-200">{reviewingTask?.title}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Feedback & Required Changes *
            </label>
            <textarea
              rows={4}
              required
              placeholder="e.g. Unit test coverage is below 90% threshold. Please add regression tests for tenant isolation."
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setReviewingTask(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleReviewAction(false)}>
              Send Feedback
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
