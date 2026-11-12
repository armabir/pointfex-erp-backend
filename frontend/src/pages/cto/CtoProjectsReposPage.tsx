import React, { useState, useMemo } from 'react'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { StatusPill } from '../../components/common/StatusPill'
import { MoneyInput } from '../../components/common/MoneyInput'
import { useCtoData } from '../../hooks/useCtoData'
import { useApp } from '../../context/AppContext'
import { formatCurrency } from '../../utils/formatters'
import type { EnrichedProject } from '../../types'
import { Search, Plus, Edit2, GitBranch, ExternalLink, CheckCircle2 } from 'lucide-react'

export function CtoProjectsReposPage() {
  const { projects, teams } = useCtoData()
  const { setSelectedProjectModal, createProject, updateProject, showToast } = useApp()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'planning' | 'completed'>(
    'all',
  )

  // Create Project Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTeamId, setNewTeamId] = useState(teams[0]?.id || '')
  const [newBudget, setNewBudget] = useState(45000)
  const [newDeadline, setNewDeadline] = useState('2026-12-15')
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [newSrsUrl, setNewSrsUrl] = useState('')

  // Edit Project Modal State
  const [editingProject, setEditingProject] = useState<EnrichedProject | null>(null)
  const [editName, setEditName] = useState('')
  const [editTeamId, setEditTeamId] = useState('')
  const [editStatus, setEditStatus] = useState<any>('active')
  const [editProgress, setEditProgress] = useState(0)
  const [editBudget, setEditBudget] = useState(0)
  const [editDeadline, setEditDeadline] = useState('')
  const [editRepoUrl, setEditRepoUrl] = useState('')
  const [editSrsUrl, setEditSrsUrl] = useState('')

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = p.name.toLowerCase().includes(q)
        const codeMatch = p.code.toLowerCase().includes(q)
        const descMatch = p.description?.toLowerCase().includes(q)
        const tagMatch = p.tags?.some((t) => t.toLowerCase().includes(q))
        if (!nameMatch && !codeMatch && !descMatch && !tagMatch) return false
      }
      return true
    })
  }, [projects, statusFilter, searchQuery])

  const handleOpenEditModal = (p: EnrichedProject) => {
    setEditingProject(p)
    setEditName(p.name)
    setEditTeamId(p.teamId || '')
    setEditStatus(p.status)
    setEditProgress(p.progress || 0)
    setEditBudget(p.budget || 0)
    setEditDeadline(p.deadline ? p.deadline.split('T')[0] : '2026-11-30')
    setEditRepoUrl(p.repositoryUrl || '')
    setEditSrsUrl(p.srs?.documentUrl || '')
  }

  const [pendingProjectConfirm, setPendingProjectConfirm] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; projectId: string; projectName: string }
    | null
  >(null)

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = newName.trim()
    const cleanCode = newCode.trim().toUpperCase()
    if (cleanName.length < 2 || cleanName.length > 120 || /^\d+$/.test(cleanName)) {
      showToast('Project name must be 2–120 characters and include letters.', 'error')
      return
    }
    if (!/^[A-Z0-9-]{2,20}$/.test(cleanCode)) {
      showToast('Project code must be 2–20 letters, numbers, or hyphens.', 'error')
      return
    }
    setPendingProjectConfirm({ mode: 'create' })
  }

  const executeProjectConfirm = () => {
    if (!pendingProjectConfirm) return
    if (pendingProjectConfirm.mode === 'create') {
      createProject({
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        description: newDesc.trim() || 'Internal engineering initiative.',
        teamId: newTeamId || undefined,
        budget: Number(newBudget),
        deadline: newDeadline,
        status: 'active',
        progress: 0,
        repositoryUrl:
          newRepoUrl.trim() || `https://github.com/pointfex/${newCode.toLowerCase()}-core`,
        srsUrl:
          newSrsUrl.trim() || `https://docs.pointfex.internal/srs/${newCode.toUpperCase()}-SRS.pdf`,
      })
      setIsCreateModalOpen(false)
      setNewName('')
      setNewCode('')
      setNewDesc('')
      setNewRepoUrl('')
      setNewSrsUrl('')
    } else if (editingProject) {
      updateProject(editingProject.id, {
        name: editName.trim(),
        teamId: editTeamId || undefined,
        status: editStatus,
        progress: Number(editProgress),
        budget: Number(editBudget),
        deadline: editDeadline,
        repositoryUrl: editRepoUrl.trim() || undefined,
        srsUrl: editSrsUrl.trim() || undefined,
      })
      setEditingProject(null)
    }
    setPendingProjectConfirm(null)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject) return
    const cleanName = editName.trim()
    if (cleanName.length < 2 || cleanName.length > 120 || /^\d+$/.test(cleanName)) {
      showToast('Project name must be 2–120 characters and include letters.', 'error')
      return
    }
    setPendingProjectConfirm({
      mode: 'edit',
      projectId: editingProject.id,
      projectName: cleanName,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            Projects & Code Repositories
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="lime" size="sm" icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
            Create New Project
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by name, code, description, or stack tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-lime-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({projects.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Active Sprints
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('planning')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'planning'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Planning
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProjects.map((project) => {
          const assignedTeam = teams.find((t) => t.id === project.teamId)

          return (
            <div
              key={project.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 flex flex-col justify-between shadow-2xs group space-y-3"
            >
              <div>
                {/* Top Row: Code Badge & Status Pill */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant="indigo" size="xs">
                    {project.code}
                  </Badge>
                  <StatusPill status={project.status} size="sm" />
                </div>

                {/* Title */}
                <h4
                  onClick={() => setSelectedProjectModal(project)}
                  className="font-semibold text-xs text-slate-900 dark:text-slate-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors cursor-pointer truncate mb-1"
                >
                  {project.name}
                </h4>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                  {project.description}
                </p>

                {/* Progress bar */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Sprint Progress</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Simplified Repo Link Box */}
                {(project.repositoryUrl || project.repo) && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <a
                      href={
                        project.repositoryUrl ||
                        `https://github.com/pointfex/${project.code.toLowerCase()}-core`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 font-mono text-[11px] text-sky-600 dark:text-sky-400 hover:underline truncate"
                    >
                      <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {project.repositoryUrl
                          ? project.repositoryUrl.replace('https://', '')
                          : `github.com/pointfex/${project.code.toLowerCase()}-core`}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-70 shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <span>{assignedTeam?.name?.split('—')[0]?.trim() || 'Unassigned'}</span>
                  <span>•</span>
                  <span>{formatCurrency(project.budget)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={Edit2}
                    onClick={() => handleOpenEditModal(project)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => setSelectedProjectModal(project)}
                  >
                    Inspect
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Engineering Project"
        >
          <form onSubmit={handleSaveCreate} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Aether Quantum Bridge"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Project Code *
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g., AQB-01"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 uppercase"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="High-level engineering purpose and system objectives..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Assigned Squad
                </label>
                <select
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="">Unassigned</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <MoneyInput
                label="Allocated Budget (BDT)"
                min={0}
                value={newBudget}
                onChangeDigits={(val) => setNewBudget(val)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Target Sprint Deadline
                </label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  placeholder="https://github.com/pointfex/repo"
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
                Create Project
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <Modal
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          title={`Edit Project — ${editingProject.code}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Project Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Assigned Squad
                </label>
                <select
                  value={editTeamId}
                  onChange={(e) => setEditTeamId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="">Unassigned</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Project Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="active">Active Sprint</option>
                  <option value="planning">Planning Phase</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Sprint Progress ({editProgress}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={editProgress}
                  onChange={(e) => setEditProgress(Number(e.target.value))}
                  className="w-full accent-lime-500 cursor-pointer"
                />
              </div>

              <MoneyInput
                label="Budget (BDT)"
                min={0}
                value={editBudget}
                onChangeDigits={(val) => setEditBudget(val)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Deadline
                </label>
                <input
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Repository URL
                </label>
                <input
                  type="url"
                  value={editRepoUrl}
                  onChange={(e) => setEditRepoUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingProject(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="lime" size="sm" icon={CheckCircle2}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {pendingProjectConfirm && (
        <ConfirmDialog
          isOpen={!!pendingProjectConfirm}
          onClose={() => setPendingProjectConfirm(null)}
          onConfirm={executeProjectConfirm}
          title={
            pendingProjectConfirm.mode === 'create'
              ? 'Create New Project?'
              : `Save changes to ${pendingProjectConfirm.projectName}?`
          }
          message={
            pendingProjectConfirm.mode === 'create'
              ? `Create project "${newName.trim()}" (${newCode.trim().toUpperCase()}) with budget ৳${Number(newBudget || 0).toLocaleString('en-BD')}?`
              : `Update project settings, status, and budget for "${pendingProjectConfirm.projectName}"?`
          }
          confirmLabel={pendingProjectConfirm.mode === 'create' ? 'Create Project' : 'Save Changes'}
        />
      )}
    </div>
  )
}
