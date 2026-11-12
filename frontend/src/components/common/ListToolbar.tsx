import { useState } from 'react'
import { Bookmark, Download, Plus, Search, X } from 'lucide-react'
import { Button } from './Button'

export interface SavedListView {
  id: string
  name: string
  search: string
  filterValue: string
}

export interface ListFilterChip {
  value: string
  label: string
  count?: number
}

export interface ListToolbarProps {
  storageKey: string
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filterChips?: ListFilterChip[]
  activeFilter: string
  onFilterChange: (value: string) => void
  defaultViews?: SavedListView[]
  onExportCsv?: () => void
  canExport?: boolean
}

function loadSavedViews(storageKey: string, defaults: SavedListView[]): SavedListView[] {
  if (typeof localStorage === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(`pointfex_views_${storageKey}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults
  } catch {
    return defaults
  }
}

export function ListToolbar({
  storageKey,
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterChips = [],
  activeFilter,
  onFilterChange,
  defaultViews = [],
  onExportCsv,
  canExport = true,
}: ListToolbarProps) {
  const [savedViews, setSavedViews] = useState<SavedListView[]>(() =>
    loadSavedViews(storageKey, defaultViews),
  )
  const [isSavingView, setIsSavingView] = useState(false)
  const [viewName, setViewName] = useState('')

  const persistViews = (next: SavedListView[]) => {
    setSavedViews(next)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`pointfex_views_${storageKey}`, JSON.stringify(next))
    }
  }

  const handleSaveCurrentView = () => {
    const trimmed = viewName.trim()
    if (!trimmed) return
    const newView: SavedListView = {
      id: `view_${Date.now()}`,
      name: trimmed,
      search,
      filterValue: activeFilter,
    }
    persistViews([...savedViews, newView])
    setViewName('')
    setIsSavingView(false)
  }

  const handleDeleteView = (id: string) => {
    persistViews(savedViews.filter((v) => v.id !== id))
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-3.5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[var(--radius-control)] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isSavingView ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setIsSavingView(true)}
            >
              Save View
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="View name..."
                className="px-2.5 py-1.5 text-[12px] rounded-[8px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
              <Button type="button" size="sm" variant="primary" onClick={handleSaveCurrentView}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setIsSavingView(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          {canExport && onExportCsv && (
            <Button type="button" size="sm" variant="secondary" icon={Download} onClick={onExportCsv}>
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Filter Chips & Saved Views */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {filterChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterChips.map((chip) => {
              const active = activeFilter === chip.value
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => onFilterChange(chip.value)}
                  className={`px-3 py-1 rounded-full text-[12px] font-medium cursor-pointer transition-colors ${
                    active
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {chip.label}
                  {typeof chip.count === 'number' ? ` (${chip.count})` : ''}
                </button>
              )
            })}
          </div>
        )}

        {savedViews.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-[var(--muted)] inline-flex items-center gap-1">
              <Bookmark className="w-3 h-3" /> Views:
            </span>
            {savedViews.map((v) => {
              const isCurrent = v.search === search && v.filterValue === activeFilter
              return (
                <span
                  key={v.id}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                    isCurrent
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)]/40 text-[var(--primary)]'
                      : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange(v.search)
                      onFilterChange(v.filterValue)
                    }}
                    className="cursor-pointer"
                  >
                    {v.name}
                  </button>
                  {!defaultViews.some((d) => d.id === v.id) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteView(v.id)}
                      aria-label={`Delete view ${v.name}`}
                      className="text-[var(--muted)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

