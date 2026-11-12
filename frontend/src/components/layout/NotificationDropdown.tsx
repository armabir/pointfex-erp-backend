import { useState, useRef, useEffect } from 'react'
import {
  Bell,
  CheckCheck,
  MessageSquare,
  GitPullRequest,
  DollarSign,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Notification } from '../../types'

export function NotificationDropdown() {
  const { data, markNotificationRead, markAllNotificationsRead, setSelectedTaskModal } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const notifications = data.notifications
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
      case 'pr':
        return <GitPullRequest className="w-3.5 h-3.5 text-purple-500" />
      case 'financial':
        return <DollarSign className="w-3.5 h-3.5 text-amber-500" />
      case 'deadline':
        return <Clock className="w-3.5 h-3.5 text-rose-500" />
      default:
        return <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
    }
  }

  const handleItemClick = (notif: Notification) => {
    markNotificationRead(notif.id)
    if (notif.entityType === 'task' && notif.entityId) {
      const task = data.tasks.find((t) => t.id === notif.entityId)
      if (task) {
        setSelectedTaskModal(task)
        setIsOpen(false)
      }
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-rose-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg z-50 overflow-hidden animate-in fade-in duration-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer font-medium"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`p-3 text-xs flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                    !n.read ? 'bg-sky-50/30 dark:bg-sky-950/20' : ''
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                    {getNotifIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`font-medium truncate ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{n.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
