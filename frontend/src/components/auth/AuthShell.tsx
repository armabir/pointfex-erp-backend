import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

interface AuthShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col lg:flex-row">
      {/* Desktop brand panel */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[42%] flex-col justify-between p-12 border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg)] border border-[var(--border)] shadow-sm flex items-center justify-center p-2.5 shrink-0">
            <img src="/Logo.png" alt="Pointfex Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="block text-xl font-bold tracking-tight text-[var(--text)]">
              Pointfex ERP
            </span>
            <span className="block text-xs text-[var(--muted)] mt-0.5">
              Enterprise Resource &amp; Security Platform
            </span>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-[var(--primary)] text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Trust Corporate Workspace</span>
          </div>
          <h2 className="text-[28px] leading-tight font-semibold tracking-tight text-[var(--text)]">
            Calm, accountable operations for every team at Pointfex.
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Sign in with your verified corporate email or Google account. Sensitive actions are protected by live multi-factor verification.
          </p>
        </div>

        <p className="text-xs text-[var(--muted)]">
          Access is managed by your organization&apos;s security policy.
        </p>
      </aside>

      {/* Form column */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-start gap-2">
            <div className="flex lg:hidden items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl bg-[var(--bg)] border border-[var(--border)] shadow-sm flex items-center justify-center p-1.5">
                <img src="/Logo.png" alt="Pointfex Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-base font-bold text-[var(--text)]">Pointfex ERP</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">{title}</h1>
            {subtitle && <p className="text-sm text-[var(--muted)]">{subtitle}</p>}
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}

