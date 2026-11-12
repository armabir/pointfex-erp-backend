import type { ReactNode } from 'react'

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'purple'
  | 'lime'
  | 'slate'
  | string

const VARIANT_MAP: Record<string, string> = {
  default: 'bg-[var(--surface-muted)] text-[var(--muted)] border-[var(--border)]',
  slate: 'bg-[var(--surface-muted)] text-[var(--muted)] border-[var(--border)]',
  primary: 'bg-[var(--primary-soft)] text-[var(--primary)] border-indigo-200 dark:border-indigo-800/60',
  indigo: 'bg-[var(--primary-soft)] text-[var(--primary)] border-indigo-200 dark:border-indigo-800/60',
  purple: 'bg-[var(--primary-soft)] text-[var(--primary)] border-indigo-200 dark:border-indigo-800/60',
  success: 'bg-[var(--success-soft)] text-[var(--success)] border-emerald-200 dark:border-emerald-800/60',
  emerald: 'bg-[var(--success-soft)] text-[var(--success)] border-emerald-200 dark:border-emerald-800/60',
  lime: 'bg-[var(--success-soft)] text-[var(--success)] border-emerald-200 dark:border-emerald-800/60',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-amber-200 dark:border-amber-800/60',
  amber: 'bg-[var(--warning-soft)] text-[var(--warning)] border-amber-200 dark:border-amber-800/60',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border-red-200 dark:border-red-800/60',
  rose: 'bg-[var(--danger-soft)] text-[var(--danger)] border-red-200 dark:border-red-800/60',
  info: 'bg-[var(--info-soft)] text-[var(--info)] border-sky-200 dark:border-sky-800/60',
  sky: 'bg-[var(--info-soft)] text-[var(--info)] border-sky-200 dark:border-sky-800/60',
}

export interface BadgeProps {
  children?: ReactNode
  variant?: BadgeVariant
  size?: 'xs' | 'sm'
  className?: string
  dot?: boolean
  title?: string
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  dot = false,
  title,
}: BadgeProps) {
  const variantClass = VARIANT_MAP[variant] || VARIANT_MAP.default
  const sizeClass = size === 'xs' ? 'text-[11px] px-2 py-0.5' : 'text-[12px] px-2.5 py-0.5'

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap shrink-0 ${variantClass} ${sizeClass} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {children}
    </span>
  )
}
