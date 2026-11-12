import { Card } from '../../components/common/Card'
import { Badge } from '../../components/common/Badge'
import { ShieldCheck, Sparkles, Clock } from 'lucide-react'

export function CtoSecurityTestingPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
          Security & Compliance Posture
        </h2>
      </div>

      {/* Coming Soon Card */}
      <Card title="Security Testing & Posture Center" icon={ShieldCheck}>
        <div className="py-16 px-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Coming Soon in Next Release</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
              Enterprise Security & Vulnerability Auditing
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Automated CVE vulnerability triaging, real-time SAST code analysis hooks, bug bounty
              payout pipelines, and SOC2 compliance monitoring will be available in the upcoming
              security suite integration.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-2">
            <Badge variant="indigo" size="sm">
              Phase 4 Release
            </Badge>
            <Badge variant="slate" size="sm">
              Zero-Trust Architecture
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  )
}
