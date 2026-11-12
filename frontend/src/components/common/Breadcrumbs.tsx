import React from 'react'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  onClick?: () => void
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
}

export function Breadcrumbs({ items = [] }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null

  return (
    <nav className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]" aria-label="Breadcrumb">
      <Home className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--border)] shrink-0" aria-hidden="true" />
            {isLast ? (
              <span className="font-medium text-[var(--text)] truncate" aria-current="page">
                {item.label}
              </span>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="truncate text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span className="truncate text-[var(--muted)]">{item.label}</span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
