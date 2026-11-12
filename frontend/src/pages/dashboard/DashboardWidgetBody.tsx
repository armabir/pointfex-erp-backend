import {
  CheckSquare,
  ClipboardCheck,
  Coins,
  FolderGit2,
  Plus,
  ScrollText,
  Share2,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import { formatBDT, moneyToneClass } from '../../utils/money'
import { formatDate } from '../../utils/formatters'
import type { Project, SeedData, Task, Wallet } from '../../types'
import { EmptyState } from '../../components/common/EmptyState'
import { Button } from '../../components/common/Button'
import { Badge } from '../../components/common/Badge'
import { StatusPill } from '../../components/common/StatusPill'

export interface DashboardWidgetBodyProps {
  widgetId: string
  data: SeedData
  myTasks: Task[]
  inboxPreview: any[]
  myWallet: Wallet | null
  xpBalance: number
  activeDelegationsCount: number
  myUnreadNotifications: SeedData['notifications']
  can: (perm: string) => boolean
  setRoute: (route: string) => void
  setSelectedTaskModal: (task: Task) => void
  setSelectedProjectModal: (project: Project) => void
}

export function DashboardWidgetBody({
  widgetId,
  data,
  myTasks,
  inboxPreview,
  myWallet,
  xpBalance,
  activeDelegationsCount,
  myUnreadNotifications,
  can,
  setRoute,
  setSelectedTaskModal,
  setSelectedProjectModal,
}: DashboardWidgetBodyProps) {
  switch (widgetId) {
    case 'my_tasks_due':
      if (myTasks.length === 0) {
        return (
          <EmptyState
            icon={CheckSquare}
            title="No open tasks assigned"
            description="Your task queue is clear. Check My Tasks or ask your PM for new items."
            action={
              <Button variant="secondary" onClick={() => setRoute('tasks')}>
                Open My Tasks
              </Button>
            }
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {myTasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setSelectedTaskModal(t)}
                className="w-full text-left py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-muted)]/60 px-2 rounded-[var(--radius-control)] cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-[var(--text)] truncate">{t.title}</div>
                  <div className="text-[12px] text-[var(--muted)]">
                    Due {formatDate(t.dueDate, 'short')}
                  </div>
                </div>
                <StatusPill status={t.status} />
              </button>
            </li>
          ))}
        </ul>
      )

    case 'my_pending_approvals':
      if (inboxPreview.length === 0) {
        return (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing waiting for your approval"
            description="Requests needing your decision will appear here automatically."
            action={
              <Button variant="secondary" onClick={() => setRoute('approvals')}>
                Open Approval Inbox
              </Button>
            }
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {inboxPreview.map((req) => (
            <li key={req.id} className="py-2.5 flex items-center justify-between gap-3 text-[14px]">
              <div className="min-w-0">
                <div className="font-medium text-[var(--text)] truncate">{req.actionCode}</div>
                <div className="text-[12px] text-[var(--muted)] truncate">
                  {req.entityType}:{req.entityId}
                  {req.amount ? ` • ${formatBDT(Number(req.amount))}` : ''}
                </div>
              </div>
              <Badge variant="warning" size="xs">
                {req.status}
              </Badge>
            </li>
          ))}
        </ul>
      )

    case 'my_xp_wallet':
      return (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-[var(--muted)]">Available Balance</span>
            <span
              className={`text-[24px] font-semibold tabular-nums ${moneyToneClass(myWallet?.balance ?? 0)}`}
            >
              {formatBDT(myWallet?.balance ?? 0)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)] text-[13px]">
            <div>
              <div className="text-[12px] text-[var(--muted)]">Total Earned</div>
              <div className="font-medium text-[var(--text)] tabular-nums">
                {formatBDT(myWallet?.totalEarnedToDate ?? 0)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] text-[var(--muted)]">XP Points</div>
              <div className="font-medium text-[var(--primary)] tabular-nums">{xpBalance} XP</div>
            </div>
          </div>
        </div>
      )

    case 'my_delegation_status':
      if (activeDelegationsCount === 0) {
        return (
          <EmptyState
            icon={Share2}
            title="No active delegations"
            description="You are currently operating with your own assigned role permissions."
            action={
              <Button variant="secondary" onClick={() => setRoute('delegations')}>
                Open Delegations
              </Button>
            }
          />
        )
      }
      return (
        <div className="space-y-2">
          <div className="text-[24px] font-semibold text-[var(--warning)] tabular-nums">
            {activeDelegationsCount} active
          </div>
          <p className="text-[13px] text-[var(--muted)]">
            Temporary permissions are granted to your account with automatic expiry enforcement.
          </p>
        </div>
      )

    case 'my_notifications':
      if (myUnreadNotifications.length === 0) {
        return (
          <EmptyState
            title="All caught up"
            description="You have no unread notifications right now."
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {myUnreadNotifications.map((n) => (
            <li key={n.id} className="py-2.5">
              <div className="text-[14px] font-medium text-[var(--text)] truncate">{n.title}</div>
              <div className="text-[12px] text-[var(--muted)] truncate">{n.message}</div>
            </li>
          ))}
        </ul>
      )

    case 'treasury_summary':
      return (
        <div className="grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <div className="text-[12px] text-[var(--muted)]">Initial Capital</div>
            <div className="text-[18px] font-semibold text-[var(--text)] tabular-nums">
              {formatBDT(data.treasury.initialCapital)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-[var(--muted)]">Unallocated Reserves</div>
            <div className="text-[18px] font-semibold text-[var(--success)] tabular-nums">
              {formatBDT(data.treasury.unallocatedReserves)}
            </div>
          </div>
          <div>
            <div className="text-[12px] text-[var(--muted)]">Approved Budgets</div>
            <div className="font-medium text-[var(--text)] tabular-nums">
              {formatBDT(data.treasury.totalApprovedBudgets)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-[var(--muted)]">Client Revenue</div>
            <div className="font-medium text-[var(--info)] tabular-nums">
              {formatBDT(data.treasury.totalClientRevenue)}
            </div>
          </div>
        </div>
      )

    case 'payroll_status': {
      const recentTx = data.transactions.slice(0, 5)
      if (recentTx.length === 0) {
        return (
          <EmptyState
            icon={Coins}
            title="No ledger transactions yet"
            description="Budget allocations, bonuses, and payouts in BDT will appear here."
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {recentTx.map((tx) => (
            <li key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-[14px] text-[var(--text)] truncate">{tx.description}</span>
              <span className={`text-[14px] font-semibold tabular-nums shrink-0 ${moneyToneClass(tx.amount)}`}>
                {formatBDT(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )
    }

    case 'project_health': {
      const projs = data.projects.slice(0, 5)
      if (projs.length === 0) {
        return (
          <EmptyState
            icon={FolderGit2}
            title="No projects yet"
            description="Create your first project to track sprints, milestones, and budgets."
            action={
              can('projects:create') ? (
                <Button variant="primary" icon={Plus} onClick={() => setRoute('projects-repos')}>
                  Create First Project
                </Button>
              ) : undefined
            }
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {projs.map((proj) => (
            <li key={proj.id}>
              <button
                type="button"
                onClick={() => setSelectedProjectModal(proj)}
                className="w-full text-left py-2.5 px-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)]/60 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-[var(--text)] truncate">{proj.name}</div>
                  <div className="text-[12px] text-[var(--muted)] tabular-nums">
                    {proj.code} • {formatBDT(proj.budget)}
                  </div>
                </div>
                <Badge variant={proj.status === 'active' ? 'success' : 'default'} size="xs">
                  {proj.progress}%
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )
    }

    case 'squad_delivery': {
      const teams = data.teams.slice(0, 5)
      if (teams.length === 0) {
        return (
          <EmptyState
            icon={Users}
            title="No squads configured"
            description="Create a squad to organize engineers and track delivery velocity."
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {teams.map((tm) => (
            <li key={tm.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-[var(--text)] truncate">{tm.name}</div>
                <div className="text-[12px] text-[var(--muted)]">
                  Sprint {tm.currentSprintWeek}/{tm.totalSprintWeeks}
                </div>
              </div>
              <Badge variant={tm.health === 'on_track' ? 'success' : 'warning'} size="xs">
                {tm.health === 'on_track' ? 'On track' : 'Attention'}
              </Badge>
            </li>
          ))}
        </ul>
      )
    }

    case 'hiring_pipeline':
      return (
        <div className="space-y-2">
          <div className="text-[28px] font-semibold text-[var(--text)] tabular-nums">
            {data.users.length}
          </div>
          <p className="text-[13px] text-[var(--muted)]">
            Active employees provisioned across {data.teams.length} teams.
          </p>
        </div>
      )

    case 'sales_pipeline': {
      const items = data.consultancyRequests.slice(0, 5)
      if (items.length === 0) {
        return (
          <EmptyState
            title="No client advisory requests"
            description="Incoming consultancy engagements will appear here."
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((c) => (
            <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-[14px] font-medium text-[var(--text)] truncate">{c.title}</span>
              <Badge variant="info" size="xs">
                {c.status}
              </Badge>
            </li>
          ))}
        </ul>
      )
    }

    case 'security_alerts': {
      const alerts = data.securityAlerts.slice(0, 5)
      if (alerts.length === 0) {
        return (
          <EmptyState
            icon={ShieldAlert}
            title="No open security alerts"
            description="Repositories and automated test runs show zero active findings."
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {alerts.map((a) => (
            <li key={a.id} className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-[14px] text-[var(--text)] truncate">{a.title}</span>
              <Badge variant={a.severity === 'critical' ? 'danger' : 'warning'} size="xs">
                {a.severity}
              </Badge>
            </li>
          ))}
        </ul>
      )
    }

    case 'kpi_summary': {
      const recs = data.performanceRecords.slice(0, 5)
      if (recs.length === 0) {
        return (
          <EmptyState
            icon={TrendingUp}
            title="No evaluations recorded yet"
            description="Performance reviews will appear here after the first cycle."
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {recs.map((rec) => {
            const emp = data.users.find((u) => u.id === rec.userId)
            return (
              <li key={rec.userId} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-[var(--text)] truncate">
                  {emp?.name || rec.userId}
                </span>
                <Badge variant="success" size="xs">
                  {rec.overallScore}%
                </Badge>
              </li>
            )
          })}
        </ul>
      )
    }

    case 'audit_highlights': {
      const logs = data.activityLogs.slice(0, 5)
      if (logs.length === 0) {
        return (
          <EmptyState
            icon={ScrollText}
            title="No audit events yet"
            description="Hash-chained governance events will stream here in real time."
          />
        )
      }
      return (
        <ul className="divide-y divide-[var(--border)]">
          {logs.map((log) => (
            <li key={log.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-[var(--text)] truncate">{log.action}</div>
                <div className="text-[12px] text-[var(--muted)] truncate">{log.actorName}</div>
              </div>
              <span className="text-[12px] text-[var(--muted)] shrink-0">
                {formatDate(log.timestamp, 'short')}
              </span>
            </li>
          ))}
        </ul>
      )
    }

    default:
      return null
  }
}
