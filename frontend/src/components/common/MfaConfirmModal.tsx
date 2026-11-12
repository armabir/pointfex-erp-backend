import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, KeyRound, ShieldAlert, Smartphone } from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { Modal } from './Modal'
import { Button } from './Button'

export interface MfaConfirmPayload {
  mfaCode: string
  reason?: string
}

export interface MfaConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: MfaConfirmPayload) => Promise<void> | void
  title: string
  actionSummary: string
  whoAffected?: string
  requiresReason?: boolean
  initialReason?: string
  isCritical?: boolean
  confirmLabel?: string
  isSubmitting?: boolean
}

export function MfaConfirmModal(props: MfaConfirmModalProps) {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={props.title} maxWidth="max-w-md">
      {props.isOpen && <MfaConfirmModalBody {...props} />}
    </Modal>
  )
}

function MfaConfirmModalBody({
  onClose,
  onConfirm,
  actionSummary,
  whoAffected,
  requiresReason = false,
  initialReason = '',
  isCritical = false,
  confirmLabel = 'Verify & Continue',
  isSubmitting = false,
}: MfaConfirmModalProps) {
  const { showToast, refreshPermissions } = useApp()

  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)
  const [enrollData, setEnrollData] = useState<{
    secret?: string
    otpauthUrl?: string
  } | null>(null)
  const [enrollCode, setEnrollCode] = useState('')
  const [isEnrolling, setIsEnrolling] = useState(false)

  const [code, setCode] = useState('')
  const [reason, setReason] = useState(initialReason)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    erpApi
      .refreshSession()
      .then((res) => {
        if (!cancelled) setMfaEnabled(Boolean(res?.user?.mfaEnabled))
      })
      .catch(() => {
        if (!cancelled) setMfaEnabled(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mfaEnabled) {
      window.setTimeout(() => codeInputRef.current?.focus(), 60)
    }
  }, [mfaEnabled])

  const reasonValid = !requiresReason || reason.trim().length >= 10
  const cleanedCode = code.replace(/\D/g, '').slice(0, 6)

  const submitWithCode = async (sixDigits: string) => {
    if (!reasonValid) {
      setErrorText('Please enter a written reason (minimum 10 characters).')
      return
    }
    if (sixDigits.length !== 6 || isSubmitting) return
    setErrorText(null)
    try {
      await onConfirm({
        mfaCode: sixDigits,
        reason: requiresReason ? reason.trim() : reason.trim() || undefined,
      })
    } catch (err: any) {
      const msg = err?.message || 'Verification failed. Check your 6-digit authenticator code.'
      setErrorText(msg)
      const match = msg.match(/(\d+)\s+attempt/)
      if (match) setAttemptsRemaining(Number(match[1]))
      if (msg.toLowerCase().includes('enable mfa')) {
        setMfaEnabled(false)
      }
    }
  }

  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6 && reasonValid && !isSubmitting) {
      void submitWithCode(digits)
    }
  }

  const handleStartEnroll = async () => {
    setIsEnrolling(true)
    setErrorText(null)
    try {
      const res = await erpApi.enrollMfa()
      setEnrollData({ secret: res.base32Secret || res.secretHex, otpauthUrl: res.otpauthUrl })
    } catch (err: any) {
      setErrorText(err?.message || 'Unable to start MFA enrollment.')
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = enrollCode.replace(/\D/g, '').slice(0, 6)
    if (clean.length !== 6) return
    setIsEnrolling(true)
    setErrorText(null)
    try {
      await erpApi.verifyMfa(clean)
      setMfaEnabled(true)
      setEnrollData(null)
      setEnrollCode('')
      showToast('MFA enabled. Enter a fresh code to complete your action.', 'success')
      await refreshPermissions()
    } catch (err: any) {
      setErrorText(err?.message || 'Invalid setup code. Try the current 6-digit code.')
    } finally {
      setIsEnrolling(false)
    }
  }

  return mfaEnabled === false ? (
        <div className="space-y-4 text-[13px]">
          <div className="p-3.5 rounded-[10px] bg-[var(--warning)]/10 border border-[var(--warning)]/30 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--text)]">Enable MFA to do this</p>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">
                This sensitive action requires an authenticator app. Enroll MFA now and we will return you straight to what you were doing.
              </p>
            </div>
          </div>

          {!enrollData ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Smartphone}
                disabled={isEnrolling}
                onClick={() => void handleStartEnroll()}
              >
                {isEnrolling ? 'Starting...' : 'Set Up Authenticator'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerifyEnroll} className="space-y-3">
              <div className="p-3 rounded-[8px] bg-[var(--bg)] border border-[var(--border)] space-y-1">
                <div className="text-[11px] font-medium text-[var(--muted)]">
                  Manual Setup Key (add to Google Authenticator / 1Password)
                </div>
                <div className="font-mono text-[12px] text-[var(--text)] break-all select-all">
                  {enrollData.secret}
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text)] mb-1">
                  Enter 6-digit code from your authenticator
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[15px] font-mono tracking-widest text-[var(--text)]"
                />
              </div>
              {errorText && <p className="text-[12px] text-[var(--danger)]">{errorText}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={CheckCircle2}
                  disabled={enrollCode.length !== 6 || isEnrolling}
                >
                  {isEnrolling ? 'Verifying...' : 'Enable MFA'}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitWithCode(cleanedCode)
          }}
          className="space-y-4 text-[13px]"
        >
          <div
            className={`p-3.5 rounded-[10px] border flex items-start gap-3 ${
              isCritical
                ? 'bg-[var(--danger)]/10 border-[var(--danger)]/30'
                : 'bg-[var(--warning)]/10 border-[var(--warning)]/30'
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                isCritical ? 'text-[var(--danger)]' : 'text-[var(--warning)]'
              }`}
            />
            <div className="space-y-1">
              <p className="font-semibold text-[var(--text)]">{actionSummary}</p>
              {whoAffected && (
                <p className="text-[12px] text-[var(--muted)]">Affected: {whoAffected}</p>
              )}
            </div>
          </div>

          {requiresReason && (
            <div className="space-y-1.5">
              <label className="block text-[12px] font-semibold text-[var(--text)]">
                Written Reason * (minimum 10 characters)
              </label>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this change is being made..."
                className="w-full px-3 py-2 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[13px]"
              />
              {!reasonValid && reason.length > 0 && (
                <p className="text-[11px] text-[var(--warning)]">
                  {10 - reason.trim().length} more character(s) required
                </p>
              )}
            </div>
          )}

          <div className="p-3.5 rounded-[10px] bg-[var(--bg)] border border-[var(--border)] space-y-2">
            <label
              htmlFor="fresh-mfa-code-input"
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]"
            >
              <KeyRound className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Fresh 6-digit Authenticator Code (single-use)</span>
            </label>
            <input
              id="fresh-mfa-code-input"
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={cleanedCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (pasted) {
                  e.preventDefault()
                  handleCodeChange(pasted)
                }
              }}
              placeholder="000000"
              className="w-full px-3 py-2.5 rounded-[8px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[16px] font-mono tracking-[0.25em] text-center"
            />
            <p className="text-[11px] text-[var(--muted)]">
              Recovery codes are only accepted at login. Enter a live code from your authenticator app.
            </p>
          </div>

          {errorText && (
            <div
              role="alert"
              className="p-2.5 rounded-[8px] bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[12px] text-[var(--danger)]"
            >
              {errorText}
              {attemptsRemaining !== null && (
                <span className="font-semibold"> ({attemptsRemaining} attempts remaining)</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isCritical ? 'danger' : 'primary'}
              size="sm"
              disabled={cleanedCode.length !== 6 || !reasonValid || isSubmitting}
            >
              {isSubmitting ? 'Verifying...' : confirmLabel}
            </Button>
          </div>
        </form>
      )
}
