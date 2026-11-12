import { useState, useRef, useEffect } from 'react'
import { Settings, LogOut } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Avatar } from '../common/Avatar'
import { ConfirmDialog } from '../common/ConfirmDialog'

export function UserMenu() {
  const { currentUser, setRoute, logout } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  if (!currentUser) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-full bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        aria-label="User profile menu"
      >
        <Avatar
          src={currentUser.avatarUrl || currentUser.avatar}
          name={currentUser.name}
          initials={currentUser.initials}
          size="sm"
        />
        <span className="hidden md:block text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[120px] truncate">
          {currentUser.name}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-2 animate-in fade-in duration-100">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-1">
            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {currentUser.name}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {currentUser.email}
            </div>
            <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 truncate mt-1">
              {currentUser.title}
            </div>
          </div>

          <div className="space-y-0.5 text-xs">
            <button
              onClick={() => {
                setRoute('settings')
                setIsOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Profile &amp; Settings</span>
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            <button
              onClick={() => {
                setIsOpen(false)
                setConfirmSignOutOpen(true)
              }}
              className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
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
    </div>
  )
}
