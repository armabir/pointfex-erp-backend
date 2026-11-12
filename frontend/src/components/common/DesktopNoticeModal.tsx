import { useState } from 'react'
import { Monitor, CheckCircle2 } from 'lucide-react'
import { Button } from './Button'

const DESKTOP_NOTICE_STORAGE_KEY = 'pointfex_desktop_notice_shown'

export function DesktopNoticeModal() {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(DESKTOP_NOTICE_STORAGE_KEY)
    } catch {
      return true
    }
  })

  const handleAcknowledge = () => {
    try {
      localStorage.setItem(DESKTOP_NOTICE_STORAGE_KEY, 'true')
    } catch {
      // ignore storage availability errors
    }
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desktop-notice-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
            <Monitor className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h2
              id="desktop-notice-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Recommended Workstation Display
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              For optimal performance and the best user experience, we strongly recommend accessing
              this ERP system from a desktop or laptop computer.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            onClick={handleAcknowledge}
          >
            Acknowledge &amp; Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
