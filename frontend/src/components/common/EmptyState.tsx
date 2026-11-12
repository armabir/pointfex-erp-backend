import type { ReactNode, ComponentType } from 'react'
import { Inbox } from 'lucide-react'

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description = 'Items matching this view will appear here once created.',
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-8 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-card)] bg-[var(--surface-muted)]/60 ${className}`}
    >
      <div className="p-3 rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] text-[var(--primary)] shadow-2xs mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-[14px] font-semibold text-[var(--text)]">{title}</h4>
      <p className="text-[13px] text-[var(--muted)] max-w-sm mt-1 leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
