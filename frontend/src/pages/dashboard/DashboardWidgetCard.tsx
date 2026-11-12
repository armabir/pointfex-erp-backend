import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Card } from '../../components/common/Card'
import { useApp } from '../../context/AppContext'
import type { DashboardWidgetDef } from '../../dashboard/widgets'

export interface DashboardWidgetCardProps {
  widget: DashboardWidgetDef
  children: ReactNode
}

export function DashboardWidgetCard({ widget, children }: DashboardWidgetCardProps) {
  const { setRoute } = useApp()

  return (
    <Card
      title={widget.title}
      subtitle={widget.description}
      headerBorder
      className={widget.size === 'lg' ? 'lg:col-span-2' : ''}
      action={
        widget.viewAllRoute ? (
          <button
            type="button"
            onClick={() => setRoute(widget.viewAllRoute!)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--primary)] hover:underline cursor-pointer whitespace-nowrap"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : null
      }
    >
      <div className="pt-2">{children}</div>
    </Card>
  )
}

