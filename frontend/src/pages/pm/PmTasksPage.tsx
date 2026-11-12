import React, { useState, useMemo } from 'react'
import { Badge } from '../../components/common/Badge'
import { usePmData } from '../../hooks/usePmData'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/formatters'
import type { TaskStatus } from '../../types'
import { Clock, Layers, Crown, Search, Lock } from 'lucide-react'

interface ColumnDef {
  id: TaskStatus
  label: string
  dot: string
  isLocked?: boolean
}

interface ExecutiveDef {
  id: string
  name: string
  role: string
  title: string
}

export function PmTasksPage() {
  const { pmPersonalTasks, pm } = usePmData()
  const { updatePmTaskStatus, setSelectedTaskModal, showToast } = useApp()

  // Filters (Executive Filter Sidebar on Left + Search on Right)
  const [selectedExecutive, setSelectedExecutive] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)

  const columns: ColumnDef[] = [
    { id: 'todo', label: 'To Do', dot: 'bg-slate-400 dark:bg-slate-500' },
    { id: 'in_progress', label: 'In Progress', dot: 'bg-sky-500' },
    { id: 'in_review', label: 'In Review', dot: 'bg-purple-500' },
    { id: 'completed', label: 'Completed', dot: 'bg-emerald-500', isLocked: true },
    { id: 'blocked', label: 'Blocked', dot: 'bg-rose-500' },
  ]

  // Executive categories
  const executives: ExecutiveDef[] = [
    {
      id: 'cto',
      name: 'CTO — Technology Office',
      role: 'CTO',
      title: 'Architecture & Engineering Standards',
    },
    {
      id: 'cfo',
      name: 'CFO — Finance Office',
      role: 'CFO',
      title: 'Budgets & Financial Allocations',
    },
    { id: 'cpo', name: 'CPO — People Office', role: 'CPO', title: 'Talent, HR & Squad Health' },
    {
      id: 'ceo',
      name: 'CEO — Executive Office',
      role: 'CEO',
      title: 'Company Roadmap & Milestones',
    },
  ]

  // Filter tasks based on executive assignor and search
  const filteredTasks = useMemo(() => {
    return pmPersonalTasks.filter((task) => {
      if (selectedExecutive !== 'all') {
        const creatorRole = task.creator?.role?.toLowerCase()
        const creatorTitle = task.creator?.title?.toLowerCase() || ''
        const creatorName = task.creator?.name?.toLowerCase() || ''
        const matchesExec =
          creatorRole === selectedExecutive ||
          creatorTitle.includes(selectedExecutive) ||
          creatorName.includes(selectedExecutive) ||
          task.tags?.some((t) => t.toLowerCase() === selectedExecutive)
        if (!matchesExec) return false
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
  }, [pmPersonalTasks, selectedExecutive, searchQuery])

  // Overall stats for left sidebar
  const totalTasksCount = pmPersonalTasks.length
  const totalCompletedCount = pmPersonalTasks.filter((t) => t.status === 'completed').length
  const totalActiveCount = totalTasksCount - totalCompletedCount
  const overallProgress =
    totalTasksCount > 0 ? Math.round((totalCompletedCount / totalTasksCount) * 100) : 0

  // Drag and drop handlers (Exactly like Dev's TasksPage)
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

    const task = pmPersonalTasks.find((t) => t.id === taskId)
    if (!task || task.status === targetColId) return

    // Permission constraint: PM cannot drag directly to Completed (needs C-Level executive verification)
    if (targetColId === 'completed') {
      showToast(
        'Permission denied: PM operational tasks require C-Level executive verification to be marked as Completed. Please move to "In Review" for sign-off.',
        'error',
      )
      setDraggedTaskId(null)
      return
    }

    updatePmTaskStatus(taskId, targetColId)
    setDraggedTaskId(null)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            My Operational Tasks
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Interactive Kanban board · Personal responsibilities assigned to {pm?.name || 'PM'} by
            C-Suite Executives
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs font-medium self-start sm:self-auto">
          <Lock className="w-3.5 h-3.5" />
          <span>PM Mode: "Completed" status requires C-Level executive verification</span>
        </div>
      </div>

      {/* Main 2-Column Grid: Left Executive Filter Sidebar + Right 5-Column Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side (3 cols): Executive Filter Cards */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-slate-400" />
              Executive Filter
            </span>
            <span className="text-[11px] text-slate-400">{executives.length + 1} views</span>
          </div>

          {/* "All Initiatives" Card */}
          <button
            type="button"
            onClick={() => setSelectedExecutive('all')}
            className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
              selectedExecutive === 'all'
                ? 'bg-white dark:bg-slate-900 border-lime-400 dark:border-lime-400/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] ring-1 ring-lime-400'
                : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    selectedExecutive === 'all'
                      ? 'bg-lime-400 text-slate-950 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    All Directives
                  </span>
                  <span className="text-[10px] text-slate-400">C-Suite Directives</span>
                </div>
              </div>
              <Badge variant="lime" size="xs">
                {totalTasksCount}
              </Badge>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Progress</span>
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

          {/* Individual Executive Cards */}
          {executives.map((exec) => {
            const isSelected = selectedExecutive === exec.id
            const eTasks = pmPersonalTasks.filter((t) => {
              const creatorRole = t.creator?.role?.toLowerCase()
              const creatorTitle = t.creator?.title?.toLowerCase() || ''
              const creatorName = t.creator?.name?.toLowerCase() || ''
              return (
                creatorRole === exec.id ||
                creatorTitle.includes(exec.id) ||
                creatorName.includes(exec.id) ||
                t.tags?.some((tag) => tag.toLowerCase() === exec.id)
              )
            })
            const eTotal = eTasks.length
            const eCompleted = eTasks.filter((t) => t.status === 'completed').length
            const eActive = eTotal - eCompleted
            const eProgress = eTotal > 0 ? Math.round((eCompleted / eTotal) * 100) : 0

            return (
              <button
                key={exec.id}
                type="button"
                onClick={() => setSelectedExecutive(exec.id)}
                className={`w-full text-left p-3.5 rounded-2xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-lime-400 dark:border-lime-400/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] ring-1 ring-lime-400'
                    : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate block">
                      {exec.name}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate block">{exec.title}</span>
                  </div>
                  <Badge variant="purple" size="xs">
                    {exec.role}
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Completion</span>
                    <span className="font-bold text-slate-900 dark:text-white font-display">
                      {eProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${eProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{eActive} Active</span>
                    <span>{eCompleted} Done</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right Side (9 cols): Search & 5-Column Kanban Board */}
        <div className="lg:col-span-9 space-y-4">
          {/* Top Bar: Search */}
          <div className="p-3 rounded-2xl bg-white dark:bg-[#0f1422] border border-slate-200/70 dark:border-slate-800/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search directives, tags, or briefs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <span className="text-xs text-slate-400">
              Showing <strong>{filteredTasks.length}</strong> tasks
            </span>
          </div>

          {/* 5-Column Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-start">
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id)
              const isDragOver = dragOverColId === col.id

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`rounded-2xl p-3 min-h-[500px] flex flex-col transition-colors border ${
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
                      {col.isLocked && (
                        <span title="Requires C-Level sign-off">
                          <Lock className="w-3 h-3 text-amber-500" />
                        </span>
                      )}
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
                        const creator = task.creator

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => setSelectedTaskModal(task)}
                            className={`p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/70 dark:border-slate-750 shadow-2xs hover:shadow-xs transition-all cursor-pointer group space-y-2.5 ${
                              isDragging ? 'opacity-40 scale-95' : ''
                            }`}
                          >
                            {/* Card Top: Assignor Badge & Priority */}
                            <div className="flex items-center justify-between gap-1 text-[10px]">
                              <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                {creator?.role?.toUpperCase() || 'C-SUITE'}
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

                            {/* Card Footer: Due Date */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                              <span className="truncate">
                                {creator?.name?.split(' ')[0] || 'Executive'}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatDate(task.dueDate, 'short')}
                              </span>
                            </div>
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
  )
}

export default PmTasksPage
