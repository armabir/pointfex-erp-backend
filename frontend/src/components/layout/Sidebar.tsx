import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Share2,
  Sun,
  X,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import {
  findWorkspaceByRoute,
  resolveVisibleWorkspaces,
} from '../../config/nav-registry'
import type { WorkspaceId } from '../../config/workspaces'
import { Avatar } from '../common/Avatar'
import { ConfirmDialog } from '../common/ConfirmDialog'

export function Sidebar() {
  const {
    currentRoute,
    setRoute,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    currentUser,
    pendingApprovalsCount,
    activeDelegationsCount,
    theme,
    toggleTheme,
    logout,
  } = useApp()
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false)
  const { permissions, authzSnapshot } = usePermissions()

  const effectivePermissions = authzSnapshot?.effectiveCodes ?? permissions
  const visibleWorkspaces = useMemo(
    () => resolveVisibleWorkspaces(effectivePermissions),
    [effectivePermissions],
  )

  const routeWorkspaceId = findWorkspaceByRoute(currentRoute)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<WorkspaceId | null>(null)
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false)

  const activeWorkspace = useMemo(() => {
    const candidateId = selectedWorkspaceId || routeWorkspaceId
    return (
      visibleWorkspaces.find((w) => w.workspace.id === candidateId) ||
      visibleWorkspaces.find((w) => w.workspace.id === routeWorkspaceId) ||
      visibleWorkspaces[0]
    )
  }, [visibleWorkspaces, selectedWorkspaceId, routeWorkspaceId])

  const handleNavigate = (routeId: string) => {
    setSelectedWorkspaceId(null)
    setIsSwitcherOpen(false)
    setRoute(routeId)
    setMobileSidebarOpen(false)
  }

  const handleSelectWorkspace = (wsId: WorkspaceId) => {
    setSelectedWorkspaceId(wsId)
    setIsSwitcherOpen(false)
    if (isSidebarCollapsed) {
      toggleSidebar()
    }
    const targetWs = visibleWorkspaces.find((w) => w.workspace.id === wsId)
    if (targetWs && targetWs.items.length === 1) {
      handleNavigate(targetWs.items[0].route)
    }
  }

  const getBadgeValue = (badgeSource?: 'pendingApprovals' | 'activeDelegations') => {
    if (badgeSource === 'pendingApprovals' && pendingApprovalsCount > 0) {
      return pendingApprovalsCount
    }
    if (badgeSource === 'activeDelegations' && activeDelegationsCount > 0) {
      return activeDelegationsCount
    }
    return 0
  }

  return (
    <>
      {/* Desktop Dual-Pane Navigation: Left Workspace Rail + Contextual Second Panel */}
      <aside
        aria-label="Primary workspace navigation"
        className="hidden lg:flex fixed top-0 left-0 bottom-0 z-40 select-none"
      >
        {/* Slim Workspace Icon Rail */}
        <div className="w-16 flex flex-col items-center bg-[var(--surface)] border-r border-[var(--border)] py-3">
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="w-10 h-10 rounded-[10px] overflow-hidden border border-[var(--border)] mb-4 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            title="Pointfex Home"
            aria-label="Pointfex Home"
          >
            <img src="/Logo.png" alt="Pointfex" className="w-full h-full object-cover" />
          </button>

          <nav
            aria-label="Workspaces"
            className="flex-1 w-full flex flex-col items-center gap-1.5 overflow-y-auto px-2"
          >
            {visibleWorkspaces.map(({ workspace }) => {
              const Icon = workspace.icon
              const isActive = activeWorkspace?.workspace.id === workspace.id
              const showRailBadge =
                (workspace.id === 'my_work' || workspace.id === 'admin') && pendingApprovalsCount > 0

              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => handleSelectWorkspace(workspace.id)}
                  title={workspace.label}
                  aria-label={workspace.label}
                  aria-current={isActive ? 'true' : undefined}
                  className={`relative min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-[10px] transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {showRailBadge && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--danger)] text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                      {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Bottom Rail Actions */}
          <div className="pt-3 border-t border-[var(--border)] w-full flex flex-col items-center gap-1.5 px-2">
            <button
              type="button"
              onClick={toggleSidebar}
              className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-[10px] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
              title={isSidebarCollapsed ? 'Expand workspace panel' : 'Collapse workspace panel'}
              aria-label={isSidebarCollapsed ? 'Expand workspace panel' : 'Collapse workspace panel'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-[10px] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[var(--warning)]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setConfirmSignOutOpen(true)}
              className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-[10px] text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contextual Second Panel (collapsible to icon rail only) */}
        {!isSidebarCollapsed && activeWorkspace && (
          <div className="w-56 flex flex-col bg-[var(--surface)] border-r border-[var(--border)]">
            {/* Top-left Workspace Switcher */}
            <div className="relative h-16 sm:h-20 px-3 flex items-center justify-between border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setIsSwitcherOpen((prev) => !prev)}
                className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] cursor-pointer text-left"
                aria-expanded={isSwitcherOpen}
                aria-label="Switch workspace"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                    Workspace
                  </div>
                  <div className="text-[14px] font-semibold text-[var(--text)] truncate">
                    {activeWorkspace.workspace.label}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[var(--muted)] shrink-0" />
              </button>

              {isSwitcherOpen && (
                <div className="absolute top-full left-2 right-2 mt-1 p-1.5 rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] shadow-lg z-50 max-h-80 overflow-y-auto">
                  {visibleWorkspaces.map(({ workspace }) => {
                    const Icon = workspace.icon
                    const selected = workspace.id === activeWorkspace.workspace.id
                    return (
                      <button
                        key={workspace.id}
                        type="button"
                        onClick={() => handleSelectWorkspace(workspace.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-[13px] cursor-pointer ${
                          selected
                            ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                            : 'text-[var(--text)] hover:bg-[var(--surface-muted)]'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{workspace.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Active Delegation Pill */}
            {activeDelegationsCount > 0 && (
              <button
                type="button"
                onClick={() => handleNavigate('delegations')}
                className="mx-3 mt-3 px-3 py-2 rounded-[var(--radius-control)] bg-[var(--warning-soft)] text-[var(--warning)] border border-amber-300/60 dark:border-amber-800/60 flex items-center gap-2 text-[12px] font-medium cursor-pointer text-left"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Delegated access ({activeDelegationsCount})
                </span>
              </button>
            )}

            {/* Contextual Pages grouped under at most 3 short headings */}
            <nav
              aria-label={`${activeWorkspace.workspace.label} pages`}
              className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
            >
              {activeWorkspace.sections.map((section) => (
                <div key={section.heading} className="space-y-1">
                  <div className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {section.heading}
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = currentRoute === item.route
                      const Icon = item.icon
                      const badgeValue = getBadgeValue(item.badgeSource)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.route)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full min-h-[40px] flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[var(--radius-control)] text-[13px] font-medium transition-colors duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold'
                              : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {badgeValue > 0 && (
                            <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded-full bg-[var(--primary)] text-white leading-none">
                              {badgeValue > 99 ? '99+' : badgeValue}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Bottom User Card */}
            {currentUser && (
              <div className="p-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => handleNavigate('settings')}
                  className="w-full flex items-center gap-2.5 p-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] cursor-pointer text-left"
                >
                  <Avatar
                    src={currentUser.avatarUrl || currentUser.avatar}
                    name={currentUser.name}
                    initials={currentUser.initials}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--text)] truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate">
                      {currentUser.title}
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Mobile Full-Screen Workspace Menu */}
      {isMobileSidebarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All workspaces"
          className="lg:hidden fixed inset-0 z-50 bg-[var(--bg)] flex flex-col"
        >
          <div className="h-16 px-4 flex items-center justify-between bg-[var(--surface)] border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <img
                src="/Logo.png"
                alt="Pointfex"
                className="w-8 h-8 rounded-lg object-cover border border-[var(--border)]"
              />
              <div>
                <div className="text-[15px] font-semibold text-[var(--text)] leading-tight">
                  Workspaces
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  {visibleWorkspaces.length} available
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
              aria-label="Close workspace menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {visibleWorkspaces.map(({ workspace, items }) => {
              const WsIcon = workspace.icon
              return (
                <div
                  key={workspace.id}
                  className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-card)] p-3 space-y-2"
                >
                  <div className="flex items-center gap-2 px-1">
                    <WsIcon className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-[13px] font-semibold text-[var(--text)]">
                      {workspace.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {items.map((item) => {
                      const ItemIcon = item.icon
                      const isActive = currentRoute === item.route
                      const badgeValue = getBadgeValue(item.badgeSource)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.route)}
                          className={`min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-control)] text-[14px] font-medium cursor-pointer text-left ${
                            isActive
                              ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                              : 'bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-muted)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ItemIcon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {badgeValue > 0 && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-[var(--primary)] text-white">
                              {badgeValue}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-4 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="min-h-[44px] px-3 rounded-[var(--radius-control)] border border-[var(--border)] text-[13px] font-medium text-[var(--text)] inline-flex items-center gap-2 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-[var(--warning)]" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen(false)
                setConfirmSignOutOpen(true)
              }}
              className="min-h-[44px] px-4 rounded-[var(--radius-control)] bg-[var(--danger-soft)] text-[var(--danger)] text-[13px] font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmSignOutOpen}
        onClose={() => setConfirmSignOutOpen(false)}
        onConfirm={() => {
          setConfirmSignOutOpen(false)
          logout()
        }}
        title="Sign out of Pointfex ERP?"
        message="You will be signed out of your current session and returned to the login screen."
        confirmLabel="Sign Out"
        severity="danger"
      />
    </>
  )
}
