import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import type { ToastMessage } from '../../types'

export interface ToastProps {
  toast: ToastMessage | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null

  const icon =
    toast.type === 'success' ? (
      <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
    ) : toast.type === 'error' ? (
      <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0" />
    ) : toast.type === 'warning' ? (
      <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />
    ) : (
      <Info className="w-4 h-4 text-[var(--info)] shrink-0" />
    )

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] shadow-lg text-[13px] font-medium text-[var(--text)] max-w-md"
    >
      {icon}
      <span>{toast.msg}</span>
    </div>
  )
}

