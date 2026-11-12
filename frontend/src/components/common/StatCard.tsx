import type { ComponentType } from 'react'

export interface StatCardProps {
  label: string
  value: string | number
  trend?: string
  trendTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  icon?: ComponentType<{ className?: string }>
  onClick?: () => void
  className?: string
}

const TONE_MAP = {
  neutral: 'text-[var(--muted)]',
  success: 'text-[var(--success)]',
  warning: 'text-[var(--warning)]',
  danger: 'text-[var(--danger)]',
  info: 'text-[var(--info)]',
}

export function StatCard({
  label,
  value,
  trend,
  trendTone = 'neutral',
  icon: Icon,
  onClick,
  className = '',
}: StatCardProps) {
  const interactive = Boolean(onClick)
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-4 sm:p-5 shadow-[var(--shadow-soft)] transition-colors ${
        interactive ? 'hover:border-[var(--primary)] cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[12px] font-medium text-[var(--muted)] truncate">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-[var(--muted)] shrink-0" />}
      </div>
      <div className="text-[20px] sm:text-[28px] font-semibold text-[var(--text)] tracking-tight leading-tight tabular-nums">
        {value}
      </div>
      {trend && (
        <div className={`text-[12px] font-medium mt-1.5 truncate ${TONE_MAP[trendTone]}`}>
          {trend}
        </div>
      )}
    </Tag>
  )
}

