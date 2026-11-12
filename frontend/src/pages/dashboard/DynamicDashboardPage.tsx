import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Clock,
  Coins,
  FolderGit2,
  Pin,
  Share2,
  SlidersHorizontal,
  Users,
  Wallet,
} from 'lucide-react'
import { erpApi } from '../../api/client'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'
import { resolveVisibleDashboardWidgets } from '../../dashboard/widgets'
import { resolveVisibleNavigation, resolveVisibleWorkspaces } from '../../config/nav-registry'
import { formatBDTCompact } from '../../utils/money'
import {
  getClockInStateKey,
  loadUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '../../utils/user-prefs'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, type StatCardProps } from '../../components/common/StatCard'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { DashboardWidgetCard } from './DashboardWidgetCard'
import { DashboardWidgetBody } from './DashboardWidgetBody'
import { HomePersonalizeModal } from './HomePersonalizeModal'

function getDhakaGreeting(): string {
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Dhaka',
    }).format(new Date())
    const hour = Number(hourStr)
    if (hour >= 5 && hour < 12) return 'Good morning'
    if (hour >= 12 && hour < 17) return 'Good afternoon'
    if (hour >= 17 && hour < 21) return 'Good evening'
    return 'Working late'
  } catch {
    return 'Welcome back'
  }
}

export function DynamicDashboardPage() {
  const {
    currentUser,
    data,
    pendingApprovalsCount,
    activeDelegationsCount,
    authzSnapshot,
    setRoute,
    setSelectedTaskModal,
    setSelectedProjectModal,
    can,
    canAny,
    showToast,
  } = useApp()
  const { permissions } = usePermissions()
  const effectivePermissions = authzSnapshot?.effectiveCodes ?? permissions

  const [prefs, setPrefs] = useState<UserPreferences>(() => loadUserPreferences(currentUser?.id))
  const [isPersonalizeOpen, setIsPersonalizeOpen] = useState(false)
  const [clockedInAt, setClockedInAt] = useState<string | null>(() => {
    if (!currentUser?.id || typeof localStorage === 'undefined') return null
    return localStorage.getItem(getClockInStateKey(currentUser.id))
  })

  const updatePrefs = (next: UserPreferences) => {
    setPrefs(next)
    saveUserPreferences(currentUser?.id, next)
  }

  const allRoleWidgets = useMemo(
    () => resolveVisibleDashboardWidgets(effectivePermissions),
    [effectivePermissions],
  )

  const visibleWidgets = useMemo(() => {
    const orderMap = new Map(prefs.widgetOrder.map((id, idx) => [id, idx]))
    return allRoleWidgets
      .filter((w) => !prefs.hiddenWidgetIds.includes(w.id))
      .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
  }, [allRoleWidgets, prefs.hiddenWidgetIds, prefs.widgetOrder])

  const { visibleItems: availablePages } = useMemo(
    () => resolveVisibleNavigation(effectivePermissions),
    [effectivePermissions],
  )
  const availableWorkspaces = useMemo(
    () => resolveVisibleWorkspaces(effectivePermissions).map((w) => w.workspace),
    [effectivePermissions],
  )

  const pinnedPages = useMemo(
    () => availablePages.filter((p) => prefs.pinnedRoutes.includes(p.route)),
    [availablePages, prefs.pinnedRoutes],
  )

  const [inboxPreview, setInboxPreview] = useState<any[]>([])
  const myPerformance = useMemo(
    () => data.performanceRecords.find((p) => p.userId === currentUser?.id) || null,
    [data.performanceRecords, currentUser?.id],
  )
  const xpBalance = myPerformance?.velocityPointsSprint3 ?? 0
  const xpLevel = Math.max(1, Math.floor(xpBalance / 250) + 1)

  const canClockAttendance = canAny([
    'attendance:clock_in',
    'attendance:clock_out',
    'attendance:read_own',
  ])

  const handleToggleClock = () => {
    if (!currentUser?.id) return
    const key = getClockInStateKey(currentUser.id)
    if (clockedInAt) {
      localStorage.removeItem(key)
      setClockedInAt(null)
      showToast('Clocked out for today.', 'info')
    } else {
      const nowIso = new Date().toISOString()
      localStorage.setItem(key, nowIso)
      setClockedInAt(nowIso)
      showToast('Clocked in for today.', 'success')
    }
  }

  useEffect(() => {
    if (!currentUser?.id) return
    if (can('approvals:read') || can('approvals:approve') || can('governance:approve_request')) {
      erpApi
        .getApprovalInbox()
        .then((rows) => setInboxPreview(Array.isArray(rows) ? rows.slice(0, 5) : []))
        .catch(() => setInboxPreview([]))
    }
  }, [currentUser?.id, can])

  const myTasks = useMemo(
    () =>
      data.tasks
        .filter((t) => t.assigneeId === currentUser?.id && t.status !== 'completed')
        .slice(0, 5),
    [data.tasks, currentUser?.id],
  )

  const myWallet = useMemo(
    () => data.wallets.find((w) => w.userId === currentUser?.id) || null,
    [data.wallets, currentUser?.id],
  )

  const myUnreadNotifications = useMemo(
    () => data.notifications.filter((n) => !n.read).slice(0, 5),
    [data.notifications],
  )

  const statCards: StatCardProps[] = useMemo(() => {
    const cards: StatCardProps[] = [
      {
        label: 'My Open Tasks',
        value: myTasks.length,
        trend: myTasks.some((t) => t.priority === 'urgent') ? 'Priority items due' : 'On schedule',
        trendTone: myTasks.some((t) => t.priority === 'urgent') ? 'warning' : 'success',
        icon: CheckSquare,
        onClick: () => setRoute('tasks'),
      },
      {
        label: 'Needs My Action',
        value: pendingApprovalsCount,
        trend: pendingApprovalsCount > 0 ? 'Waiting in Inbox' : 'All caught up',
        trendTone: pendingApprovalsCount > 0 ? 'warning' : 'neutral',
        icon: ClipboardCheck,
        onClick: () => setRoute('inbox'),
      },
    ]

    if (can('treasury:read')) {
      cards.push({
        label: 'Treasury Reserves',
        value: formatBDTCompact(data.treasury.unallocatedReserves),
        trend: `Capital ${formatBDTCompact(data.treasury.initialCapital)}`,
        trendTone: 'info',
        icon: Coins,
        onClick: () => setRoute('budget'),
      })
    } else {
      cards.push({
        label: 'Wallet Balance',
        value: formatBDTCompact(myWallet?.balance ?? 0),
        trend: `Level ${xpLevel} • ${xpBalance} XP`,
        trendTone: 'success',
        icon: Wallet,
        onClick: () => setRoute('earnings'),
      })
    }

    if (can('projects:read_all')) {
      cards.push({
        label: 'Active Projects',
        value: data.projects.filter((p) => p.status === 'active').length,
        trend: `${data.projects.length} total tracked`,
        trendTone: 'neutral',
        icon: FolderGit2,
        onClick: () => setRoute('projects-repos'),
      })
    } else {
      cards.push({
        label: 'Active Staff',
        value: data.users.length,
        trend: `${data.teams.length} active squads`,
        trendTone: 'neutral',
        icon: Users,
        onClick: () => setRoute('team-management'),
      })
    }

    return cards.slice(0, 4)
  }, [
    can,
    data.projects,
    data.teams.length,
    data.treasury.initialCapital,
    data.treasury.unallocatedReserves,
    data.users,
    myTasks,
    myWallet?.balance,
    pendingApprovalsCount,
    setRoute,
    xpBalance,
    xpLevel,
  ])

  const isCompact = prefs.density === 'compact'

  return (
    <div className={isCompact ? 'space-y-4' : 'space-y-6'}>
      <PageHeader
        title={`${getDhakaGreeting()}, ${currentUser?.name || 'Team Member'}`}
        subtitle="Your daily focus, personal standing, and permission-matched workspace updates."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {canClockAttendance && (
              <Button
                variant={clockedInAt ? 'secondary' : 'primary'}
                size="sm"
                icon={Clock}
                onClick={handleToggleClock}
              >
                {clockedInAt ? 'Clock Out' : 'Clock In'}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={SlidersHorizontal}
              onClick={() => setIsPersonalizeOpen(true)}
            >
              Customize
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={ClipboardCheck}
              onClick={() => setRoute('inbox')}
            >
              Inbox ({pendingApprovalsCount})
            </Button>
          </div>
        }
      />

      {/* Personal Standing & Today's Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="indigo" size="sm">
          <Award className="w-3.5 h-3.5 inline mr-1" />
          Level {xpLevel} • {xpBalance} XP
        </Badge>
        <Badge variant="emerald" size="sm">
          <Wallet className="w-3.5 h-3.5 inline mr-1" />
          {formatBDTCompact(myWallet?.balance ?? 0)}
        </Badge>
        <Badge variant="sky" size="sm">
          <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
          Leave Balance: 14d
        </Badge>
        {activeDelegationsCount > 0 && (
          <Badge variant="amber" size="sm">
            <Share2 className="w-3.5 h-3.5 inline mr-1" />
            {activeDelegationsCount} Active Delegation{activeDelegationsCount === 1 ? '' : 's'}
          </Badge>
        )}
      </div>

      {/* Pinned Favorite Pages */}
      {pinnedPages.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-[var(--muted)] inline-flex items-center gap-1">
            <Pin className="w-3.5 h-3.5" /> Pinned:
          </span>
          {pinnedPages.map((page) => {
            const Icon = page.icon
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => setRoute(page.route)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[12px] font-medium text-[var(--text)] hover:border-[var(--primary)] cursor-pointer transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>{page.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Max 4 calm StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* 2-Column Permission-Driven Widget Grid */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${isCompact ? 'gap-4' : 'gap-6'}`}>
        {visibleWidgets.map((widget) => (
          <DashboardWidgetCard key={widget.id} widget={widget}>
            <DashboardWidgetBody
              widgetId={widget.id}
              data={data}
              myTasks={myTasks}
              inboxPreview={inboxPreview}
              myWallet={myWallet}
              xpBalance={xpBalance}
              activeDelegationsCount={activeDelegationsCount}
              myUnreadNotifications={myUnreadNotifications}
              can={can}
              setRoute={setRoute}
              setSelectedTaskModal={setSelectedTaskModal}
              setSelectedProjectModal={setSelectedProjectModal}
            />
          </DashboardWidgetCard>
        ))}
      </div>

      <HomePersonalizeModal
        isOpen={isPersonalizeOpen}
        onClose={() => setIsPersonalizeOpen(false)}
        prefs={prefs}
        onChangePrefs={updatePrefs}
        availableWidgets={allRoleWidgets}
        availablePages={availablePages}
        availableWorkspaces={availableWorkspaces}
      />
    </div>
  )
}
