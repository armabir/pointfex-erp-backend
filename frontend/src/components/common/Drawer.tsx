import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export interface DrawerProps {
  isOpen: boolean
  onClose?: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  side?: 'right' | 'left'
  widthClass?: string
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  side = 'right',
  widthClass = 'max-w-md',
}: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose?.()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex flex-col w-full ${widthClass} bg-[var(--surface)] border-[var(--border)] shadow-xl h-full ${
          side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r'
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-[var(--text)] truncate">{title}</h3>
            {subtitle && <p className="text-[12px] text-[var(--muted)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 rounded-[var(--radius-control)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-[14px] text-[var(--text)]">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2.5 bg-[var(--surface-muted)]/50">
            {footer}
          </div>
        )}
      </aside>
    </div>
  )
}

