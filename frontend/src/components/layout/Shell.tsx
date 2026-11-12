import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  LayoutDashboard,
  CheckSquare,
  Inbox,
  Search,
  Menu,
  Loader2,
} from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { getPermittedShortcuts } from '../../services/palette-items'
import { QuickSearchModal } from '../common/QuickSearchModal'
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal'
import { TaskDetailModal } from '../common/TaskDetailModal'
import { ProjectDetailModal } from '../common/ProjectDetailModal'
import { Toast } from '../common/Toast'
import { DelegationBanner } from './DelegationBanner'

export interface ShellProps {
  children?: ReactNode
}

export function Shell({ children }: ShellProps) {
  const {
    isSidebarCollapsed,
    setMobileSidebarOpen,
    isSearchOpen,
    setIsSearchOpen,
    selectedTaskModal,
    setSelectedTaskModal,
    selectedProjectModal,
    setSelectedProjectModal,
    toastMessage,
    isDataLoading,
    data,
    currentRoute,
    setRoute,
    pendingApprovalsCount,
  } = useApp()
  const { permissions, authzSnapshot } = usePermissions()
  const effectivePermissions = authzSnapshot?.effectiveCodes ?? permissions
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const pendingChordRef = useRef<string | null>(null)
  const chordTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
        return
      }

      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey) {
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setIsHelpOpen((prev) => !prev)
        return
      }

      const key = e.key.toLowerCase()
      if (pendingChordRef.current === 'g') {
        const shortcuts = getPermittedShortcuts(effectivePermissions)
        const match = shortcuts.find((s) => s.sequence[1] === key)
        pendingChordRef.current = null
        if (chordTimerRef.current) window.clearTimeout(chordTimerRef.current)
        if (match) {
          e.preventDefault()
          setRoute(match.route)
        }
        return
      }

      if (key === 'g') {
        pendingChordRef.current = 'g'
        if (chordTimerRef.current) window.clearTimeout(chordTimerRef.current)
        chordTimerRef.current = window.setTimeout(() => {
          pendingChordRef.current = null
        }, 900)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setIsSearchOpen, setRoute, effectivePermissions])

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans transition-colors">
      {/* Desktop Dual-Pane + Mobile Full-Screen Workspace Menu */}
      <Sidebar />

      {/* Main Container */}
      <div
        className={`flex-1 flex flex-col transition-all duration-200 ${
          isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'
        }`}
      >
        <Header />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-12 max-w-7xl w-full mx-auto">
          <DelegationBanner />
          {isDataLoading && data.users.length === 0 ? (
            <div className="min-h-[55vh] flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
              <Loader2 className="w-7 h-7 animate-spin text-[var(--primary)]" />
              <p className="text-[13px] font-medium">Loading your workspace...</p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Home, My Work, Inbox, Search, More; >= 44px touch targets) */}
      <nav
        aria-label="Mobile quick navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[var(--surface)] border-t border-[var(--border)] px-2 py-1 grid grid-cols-5 gap-1"
      >
        <button
          type="button"
          onClick={() => setRoute('dashboard')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[11px] font-medium cursor-pointer px-1 ${
            currentRoute === 'dashboard'
              ? 'text-[var(--primary)] bg-[var(--primary-soft)]'
              : 'text-[var(--muted)]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">Home</span>
        </button>

        <button
          type="button"
          onClick={() => setRoute('tasks')}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[11px] font-medium cursor-pointer px-1 ${
            currentRoute === 'tasks'
              ? 'text-[var(--primary)] bg-[var(--primary-soft)]'
              : 'text-[var(--muted)]'
          }`}
        >
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">My Work</span>
        </button>

        <button
          type="button"
          onClick={() => setRoute('inbox')}
          className={`relative min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[11px] font-medium cursor-pointer px-1 ${
            currentRoute === 'inbox' || currentRoute === 'approvals'
              ? 'text-[var(--primary)] bg-[var(--primary-soft)]'
              : 'text-[var(--muted)]'
          }`}
        >
          <Inbox className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full">Inbox</span>
          {pendingApprovalsCount > 0 && (
            <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--danger)] text-white text-[10px] font-semibold flex items-center justify-center leading-none">
              {pendingApprovalsCount > 9 ? '9+' : pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[11px] font-medium text-[var(--muted)] cursor-pointer px-1"
          aria-label="Open search"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span>Search</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] text-[11px] font-medium text-[var(--muted)] cursor-pointer px-1"
          aria-label="Open all workspaces menu"
        >
          <Menu className="w-4 h-4 shrink-0" />
          <span>More</span>
        </button>
      </nav>

      {/* Modals & Portal */}
      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <KeyboardShortcutsModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <TaskDetailModal
        task={selectedTaskModal}
        isOpen={Boolean(selectedTaskModal)}
        onClose={() => setSelectedTaskModal(null)}
      />

      <ProjectDetailModal
        project={selectedProjectModal}
        isOpen={Boolean(selectedProjectModal)}
        onClose={() => setSelectedProjectModal(null)}
      />

      {/* Toast notification */}
      <Toast toast={toastMessage} />
    </div>
  )
}
