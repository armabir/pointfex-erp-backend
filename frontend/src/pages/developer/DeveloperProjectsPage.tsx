import { Card } from '../../components/common/Card'
import { StatusPill } from '../../components/common/StatusPill'
import { Button } from '../../components/common/Button'
import { useDeveloperData } from '../../hooks/useDeveloperData'
import { useApp } from '../../context/AppContext'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { FolderGit2, GitBranch, ExternalLink } from 'lucide-react'

export function DeveloperProjectsPage() {
  const { devProjects } = useDeveloperData()
  const { setSelectedProjectModal } = useApp()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            My Projects
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active projects assigned to Team 1
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {devProjects.map((project) => (
          <Card
            key={project.id}
            title={project.name}
            icon={FolderGit2}
            action={
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setSelectedProjectModal(project)}
              >
                Details
              </Button>
            }
          >
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {project.description}
              </p>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Progress</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {project.progress}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
                    Status
                  </span>
                  <StatusPill status={project.status} size="sm" className="mt-1" />
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
                    Budget
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                    {formatCurrency(project.budget)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Due</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 mt-1 block">
                    {formatDate(project.deadline, 'short')}
                  </span>
                </div>
              </div>

              {(project.repositoryUrl || project.repo) && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                  <a
                    href={
                      project.repositoryUrl ||
                      `https://github.com/pointfex/${project.code?.toLowerCase() || 'core'}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:underline truncate"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {project.repositoryUrl
                        ? project.repositoryUrl.replace('https://', '')
                        : `github.com/pointfex/${project.code?.toLowerCase() || 'core'}`}
                    </span>
                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-70 shrink-0" />
                  </a>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                    {project.repo?.activeBranch || 'main'}
                  </span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
