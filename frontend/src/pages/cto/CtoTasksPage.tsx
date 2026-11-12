import React, { useState, useMemo } from 'react'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { useCtoData } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/formatters'
import type { TaskStatus, TaskPriority } from '../../types'
import { Clock, Search, Plus, CheckCircle2 } from 'lucide-react'

interface ColumnDef {
  id: TaskStatus
  label: string
  dot: string
}

const COLUMNS: ColumnDef[] = [
  { id: 'todo', label: 'To Do', dot: 'bg-slate-400 dark:bg-slate-500' },
  { id: 'in_progress', label: 'In Progress', dot: 'bg-sky-500' },
  { id: 'in_review', label: 'In Review', dot: 'bg-purple-500' },
  { id: 'completed', label: 'Completed', dot: 'bg-emerald-500' },
  { id: 'blocked', label: 'Blocked', dot: 'bg-rose-500' },
]

export function CtoTasksPage() {
  const { ctoPersonalTasks, projects } = useCtoData()
  const { createCtoPersonalTask, updateCtoPersonalTaskStatus, setSelectedTaskModal, showToast } =
    useApp()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  // Create Task Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium')
  const [taskProjectId, setTaskProjectId] = useState(projects[0]?.id || '')
  const [taskDueDate, setTaskDueDate] = useState('2026-11-28')
  const [taskTags, setTaskTags] = useState('Executive, Architecture')

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)

  const columns = COLUMNS

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return ctoPersonalTasks.filter((task) => {
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = task.title.toLowerCase().includes(q)
        const descMatch = task.description?.toLowerCase().includes(q)
        const tagMatch = task.tags?.some((t) => t.toLowerCase().includes(q))
        if (!titleMatch && !descMatch && !tagMatch) return false
      }

      return true
    })
  }, [ctoPersonalTasks, priorityFilter, searchQuery])

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

    const task = ctoPersonalTasks.find((t) => t.id === taskId)
    if (!task || task.status === targetColId) return

    // CTO can complete own tasks
    updateCtoPersonalTaskStatus(taskId, targetColId)
    showToast(`Task moved to ${targetColId.replace('_', ' ')}`, 'success')
    setDraggedTaskId(null)
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) {
      showToast('Task title is required.', 'error')
      return
    }

    const tagsArray = taskTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    createCtoPersonalTask({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      priority: taskPriority,
      projectId: taskProjectId || undefined,
      dueDate: taskDueDate,
      tags: tagsArray.length > 0 ? tagsArray : ['Executive', 'Architecture'],
    })

    setIsCreateModalOpen(false)
    setTaskTitle('')
    setTaskDesc('')
  }

  const completedCount = ctoPersonalTasks.filter((t) => t.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            My Tasks & Directives
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="emerald" size="sm">
            {completedCount} / {ctoPersonalTasks.length} Completed
          </Badge>
          <Button variant="lime" size="sm" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
            Add Task
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search my tasks by title, description, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-lime-500"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setPriorityFilter('all')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              priorityFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({ctoPersonalTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setPriorityFilter('urgent')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              priorityFilter === 'urgent'
                ? 'bg-rose-500 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Urgent
          </button>
          <button
            type="button"
            onClick={() => setPriorityFilter('high')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              priorityFilter === 'high'
                ? 'bg-amber-500 text-white font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            High
          </button>
          <button
            type="button"
            onClick={() => setPriorityFilter('medium')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              priorityFilter === 'medium'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Medium
          </button>
        </div>
      </div>

      {/* Full-Width 5-Column Kanban Board */}
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
                className={`flex-1 min-w-[220px] rounded-3xl p-3.5 border transition-colors min-h-[520px] flex flex-col ${
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
                <div className="space-y-3 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-2xl flex items-center justify-center p-3 text-center">
                      <span className="text-[11px] text-slate-400">Empty</span>
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedTaskModal(task)}
                        className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/70 hover:border-lime-400 dark:hover:border-lime-500 hover:shadow-xs transition-all duration-150 cursor-grab active:cursor-grabbing group space-y-2.5"
                      >
                        {/* Top Row: Project Code & Priority */}
                        <div className="flex items-center justify-between gap-1">
                          <Badge variant="indigo" size="xs">
                            {task.project?.code || 'CTO-EXEC'}
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

                        {/* Title */}
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors line-clamp-2">
                          {task.title}
                        </h4>

                        {/* Description */}
                        {task.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {task.tags.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-600/60"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{formatDate(task.dueDate, 'short')}</span>
                          </div>

                          {col.id === 'completed' ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateCtoPersonalTaskStatus(task.id, 'completed')
                                showToast('Task marked as completed!', 'success')
                              }}
                              className="text-[10px] font-semibold text-lime-600 dark:text-lime-400 hover:underline cursor-pointer"
                            >
                              Mark Done
                            </button>
                          )}
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

      {/* Modal: Add Personal Task */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Add Personal CTO Task"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Finalize Zero-Trust mesh topology for SOC2 audit"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Description & Deliverable Notes
              </label>
              <textarea
                rows={3}
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Technical objectives, dependencies, and requirements..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Project
                </label>
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="">Internal Executive Initiative</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={taskTags}
                  onChange={(e) => setTaskTags(e.target.value)}
                  placeholder="e.g. Architecture, SOC2, Roadmap"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm" icon={Plus}>
                Add Task
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
