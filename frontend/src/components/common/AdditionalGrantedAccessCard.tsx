import { useState } from 'react'
import { Calendar, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { getPermissionDisplay } from '../../utils/permission-dictionary'
import { getRouteForPermission } from '../../utils/permission-routes'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card } from './Card'

export function AdditionalGrantedAccessCard() {
  const { directPermissions, refreshPermissions, setRoute } = useApp()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshPermissions()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Card
      title="Additional Granted Access"
      subtitle="Launchpad for temporary capabilities delegated directly to your account outside your baseline role"
      icon={ShieldCheck}
      action={
        <div className="flex items-center gap-2">
          {directPermissions.length > 0 && (
            <Badge variant="amber" size="xs" dot>
              {directPermissions.length} Active
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            icon={RefreshCw}
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Syncing...' : 'Sync Access'}
          </Button>
        </div>
      }
    >
      {directPermissions.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          No additional temporary permissions are currently delegated to your account.
        </div>
      ) : (
        <div className="space-y-2.5">
          {directPermissions.map((dp) => {
            const display = getPermissionDisplay(dp.code, dp.description || undefined)
            const routeTarget = getRouteForPermission(dp.code)

            return (
              <div
                key={dp.id}
                className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {display.label}
                    </span>
                    <Badge variant="indigo" size="xs">
                      {display.department}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {display.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300">
                      <Calendar className="w-3.5 h-3.5" />
                      {dp.expiresAt
                        ? `Expires ${new Date(dp.expiresAt).toLocaleString()}`
                        : 'Ongoing access'}
                    </span>
                    {dp.reason && <span>Reason: {dp.reason}</span>}
                  </div>
                </div>

                {routeTarget && (
                  <Button
                    type="button"
                    variant="primary"
                    size="xs"
                    icon={ExternalLink}
                    title={`Open ${routeTarget.moduleLabel} (${routeTarget.path})`}
                    onClick={() => setRoute(routeTarget.routeId)}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Launch {routeTarget.moduleLabel}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
