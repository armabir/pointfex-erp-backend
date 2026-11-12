import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  badge?: ReactNode
}

export function PageHeader({ title, subtitle, action, badge }: PageHeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[20px] sm:text-[28px] font-semibold text-[var(--text)] tracking-tight leading-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className="text-[14px] text-[var(--muted)] leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </header>
  )
}

