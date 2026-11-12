import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { useDeveloperData } from '../../hooks/useDeveloperData'
import { useApp } from '../../context/AppContext'
import { Mail, Globe, Shield } from 'lucide-react'

export function DeveloperTeamPage() {
  const { team, teamMembers, pm } = useDeveloperData()
  const { currentDevId } = useApp()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
          {team?.name || 'Team 1 — Quantum Core'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{team?.focus}</p>
      </div>

      {/* PM Card */}
      {pm && (
        <Card title="Project Manager" icon={Shield}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white dark:bg-lime-400 dark:text-slate-950 flex items-center justify-center font-bold">
                {pm.initials}
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-sm">
                  {pm.name}
                </div>
                <div className="text-slate-500 dark:text-slate-400">{pm.title}</div>
              </div>
            </div>
            <Badge variant="emerald" size="xs" dot>
              Online
            </Badge>
          </div>
        </Card>
      )}

      {/* Team Squad */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Developers ({teamMembers.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamMembers.map((member) => (
            <Card key={member.id} noPadding>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-xs border border-slate-200/60 dark:border-slate-700">
                      {member.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        {member.name}
                        {member.id === currentDevId && (
                          <Badge variant="lime" size="xs">
                            YOU
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {member.title}
                      </div>
                    </div>
                  </div>

                  <Badge variant={member.status === 'online' ? 'emerald' : 'slate'} size="xs" dot>
                    {member.status}
                  </Badge>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <div className="flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  {member.timezone && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Globe className="w-3 h-3 text-slate-400" />
                      <span>{member.timezone}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
