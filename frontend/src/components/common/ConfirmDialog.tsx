import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  severity?: 'standard' | 'danger'
  isSubmitting?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'standard',
  isSubmitting = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed ${
            severity === 'danger'
              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={severity === 'danger' ? 'danger' : 'primary'}
            size="sm"
            disabled={isSubmitting}
            onClick={onConfirm}
          >
            {isSubmitting ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
