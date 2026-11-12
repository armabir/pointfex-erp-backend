import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  X,
  CheckSquare,
  FolderGit2,
  ArrowRight,
  Clock,
  Compass,
  PlusCircle,
  Command,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { resolveVisibleNavigation } from '../../config/nav-registry'
import { filterPaletteByPermissions } from '../../services/palette-items'
import { Avatar } from './Avatar'

export interface QuickSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function QuickSearchModal({ isOpen, onClose }: QuickSearchModalProps) {
  const {
    data,
    recentRoutes,
    setSelectedTaskModal,
    setSelectedProjectModal,
    setRoute,
  } = useApp()
  const { permissions, authzSnapshot } = usePermissions()
  const effectivePermissions = authzSnapshot?.effectiveCodes ?? permissions

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 120)
  const [activeTab, setActiveTab] = useState<
    'all' | 'actions' | 'pages' | 'tasks' | 'projects' | 'members'
  >('all')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClose = () => {
    setQuery('')
    onClose()
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [isOpen])

  const { visibleItems } = useMemo(
    () => resolveVisibleNavigation(effectivePermissions),
    [effectivePermissions],
  )

  const visibleByRoute = useMemo(
    () => new Map(visibleItems.map((item) => [item.route, item])),
    [visibleItems],
  )

  const recentAccessiblePages = useMemo(
    () =>
      recentRoutes
        .map((r) => visibleByRoute.get(r))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .slice(0, 4),
    [recentRoutes, visibleByRoute],
  )

  const paletteMatches = useMemo(
    () =>
      filterPaletteByPermissions({
        query: debouncedQuery,
        effectivePermissions,
      }),
    [debouncedQuery, effectivePermissions],
  )

  const searchResults = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    const members = paletteMatches.allowPeople
      ? !q
        ? data.users.slice(0, 3)
        : data.users.filter(
            (u) => u.name.toLowerCase().includes(q) || u.title.toLowerCase().includes(q),
          )
      : []

    return {
      pages: paletteMatches.pages,
      actions: paletteMatches.actions,
      shortcuts: paletteMatches.shortcuts,
      tasks: !q
        ? data.tasks.slice(0, 3)
        : data.tasks.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q) ||
              t.tags?.some((tag) => tag.toLowerCase().includes(q)),
          ),
      projects: !q
        ? data.projects.slice(0, 3)
        : data.projects.filter(
            (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
          ),
      members,
    }
  }, [debouncedQuery, paletteMatches, data])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4">
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command and Action Palette"
        className="relative z-10 w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
      >
        <div className="flex items-center px-4 py-3.5 border-b border-[var(--border)] gap-3">
          <Search className="w-5 h-5 text-[var(--muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, quick-create actions, shortcuts, people, or tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[15px] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-1 text-[11px] font-mono bg-[var(--surface-muted)] border border-[var(--border)] rounded text-[var(--muted)] cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/60 overflow-x-auto text-[12px]">
          {(['all', 'actions', 'pages', 'tasks', 'projects', 'members'] as const).map((tab) => {
            if (tab === 'members' && !paletteMatches.allowPeople) return null
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-full font-medium capitalize cursor-pointer transition-colors ${
                  activeTab === tab
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!debouncedQuery.trim() && activeTab === 'all' && recentAccessiblePages.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Recent Pages
              </div>
              <div className="space-y-1 mt-1">
                {recentAccessiblePages.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={`rec-${item.id}`}
                      type="button"
                      onClick={() => {
                        setRoute(item.route)
                        handleClose()
                      }}
                      className="w-full text-left px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                        <span className="text-[14px] font-medium text-[var(--text)] truncate">
                          {item.label}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'actions') && searchResults.actions.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                Quick Create Actions
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.actions.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      setRoute(act.route)
                      handleClose()
                    }}
                    className="w-full text-left px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[var(--text)] truncate">
                        {act.label}
                      </div>
                      <div className="text-[12px] text-[var(--muted)] truncate">
                        {act.description}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'pages') && searchResults.pages.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                Pages
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.pages.slice(0, 6).map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={`pg-${item.id}`}
                      type="button"
                      onClick={() => {
                        setRoute(item.route)
                        handleClose()
                      }}
                      className="w-full text-left px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-[var(--muted)] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-[var(--text)] truncate">
                            {item.label}
                          </div>
                          {item.description && (
                            <div className="text-[12px] text-[var(--muted)] truncate">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {activeTab === 'all' && searchResults.shortcuts.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <Command className="w-3.5 h-3.5" />
                Go-To Shortcuts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                {searchResults.shortcuts.slice(0, 4).map((sc) => (
                  <button
                    key={sc.keys}
                    type="button"
                    onClick={() => {
                      setRoute(sc.route)
                      handleClose()
                    }}
                    className="text-left px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-[13px] text-[var(--text)] truncate">{sc.label}</span>
                    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--bg)] border border-[var(--border)] rounded shrink-0">
                      {sc.keys}
                    </kbd>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'tasks') && searchResults.tasks.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Tasks
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.tasks.slice(0, 5).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskModal(task)
                      handleClose()
                    }}
                    className="w-full text-left px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckSquare className="w-4 h-4 text-[var(--primary)] shrink-0" />
                      <span className="text-[14px] text-[var(--text)] truncate">{task.title}</span>
                    </div>
                    <span className="text-[12px] text-[var(--muted)] shrink-0 capitalize">
                      {task.status.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'projects') && searchResults.projects.length > 0 && (
            <section>
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Projects
              </div>
              <div className="space-y-1 mt-1">
                {searchResults.projects.slice(0, 4).map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectModal(proj)
                      handleClose()
                    }}
                    className="w-full text-left px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderGit2 className="w-4 h-4 text-[var(--info)] shrink-0" />
                      <span className="text-[14px] text-[var(--text)] truncate">{proj.name}</span>
                    </div>
                    <span className="text-[12px] text-[var(--muted)] shrink-0">{proj.code}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'members') &&
            paletteMatches.allowPeople &&
            searchResults.members.length > 0 && (
              <section>
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  People
                </div>
                <div className="space-y-1 mt-1">
                  {searchResults.members.slice(0, 4).map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setRoute('people')
                        handleClose()
                      }}
                      className="w-full text-left px-3 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar
                          src={member.avatarUrl || member.avatar}
                          name={member.name}
                          initials={member.initials}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium text-[var(--text)] truncate">
                            {member.name}
                          </div>
                          <div className="text-[12px] text-[var(--muted)] truncate">
                            {member.title}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}
        </div>
      </div>
    </div>
  )
}
