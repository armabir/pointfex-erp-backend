import { MfaConfirmModal } from './MfaConfirmModal'

export interface SecurityConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (
    stepUpPhrase?: string,
    passwordConfirm?: string,
    mfaCode?: string,
  ) => Promise<void> | void
  title: string
  details: string
  whatWillHappen?: string
  severity?: 'standard' | 'danger'
  isCritical?: boolean
  coApproverNote?: string
  requirePhrase?: string
  requirePassword?: boolean
  requireMfa?: boolean
  confirmLabel?: string
  isSubmitting?: boolean
}

/**
 * Unified confirmation wrapper delegating to `MfaConfirmModal` so all sensitive
 * and executive confirmations share the fresh 6-digit MFA + enrollment flow.
 */
export function SecurityConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  details,
  whatWillHappen,
  severity = 'standard',
  isCritical = false,
  confirmLabel,
  isSubmitting = false,
}: SecurityConfirmModalProps) {
  return (
    <MfaConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={({ mfaCode, reason }) => onConfirm(reason, undefined, mfaCode)}
      title={title}
      actionSummary={details}
      whoAffected={whatWillHappen}
      isCritical={isCritical || severity === 'danger'}
      confirmLabel={confirmLabel}
      isSubmitting={isSubmitting}
    />
  )
}
