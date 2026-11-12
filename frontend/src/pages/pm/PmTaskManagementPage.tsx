import React, { useState, useMemo } from 'react'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { StatusPill } from '../../components/common/StatusPill'
import { usePmData } from '../../hooks/usePmData'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/formatters'
import type { Task, TaskPriority, TaskStatus } from '../../types'
import { Plus, Search, CheckCircle2, XCircle, FolderGit2, Layers, Clock, Users } from 'lucide-react'

interface ColumnDef {
  id: TaskStatus
  label: string
  dot: string
  isReview?: boolean
  isApproval?: boolean
}

export function PmTaskManagementPage() {
  const { teamTasks, teamProjects, teamMembers, team } = usePmData()
  const { createTask, approveTask, rejectTask, updateTaskStatus, setSelectedTaskModal } = useApp()

  // Filters (Left Column Project Selection + Right Column Dev & Search Filter)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [selectedDevId, setSelectedDevId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false)
  const [rejectingTask, setRejectingTask] = useState<Task | null>(null)
  const [rejectFeedback, setRejectFeedback] = useState<string>('')

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskProject, setNewTaskProject] = useState(teamProjects[0]?.id || '')
  const [newTaskDev, setNewTaskDev] = useState(teamMembers[0]?.id || '')
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const newTaskHours = '8'
  const [newTaskTags, setNewTaskTags] = useState('')

  const columns: ColumnDef[] = [
    { id: 'todo', label: 'To Do', dot: 'bg-slate-400 dark:bg-slate-500' },
    { id: 'in_progress', label: 'In Progress', dot: 'bg-sky-500' },
    { id: 'in_review', label: 'In Review', dot: 'bg-purple-500', isReview: true },
    { id: 'completed', label: 'Completed', dot: 'bg-emerald-500', isApproval: true },
    { id: 'blocked', label: 'Blocked', dot: 'bg-rose-500' },
  ]

  // Filter tasks based on left-side project selection + right-side dev & search
  const filteredTasks = useMemo(() => {
    return teamTasks.filter((task) => {
      if (selectedProjectId !== 'all' && task.projectId !== selectedProjectId) return false
      if (selectedDevId !== 'all' && task.assigneeId !== selectedDevId) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = task.title.toLowerCase().includes(q)
        const descMatch = task.description?.toLowerCase().includes(q)
        const tagMatch = task.tags?.some((t) => t.toLowerCase().includes(q))
        if (!titleMatch && !descMatch && !tagMatch) return false
      }
      return true
    })
  }, [teamTasks, selectedProjectId, selectedDevId, searchQuery])

  // Summary stats for the left sidebar
  const totalTasksCount = teamTasks.length
  const totalCompletedCount = teamTasks.filter((t) => t.status === 'completed').length
  const totalActiveCount = totalTasksCount - totalCompletedCount
  const overallProgress =
    totalTasksCount > 0 ? Math.round((totalCompletedCount / totalTasksCount) * 100) : 0

  // Drag handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
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

    const task = teamTasks.find((t) => t.id === taskId)
    if (!task || task.status === targetColId) return

    if (targetColId === 'completed') {
      approveTask(taskId, 'Directly verified and approved via PM Kanban board')
    } else {
      updateTaskStatus(taskId, targetColId)
    }
    setDraggedTaskId(null)
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !newTaskProject || !newTaskDev) return

    const tagList = newTaskTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    createTask({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      projectId: newTaskProject,
      assigneeId: newTaskDev,
      priority: newTaskPriority,
      dueDate: newTaskDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      estimatedHours: newTaskHours,
      tags: tagList,
    })

    setNewTaskTitle('')
    setNewTaskDesc('')
    setNewTaskTags('')
    setIsCreateModalOpen(false)
  }

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingTask || !rejectFeedback.trim()) return

    rejectTask(rejectingTask.id, rejectFeedback.trim())
    setRejectingTask(null)
    setRejectFeedback('')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Team Task Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            5-Column Kanban Board · Manage, assign, and approve deliverables for{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {team?.name || 'Squad'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="lime"
            size="sm"
            icon={Plus}
            onClick={() => {
              if (selectedProjectId !== 'all') setNewTaskProject(selectedProjectId)
              setIsCreateModalOpen(true)
            }}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* Main Grid: Projects Sidebar (Left) + 5-Column Kanban (Right) (Identical Layout to Dev Tasks) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side (3 cols): Project Cards Filter Sidebar */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
              Project Filter
            </span>
            <span className="text-[11px] text-slate-400">{teamProjects.length + 1} views</span>
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
                  <span className="text-[10px] text-slate-400">Squad Overview</span>
                </div>
              </div>
              <Badge variant="lime" size="xs">
                {totalTasksCount}
              </Badge>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Sprint Progress</span>
                <span className="font-bold text-slate-900 dark:text-white font-display">
                  {overallProgress}%
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-lime-500 h-1.5 rounded-full"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{totalActiveCount} Active</span>
                <span>{totalCompletedCount} Done</span>
              </div>
            </div>
          </button>

          {/* Individual Project Cards */}
          {teamProjects.map((project) => {
            const isSelected = selectedProjectId === project.id
            const pTasks = teamTasks.filter((t) => t.projectId === project.id)
            const pTotal = pTasks.length
            const pCompleted = pTasks.filter((t) => t.status === 'completed').length
            const pActive = pTotal - pCompleted
            const pProgress =
              pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : project.progress || 0

            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProjectId(project.id)}
                className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-lime-400 dark:border-lime-400/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] ring-1 ring-lime-400'
                    : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
                      {project.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{project.code}</span>
                  </div>
                  <StatusPill status={project.status} size="sm" />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Progress</span>
                    <span className="font-bold text-slate-900 dark:text-white font-display">
                      {pProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full"
                      style={{ width: `${pProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{pActive} Active</span>
                    <span>{pCompleted} Done</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right Side (9 cols): Search/Filter Bar & 5-Column Kanban Board */}
        <div className="lg:col-span-9 space-y-4">
          {/* Developer Summary Selection Cards (Similar to project filter cards on left) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Developer Filter
              </span>
              {selectedDevId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedDevId('all')}
                  className="text-[11px] font-semibold text-lime-600 dark:text-lime-400 hover:underline cursor-pointer"
                >
                  Clear dev filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* "All Devs" Card */}
              <button
                type="button"
                onClick={() => setSelectedDevId('all')}
                className={`text-left p-2.5 rounded-2xl transition-all cursor-pointer border ${
                  selectedDevId === 'all'
                    ? 'bg-white dark:bg-slate-900 border-lime-400 ring-1 ring-lime-400 shadow-2xs'
                    : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                      selectedDevId === 'all'
                        ? 'bg-lime-400 text-slate-950 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    All Devs
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 pl-1">
                  {teamMembers.length} squad engineers
                </div>
              </button>

              {/* Developer Cards */}
              {teamMembers.map((dev) => {
                const isSelected = selectedDevId === dev.id
                const devTasks = teamTasks.filter((t) => t.assigneeId === dev.id)
                const devActive = devTasks.filter((t) => t.status !== 'completed').length
                const devDone = devTasks.filter((t) => t.status === 'completed').length

                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => setSelectedDevId(dev.id)}
                    className={`text-left p-2.5 rounded-2xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 border-lime-400 ring-1 ring-lime-400 shadow-2xs'
                        : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {dev.initials}
                        </div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {dev.name.split(' ')[0]}
                        </span>
                      </div>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                      <span>{devActive} active</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {devDone} done
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-3 rounded-2xl bg-white dark:bg-[#0f1422] border border-slate-200/70 dark:border-slate-800/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search team tasks, tags, or briefs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-400 shrink-0">{filteredTasks.length} tasks</span>
          </div>

          {/* 5-Column Kanban Board */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 items-start min-w-[1150px]">
              {columns.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.id)
                const isDragOver = dragOverColId === col.id

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`flex-1 min-w-[220px] rounded-2xl p-3.5 min-h-[500px] flex flex-col transition-colors border ${
                      isDragOver
                        ? 'bg-lime-50/50 dark:bg-lime-950/20 border-lime-400'
                        : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                          {col.label}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-500 shadow-2xs">
                        {colTasks.length}
                      </span>
                    </div>

                    {/* Tasks List */}
                    <div className="space-y-2.5 flex-1">
                      {colTasks.length === 0 ? (
                        <div className="py-10 text-center text-[11px] text-slate-400/80">
                          Drop task here
                        </div>
                      ) : (
                        colTasks.map((task) => {
                          const isDragging = draggedTaskId === task.id
                          const assignee = task.assignee

                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onClick={() => setSelectedTaskModal(task)}
                              className={`p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/70 dark:border-slate-750 shadow-2xs hover:shadow-xs transition-all cursor-pointer group space-y-2.5 ${
                                isDragging ? 'opacity-40 scale-95' : ''
                              }`}
                            >
                              {/* Card Top: Project Code & Priority */}
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-mono text-slate-400">
                                  {task.project?.code || 'SQUAD'}
                                </span>
                                <Badge
                                  variant={
                                    task.priority === 'urgent'
                                      ? 'rose'
                                      : task.priority === 'high'
                                        ? 'amber'
                                        : 'slate'
                                  }
                                  size="xs"
                                >
                                  {task.priority}
                                </Badge>
                              </div>

                              {/* Task Title */}
                              <div className="font-semibold text-xs text-slate-900 dark:text-white leading-snug line-clamp-2">
                                {task.title}
                              </div>

                              {/* Assignee & Due Date */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                                <span className="flex items-center gap-1 truncate font-medium text-slate-700 dark:text-slate-300">
                                  <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold">
                                    {assignee?.initials || 'D'}
                                  </span>
                                  <span className="truncate">
                                    {assignee?.name?.split(' ')[0] || 'Dev'}
                                  </span>
                                </span>
                                <span className="flex items-center gap-1 shrink-0">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {formatDate(task.dueDate, 'short')}
                                </span>
                              </div>

                              {/* In-Review PM Action Buttons */}
                              {col.id === 'in_review' && (
                                <div
                                  className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      approveTask(task.id, 'Approved via PM Kanban board')
                                    }
                                    className="flex-1 py-1.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectingTask(task)
                                      setRejectFeedback('')
                                    }}
                                    className="flex-1 py-1.5 px-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors whitespace-nowrap shadow-2xs"
                                  >
                                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>Reject</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create New Task */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Sprint Task"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Integrate Canvas 2D fallback for unsupported WebGL clients"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Project <span className="text-rose-500">*</span>
              </label>
              <select
                value={newTaskProject}
                onChange={(e) => setNewTaskProject(e.target.value)}
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
                Assignee Developer <span className="text-rose-500">*</span>
              </label>
              <select
                value={newTaskDev}
                onChange={(e) => setNewTaskDev(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.title})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Description & Requirements
            </label>
            <textarea
              rows={3}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Technical specifications, deliverable requirements, or acceptance criteria..."
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g., frontend, canvas, fallback, perf"
              value={newTaskTags}
              onChange={(e) => setNewTaskTags(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="lime" size="sm" icon={Plus}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reject with Feedback */}
      <Modal
        isOpen={Boolean(rejectingTask)}
        onClose={() => setRejectingTask(null)}
        title={`Reject Deliverable: ${rejectingTask?.title || 'Task'}`}
      >
        <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            This task will be returned to <strong>In Progress</strong> for developer revision.
            Please provide specific technical feedback or missing acceptance criteria.
          </p>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Review Feedback <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder="e.g. PR was missing automated tests for error boundary handling on network disconnect. Please add coverage and resubmit."
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRejectingTask(null)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" icon={XCircle}>
              Return to In Progress
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PmTaskManagementPage
