import { useEffect, useState, useCallback, useRef } from 'react'
import { Clock, LogOut } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface IdleTimeoutModalProps {
  isAuthenticated: boolean
  onLogout: () => void
  idleMinutes?: number
  warningMinutes?: number
}

export function IdleTimeoutModal({
  isAuthenticated,
  onLogout,
  idleMinutes = 30,
  warningMinutes = 1,
}: IdleTimeoutModalProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(warningMinutes * 60)

  const idleMs = (idleMinutes - warningMinutes) * 60 * 1000
  const lastActivityRef = useRef<number>(Date.now())
  const countdownIntervalRef = useRef<any>(null)
  const checkTimerRef = useRef<any>(null)

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (showWarning) {
      setShowWarning(false)
      setCountdown(warningMinutes * 60)
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
    }
  }, [showWarning, warningMinutes])

  // Track global user events
  useEffect(() => {
    if (!isAuthenticated) return

    const handleUserActivity = () => {
      // Only reset activity silently if warning modal is not currently open
      if (!showWarning) {
        lastActivityRef.current = Date.now()
      }
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
    for (const evt of events) {
      window.addEventListener(evt, handleUserActivity, { passive: true })
    }

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, handleUserActivity)
      }
    }
  }, [isAuthenticated, showWarning])

  // Periodic check of idle time
  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false)
      return
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= idleMs && !showWarning) {
        setShowWarning(true)
        setCountdown(warningMinutes * 60)
      }
    }, 5000)

    checkTimerRef.current = interval
    return () => clearInterval(interval)
  }, [isAuthenticated, idleMs, showWarning, warningMinutes])

  // Countdown timer when warning modal is active
  useEffect(() => {
    if (!showWarning) return

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current)
          setShowWarning(false)
          onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [showWarning, onLogout])

  if (!showWarning) return null

  return (
    <Modal
      isOpen={showWarning}
      onClose={() => {}}
      title="Session Idle Security Warning"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white text-sm">
              Inactivity Timeout
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              You have been inactive for nearly 30 minutes. For organizational data security, your session will automatically terminate in:
            </p>
          </div>
        </div>

        <div className="text-center py-2">
          <span className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            00:{countdown.toString().padStart(2, '0')}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Seconds remaining before automatic sign-out</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={LogOut}
            onClick={() => {
              setShowWarning(false)
              onLogout()
            }}
          >
            Sign Out Now
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={resetActivity}
          >
            Stay Signed In
          </Button>
        </div>
      </div>
    </Modal>
  )
}
