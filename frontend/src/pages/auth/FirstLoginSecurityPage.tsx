import React, { useState } from 'react'
import {
  KeyRound,
  Lock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Copy,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { Button } from '../../components/common/Button'
import { AuthShell } from '../../components/auth/AuthShell'

export function FirstLoginSecurityPage() {
  const {
    currentUser,
    mustChangePassword,
    mustEnrollMfa,
    completeFirstLoginSetup,
    logout,
    showToast,
  } = useApp()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordDone, setPasswordDone] = useState(!mustChangePassword)

  const [mfaEnrollment, setMfaEnrollment] = useState<{
    base32Secret?: string
    otpauthUrl?: string
  } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaDone, setMfaDone] = useState(Boolean(currentUser?.mfaEnabled))
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [recoveryMfaCode, setRecoveryMfaCode] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (newPassword.length < 12) {
      setErrorMsg('New password must be at least 12 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.')
      return
    }
    setIsSubmitting(true)
    try {
      await erpApi.changePassword(currentPassword, newPassword)
      setPasswordDone(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast(
        mustEnrollMfa
          ? 'Password updated. Complete mandatory MFA enrollment to continue.'
          : 'Password updated! You can set up optional MFA below or skip for now.',
        'success',
      )
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to change password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartMfa = async () => {
    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      const res = await erpApi.enrollMfa()
      setMfaEnrollment({ base32Secret: res.base32Secret, otpauthUrl: res.otpauthUrl })
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to initialize MFA enrollment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      await erpApi.verifyMfa(mfaCode.trim())
      setMfaDone(true)
      showToast('MFA enrolled and verified! Generate your recovery codes or continue.', 'success')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid 6-digit MFA code.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateRecoveryCodes = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      const res = await erpApi.regenerateRecoveryCodes({ mfaCode: recoveryMfaCode.trim() })
      setRecoveryCodes(res.recoveryCodes)
      setRecoveryMfaCode('')
      showToast('Recovery codes generated. Save them somewhere safe!', 'success')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to generate recovery codes.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={`Welcome to Pointfex ERP${currentUser?.name ? `, ${currentUser.name}` : ''}`}
      subtitle={`${currentUser?.email || ''} — Complete your first-login security setup`}
    >
      <div className="space-y-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Rotate Initial Password */}
        <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[var(--primary)]" />
              Step 1: Set your password (min 12 chars)
            </span>
            {passwordDone && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed
              </span>
            )}
          </div>

          {!passwordDone && (
            <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current temporary password"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
              <input
                type="password"
                required
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New strong password (min 12 characters)"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
              <input
                type="password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
              <Button type="submit" size="sm" variant="primary" disabled={isSubmitting}>
                Update Password
              </Button>
            </form>
          )}
        </div>

        {/* Step 2: Enroll & Verify TOTP MFA */}
        <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              Step 2: Authenticator App (TOTP MFA){!mustEnrollMfa ? ' — Optional' : ' — Required'}
            </span>
            {mfaDone && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>

          {!mfaDone && (
            <div className="space-y-3 text-xs">
              {!mfaEnrollment ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={isSubmitting || !passwordDone}
                    onClick={() => void handleStartMfa()}
                  >
                    Set Up Authenticator MFA
                  </Button>
                  {!mustEnrollMfa && passwordDone && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSubmitting}
                      onClick={() => void completeFirstLoginSetup()}
                    >
                      Skip MFA for now
                    </Button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleVerifyMfa} className="space-y-3">
                  <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
                    <div className="text-[11px] text-[var(--muted)]">
                      Add this secret key to Google Authenticator, 1Password, or Bitwarden:
                    </div>
                    <div className="font-mono text-xs text-amber-600 dark:text-amber-300 break-all select-all">
                      {mfaEnrollment.base32Secret}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="\d{6}"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="Enter 6-digit TOTP code"
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-mono"
                    />
                    <Button type="submit" size="sm" variant="primary" disabled={isSubmitting}>
                      Verify MFA
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {mfaDone && (
            <div className="space-y-3 text-xs">
              {!recoveryCodes ? (
                <form onSubmit={handleGenerateRecoveryCodes} className="space-y-2">
                  <p className="text-[var(--muted)]">
                    Optional: Enter the next 6-digit code from your authenticator to generate single-use login recovery codes.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={recoveryMfaCode}
                      onChange={(e) => setRecoveryMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Next 6-digit code"
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-mono"
                    />
                    <Button type="submit" size="sm" variant="secondary" disabled={isSubmitting || recoveryMfaCode.length !== 6}>
                      Generate Recovery Codes
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="p-3 rounded-lg bg-[var(--surface)] border border-amber-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-600 dark:text-amber-300">Save Your Recovery Codes (shown once)</span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(recoveryCodes.join('\n'))
                        showToast('Recovery codes copied to clipboard.', 'info')
                      }}
                      className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-[var(--text)]">
                    {recoveryCodes.map((c) => (
                      <div key={c} className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-center">
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={!passwordDone}
                onClick={() => void completeFirstLoginSetup()}
              >
                Continue to Pointfex ERP
              </Button>
            </div>
          )}
        </div>
      </div>
    </AuthShell>
  )
}

