import { Search, Menu, Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { findNavItemByRoute, findWorkspaceByRoute } from '../../config/nav-registry'
import { getWorkspaceMeta } from '../../config/workspaces'
import { Breadcrumbs, type BreadcrumbItem } from '../common/Breadcrumbs'
import { NotificationDropdown } from './NotificationDropdown'
import { QuickCreateMenu } from './QuickCreateMenu'
import { UserMenu } from './UserMenu'

export function Header() {
  const {
    currentRoute,
    setRoute,
    setMobileSidebarOpen,
    setIsSearchOpen,
    theme,
    toggleTheme,
  } = useApp()

  const activeNav = findNavItemByRoute(currentRoute)
  const activeWorkspace = getWorkspaceMeta(findWorkspaceByRoute(currentRoute))
  const breadcrumbs: BreadcrumbItem[] =
    currentRoute === 'dashboard'
      ? [{ label: 'Home' }, { label: 'My Day' }]
      : [
          { label: activeWorkspace.label, onClick: () => setRoute('dashboard') },
          { label: activeNav?.label || currentRoute },
        ]

  return (
    <header className="sticky top-0 z-20 h-16 sm:h-20 bg-[var(--surface)]/95 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-[var(--border)] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((prev) => !prev)}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)] lg:hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-2 min-h-[38px] rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border)] text-[13px] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
          title="Open command palette (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
          <span>Search pages &amp; items...</span>
          <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-[var(--surface)] border border-[var(--border)] rounded">
            Ctrl+K
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="sm:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer transition-colors"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-[var(--warning)]" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>

        <QuickCreateMenu />
        <NotificationDropdown />
        <UserMenu />
      </div>
    </header>
  )
}
