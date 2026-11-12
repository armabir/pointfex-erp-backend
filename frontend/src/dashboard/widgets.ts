export type WidgetSize = 'sm' | 'md' | 'lg'

export interface DashboardWidgetDef {
  id: string
  title: string
  group: 'my_day' | 'organization'
  size: WidgetSize
  alwaysVisible?: boolean
  requiredPermissions?: {
    any?: string[]
    all?: string[]
  }
  viewAllRoute?: string
  description: string
}

export const DASHBOARD_WIDGETS: readonly DashboardWidgetDef[] = [
  // "My Day" — always visible to every employee
  {
    id: 'my_tasks_due',
    title: 'My Tasks',
    group: 'my_day',
    size: 'md',
    alwaysVisible: true,
    viewAllRoute: 'tasks',
    description: 'Tasks assigned to you and upcoming due dates',
  },
  {
    id: 'my_pending_approvals',
    title: 'Waiting for Your Approval',
    group: 'my_day',
    size: 'md',
    alwaysVisible: true,
    viewAllRoute: 'approvals',
    description: 'Items queued for your sign-off or review',
  },
  {
    id: 'my_xp_wallet',
    title: 'My Wallet & XP',
    group: 'my_day',
    size: 'sm',
    alwaysVisible: true,
    viewAllRoute: 'earnings',
    description: 'Available BDT balance, recent credits, and XP standing',
  },
  {
    id: 'my_delegation_status',
    title: 'Delegation Status',
    group: 'my_day',
    size: 'sm',
    alwaysVisible: true,
    viewAllRoute: 'delegations',
    description: 'Active delegated powers and upcoming expirations',
  },
  {
    id: 'my_notifications',
    title: 'Notifications',
    group: 'my_day',
    size: 'md',
    alwaysVisible: true,
    viewAllRoute: 'settings',
    description: 'Recent updates, assignments, and announcements',
  },
  // Organization / Capability-gated widgets
  {
    id: 'treasury_summary',
    title: 'Treasury Summary',
    group: 'organization',
    size: 'md',
    requiredPermissions: { any: ['treasury:read'] },
    viewAllRoute: 'budget',
    description: 'Company capital reserves, approved budgets, and client revenue in BDT',
  },
  {
    id: 'payroll_status',
    title: 'Payroll & Adjustments',
    group: 'organization',
    size: 'md',
    requiredPermissions: {
      any: ['payroll:read', 'payroll:approve_batch', 'finance:issue_adjustment', 'wallets:read_all'],
    },
    viewAllRoute: 'budget',
    description: 'Recent wallet disbursements, bonuses, and financial requests',
  },
  {
    id: 'project_health',
    title: 'Project Health',
    group: 'organization',
    size: 'md',
    requiredPermissions: { any: ['projects:read_all', 'projects:read_own'] },
    viewAllRoute: 'projects-repos',
    description: 'Active initiatives, sprint progress, and deadlines',
  },
  {
    id: 'squad_delivery',
    title: 'Squad Delivery',
    group: 'organization',
    size: 'md',
    requiredPermissions: { any: ['teams:read_all', 'teams:read_own'] },
    viewAllRoute: 'team-management',
    description: 'Team velocity and sprint health across squads',
  },
  {
    id: 'hiring_pipeline',
    title: 'People & Seats',
    group: 'organization',
    size: 'sm',
    requiredPermissions: { any: ['positions:read', 'employees:create', 'employees:read_directory'] },
    viewAllRoute: 'people',
    description: 'Active staff headcount and organizational seats',
  },
  {
    id: 'sales_pipeline',
    title: 'Clients & Advisory',
    group: 'organization',
    size: 'md',
    requiredPermissions: { any: ['consultancy:read', 'consultancy:manage'] },
    viewAllRoute: 'consultancy',
    description: 'Incoming client advisory requests and billable engagements',
  },
  {
    id: 'security_alerts',
    title: 'Security & Quality Alerts',
    group: 'organization',
    size: 'md',
    requiredPermissions: { any: ['security_alerts:read', 'test_runs:read', 'quality_gates:read'] },
    viewAllRoute: 'security-testing',
    description: 'Open security findings and test suite status',
  },
  {
    id: 'kpi_summary',
    title: 'Team KPI Summary',
    group: 'organization',
    size: 'md',
    requiredPermissions: { any: ['performance:read_all', 'performance:evaluate'] },
    viewAllRoute: 'performance',
    description: 'Latest staff evaluations and performance highlights',
  },
  {
    id: 'audit_highlights',
    title: 'Audit Highlights',
    group: 'organization',
    size: 'md',
    requiredPermissions: { any: ['audit_logs:read', 'audit_logs:read_confidential'] },
    viewAllRoute: 'audit-log',
    description: 'Latest governance actions and security log entries',
  },
]

export function isWidgetVisible(
  widget: DashboardWidgetDef,
  effectivePermissions: readonly string[],
): boolean {
  if (widget.alwaysVisible) return true
  const permSet = new Set(effectivePermissions)
  if (permSet.has('system:root')) return true
  const req = widget.requiredPermissions
  if (!req) return true
  if (req.all && req.all.length > 0 && !req.all.every((c) => permSet.has(c))) return false
  if (req.any && req.any.length > 0 && !req.any.some((c) => permSet.has(c))) return false
  return true
}

export function resolveVisibleDashboardWidgets(
  effectivePermissions: readonly string[],
): DashboardWidgetDef[] {
  return DASHBOARD_WIDGETS.filter((w) => isWidgetVisible(w, effectivePermissions))
}

