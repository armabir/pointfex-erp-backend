import { useState } from 'react'
import { Copy, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { Card } from './Card'
import { Button } from './Button'
import { MfaConfirmModal, type MfaConfirmPayload } from './MfaConfirmModal'

export function MfaRecoveryCodesCard() {
  const { currentUser, showToast } = useApp()
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [isMfaOpen, setIsMfaOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!currentUser?.mfaEnabled) {
    return null
  }

  const handleConfirm = async ({ mfaCode }: MfaConfirmPayload) => {
    setIsSubmitting(true)
    try {
      const res = await erpApi.regenerateRecoveryCodes({ mfaCode })
      setRecoveryCodes(res.recoveryCodes)
      setIsMfaOpen(false)
      showToast('New login recovery codes generated. Save them securely.', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Unable to regenerate recovery codes.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-500" />
            MFA Login Recovery Codes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Single-use backup codes for signing in if you lose your authenticator device. Recovery codes cannot approve sensitive actions.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={() => setIsMfaOpen(true)}
        >
          Regenerate Codes
        </Button>
      </div>

      {recoveryCodes && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Save these 8 codes now (shown once)
            </span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(recoveryCodes.join('\n'))
                showToast('Recovery codes copied to clipboard.', 'info')
              }}
              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Copy all
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            {recoveryCodes.map((code) => (
              <div
                key={code}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 text-center text-slate-900 dark:text-slate-100"
              >
                {code}
              </div>
            ))}
          </div>
        </div>
      )}

      <MfaConfirmModal
        isOpen={isMfaOpen}
        onClose={() => setIsMfaOpen(false)}
        onConfirm={handleConfirm}
        title="Regenerate Login Recovery Codes"
        actionSummary="Invalidate any previous unused recovery codes and issue 8 new single-use login recovery codes."
        whoAffected={currentUser.email}
        requiresReason={false}
        isCritical
        confirmLabel="Generate New Codes"
        isSubmitting={isSubmitting}
      />
    </Card>
  )
}
