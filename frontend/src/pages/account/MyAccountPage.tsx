import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyRound,
  Laptop,
  Link2,
  Lock,
  LogOut,
  Palette,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { PageHeader } from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { MfaRecoveryCodesCard } from '../../components/common/MfaRecoveryCodesCard'
import { AdditionalGrantedAccessCard } from '../../components/common/AdditionalGrantedAccessCard'
import { validatePasswordStrength } from '../../utils/password-policy'

function formatDhakaDateTime(iso?: string | null): string {
  if (!iso) return 'Never'
  return new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function MyAccountPage() {
  const { currentUser, theme, toggleTheme, showToast, updateUser, refreshData, logout } = useApp()

  const [bio, setBio] = useState(currentUser?.bio || '')
  const [timezone, setTimezone] = useState(currentUser?.timezone || 'Asia/Dhaka (UTC+6)')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordMfaCode, setPasswordMfaCode] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const [sessionsData, setSessionsData] = useState<{
    sessions: Array<{
      id: string
      deviceLabel: string
      ipAddress?: string | null
      lastActiveAt: string
      mfaVerified: boolean
    }>
    externalIdentities: Array<{
      id: string
      provider: string
      email: string
      emailVerified: boolean
      lastLoginAt?: string | null
    }>
    hasPassword: boolean
    mfaEnabled: boolean
  } | null>(null)

  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    const key = currentUser?.id ? `pointfex_density_${currentUser.id}` : 'pointfex_density'
    return (localStorage.getItem(key) as 'comfortable' | 'compact') || 'comfortable'
  })

  const [mfaEnrollData, setMfaEnrollData] = useState<{ base32Secret?: string } | null>(null)
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')

  const loadAccountSecurity = useCallback(async () => {
    try {
      const res = await erpApi.getMySessions()
      setSessionsData(res)
    } catch {
      // Ignore offline/mock fallback
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void erpApi
      .getMySessions()
      .then((res) => {
        if (!cancelled) setSessionsData(res)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    setSavingProfile(true)
    try {
      updateUser(currentUser.id, { bio, timezone })
      await erpApi.updateEmployee(currentUser.id, { bio, timezone })
      showToast('Profile preferences saved.', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Unable to save profile.', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const pwdStrength = useMemo(
    () =>
      validatePasswordStrength(newPassword, {
        name: currentUser?.name,
        email: currentUser?.email,
      }),
    [newPassword, currentUser?.name, currentUser?.email],
  )

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwdStrength.valid) {
      showToast(pwdStrength.errors[0] || 'Password does not meet policy requirements.', 'error')
      return
    }
    setChangingPassword(true)
    try {
      await erpApi.changePassword(currentPassword, newPassword, passwordMfaCode || undefined)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordMfaCode('')
      showToast(
        'Password updated successfully. All other active sessions have been revoked.',
        'success',
      )
      await loadAccountSecurity()
    } catch (err: any) {
      showToast(err?.message || 'Unable to update password.', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    try {
      const res = await erpApi.logoutAllDevices()
      showToast(`Logged out of ${res.revokedCount} devices. Redirecting to sign in...`, 'info')
      window.setTimeout(() => {
        void logout()
      }, 700)
    } catch (err: any) {
      showToast(err?.message || 'Failed to logout from all devices.', 'error')
    }
  }

  const handleRevokeSession = async (id: string) => {
    try {
      await erpApi.revokeMySession(id)
      showToast('Session revoked.', 'info')
      await loadAccountSecurity()
    } catch (err: any) {
      showToast(err?.message || 'Unable to revoke session.', 'error')
    }
  }

  const handleStartMfaEnroll = async () => {
    try {
      const res = await erpApi.enrollMfa()
      setMfaEnrollData({ base32Secret: res.base32Secret })
    } catch (err: any) {
      showToast(err?.message || 'Unable to start MFA enrollment.', 'error')
    }
  }

  const handleVerifyMfaEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await erpApi.verifyMfa(mfaVerifyCode.trim())
      setMfaEnrollData(null)
      setMfaVerifyCode('')
      showToast('Authenticator MFA enabled.', 'success')
      await Promise.all([refreshData(), loadAccountSecurity()])
    } catch (err: any) {
      showToast(err?.message || 'Invalid 6-digit MFA code.', 'error')
    }
  }

  const handleDensityChange = (next: 'comfortable' | 'compact') => {
    setDensity(next)
    const key = currentUser?.id ? `pointfex_density_${currentUser.id}` : 'pointfex_density'
    localStorage.setItem(key, next)
    showToast(`Display density set to ${next}.`, 'info')
  }

  const googleLink = sessionsData?.externalIdentities.find((x) => x.provider === 'google')
  const mfaEnabled = Boolean(sessionsData?.mfaEnabled ?? currentUser?.mfaEnabled)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="My Account"
        subtitle="Manage your profile, password, Google sign-in, multi-factor security, and active sessions."
      />

      {/* Profile */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-[var(--primary)]" />
            Profile
          </h2>
          <Badge variant="neutral">{currentUser?.title || 'Team Member'}</Badge>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">Name</label>
              <input
                type="text"
                disabled
                value={currentUser?.name || ''}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">Email</label>
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--muted)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">Bio</label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short role summary"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          </div>
          <Button type="submit" size="sm" variant="primary" disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save profile'}
          </Button>
        </form>
      </Card>

      {/* Change Password */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
          <Lock className="w-4 h-4 text-[var(--primary)]" />
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
            />
            {mfaEnabled ? (
              <input
                type="text"
                required
                maxLength={6}
                value={passwordMfaCode}
                onChange={(e) => setPasswordMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit MFA code"
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono"
              />
            ) : (
              <div />
            )}
          </div>

          {/* Live Password Strength Meter */}
          {newPassword.length > 0 && (
            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--text)]">Password Policy Strength</span>
                <span
                  className={`font-bold ${
                    pwdStrength.valid
                      ? 'text-emerald-500'
                      : pwdStrength.score >= 2
                        ? 'text-amber-500'
                        : 'text-rose-500'
                  }`}
                >
                  {pwdStrength.valid
                    ? 'STRONG (Complies with Policy)'
                    : pwdStrength.score >= 2
                      ? 'MODERATE'
                      : 'WEAK'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--surface-muted)] overflow-hidden flex">
                <div
                  className={`h-full transition-all ${
                    pwdStrength.valid
                      ? 'bg-emerald-500 w-full'
                      : pwdStrength.score === 3
                        ? 'bg-amber-400 w-3/4'
                        : pwdStrength.score === 2
                          ? 'bg-amber-500 w-1/2'
                          : 'bg-rose-500 w-1/4'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1">
                <div className={`flex items-center gap-1.5 ${pwdStrength.rules.minLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted)]'}`}>
                  {pwdStrength.rules.minLength ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                  <span>8 to 128 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwdStrength.rules.hasUpper && pwdStrength.rules.hasLower ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted)]'}`}>
                  {pwdStrength.rules.hasUpper && pwdStrength.rules.hasLower ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                  <span>Uppercase &amp; lowercase letters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwdStrength.rules.hasNumber && pwdStrength.rules.hasSymbol ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted)]'}`}>
                  {pwdStrength.rules.hasNumber && pwdStrength.rules.hasSymbol ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                  <span>Numbers &amp; special characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${pwdStrength.rules.notCommon && pwdStrength.rules.noNameOrEmail ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted)]'}`}>
                  {pwdStrength.rules.notCommon && pwdStrength.rules.noNameOrEmail ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                  <span>Not common &amp; no name/email</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={changingPassword || (newPassword.length > 0 && !pwdStrength.valid)}
            >
              {changingPassword ? 'Updating...' : 'Update password'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Linked Google Account & MFA Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[var(--primary)]" />
            Linked Google Account
          </h2>
          {googleLink ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text)]">{googleLink.email}</span>
                  <Badge variant="success" size="xs">
                    Google Account Linked
                  </Badge>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Last sign-in: {formatDhakaDateTime(googleLink.lastLoginAt)}
                </div>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                To change your linked email, contact the Chief Executive Officer.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <p className="text-[var(--muted)]">
                Link your verified Google workspace account for passwordless sign-in.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  window.location.assign(`${window.location.origin}/api/auth/google`)
                }
              >
                Link Google account
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
              MFA Status
            </h2>
            <Badge variant={mfaEnabled ? 'success' : 'warning'}>
              {mfaEnabled ? 'Enabled' : 'Not enabled'}
            </Badge>
          </div>
          {!mfaEnabled ? (
            !mfaEnrollData ? (
              <div className="space-y-2 text-xs">
                <p className="text-[var(--muted)]">
                  Enable an authenticator app to protect sensitive actions and generate 10 recovery codes.
                </p>
                <Button type="button" size="sm" variant="primary" icon={KeyRound} onClick={() => void handleStartMfaEnroll()}>
                  Enable Authenticator MFA
                </Button>
              </div>
            ) : (
              <form onSubmit={handleVerifyMfaEnroll} className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono break-all select-all">
                  {mfaEnrollData.base32Secret}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={mfaVerifyCode}
                    onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono"
                  />
                  <Button type="submit" size="sm" variant="primary">
                    Verify
                  </Button>
                </div>
              </form>
            )
          ) : (
            <p className="text-xs text-[var(--muted)]">
              Authenticator TOTP is active. Sensitive actions require a fresh 6-digit code every time.
            </p>
          )}
        </Card>
      </div>

      <MfaRecoveryCodesCard />

      {/* Active Sessions */}
      <Card className="p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
            <Laptop className="w-4 h-4 text-[var(--primary)]" />
            Active Sessions
          </h2>
          <Button
            type="button"
            size="xs"
            variant="danger"
            icon={LogOut}
            onClick={() => void handleLogoutAllDevices()}
          >
            Log out of all devices
          </Button>
        </div>
        <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden">
          {!sessionsData || sessionsData.sessions.length === 0 ? (
            <div className="p-4 text-xs text-[var(--muted)] text-center">No active sessions found.</div>
          ) : (
            sessionsData.sessions.map((s) => (
              <div key={s.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--text)] truncate">{s.deviceLabel}</div>
                  <div className="text-[11px] text-[var(--muted)]">
                    IP: {s.ipAddress || 'Unknown'} · Last active {formatDhakaDateTime(s.lastActiveAt)}
                  </div>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="danger"
                  icon={Trash2}
                  onClick={() => void handleRevokeSession(s.id)}
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Theme & Density */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
          <Palette className="w-4 h-4 text-[var(--primary)]" />
          Theme &amp; Density
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Button type="button" size="sm" variant="secondary" onClick={toggleTheme}>
            Theme: {theme === 'dark' ? 'Dark' : 'Light'} (switch)
          </Button>
          <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(['comfortable', 'compact'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleDensityChange(mode)}
                className={`px-3 py-1.5 capitalize cursor-pointer ${
                  density === mode
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface)] text-[var(--text)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <AdditionalGrantedAccessCard />
    </div>
  )
}
