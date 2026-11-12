export interface PermissionRouteTarget {
  /** Internal route ID evaluated by MainContentRouter in App.tsx */
  routeId: string
  /** URL path pushed/displayed for navigation clarity */
  path: string
  /** Business-friendly module title rendered on launch actions */
  moduleLabel: string
}

const ROUTE_TARGETS: Record<string, PermissionRouteTarget> = {
  people: { routeId: 'people', path: '/people', moduleLabel: 'People Directory' },
  finance: { routeId: 'budget', path: '/finance', moduleLabel: 'Financial Operations' },
  pmFinance: {
    routeId: 'budget-finance',
    path: '/finance',
    moduleLabel: 'Project Budget & Finance',
  },
  performance: {
    routeId: 'performance',
    path: '/performance',
    moduleLabel: 'Performance & Culture',
  },
  taskManagement: {
    routeId: 'task-management',
    path: '/task-management',
    moduleLabel: 'Task Management',
  },
  projectsRepos: {
    routeId: 'projects-repos',
    path: '/projects',
    moduleLabel: 'Projects & Engineering',
  },
  teamManagement: {
    routeId: 'team-management',
    path: '/teams',
    moduleLabel: 'Squads & Teams',
  },
  codeQuality: {
    routeId: 'code-quality',
    path: '/code-quality',
    moduleLabel: 'Code Review & Quality',
  },
  securityTesting: {
    routeId: 'security-testing',
    path: '/security-testing',
    moduleLabel: 'Security & Testing',
  },
  consultancy: {
    routeId: 'consultancy',
    path: '/consultancy',
    moduleLabel: 'Advisory & Consultancy',
  },
  accessControl: {
    routeId: 'access-control',
    path: '/access-control',
    moduleLabel: 'Governance & Access',
  },
  reports: {
    routeId: 'reports',
    path: '/reports',
    moduleLabel: 'Executive Reports',
  },
  auditLog: {
    routeId: 'audit-log',
    path: '/audit-log',
    moduleLabel: 'Governance Audit Trail',
  },
}

/**
 * Exact permission-to-route table mapping every delegatable capability to its hidden/protected
 * workspace destination so Profile Settings can act as a secure launchpad without cluttering Sidebar.
 */
export const PERMISSION_ROUTES: Record<string, PermissionRouteTarget> = {
  // People Directory & Organizational Access
  'employees:read_directory': ROUTE_TARGETS.people,
  'employees:create': ROUTE_TARGETS.people,
  'employees:update_any': ROUTE_TARGETS.people,
  'employees:suspend': ROUTE_TARGETS.people,
  'positions:read': ROUTE_TARGETS.people,
  'positions:assign': ROUTE_TARGETS.people,
  'users:assign_role': ROUTE_TARGETS.people,

  // Finance & Treasury
  'treasury:read': ROUTE_TARGETS.finance,
  'wallets:read_all': ROUTE_TARGETS.finance,
  'transactions:read_all': ROUTE_TARGETS.finance,
  'budgets:allocate_project': ROUTE_TARGETS.finance,
  'budgets:approve_request': ROUTE_TARGETS.finance,
  'budgets:reject_request': ROUTE_TARGETS.finance,
  'finance:issue_adjustment': ROUTE_TARGETS.finance,
  'revenue_share:process': ROUTE_TARGETS.finance,
  'budgets:read_requests': ROUTE_TARGETS.pmFinance,
  'budgets:request_increase': ROUTE_TARGETS.pmFinance,
  'budgets:allocate_developer': ROUTE_TARGETS.pmFinance,

  // HR Performance & Disciplinary / Grievances
  'performance:read_all': ROUTE_TARGETS.performance,
  'performance:evaluate': ROUTE_TARGETS.performance,
  'performance:recognize': ROUTE_TARGETS.performance,
  'performance:discipline': ROUTE_TARGETS.performance,
  'grievances:create': ROUTE_TARGETS.performance,
  'grievances:read_confidential': ROUTE_TARGETS.performance,
  'grievances:adjudicate_confidential': ROUTE_TARGETS.performance,

  // Tasks & Executive Directives
  'tasks:create_assign': ROUTE_TARGETS.taskManagement,
  'tasks:approve': ROUTE_TARGETS.taskManagement,
  'tasks:reject': ROUTE_TARGETS.taskManagement,
  'tasks:reassign': ROUTE_TARGETS.taskManagement,
  'directives:read': ROUTE_TARGETS.taskManagement,
  'directives:dispatch': ROUTE_TARGETS.taskManagement,

  // Projects, Teams & Engineering
  'projects:read_all': ROUTE_TARGETS.projectsRepos,
  'projects:create': ROUTE_TARGETS.projectsRepos,
  'projects:update': ROUTE_TARGETS.projectsRepos,
  'projects:assign_team': ROUTE_TARGETS.projectsRepos,
  'milestones:create': ROUTE_TARGETS.projectsRepos,
  'milestones:update': ROUTE_TARGETS.projectsRepos,
  'teams:read_all': ROUTE_TARGETS.teamManagement,
  'teams:create': ROUTE_TARGETS.teamManagement,
  'teams:update': ROUTE_TARGETS.teamManagement,
  'teams:manage_members': ROUTE_TARGETS.teamManagement,
  'quality_gates:read': ROUTE_TARGETS.codeQuality,
  'security_alerts:read': ROUTE_TARGETS.securityTesting,
  'security_alerts:create': ROUTE_TARGETS.securityTesting,
  'security_alerts:update_status': ROUTE_TARGETS.securityTesting,
  'test_runs:read': ROUTE_TARGETS.securityTesting,
  'consultancy:manage': ROUTE_TARGETS.consultancy,

  // Governance, Roles & Audit Logs
  'roles:read': ROUTE_TARGETS.accessControl,
  'roles:create': ROUTE_TARGETS.accessControl,
  'roles:update': ROUTE_TARGETS.accessControl,
  'roles:delete': ROUTE_TARGETS.accessControl,
  'permissions:read': ROUTE_TARGETS.accessControl,
  'permissions:delegate': ROUTE_TARGETS.accessControl,
  'decisions:read': ROUTE_TARGETS.accessControl,
  'decisions:ratify': ROUTE_TARGETS.accessControl,
  'audit_logs:read': ROUTE_TARGETS.auditLog,
  'audit_logs:read_confidential': ROUTE_TARGETS.auditLog,

  // Executive Reports
  'reports:read_standard': ROUTE_TARGETS.reports,
  'reports:triage': ROUTE_TARGETS.reports,
  'reports:forward': ROUTE_TARGETS.reports,
}

const PATH_TO_ROUTE_ID: Record<string, string> = {
  '/people': 'people',
  '/finance': 'budget',
  '/performance': 'performance',
  '/task-management': 'task-management',
  '/projects': 'projects-repos',
  '/teams': 'team-management',
  '/code-quality': 'code-quality',
  '/security-testing': 'security-testing',
  '/consultancy': 'consultancy',
  '/access-control': 'access-control',
  '/reports': 'reports',
  '/audit-log': 'audit-log',
}

export function getRouteForPermission(permissionCode: string): PermissionRouteTarget | null {
  return PERMISSION_ROUTES[permissionCode] ?? null
}

export function resolveRouteIdFromPath(routeOrPath: string): string {
  const cleaned = routeOrPath.trim()
  if (PATH_TO_ROUTE_ID[cleaned]) {
    return PATH_TO_ROUTE_ID[cleaned]
  }
  return cleaned.replace(/^\/+/, '')
}

