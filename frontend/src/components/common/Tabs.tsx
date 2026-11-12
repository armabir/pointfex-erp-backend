export interface TabOption {
  id: string
  label: string
  count?: number
}

export interface TabsProps {
  tabs: TabOption[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeId, onChange, className = '' }: TabsProps) {
  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border)] ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer min-h-[36px] ${
              active
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--border)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums ${
                  active
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                    : 'bg-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

