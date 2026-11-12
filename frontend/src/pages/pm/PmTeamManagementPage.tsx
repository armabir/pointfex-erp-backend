import React, { useState } from 'react'
import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { usePmData } from '../../hooks/usePmData'
import { useApp } from '../../context/AppContext'
import type { DeveloperWorkload } from '../../types'
import { Mail, Globe, ArrowRightLeft, CheckCircle2, Clock } from 'lucide-react'

export function PmTeamManagementPage() {
  const { team, developerWorkloads, teamMembers } = usePmData()
  const { reassignTask } = useApp()

  // Simple Reassign Modal State
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [sourceDev, setSourceDev] = useState<DeveloperWorkload | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [targetDevId, setTargetDevId] = useState('')

  const handleOpenReassign = (dev: DeveloperWorkload) => {
    setSourceDev(dev)
    const activeTasks = dev.tasks.filter((t) => t.status !== 'completed')
    setSelectedTaskId(activeTasks[0]?.id || '')
    const otherDevs = teamMembers.filter((m) => m.id !== dev.id)
    setTargetDevId(otherDevs[0]?.id || '')
    setReassignModalOpen(true)
  }

  const handleConfirmReassign = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTaskId || !targetDevId) return
    reassignTask(selectedTaskId, targetDevId)
    setReassignModalOpen(false)
    setSourceDev(null)
  }

  const workloads = developerWorkloads

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            {team?.name || 'Squad'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {team?.focus} · {teamMembers.length} Dedicated Engineers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="emerald" size="sm" dot>
            {team?.weeklyVelocity || 42} pts Velocity
          </Badge>
        </div>
      </div>

      {/* 4 Developer Squad Cards (Simple, Clean & Relaxing) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workloads.map((member) => {
          const activeTasks = member.tasks.filter((t) => t.status !== 'completed')
          return (
            <Card key={member.id} noPadding>
              <div className="p-5 space-y-4 text-xs">
                {/* Header: Avatar, Name, Title, Online Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white dark:bg-slate-800 flex items-center justify-center font-bold text-sm border border-slate-200/60 dark:border-slate-700 shrink-0">
                      {member.initials || 'DEV'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {member.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {member.title}
                      </div>
                    </div>
                  </div>

                  <Badge variant={member.status === 'online' ? 'emerald' : 'slate'} size="xs" dot>
                    {member.status}
                  </Badge>
                </div>

                {/* Contact info */}
                <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {member.email}
                  </span>
                  {member.timezone && (
                    <span className="flex items-center gap-1.5 shrink-0">
                      <Globe className="w-3.5 h-3.5 text-slate-400" /> {member.timezone}
                    </span>
                  )}
                </div>

                {/* Workload Stats & Reassign Action */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {member.activeTasks}
                      </span>
                      <span className="text-[11px] text-slate-400">active</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {member.completedTasks}
                      </span>
                      <span className="text-[11px] text-slate-400">done</span>
                    </div>
                  </div>

                  {activeTasks.length > 0 && (
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={ArrowRightLeft}
                      onClick={() => handleOpenReassign(member)}
                    >
                      Reassign
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Clean Reassign Task Modal */}
      <Modal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        title={`Reassign Task from ${sourceDev?.name || 'Developer'}`}
      >
        <form onSubmit={handleConfirmReassign} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Active Task to Reassign <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {sourceDev?.tasks
                .filter((t) => t.status !== 'completed')
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.priority.toUpperCase()})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Assign to Teammate <span className="text-rose-500">*</span>
            </label>
            <select
              value={targetDevId}
              onChange={(e) => setTargetDevId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              {teamMembers
                .filter((m) => m.id !== sourceDev?.id)
                .map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name} ({dev.title})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setReassignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="lime" size="sm" icon={ArrowRightLeft}>
              Confirm Reassignment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default PmTeamManagementPage
