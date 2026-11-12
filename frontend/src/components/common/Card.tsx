import type { ReactNode, ComponentType } from 'react'

export interface CardProps {
  children?: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ComponentType<{ className?: string }>
  action?: ReactNode
  headerBorder?: boolean
  noPadding?: boolean
}

export function Card({
  children,
  className = '',
  title,
  subtitle,
  icon: Icon,
  action,
  headerBorder = false,
  noPadding = false,
}: CardProps) {
  return (
    <section
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] shadow-[var(--shadow-soft)] transition-colors duration-150 ${className}`}
    >
      {(title || subtitle || action || Icon) && (
        <div
          className={`flex items-center justify-between gap-3 px-4 sm:px-6 py-4 ${
            headerBorder ? 'border-b border-[var(--border)]' : ''
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="p-2 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-[16px] font-semibold text-[var(--text)] tracking-tight truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[12px] text-[var(--muted)] truncate mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'px-4 sm:px-6 pb-4 sm:pb-6 pt-2'}>{children}</div>
    </section>
  )
}
