import { Keyboard } from 'lucide-react'
import { Modal } from './Modal'
import { usePermissions } from '../../hooks/usePermissions'
import { getPermittedShortcuts } from '../../services/palette-items'

export interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { permissions, authzSnapshot } = usePermissions()
  const effectivePermissions = authzSnapshot?.effectiveCodes ?? permissions
  const shortcuts = getPermittedShortcuts(effectivePermissions)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" maxWidth="max-w-lg">
      <div className="space-y-5 text-[13px]">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Global
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
              <span className="text-[var(--text)]">Open Command &amp; Action Palette</span>
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px]">
                Ctrl + K
              </kbd>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)]">
              <span className="text-[var(--text)]">Open Keyboard Shortcuts Help</span>
              <kbd className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px]">
                ?
              </kbd>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Go To (Press g, then key)
          </div>
          <div className="space-y-1.5">
            {shortcuts.map((sc) => (
              <div
                key={sc.keys}
                className="flex items-center justify-between py-1.5 border-b border-[var(--border)]"
              >
                <span className="text-[var(--text)]">{sc.label}</span>
                <div className="flex items-center gap-1">
                  {sc.sequence.map((k) => (
                    <kbd
                      key={k}
                      className="px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px]"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Unified Inbox
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <Keyboard className="w-3.5 h-3.5" />
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">
                  j
                </kbd>{' '}
                /{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">
                  k
                </kbd>{' '}
                Move focus
              </span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">
                a
              </kbd>{' '}
              Approve •{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] font-mono">
                r
              </kbd>{' '}
              Reject
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

