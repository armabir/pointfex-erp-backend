import { Modal } from './Modal'
import { Badge } from './Badge'
import { Button } from './Button'
import { StatusPill } from './StatusPill'
import { formatDate, getRelativeDeadline } from '../../utils/formatters'
import { Calendar, FileCode, ExternalLink, Clock, GitBranch } from 'lucide-react'
import type { Project, EnrichedProject } from '../../types'

export interface ProjectDetailModalProps {
  project: (Project & { repo?: any; srs?: any }) | (EnrichedProject & { srs?: any }) | null
  isOpen: boolean
  onClose: () => void
}

export function ProjectDetailModal({ project, isOpen, onClose }: ProjectDetailModalProps) {
  if (!project) return null

  const deadlineInfo = getRelativeDeadline(project.deadline)

  const srs = project.srs || {
    documentTitle: `${project.code}-Software-Requirements-Specification.pdf`,
    documentUrl: `https://docs.pointfex.internal/srs/${project.code}-SRS.pdf`,
    version: 'v1.0 (Draft)',
    lastUpdated: project.startDate || '2026-10-12',
    overview:
      'System requirements specification defining functional architecture, data pipeline thresholds, and API specifications.',
    requirementsCount: 20,
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Badge variant="indigo" size="sm">
            {project.code}
          </Badge>
          <span className="truncate">{project.name}</span>
        </div>
      }
      subtitle={`Sprint Cycle: Week ${project.currentWeek || 3} of ${project.totalWeeks || 5}`}
      maxWidth="max-w-2xl"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4 text-xs">
        {/* 1. Progress & Status Section */}
        <div className="p-4 bg-slate-50 dark:bg-[#131a2b] rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
              <StatusPill status={project.status} size="sm" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {project.progress}% Complete
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-700/80 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-sky-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        {/* 2. Title & Description */}
        <div className="p-4 bg-slate-50/70 dark:bg-[#131a2b] rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs">{project.name}</h4>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
            {project.description}
          </p>
        </div>

        {/* 3. Deadlines Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-[#131a2b] rounded-2xl border border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              Sprint Start
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDate(project.startDate, 'medium')}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              Final Deadline
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {formatDate(project.deadline, 'medium')}
            </span>
          </div>

          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              Time Remaining
            </span>
            <span className="font-semibold text-sky-600 dark:text-sky-400 mt-0.5 block">
              {deadlineInfo.label}
            </span>
          </div>
        </div>

        {/* 4. SRS (Software Requirements Specification) Section */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#131a2b] border border-slate-200/80 dark:border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                <FileCode className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                  Software Requirements Specification (SRS)
                </h4>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {srs.version} · Updated {formatDate(srs.lastUpdated, 'short')}
                </span>
              </div>
            </div>

            <a
              href={srs.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-100 dark:border-indigo-800/60 transition-colors text-xs font-semibold"
            >
              <span>View Spec</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed bg-white dark:bg-[#0b101b] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
            {srs.overview}
          </p>
        </div>

        {/* Clean Repository Link */}
        {(project.repositoryUrl || project.repo) && (
          <div className="p-3 bg-slate-50 dark:bg-[#131a2b] rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-600 dark:text-slate-400 font-mono text-[11px]">
            <a
              href={
                project.repositoryUrl ||
                `https://github.com/pointfex/${project.code.toLowerCase()}-core`
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sky-600 dark:text-sky-400 hover:underline"
            >
              <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {project.repositoryUrl || `github.com/pointfex/${project.code.toLowerCase()}-core`}
              </span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
            </a>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {project.repo?.activeBranch || 'main'}
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
