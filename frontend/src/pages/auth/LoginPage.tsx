import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { ApiError, erpApi } from '../../api/client'
import { AuthShell } from '../../components/auth/AuthShell'

function mapFriendlyAuthError(rawMessage?: string, oauthErrorCode?: string | null): string {
  if (oauthErrorCode === 'cancelled') {
    return 'Google sign-in was cancelled. You can try again whenever you are ready.'
  }
  if (oauthErrorCode === 'expired_link') {
    return 'This sign-in link expired. Please start Google sign-in again.'
  }
  if (oauthErrorCode === 'unverified_email') {
    return 'Your Google account email must be verified before signing in.'
  }
  if (oauthErrorCode === 'not_allowed') {
    return 'This account is not allowed.'
  }
  if (oauthErrorCode === 'google_error') {
    return 'Google sign-in could not be completed. Please try again.'
  }
  if (!rawMessage) {
    return 'Unable to sign in. Check your credentials and try again.'
  }
  const lower = rawMessage.toLowerCase()
  if (lower.includes('allowlist') || lower.includes('not allowed') || lower.includes('no pointfex')) {
    return 'This account is not allowed.'
  }
  if (lower.includes('temporary password') && lower.includes('expired')) {
    return 'Your temporary password expired. Request a new one.'
  }
  return rawMessage
}

const REMEMBERED_LOGIN_KEY = 'pointfex_remembered_login_id'
const REMEMBERED_LOGIN_TTL_MS = 3 * 24 * 60 * 60 * 1000

function readRememberedEmail(): string {
  try {
    const raw = localStorage.getItem(REMEMBERED_LOGIN_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { email?: string; expiresAt?: number }
    if (parsed.email && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
      return parsed.email
    }
    localStorage.removeItem(REMEMBERED_LOGIN_KEY)
  } catch {
    // ignore storage errors
  }
  return ''
}

function saveRememberedEmail(email: string): void {
  try {
    const clean = email.trim().toLowerCase()
    if (!clean) return
    localStorage.setItem(
      REMEMBERED_LOGIN_KEY,
      JSON.stringify({ email: clean, expiresAt: Date.now() + REMEMBERED_LOGIN_TTL_MS }),
    )
  } catch {
    // ignore storage errors
  }
}

export function LoginPage() {
  const { loginWithCredentials, completeGoogleLogin } = useApp()

  const [email, setEmail] = useState(() => readRememberedEmail())
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('oauthErrorCode')
    const raw = params.get('oauthError')
    return code || raw ? mapFriendlyAuthError(raw || undefined, code) : null
  })

  // MFA challenge state
  const [mfaChallenge, setMfaChallenge] = useState<{
    mode: 'password' | 'google'
    pendingToken?: string
  } | null>(null)
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [mfaCodeInput, setMfaCodeInput] = useState('')
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('')
  const mfaInputRef = useRef<HTMLInputElement | null>(null)

  // Reset password views
  const [authView, setAuthView] = useState<'login' | 'reset'>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('token') ? 'reset' : 'login'
  })
  const [isOnboardingLink] = useState(
    () => new URLSearchParams(window.location.search).get('onboarding') === '1',
  )
  const [resetToken] = useState(
    () => new URLSearchParams(window.location.search).get('token') || '',
  )
  const [newResetPassword, setNewResetPassword] = useState('')
  const [confirmResetPassword, setConfirmResetPassword] = useState('')
  const [resetMfaCode, setResetMfaCode] = useState('')

  useEffect(() => {
    if (
      window.location.pathname !== '/login' &&
      !window.location.pathname.startsWith('/reset-password')
    ) {
      window.history.replaceState(null, '', '/login' + window.location.search)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthErrorCode = params.get('oauthErrorCode')
    const oauthError = params.get('oauthError')
    const oauthCode = params.get('oauthCode')
    if (oauthErrorCode || oauthError) {
      window.history.replaceState(null, '', '/login')
      return
    }
    if (oauthCode) {
      window.history.replaceState(null, '', '/login')
      void completeGoogleLogin({ code: oauthCode })
        .then((res) => {
          if (res.mfaRequired) {
            setMfaChallenge({ mode: 'google', pendingToken: res.pendingToken })
          }
        })
        .catch((err: unknown) => {
          setErrorMsg(mapFriendlyAuthError(err instanceof Error ? err.message : undefined))
        })
    }
  }, [completeGoogleLogin])

  useEffect(() => {
    if (mfaChallenge) {
      mfaInputRef.current?.focus()
    }
  }, [mfaChallenge, useRecoveryCode])

  const submitMfaPayload = async (payload: { mfaCode?: string; recoveryCode?: string }) => {
    if (!mfaChallenge || isSubmitting) return
    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      if (mfaChallenge.mode === 'password') {
        await loginWithCredentials(email.trim(), password, payload)
        saveRememberedEmail(email.trim())
      } else {
        await completeGoogleLogin({
          pendingToken: mfaChallenge.pendingToken,
          ...payload,
        })
      }
    } catch (err: unknown) {
      setErrorMsg(mapFriendlyAuthError(err instanceof Error ? err.message : undefined))
      setMfaCodeInput('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextFieldErrors: { email?: string; password?: string } = {}
    if (!email.trim() || !email.includes('@')) {
      nextFieldErrors.email = 'Enter a valid email address.'
    }
    if (!password) {
      nextFieldErrors.password = 'Enter your password.'
    }
    setFieldError(nextFieldErrors)
    if (nextFieldErrors.email || nextFieldErrors.password) return

    setErrorMsg(null)
    setInfoMsg(null)
    setIsSubmitting(true)
    try {
      const res = await loginWithCredentials(email.trim(), password)
      if (res.mfaRequired) {
        setMfaChallenge({ mode: 'password' })
      } else {
        saveRememberedEmail(email.trim())
      }
    } catch (err: unknown) {
      const status =
        err instanceof ApiError ? err.status : (err as { status?: number } | null)?.status
      if (status === 429) {
        setErrorMsg('Too many sign-in attempts. Please wait 60 seconds and try again.')
      } else {
        setErrorMsg(mapFriendlyAuthError(err instanceof Error ? err.message : undefined))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMfaCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setMfaCodeInput(digits)
    if (digits.length === 6) {
      void submitMfaPayload({ mfaCode: digits })
    }
  }

  const handleGoogleSignIn = () => {
    setErrorMsg(null)
    setIsSubmitting(true)
    window.location.assign('/api/auth/google')
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setInfoMsg(null)
    if (newResetPassword.length < 12) {
      setErrorMsg('New password must be at least 12 characters.')
      return
    }
    if (newResetPassword !== confirmResetPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }
    setIsSubmitting(true)
    try {
      await erpApi.resetPasswordWithToken({
        token: resetToken.trim(),
        newPassword: newResetPassword,
        ...(resetMfaCode.trim() ? { mfaCode: resetMfaCode.trim() } : {}),
      })
      setInfoMsg('Password saved successfully! You can now sign in with your new password or Google.')
      setAuthView('login')
      setNewResetPassword('')
      setConfirmResetPassword('')
      setResetMfaCode('')
      window.history.replaceState(null, '', '/login')
    } catch (err: unknown) {
      setErrorMsg(mapFriendlyAuthError(err instanceof Error ? err.message : undefined))
    } finally {
      setIsSubmitting(false)
    }
  }

  const shellTitle = mfaChallenge
    ? 'Two-factor verification'
    : authView === 'reset'
      ? isOnboardingLink
        ? 'Activate your account'
        : 'Choose a new password'
      : 'Sign in to Pointfex ERP'

  const shellSubtitle = mfaChallenge
    ? useRecoveryCode
      ? 'Enter one of your single-use recovery codes.'
      : 'Enter the 6-digit code from your authenticator app.'
    : authView === 'reset'
      ? isOnboardingLink
        ? 'Set your password using this 24-hour one-time setup link.'
        : 'Set a new password of at least 12 characters.'
      : 'Use your Google workspace account or email and password.'

  return (
    <AuthShell title={shellTitle} subtitle={shellSubtitle}>
      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {infoMsg && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{infoMsg}</span>
        </div>
      )}

      {mfaChallenge ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitMfaPayload(
              useRecoveryCode
                ? { recoveryCode: recoveryCodeInput.trim() }
                : { mfaCode: mfaCodeInput.trim() },
            )
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="login-mfa-input"
              className="block text-xs font-medium text-[var(--text)] mb-1.5"
            >
              {useRecoveryCode ? 'Recovery code' : '6-digit verification code'}
            </label>
            <input
              id="login-mfa-input"
              ref={mfaInputRef}
              type="text"
              inputMode={useRecoveryCode ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              maxLength={useRecoveryCode ? 16 : 6}
              value={useRecoveryCode ? recoveryCodeInput : mfaCodeInput}
              onChange={(e) =>
                useRecoveryCode
                  ? setRecoveryCodeInput(e.target.value.toUpperCase())
                  : handleMfaCodeChange(e.target.value)
              }
              placeholder={useRecoveryCode ? 'ABCDE12345' : '000000'}
              className="w-full px-3.5 py-2.5 text-base font-mono tracking-widest text-center bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[var(--primary)] hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            <span>Verify &amp; Sign in</span>
          </button>

          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <button
              type="button"
              onClick={() => {
                setUseRecoveryCode((prev) => !prev)
                setErrorMsg(null)
              }}
              className="text-[var(--primary)] hover:underline cursor-pointer"
            >
              {useRecoveryCode ? 'Use authenticator app instead' : 'Use a recovery code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMfaChallenge(null)
                setMfaCodeInput('')
                setRecoveryCodeInput('')
              }}
              className="hover:text-[var(--text)] cursor-pointer"
            >
              Back to sign in
            </button>
          </div>
        </form>
      ) : authView === 'reset' ? (
        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-password" className="block text-xs font-medium text-[var(--text)] mb-1.5">
              New password (min 12 characters)
            </label>
            <input
              id="reset-password"
              type="password"
              required
              minLength={12}
              value={newResetPassword}
              onChange={(e) => setNewResetPassword(e.target.value)}
              placeholder="Enter new strong password"
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label htmlFor="confirm-reset-password" className="block text-xs font-medium text-[var(--text)] mb-1.5">
              Confirm new password
            </label>
            <input
              id="confirm-reset-password"
              type="password"
              required
              minLength={12}
              value={confirmResetPassword}
              onChange={(e) => setConfirmResetPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          {!isOnboardingLink && (
            <div>
              <label htmlFor="reset-mfa" className="block text-xs font-medium text-[var(--text)] mb-1.5">
                Authenticator code (if MFA is enabled on your account)
              </label>
              <input
                id="reset-mfa"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={resetMfaCode}
                onChange={(e) => setResetMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-3.5 py-2 text-sm font-mono bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[var(--primary)] hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium cursor-pointer"
          >
            {isSubmitting ? 'Saving Password...' : isOnboardingLink ? 'Activate Account & Set Password' : 'Save New Password'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthView('login')
              window.history.replaceState(null, '', '/login')
            }}
            className="w-full text-xs text-[var(--muted)] hover:text-[var(--text)] inline-flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGoogleSignIn}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)]/40 border border-[var(--border)] text-[var(--text)] text-sm font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-[var(--border)]" />
            <span className="px-3 text-xs text-[var(--muted)]">or sign in with email</span>
            <div className="flex-grow border-t border-[var(--border)]" />
          </div>

          <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-[var(--text)] mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldError.email) setFieldError((prev) => ({ ...prev, email: undefined }))
                  }}
                  placeholder="name@company.com"
                  aria-invalid={Boolean(fieldError.email)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              {fieldError.email && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{fieldError.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-medium text-[var(--text)]">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                  onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldError.password) {
                      setFieldError((prev) => ({ ...prev, password: undefined }))
                    }
                  }}
                  placeholder="Enter your password"
                  aria-invalid={Boolean(fieldError.password)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {capsLockOn && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Caps Lock is on.
                </p>
              )}
              {fieldError.password && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {fieldError.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[var(--primary)] hover:opacity-95 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>

            <p className="text-[11px] text-[var(--muted)] text-center pt-2 leading-relaxed">
              Forgot your password? Please contact the CHRO or an administrator to reset your credentials.
            </p>
          </form>
        </div>
      )}
      <div className="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span>Pointfex ERP</span>
        <span className="font-mono">v3.3.0 beta</span>
      </div>
    </AuthShell>
  )
}
