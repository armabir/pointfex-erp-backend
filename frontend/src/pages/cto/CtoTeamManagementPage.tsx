import React, { useState, useMemo } from 'react'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Avatar } from '../../components/common/Avatar'
import { useCtoData, type TeamWithDetails } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import {
  Users,
  Search,
  FolderGit2,
  ShieldCheck,
  UserCheck,
  Plus,
  Edit2,
  CheckCircle2,
} from 'lucide-react'

export function CtoTeamManagementPage() {
  const { teams, developers, projectManagers, projects } = useCtoData()
  const { createTeam, updateTeam, showToast } = useApp()
  const { hasPermission, hasAnyPermission } = usePermissions()

  const canCreateSquad = hasPermission('teams:create')
  const canManageSquad = hasAnyPermission('teams:update', 'teams:manage_members')

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSquad, setSelectedSquad] = useState<TeamWithDetails | null>(null)

  // Create Squad Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newSquadName, setNewSquadName] = useState('')
  const [newSquadCode, setNewSquadCode] = useState('')
  const [newPmId, setNewPmId] = useState('')
  const [newMemberIds, setNewMemberIds] = useState<string[]>([])
  const [newProjectIds, setNewProjectIds] = useState<string[]>([])

  // Edit Squad Modal State
  const [editingSquad, setEditingSquad] = useState<TeamWithDetails | null>(null)
  const [editSquadName, setEditSquadName] = useState('')
  const [editSquadCode, setEditSquadCode] = useState('')
  const [editPmId, setEditPmId] = useState('')
  const [editMemberIds, setEditMemberIds] = useState<string[]>([])
  const [editProjectIds, setEditProjectIds] = useState<string[]>([])

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        (t.pm?.name || '').toLowerCase().includes(q)
      )
    })
  }, [teams, searchQuery])

  const handleOpenEdit = (squad: TeamWithDetails) => {
    setEditingSquad(squad)
    setEditSquadName(squad.name)
    setEditSquadCode(squad.code)
    setEditPmId(squad.pmId || '')
    setEditMemberIds(squad.memberIds || [])
    setEditProjectIds(squad.projectIds || [])
  }

  const [pendingSquadConfirm, setPendingSquadConfirm] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; squadId: string; squadName: string }
    | null
  >(null)

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = newSquadName.trim()
    const cleanCode = newSquadCode.trim().toUpperCase()
    if (cleanName.length < 2 || cleanName.length > 100) {
      showToast('Squad name must be between 2 and 100 characters.', 'error')
      return
    }
    if (/^\d+$/.test(cleanName)) {
      showToast('Squad name must include letters, not numbers only.', 'error')
      return
    }
    if (!/^[A-Z0-9-]{2,16}$/.test(cleanCode)) {
      showToast('Squad code must be 2–16 letters, numbers, or hyphens (e.g. SQ-07).', 'error')
      return
    }
    setPendingSquadConfirm({ mode: 'create' })
  }

  const executeSquadConfirm = () => {
    if (!pendingSquadConfirm) return
    if (pendingSquadConfirm.mode === 'create') {
      createTeam({
        name: newSquadName.trim(),
        code: newSquadCode.trim().toUpperCase(),
        focus: 'General software engineering and delivery',
        pmId: newPmId || undefined,
        memberIds: newMemberIds,
        projectIds: newProjectIds,
      })
      setIsCreateModalOpen(false)
      setNewSquadName('')
      setNewSquadCode('')
      setNewPmId('')
      setNewMemberIds([])
      setNewProjectIds([])
    } else if (editingSquad) {
      updateTeam(editingSquad.id, {
        name: editSquadName.trim(),
        code: editSquadCode.trim().toUpperCase(),
        pmId: editPmId || undefined,
        memberIds: editMemberIds,
        projectIds: editProjectIds,
      })
      setEditingSquad(null)
    }
    setPendingSquadConfirm(null)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSquad) return
    const cleanName = editSquadName.trim()
    const cleanCode = editSquadCode.trim().toUpperCase()
    if (cleanName.length < 2 || cleanName.length > 100 || /^\d+$/.test(cleanName)) {
      showToast('Squad name must be 2–100 characters and include letters.', 'error')
      return
    }
    if (!/^[A-Z0-9-]{2,16}$/.test(cleanCode)) {
      showToast('Squad code must be 2–16 letters, numbers, or hyphens.', 'error')
      return
    }
    setPendingSquadConfirm({
      mode: 'edit',
      squadId: editingSquad.id,
      squadName: cleanName,
    })
  }

  const toggleCreateMember = (devId: string) => {
    setNewMemberIds((prev) =>
      prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId],
    )
  }

  const toggleCreateProject = (projId: string) => {
    setNewProjectIds((prev) =>
      prev.includes(projId) ? prev.filter((id) => id !== projId) : [...prev, projId],
    )
  }

  const toggleEditMember = (devId: string) => {
    setEditMemberIds((prev) =>
      prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId],
    )
  }

  const toggleEditProject = (projId: string) => {
    setEditProjectIds((prev) =>
      prev.includes(projId) ? prev.filter((id) => id !== projId) : [...prev, projId],
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-display">
            Engineering Squads &amp; Teams
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Organize cross-functional squads, project leads, and sprint allocation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateSquad && (
            <Button
              variant="brand"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create New Squad
            </Button>
          )}
        </div>
      </div>

      {/* Top 4 Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {teams.length} Squads
            </div>
            <div className="text-[11px] text-slate-400">Total Teams</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {developers.length} Developers
            </div>
            <div className="text-[11px] text-slate-400">Active Engineers</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-950/40 text-lime-600 dark:text-lime-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {projectManagers.length} PMs
            </div>
            <div className="text-[11px] text-slate-400">Assigned Managers</div>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FolderGit2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {projects.length} Projects
            </div>
            <div className="text-[11px] text-slate-400">Active Deliverables</div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search squads by name, code, or PM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-lime-500"
          />
        </div>
      </div>

      {/* Squad Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTeams.map((squad) => {
          const completionRate =
            squad.tasksCount > 0
              ? Math.round((squad.completedTasksCount / squad.tasksCount) * 100)
              : 0

          return (
            <div
              key={squad.id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col justify-between shadow-2xs group space-y-4"
            >
              <div className="space-y-3">
                {/* Header Row: Code & Squad Name */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="indigo" size="xs">
                      {squad.code}
                    </Badge>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {squad.name.split('—')[0]}
                    </span>
                  </div>
                  <Badge variant="slate" size="xs">
                    {squad.members.length} Devs
                  </Badge>
                </div>

                {/* Assigned PM */}
                <div className="flex items-center justify-between text-xs py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400 font-medium">Project Manager</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar
                      src={squad.pm?.avatarUrl || squad.pm?.avatar}
                      name={squad.pm?.name || 'Project Manager'}
                      initials={squad.pm?.initials}
                      size="xs"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                      {squad.pm?.name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Assigned Projects */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Assigned Projects ({squad.projects.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {squad.projects.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">
                        No projects assigned
                      </span>
                    ) : (
                      squad.projects.map((proj) => (
                        <span
                          key={proj.id}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono flex items-center gap-1 border border-indigo-100 dark:border-indigo-800/40"
                        >
                          <FolderGit2 className="w-3 h-3" />
                          {proj.code}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Task Completion Progress Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Task Completion</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {squad.completedTasksCount} / {squad.tasksCount} ({completionRate}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-lime-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer: Member avatars + Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {squad.members.slice(0, 5).map((member) => (
                    <Avatar
                      key={member.id}
                      src={member.avatarUrl || member.avatar}
                      name={member.name}
                      initials={member.initials}
                      title={`${member.name} (${member.title})`}
                      className="w-6 h-6 text-[10px] ring-2 ring-white dark:ring-slate-900"
                    />
                  ))}
                  {squad.members.length > 5 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 ring-2 ring-white dark:ring-slate-900">
                      +{squad.members.length - 5}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {canManageSquad && (
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={Edit2}
                      onClick={() => handleOpenEdit(squad)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button variant="secondary" size="xs" onClick={() => setSelectedSquad(squad)}>
                    Inspect
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Squad Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Engineering Squad"
        >
          <form onSubmit={handleSaveCreate} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Squad Name *
                </label>
                <input
                  type="text"
                  value={newSquadName}
                  onChange={(e) => setNewSquadName(e.target.value)}
                  placeholder="e.g. Squad Theta — Quantum Services"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Squad Code *
                </label>
                <input
                  type="text"
                  value={newSquadCode}
                  onChange={(e) => setNewSquadCode(e.target.value)}
                  placeholder="e.g. SQ-07"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 uppercase"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Assigned PM
              </label>
              <select
                value={newPmId}
                onChange={(e) => setNewPmId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
              >
                <option value="">Unassigned</option>
                {projectManagers.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Assign Projects
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newProjectIds.includes(p.id)}
                      onChange={() => toggleCreateProject(p.id)}
                      className="rounded accent-lime-500"
                    />
                    <span className="truncate">
                      {p.code} — {p.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Assign Dedicated Developers
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                {developers.map((dev) => (
                  <label
                    key={dev.id}
                    className="flex items-center gap-2 text-[11px] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={newMemberIds.includes(dev.id)}
                      onChange={() => toggleCreateMember(dev.id)}
                      className="rounded accent-lime-500"
                    />
                    <span className="truncate">{dev.name}</span>
                  </label>
                ))}
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
                Create Squad
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Squad Modal */}
      {editingSquad && (
        <Modal
          isOpen={!!editingSquad}
          onClose={() => setEditingSquad(null)}
          title={`Edit Squad — ${editingSquad.name}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Squad Name
                </label>
                <input
                  type="text"
                  value={editSquadName}
                  onChange={(e) => setEditSquadName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Squad Code
                </label>
                <input
                  type="text"
                  value={editSquadCode}
                  onChange={(e) => setEditSquadCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 uppercase"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Assigned PM
              </label>
              <select
                value={editPmId}
                onChange={(e) => setEditPmId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
              >
                <option value="">Unassigned</option>
                {projectManagers.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Assigned Projects
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editProjectIds.includes(p.id)}
                      onChange={() => toggleEditProject(p.id)}
                      className="rounded accent-lime-500"
                    />
                    <span className="truncate">
                      {p.code} — {p.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Squad Members
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                {developers.map((dev) => (
                  <label
                    key={dev.id}
                    className="flex items-center gap-2 text-[11px] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editMemberIds.includes(dev.id)}
                      onChange={() => toggleEditMember(dev.id)}
                      className="rounded accent-lime-500"
                    />
                    <span className="truncate">{dev.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingSquad(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm" icon={CheckCircle2}>
                Save Squad Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Squad Inspection Modal */}
      {selectedSquad && (
        <Modal
          isOpen={!!selectedSquad}
          onClose={() => setSelectedSquad(null)}
          title={
            selectedSquad
              ? `${selectedSquad.name} (${selectedSquad.code}) — Squad Overview`
              : 'Squad'
          }
        >
          <div className="space-y-4 text-xs">
            {/* PM Card */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-slate-400 font-medium">Assigned Project Manager</span>
              <div className="flex items-center gap-2">
                <Avatar
                  src={selectedSquad.pm?.avatarUrl || selectedSquad.pm?.avatar}
                  name={selectedSquad.pm?.name || 'Project Manager'}
                  initials={selectedSquad.pm?.initials}
                  className="w-6 h-6 text-[10px]"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedSquad.pm?.name || 'Unassigned'}
                </span>
              </div>
            </div>

            {/* Members List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Dedicated Engineers ({selectedSquad.members.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedSquad.members.map((member) => (
                  <div
                    key={member.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                  >
                    <Avatar
                      src={member.avatarUrl || member.avatar}
                      name={member.name}
                      initials={member.initials}
                      className="w-8 h-8 text-xs"
                    />
                    <div>
                      <h5 className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {member.name}
                      </h5>
                      <span className="text-[10px] text-slate-400 block">{member.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Projects */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Managed Projects ({selectedSquad.projects.length})
              </h4>
              <div className="space-y-2">
                {selectedSquad.projects.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.code} — {p.name}
                      </span>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{p.description}</p>
                    </div>
                    <span className="font-bold text-sky-600 dark:text-sky-400">{p.progress}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={() => setSelectedSquad(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {pendingSquadConfirm && (
        <ConfirmDialog
          isOpen={!!pendingSquadConfirm}
          onClose={() => setPendingSquadConfirm(null)}
          onConfirm={executeSquadConfirm}
          title={
            pendingSquadConfirm.mode === 'create'
              ? 'Create Engineering Squad?'
              : `Save changes to ${pendingSquadConfirm.squadName}?`
          }
          message={
            pendingSquadConfirm.mode === 'create'
              ? `Create squad "${newSquadName.trim()}" (${newSquadCode.trim().toUpperCase()}) with ${newMemberIds.length} member(s) and ${newPmId ? 'an assigned PM' : 'no PM assigned yet'}?`
              : `Update squad configuration, PM assignment, and roster (${editMemberIds.length} member(s))?`
          }
          confirmLabel={pendingSquadConfirm.mode === 'create' ? 'Create Squad' : 'Save Changes'}
        />
      )}
    </div>
  )
}
