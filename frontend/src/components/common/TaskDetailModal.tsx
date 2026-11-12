import React, { useState } from 'react'
import { Modal } from './Modal'
import { Badge } from './Badge'
import { StatusPill } from './StatusPill'
import { Button } from './Button'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { formatDate } from '../../utils/formatters'
import { Calendar, Clock, CheckCircle2, Send } from 'lucide-react'
import type { Task, EnrichedTask, TaskStatus } from '../../types'

export interface TaskDetailModalProps {
  task: Task | EnrichedTask | null
  isOpen: boolean
  onClose: () => void
}

export function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  const { data, updateTaskStatus, addTaskComment, resolvers, showToast } = useApp()
  const { hasPermission } = usePermissions()
  const canApproveTasks = hasPermission('tasks:approve')
  const [newComment, setNewComment] = useState('')

  if (!task) return null

  // Always read freshest task state from data
  const currentTask = data.tasks.find((t) => t.id === task.id) || task

  const project = resolvers.getProject(currentTask.projectId)
  const comments = data.comments.filter((c) => c.taskId === currentTask.id)

  const handleStatusChange = (newStatus: string) => {
    if (!canApproveTasks && newStatus === 'completed') {
      showToast(
        'Permission denied: Deliverable completion approval (`tasks:approve`) is required',
        'error',
      )
      return
    }
    updateTaskStatus(currentTask.id, newStatus as TaskStatus)
  }

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    addTaskComment(currentTask.id, newComment.trim())
    setNewComment('')
  }

  const isDev = !canApproveTasks

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentTask.title}
      subtitle={project?.name || 'Project'}
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>

          {isDev ? (
            // Developer action button
            currentTask.status === 'in_review' ? (
              <Button variant="secondary" size="sm" disabled>
                <Clock className="w-3.5 h-3.5 mr-1" />
                Awaiting PM Review
              </Button>
            ) : currentTask.status === 'completed' ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Verified & Completed
              </span>
            ) : (
              <Button
                variant="lime"
                size="sm"
                icon={Send}
                onClick={() => {
                  handleStatusChange('in_review')
                  onClose()
                }}
              >
                Submit for Review
              </Button>
            )
          ) : // PM / Executive action button
          currentTask.status !== 'completed' ? (
            <Button
              variant="lime"
              size="sm"
              icon={CheckCircle2}
              onClick={() => {
                handleStatusChange('completed')
                onClose()
              }}
            >
              Approve & Complete
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => handleStatusChange('in_progress')}>
              Reopen Task
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Status & Priority Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-[#131a2b] rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
            <select
              value={currentTask.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-slate-400 cursor-pointer font-medium"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="completed" disabled={isDev}>
                Completed {isDev ? '(PM Only)' : ''}
              </option>
              <option value="blocked">Blocked</option>
            </select>
            <StatusPill status={currentTask.status} size="sm" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">Priority:</span>
            <Badge
              variant={
                currentTask.priority === 'urgent'
                  ? 'rose'
                  : currentTask.priority === 'high'
                    ? 'amber'
                    : 'slate'
              }
              size="xs"
            >
              {currentTask.priority}
            </Badge>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</h4>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-[#131a2b] p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            {currentTask.description || 'No description provided.'}
          </p>
        </div>

        {/* Metadata info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-[#131a2b] border border-slate-100 dark:border-slate-800 text-[11px]">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block">Due Date</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDate(currentTask.dueDate, 'medium')}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block">Logged Time</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {currentTask.loggedHours || 0} hrs
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block">Reviewer</span>
            <span className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 block truncate">
              {isDev ? 'Sarah Jenkins (PM)' : 'You (PM Review)'}
            </span>
          </div>
        </div>

        {/* Comments Section */}
        <div>
          <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Activity & Comments
          </h4>

          <div className="space-y-2 max-h-36 overflow-y-auto mb-3 pr-1">
            {comments.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500 italic py-2 text-center text-[11px]">
                No comments on this task yet.
              </p>
            ) : (
              comments.map((c) => {
                const author = resolvers.getUser(c.authorId)
                return (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#131a2b] border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                        {author?.name || 'Team Member'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDate(c.createdAt, 'short')}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-snug">{c.content}</p>
                  </div>
                )
              })
            )}
          </div>

          {/* Add comment input */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add an update or note..."
              className="flex-1 bg-slate-50 dark:bg-[#131a2b] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-[#0b101b] focus:outline-none focus:border-slate-400"
            />
            <Button type="submit" variant="secondary" size="xs" icon={Send}>
              Send
            </Button>
          </form>
        </div>
      </div>
    </Modal>
  )
}
