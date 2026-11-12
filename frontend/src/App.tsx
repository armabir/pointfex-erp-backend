import { lazy, Suspense } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Shell } from './components/layout/Shell'
import { LoginPage } from './pages/auth/LoginPage'
import { FirstLoginSecurityPage } from './pages/auth/FirstLoginSecurityPage'
import { DesktopNoticeModal } from './components/common/DesktopNoticeModal'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { SkeletonCard } from './components/common/Skeleton'
import { usePermissions } from './hooks/usePermissions'
import { canAccessRoute } from './config/nav-registry'

const DeveloperTasksPage = lazy(() =>
  import('./pages/developer/DeveloperTasksPage').then((m) => ({ default: m.DeveloperTasksPage })),
)
const DeveloperProjectsPage = lazy(() =>
  import('./pages/developer/DeveloperProjectsPage').then((m) => ({
    default: m.DeveloperProjectsPage,
  })),
)
const DeveloperTeamPage = lazy(() =>
  import('./pages/developer/DeveloperTeamPage').then((m) => ({ default: m.DeveloperTeamPage })),
)
const DeveloperEarningsPage = lazy(() =>
  import('./pages/developer/DeveloperEarningsPage').then((m) => ({
    default: m.DeveloperEarningsPage,
  })),
)
const DeveloperReportPage = lazy(() =>
  import('./pages/developer/DeveloperReportPage').then((m) => ({ default: m.DeveloperReportPage })),
)
const PmTasksPage = lazy(() =>
  import('./pages/pm/PmTasksPage').then((m) => ({ default: m.PmTasksPage })),
)
const PmTaskManagementPage = lazy(() =>
  import('./pages/pm/PmTaskManagementPage').then((m) => ({ default: m.PmTaskManagementPage })),
)
const PmProjectsPage = lazy(() =>
  import('./pages/pm/PmProjectsPage').then((m) => ({ default: m.PmProjectsPage })),
)
const PmTeamManagementPage = lazy(() =>
  import('./pages/pm/PmTeamManagementPage').then((m) => ({ default: m.PmTeamManagementPage })),
)
const PmBudgetFinancePage = lazy(() =>
  import('./pages/pm/PmBudgetFinancePage').then((m) => ({ default: m.PmBudgetFinancePage })),
)
const PmEarningsPage = lazy(() =>
  import('./pages/pm/PmEarningsPage').then((m) => ({ default: m.PmEarningsPage })),
)
const PmReportsPage = lazy(() =>
  import('./pages/pm/PmReportsPage').then((m) => ({ default: m.PmReportsPage })),
)
const CtoTasksPage = lazy(() =>
  import('./pages/cto/CtoTasksPage').then((m) => ({ default: m.CtoTasksPage })),
)
const CtoTaskManagementPage = lazy(() =>
  import('./pages/cto/CtoTaskManagementPage').then((m) => ({ default: m.CtoTaskManagementPage })),
)
const CtoTeamManagementPage = lazy(() =>
  import('./pages/cto/CtoTeamManagementPage').then((m) => ({ default: m.CtoTeamManagementPage })),
)
const CtoAuditLogPage = lazy(() =>
  import('./pages/cto/CtoAuditLogPage').then((m) => ({ default: m.CtoAuditLogPage })),
)
const CtoPeoplePage = lazy(() =>
  import('./pages/cto/CtoPeoplePage').then((m) => ({ default: m.CtoPeoplePage })),
)
const CtoProjectsReposPage = lazy(() =>
  import('./pages/cto/CtoProjectsReposPage').then((m) => ({ default: m.CtoProjectsReposPage })),
)
const CtoCodeQualityPage = lazy(() =>
  import('./pages/cto/CtoCodeQualityPage').then((m) => ({ default: m.CtoCodeQualityPage })),
)
const CtoSecurityTestingPage = lazy(() =>
  import('./pages/cto/CtoSecurityTestingPage').then((m) => ({
    default: m.CtoSecurityTestingPage,
  })),
)
const CtoConsultancyPage = lazy(() =>
  import('./pages/cto/CtoConsultancyPage').then((m) => ({ default: m.CtoConsultancyPage })),
)
const CtoEarningsPage = lazy(() =>
  import('./pages/cto/CtoEarningsPage').then((m) => ({ default: m.CtoEarningsPage })),
)
const CtoReportsPage = lazy(() =>
  import('./pages/cto/CtoReportsPage').then((m) => ({ default: m.CtoReportsPage })),
)
const MyAccountPage = lazy(() =>
  import('./pages/account/MyAccountPage').then((m) => ({ default: m.MyAccountPage })),
)
const LoginAccessPage = lazy(() =>
  import('./pages/admin/LoginAccessPage').then((m) => ({ default: m.LoginAccessPage })),
)
const SecurityOverviewPage = lazy(() =>
  import('./pages/admin/SecurityOverviewPage').then((m) => ({
    default: m.SecurityOverviewPage,
  })),
)
const DynamicDashboardPage = lazy(() =>
  import('./pages/dashboard/DynamicDashboardPage').then((m) => ({
    default: m.DynamicDashboardPage,
  })),
)
const CfoBudgetPage = lazy(() =>
  import('./pages/cfo/CfoBudgetPage').then((m) => ({ default: m.CfoBudgetPage })),
)
const ChroPerformancePage = lazy(() =>
  import('./pages/chro/ChroPerformancePage').then((m) => ({ default: m.ChroPerformancePage })),
)
const CeoRoleMatrixPage = lazy(() =>
  import('./pages/ceo/CeoRoleMatrixPage').then((m) => ({ default: m.CeoRoleMatrixPage })),
)
const DelegationCenterPage = lazy(() =>
  import('./pages/security/DelegationCenterPage').then((m) => ({
    default: m.DelegationCenterPage,
  })),
)
const UnifiedInboxPage = lazy(() =>
  import('./pages/security/UnifiedInboxPage').then((m) => ({ default: m.UnifiedInboxPage })),
)
const AccessDeniedPage = lazy(() =>
  import('./pages/security/AccessDeniedPage').then((m) => ({ default: m.AccessDeniedPage })),
)

function PageRouteFallback() {
  return (
    <div className="space-y-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

function MainContentRouter() {
  const { currentRoute, can, canAny } = useApp()
  const { permissions, authzSnapshot } = usePermissions()
  const effectivePermissions = authzSnapshot?.effectiveCodes ?? permissions

  if (currentRoute !== 'dashboard' && !canAccessRoute(currentRoute, effectivePermissions)) {
    return <AccessDeniedPage routeId={currentRoute} />
  }

  if (
    currentRoute === 'delegations' &&
    canAny([
      'delegations:read_own',
      'delegations:read_received',
      'delegations:read_all',
      'delegations:create',
      'delegations:approve',
      'delegations:revoke',
      'permissions:delegate',
    ])
  ) {
    return <DelegationCenterPage />
  }
  if (currentRoute === 'inbox') {
    return <UnifiedInboxPage />
  }
  if (
    currentRoute === 'approvals' &&
    canAny([
      'approvals:read',
      'approvals:create',
      'approvals:approve',
      'approvals:reject',
      'governance:approve_request',
      'payroll:approve_batch',
      'budgets:approve_request',
      'tasks:approve',
    ])
  ) {
    return <UnifiedInboxPage />
  }

  // Capability-driven module routing (no hardcoded role gate checks)
  if (
    currentRoute === 'people' &&
    canAny([
      'employees:read_directory',
      'employees:create',
      'employees:update_any',
      'employees:suspend',
      'users:suspend',
      'positions:read',
      'positions:assign',
      'users:assign_role',
    ])
  ) {
    return <CtoPeoplePage />
  }
  if (
    currentRoute === 'task-management' &&
    canAny([
      'tasks:create_assign',
      'tasks:approve',
      'tasks:reject',
      'tasks:reassign',
      'directives:read',
      'directives:dispatch',
    ])
  ) {
    return can('projects:read_all') || can('directives:dispatch') ? (
      <CtoTaskManagementPage />
    ) : (
      <PmTaskManagementPage />
    )
  }
  if (
    currentRoute === 'access-control' &&
    canAny([
      'roles:read',
      'roles:create',
      'roles:update',
      'roles:delete',
      'users:assign_role',
      'permissions:read',
      'permissions:delegate',
      'delegations:create',
      'governance:read',
      'decisions:read',
      'decisions:ratify',
    ])
  ) {
    return <CeoRoleMatrixPage />
  }
  if (
    currentRoute === 'budget' &&
    canAny([
      'treasury:read',
      'wallets:read_all',
      'transactions:read_all',
      'budgets:approve_request',
      'budgets:reject_request',
      'budgets:allocate_project',
      'finance:issue_adjustment',
      'revenue_share:process',
    ])
  ) {
    return <CfoBudgetPage />
  }
  if (
    currentRoute === 'budget-finance' &&
    canAny(['budgets:read_requests', 'budgets:request_increase', 'budgets:allocate_developer'])
  ) {
    return <PmBudgetFinancePage />
  }
  if (
    currentRoute === 'performance' &&
    canAny([
      'performance:read_all',
      'performance:evaluate',
      'performance:recognize',
      'performance:discipline',
      'grievances:read_confidential',
      'grievances:adjudicate_confidential',
    ])
  ) {
    return <ChroPerformancePage />
  }
  if (
    currentRoute === 'reports' &&
    canAny([
      'reports:triage',
      'reports:forward',
      'reports:read_standard',
      'grievances:read_confidential',
      'grievances:adjudicate_confidential',
      'directives:dispatch',
    ])
  ) {
    return canAny(['directives:dispatch', 'grievances:read_confidential', 'reports:read_all']) ? (
      <CtoReportsPage />
    ) : (
      <PmReportsPage />
    )
  }
  if (currentRoute === 'code-quality' && can('quality_gates:read')) {
    return <CtoCodeQualityPage />
  }
  if (
    currentRoute === 'security-testing' &&
    canAny([
      'security_alerts:read',
      'security_alerts:create',
      'security_alerts:update_status',
      'test_runs:read',
    ])
  ) {
    return <CtoSecurityTestingPage />
  }
  if (currentRoute === 'consultancy' && canAny(['consultancy:read', 'consultancy:manage'])) {
    return <CtoConsultancyPage />
  }
  if (currentRoute === 'audit-log' && canAny(['audit_logs:read', 'audit_logs:read_confidential'])) {
    return <CtoAuditLogPage />
  }
  if (
    currentRoute === 'team-management' &&
    canAny(['teams:create', 'teams:update', 'teams:manage_members', 'teams:read_all'])
  ) {
    return can('teams:read_all') ? <CtoTeamManagementPage /> : <PmTeamManagementPage />
  }
  if (
    currentRoute === 'projects-repos' &&
    canAny([
      'projects:read_all',
      'projects:create',
      'projects:update',
      'projects:assign_team',
      'milestones:create',
      'milestones:update',
    ])
  ) {
    return <CtoProjectsReposPage />
  }
  if (currentRoute === 'projects' && can('projects:read_own')) {
    return can('tasks:create_assign') ? <PmProjectsPage /> : <DeveloperProjectsPage />
  }
  if (currentRoute === 'team' && can('teams:read_own')) {
    return <DeveloperTeamPage />
  }
  // My Work routes available to every employee (alwaysVisible)
  if (currentRoute === 'tasks') {
    if (can('projects:read_all')) return <CtoTasksPage />
    if (can('tasks:read_team')) return <PmTasksPage />
    return <DeveloperTasksPage />
  }
  if (currentRoute === 'earnings') {
    if (can('treasury:read')) return <CfoBudgetPage />
    if (can('budgets:allocate_developer')) return <PmEarningsPage />
    if (can('projects:read_all')) return <CtoEarningsPage />
    return <DeveloperEarningsPage />
  }
  if (currentRoute === 'report') {
    return can('reports:triage') ? <PmReportsPage /> : <DeveloperReportPage />
  }
  if (currentRoute === 'settings' || currentRoute === 'my-account') {
    return <MyAccountPage />
  }
  if (currentRoute === 'login-access') {
    return <LoginAccessPage />
  }
  if (currentRoute === 'security-overview') {
    return <SecurityOverviewPage />
  }

  // Dashboard resolved via declarative widget registry (never role switches)
  if (currentRoute === 'dashboard') {
    return <DynamicDashboardPage />
  }

  return <AccessDeniedPage routeId={currentRoute} />
}

function AppRoot() {
  const { isAuthenticated, isAuthChecking, mustChangePassword, mustEnrollMfa } = useApp()

  if (isAuthChecking) {
    return (
      <>
        <DesktopNoticeModal />
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-300">
          <img src="/Logo.png" alt="Pointfex" className="w-11 h-11 object-contain animate-pulse" />
          <p className="text-xs font-medium tracking-wide text-slate-400">
            Verifying secure session...
          </p>
        </div>
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <DesktopNoticeModal />
        <LoginPage />
      </>
    )
  }

  if (mustChangePassword || mustEnrollMfa) {
    return (
      <>
        <DesktopNoticeModal />
        <FirstLoginSecurityPage />
      </>
    )
  }

  return (
    <>
      <DesktopNoticeModal />
      <Shell>
        <Suspense fallback={<PageRouteFallback />}>
          <MainContentRouter />
        </Suspense>
      </Shell>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppRoot />
      </AppProvider>
    </ErrorBoundary>
  )
}
