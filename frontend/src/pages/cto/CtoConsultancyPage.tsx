import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { Briefcase, Sparkles, Clock } from 'lucide-react'

export function CtoConsultancyPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
          Technical Advisory & Consultancy
        </h2>
      </div>

      {/* Coming Soon Card */}
      <Card title="Advisory Services & Client Engagements" icon={Briefcase}>
        <div className="py-16 px-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-lime-100 dark:bg-lime-950/50 text-lime-700 dark:text-lime-400 flex items-center justify-center mx-auto shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
              <span>Coming Soon in Next Release</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              Technical Advisory & Enterprise Engagements
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The external technical advisory portal, client billing schedules, and
              cross-organization consulting requests are currently under active development. This
              module will allow the CTO office to schedule architectural reviews and track advisory
              revenues.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-2">
            <Badge variant="lime" size="sm">
              Phase 4 Release
            </Badge>
            <Badge variant="slate" size="sm">
              Client Advisory Engine
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  )
}
