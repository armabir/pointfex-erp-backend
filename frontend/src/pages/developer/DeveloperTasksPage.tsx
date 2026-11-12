import React, { useState } from 'react'
import { Badge } from '../../components/common/Badge'
import { useDeveloperData } from '../../hooks/useDeveloperData'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { getRelativeDeadline } from '../../utils/formatters'
import { Clock, FolderGit2, Lock, Layers, CheckCircle2, GripVertical } from 'lucide-react'
import type { TaskStatus } from '../../types'

export function DeveloperTasksPage() {
  const { allDevTasks, devProjects } = useDeveloperData()
  const { setSelectedTaskModal, updateTaskStatus, showToast } = useApp()
  const { hasPermission } = usePermissions()
  const canApproveTasks = hasPermission('tasks:approve')

  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)

  const columns: { id: TaskStatus; label: string; dot: string; pmOnly?: boolean }[] = [
    { id: 'todo', label: 'To Do', dot: 'bg-slate-400 dark:bg-slate-500' },
    { id: 'in_progress', label: 'In Progress', dot: 'bg-sky-500' },
    { id: 'in_review', label: 'In Review', dot: 'bg-purple-500' },
    {
      id: 'completed',
      label: 'Completed',
      dot: 'bg-emerald-500',
      pmOnly: true,
    },
    { id: 'blocked', label: 'Blocked', dot: 'bg-rose-500' },
  ]

  // Filter tasks by selected project
  const filteredTasks = allDevTasks.filter((task) => {
    if (selectedProjectId !== 'all' && task.projectId !== selectedProjectId) {
      return false
    }
    return true
  })

  // Calculate project summary stats for the sidebar
  const totalTasksCount = allDevTasks.length
  const totalCompletedCount = allDevTasks.filter((t) => t.status === 'completed').length
  const totalActiveCount = totalTasksCount - totalCompletedCount
  const overallProgress =
    totalTasksCount > 0 ? Math.round((totalCompletedCount / totalTasksCount) * 100) : 0

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

  const handleDragLeave = (_e: React.DragEvent<HTMLDivElement>, colId: string) => {
    if (dragOverColId === colId) {
      setDragOverColId(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetColId: string) => {
    e.preventDefault()
    setDragOverColId(null)
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId
    if (!taskId) return

    const task = allDevTasks.find((t) => t.id === taskId)
    if (!task) return

    if (task.status === targetColId) return

    // Permission enforcement: users without tasks:approve cannot drag into completed
    if (!canApproveTasks && targetColId === 'completed') {
      showToast(
        'Permission denied: Deliverable completion approval (`tasks:approve`) is required',
        'error',
      )
      return
    }

    updateTaskStatus(taskId, targetColId as TaskStatus)
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            My Tasks
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Interactive Kanban board · Drag and drop to update status
          </p>
        </div>

        {!canApproveTasks ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs font-medium self-start sm:self-auto">
            <Lock className="w-3.5 h-3.5" />
            <span>Approval Policy: Completed deliverables require PM review</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Executive Oversight: Full deliverable verification enabled</span>
          </div>
        )}
      </div>

      {/* Main Grid: Projects Sidebar (Left) + 5-Column Kanban (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Project Cards Filter Sidebar */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
              Project Filter
            </span>
            <span className="text-[11px] text-slate-400">{devProjects.length + 1} views</span>
          </div>

          {/* All Projects Card */}
          <div
            onClick={() => setSelectedProjectId('all')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedProjectId === 'all'
                ? 'bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 border-transparent shadow-xs'
                : 'bg-white dark:bg-[#0f1422] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers
                  className={`w-4 h-4 ${selectedProjectId === 'all' ? 'text-lime-400 dark:text-slate-950' : 'text-slate-400'}`}
                />
                <span className="text-xs font-bold">All Projects</span>
              </div>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-lg font-medium ${
                  selectedProjectId === 'all'
                    ? 'bg-white/20 text-white dark:bg-black/10 dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {totalTasksCount} tasks
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] opacity-80 mb-1.5">
              <span>
                {totalActiveCount} active · {totalCompletedCount} done
              </span>
              <span>{overallProgress}%</span>
            </div>

            <div className="w-full bg-black/10 dark:bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${selectedProjectId === 'all' ? 'bg-lime-400 dark:bg-slate-950' : 'bg-slate-800 dark:bg-slate-300'}`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {/* Individual Project Cards */}
          {devProjects.map((proj) => {
            const isSelected = selectedProjectId === proj.id
            const projDevTasks = allDevTasks.filter((t) => t.projectId === proj.id)
            const projCompleted = projDevTasks.filter((t) => t.status === 'completed').length
            const projActive = projDevTasks.length - projCompleted
            const projProgress =
              projDevTasks.length > 0 ? Math.round((projCompleted / projDevTasks.length) * 100) : 0

            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 border-transparent shadow-xs'
                    : 'bg-white dark:bg-[#0f1422] text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold truncate pr-1">{proj.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white dark:bg-black/10 dark:text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {proj.code}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] opacity-80 mb-1.5">
                  <span>
                    {projActive} active · {projCompleted} done
                  </span>
                  <span>{projProgress}%</span>
                </div>

                <div className="w-full bg-black/10 dark:bg-white/20 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${isSelected ? 'bg-lime-400 dark:bg-slate-950' : 'bg-sky-500'}`}
                    style={{ width: `${projProgress}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Right Side: 5-Column Kanban Board */}
        <div className="lg:col-span-9">
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 items-start min-w-[1150px]">
              {columns.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.id)
                const isDragOver = dragOverColId === col.id

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={(e) => handleDragLeave(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`flex-1 min-w-[220px] rounded-3xl p-3 flex flex-col min-h-[500px] border transition-all ${
                      isDragOver
                        ? 'bg-lime-50/60 dark:bg-lime-950/30 border-lime-400 dark:border-lime-500 ring-2 ring-lime-300 dark:ring-lime-700'
                        : 'bg-slate-100/70 dark:bg-[#0f1422] border-slate-200/50 dark:border-slate-800'
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-2 px-1 border-b border-slate-200/50 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {col.label}
                        </span>
                        {col.pmOnly && !canApproveTasks && (
                          <span title="PM approval required">
                            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-slate-800">
                        {colTasks.length}
                      </span>
                    </div>

                    {/* Task Cards in this Column */}
                    <div className="flex-1 space-y-2.5 overflow-y-auto">
                      {colTasks.length === 0 ? (
                        <div className="h-32 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-white/30 dark:bg-[#131a2b]/30 flex flex-col items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic p-3 text-center">
                          {col.pmOnly && !canApproveTasks ? (
                            <span className="flex items-center gap-1 text-[11px] not-italic">
                              <Lock className="w-3 h-3" />
                              PM Verification
                            </span>
                          ) : (
                            'Drop tasks here'
                          )}
                        </div>
                      ) : (
                        colTasks.map((task) => {
                          const deadline = getRelativeDeadline(task.dueDate)
                          const isBeingDragged = draggedTaskId === task.id
                          const projCode =
                            devProjects.find((p) => p.id === task.projectId)?.code || 'PROJ'

                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedTaskModal(task)}
                              className={`p-3 bg-white dark:bg-[#182033] border rounded-2xl cursor-grab active:cursor-grabbing transition-all duration-150 shadow-2xs hover:shadow-xs group ${
                                isBeingDragged
                                  ? 'opacity-40 border-lime-400 ring-2 ring-lime-300 dark:ring-lime-500'
                                  : 'border-slate-200/80 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5 mb-2">
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

                                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  <Clock className="w-3 h-3" />
                                  <span>{task.loggedHours}h</span>
                                  <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                                </div>
                              </div>

                              <h4 className="text-xs font-medium text-slate-900 dark:text-slate-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors line-clamp-2 leading-snug">
                                {task.title}
                              </h4>

                              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-400">
                                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                  {projCode}
                                </span>
                                <span
                                  className={
                                    deadline.isOverdue
                                      ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                      : ''
                                  }
                                >
                                  {deadline.label}
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
    </div>
  )
}
