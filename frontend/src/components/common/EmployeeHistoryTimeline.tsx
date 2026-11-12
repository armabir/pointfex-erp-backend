import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { erpApi } from '../../api/client'
import { formatDate } from '../../utils/formatters'
import { Badge } from './Badge'
import { Skeleton } from './Skeleton'

export interface EmployeeHistoryTimelineProps {
  employeeId: string
}

export function EmployeeHistoryTimeline({ employeeId }: EmployeeHistoryTimelineProps) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    erpApi
      .getEmployeeChangeHistory(employeeId)
      .then((rows) => {
        if (!cancelled) setEntries(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setEntries([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId])

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-[var(--muted)] py-2">
        No position, role, or profile change history recorded yet.
      </p>
    )
  }

  return (
    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
      {entries.map((item) => (
        <div
          key={item.id}
          className="p-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg)] text-[12px] space-y-1"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[var(--primary)]" />
              <Badge variant="indigo" size="xs">
                {item.changeType}
              </Badge>
              <span className="font-mono text-[11px] text-[var(--muted)]">{item.actionKey}</span>
            </div>
            <span className="text-[11px] text-[var(--muted)]">
              {formatDate(item.effectiveDate || item.createdAt, 'medium')}
            </span>
          </div>
          <p className="text-[var(--text)]">{item.reason}</p>
          <div className="text-[11px] text-[var(--muted)]">
            By {item.actor?.name || item.actorId}
            {item.afterState ? ` • After: ${JSON.stringify(item.afterState)}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

