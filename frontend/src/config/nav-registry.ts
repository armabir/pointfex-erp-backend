import {
  LayoutDashboard,
  CheckSquare,
  FolderGit2,
  Users,
  Wallet,
  Send,
  UserCheck,
  BarChart3,
  Coins,
  Settings,
  GitBranch,
  Layers,
  ScrollText,
  GitPullRequest,
  ShieldCheck,
  Briefcase,
  FileText,
  KeyRound,
  Share2,
  ClipboardCheck,
  Package,
  Inbox,
  History,
  Vote,
  Lightbulb,
  ListFilter,
} from 'lucide-react'
import type { NavItem } from '../types'
import { WORKSPACES, type WorkspaceId, type WorkspaceMeta } from './workspaces'

export type NavGroupId =
  | 'home'
  | 'my_work'
  | 'people'
  | 'projects'
  | 'finance'
  | 'sales'
  | 'governance'
  | 'insights'
  | 'settings'

export interface NavGroupMeta {
  id: NavGroupId
  label: string
}

export const NAV_GROUPS: readonly NavGroupMeta[] = [
  { id: 'home', label: 'Home' },
  { id: 'my_work', label: 'My Work' },
  { id: 'people', label: 'People' },
  { id: 'projects', label: 'Projects & Delivery' },
  { id: 'finance', label: 'Finance' },
  { id: 'sales', label: 'Sales & Clients' },
  { id: 'governance', label: 'Governance & Access' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' },
]

export interface NavRegistryItem extends NavItem {
  route: string
  group: NavGroupId
  workspace: WorkspaceId
  sectionHeading: string
  built: boolean
  requiredPermissions?: {
    any?: string[]
    all?: string[]
  }
  alwaysVisible?: boolean
  badgeSource?: 'pendingApprovals' | 'activeDelegations'
  mobilePriority?: number
  description?: string
}

export const NAV_REGISTRY: readonly NavRegistryItem[] = [
  // Home
  {
    id: 'dashboard',
    route: 'dashboard',
    label: 'My Day',
    group: 'home',
    workspace: 'home',
    sectionHeading: 'Overview',
    built: true,
    icon: LayoutDashboard,
    isImplemented: true,
    alwaysVisible: true,
    mobilePriority: 1,
    description: 'Daily focus, attendance, priorities, and role-aware widgets',
  },
  // My Work — visible to every employee regardless of role
  {
    id: 'inbox',
    route: 'inbox',
    label: 'Needs My Action',
    group: 'my_work',
    workspace: 'my_work',
    sectionHeading: 'Daily Work',
    built: true,
    icon: Inbox,
    isImplemented: true,
    alwaysVisible: true,
    badgeSource: 'pendingApprovals',
    mobilePriority: 3,
    description: 'Unified inbox of approvals, task reviews, mentions, and expiring delegations',
  },
  {
    id: 'tasks',
    route: 'tasks',
    label: 'My Tasks',
    group: 'my_work',
    workspace: 'my_work',
    sectionHeading: 'Daily Work',
    built: true,
    icon: CheckSquare,
    isImplemented: true,
    alwaysVisible: true,
    mobilePriority: 2,
    description: 'Assigned sprint work, status updates, and deliverables',
  },
  {
    id: 'earnings',
    route: 'earnings',
    label: 'My Wallet & XP',
    group: 'my_work',
    workspace: 'my_work',
    sectionHeading: 'Compensation',
    built: true,
    icon: Wallet,
    isImplemented: true,
    alwaysVisible: true,
    mobilePriority: 4,
    description: 'BDT wallet balance, transactions, and XP/KPI standing',
  },
  {
    id: 'report',
    route: 'report',
    label: 'Submissions & Leave',
    group: 'my_work',
    workspace: 'my_work',
    sectionHeading: 'Daily Work',
    built: true,
    icon: Send,
    isImplemented: true,
    alwaysVisible: true,
    description: 'Submit leave notices, ideas, or confidential grievances',
  },
  {
    id: 'settings',
    route: 'settings',
    label: 'Profile & Settings',
    group: 'settings',
    workspace: 'my_work',
    sectionHeading: 'Preferences',
    built: true,
    icon: Settings,
    isImplemented: true,
    alwaysVisible: true,
    mobilePriority: 5,
    description: 'Profile, MFA status, theme, language, and personal preferences',
  },
  // People & Culture (04, 05, 16, 17)
  {
    id: 'people',
    route: 'people',
    label: 'People Directory',
    group: 'people',
    workspace: 'people',
    sectionHeading: 'Directory',
    built: true,
    icon: UserCheck,
    isImplemented: true,
    requiredPermissions: {
      any: [
        'employees:read_directory',
        'employees:create',
        'employees:update_any',
        'positions:read',
        'positions:assign',
        'users:assign_role',
      ],
    },
    description: 'Employee directory, seats, onboarding, and lifecycle actions',
  },
  {
    id: 'team-management',
    route: 'team-management',
    label: 'Squads & Teams',
    group: 'people',
    workspace: 'people',
    sectionHeading: 'Teams',
    built: true,
    icon: Users,
    isImplemented: true,
    requiredPermissions: {
      any: ['teams:create', 'teams:update', 'teams:manage_members', 'teams:read_all'],
    },
    description: 'Manage cross-functional squads and team rosters',
  },
  {
    id: 'team',
    route: 'team',
    label: 'My Squad',
    group: 'people',
    workspace: 'people',
    sectionHeading: 'Teams',
    built: true,
    icon: Users,
    isImplemented: true,
    requiredPermissions: { all: ['teams:read_own'] },
    description: 'Collaborate with your assigned engineering squad',
  },
  {
    id: 'performance',
    route: 'performance',
    label: 'Performance & Reviews',
    group: 'people',
    workspace: 'people',
    sectionHeading: 'Growth & Reviews',
    built: true,
    icon: BarChart3,
    isImplemented: true,
    requiredPermissions: {
      any: [
        'performance:read_all',
        'performance:evaluate',
        'performance:recognize',
        'performance:discipline',
        'grievances:read_confidential',
        'grievances:adjudicate_confidential',
      ],
    },
    description: 'Evaluations, recognition, morale, and confidential mediation',
  },
  // Delivery (10, 11)
  {
    id: 'projects-repos',
    route: 'projects-repos',
    label: 'Projects & Repositories',
    group: 'projects',
    workspace: 'delivery',
    sectionHeading: 'Projects',
    built: true,
    icon: GitBranch,
    isImplemented: true,
    requiredPermissions: {
      any: ['projects:read_all', 'projects:create', 'projects:update', 'projects:assign_team'],
    },
    description: 'All active projects, milestones, and repositories',
  },
  {
    id: 'projects',
    route: 'projects',
    label: 'My Projects',
    group: 'projects',
    workspace: 'delivery',
    sectionHeading: 'Projects',
    built: true,
    icon: FolderGit2,
    isImplemented: true,
    requiredPermissions: { all: ['projects:read_own'] },
    description: 'Projects you contribute to or lead',
  },
  {
    id: 'task-management',
    route: 'task-management',
    label: 'Task Operations',
    group: 'projects',
    workspace: 'delivery',
    sectionHeading: 'Execution',
    built: true,
    icon: Layers,
    isImplemented: true,
    requiredPermissions: {
      any: [
        'tasks:create_assign',
        'tasks:approve',
        'tasks:reject',
        'tasks:reassign',
        'directives:dispatch',
      ],
    },
    description: 'Assign work, approve milestones, and track sprint velocity',
  },
  // Engineering Ops (12, 13, 14, 15)
  {
    id: 'code-quality',
    route: 'code-quality',
    label: 'Code Quality',
    group: 'projects',
    workspace: 'engineering',
    sectionHeading: 'Quality Gates',
    built: true,
    icon: GitPullRequest,
    isImplemented: true,
    requiredPermissions: { all: ['quality_gates:read'] },
    description: 'Static analysis, test coverage, and compliance gates',
  },
  {
    id: 'security-testing',
    route: 'security-testing',
    label: 'Security & Testing',
    group: 'projects',
    workspace: 'engineering',
    sectionHeading: 'Security & QA',
    built: true,
    icon: ShieldCheck,
    isImplemented: true,
    requiredPermissions: { any: ['security_alerts:read', 'security_alerts:create', 'test_runs:read'] },
    description: 'Security vulnerability backlog and automated test runs',
  },
  // Finance (06, 07)
  {
    id: 'budget',
    route: 'budget',
    label: 'Treasury & Budgets',
    group: 'finance',
    workspace: 'finance',
    sectionHeading: 'Treasury',
    built: true,
    icon: Coins,
    isImplemented: true,
    requiredPermissions: {
      any: [
        'treasury:read',
        'wallets:read_all',
        'transactions:read_all',
        'budgets:approve_request',
        'budgets:reject_request',
        'budgets:allocate_project',
        'finance:issue_adjustment',
        'revenue_share:process',
      ],
    },
    description: 'Company reserves, project budgets, payroll, and ledgers in BDT',
  },
  {
    id: 'budget-finance',
    route: 'budget-finance',
    label: 'Budget Requests',
    group: 'finance',
    workspace: 'finance',
    sectionHeading: 'Allocations',
    built: true,
    icon: Coins,
    isImplemented: true,
    requiredPermissions: {
      any: ['budgets:read_requests', 'budgets:request_increase', 'budgets:allocate_developer'],
    },
    description: 'Allocate squad funds and submit BDT budget requests',
  },
  // Operations (08) — hidden until built
  {
    id: 'procurement-ops',
    route: 'procurement-ops',
    label: 'Procurement & Assets',
    group: 'finance',
    workspace: 'operations',
    sectionHeading: 'Procurement',
    built: false,
    icon: Package,
    isImplemented: false,
    requiredPermissions: { any: ['purchase_orders:read', 'vendors:read', 'assets:read'] },
    description: 'Vendors, purchase orders, inventory, and company assets',
  },
  // Product & Clients (09, 18)
  {
    id: 'consultancy',
    route: 'consultancy',
    label: 'Clients & Advisory',
    group: 'sales',
    workspace: 'product_clients',
    sectionHeading: 'Client Delivery',
    built: true,
    icon: Briefcase,
    isImplemented: true,
    requiredPermissions: { any: ['consultancy:read', 'consultancy:manage', 'consultancy:create'] },
    description: 'Client advisory engagements and consulting requests',
  },
  // Company Hub (19 + reports)
  {
    id: 'reports',
    route: 'reports',
    label: 'Executive Reports',
    group: 'insights',
    workspace: 'company_hub',
    sectionHeading: 'Reports & Triage',
    built: true,
    icon: FileText,
    isImplemented: true,
    requiredPermissions: {
      any: [
        'reports:triage',
        'reports:forward',
        'reports:read_standard',
        'grievances:read_confidential',
        'grievances:adjudicate_confidential',
        'directives:dispatch',
      ],
    },
    description: 'Cross-squad proposals, triage queues, and executive directives',
  },
  // Admin & Governance (01, 02, 03, 20)
  {
    id: 'approvals',
    route: 'approvals',
    label: 'Inbox & Approvals',
    group: 'governance',
    workspace: 'admin',
    sectionHeading: 'Action Queue',
    built: true,
    icon: ClipboardCheck,
    isImplemented: true,
    badgeSource: 'pendingApprovals',
    mobilePriority: 3,
    requiredPermissions: {
      any: [
        'approvals:read',
        'approvals:create',
        'approvals:approve',
        'approvals:reject',
        'governance:approve_request',
        'payroll:approve_batch',
        'budgets:approve_request',
        'tasks:approve',
      ],
    },
    description: 'Pending multi-step approvals and action queue',
  },
  {
    id: 'access-control',
    route: 'access-control',
    label: 'Roles & Permissions',
    group: 'governance',
    workspace: 'admin',
    sectionHeading: 'Access Control',
    built: true,
    icon: KeyRound,
    isImplemented: true,
    requiredPermissions: {
      any: [
        'roles:read',
        'roles:create',
        'roles:update',
        'roles:delete',
        'users:assign_role',
        'permissions:read',
        'permissions:delegate',
        'delegations:create',
        'governance:read',
      ],
    },
    description: 'Role builder, templates, assignments, and effective access viewer',
  },
  {
    id: 'delegations',
    route: 'delegations',
    label: 'Delegations',
    group: 'governance',
    workspace: 'admin',
    sectionHeading: 'Access Control',
    built: true,
    icon: Share2,
    isImplemented: true,
    badgeSource: 'activeDelegations',
    requiredPermissions: {
      any: [
        'delegations:read_own',
        'delegations:read_received',
        'delegations:read_all',
        'delegations:create',
        'delegations:approve',
        'delegations:revoke',
        'permissions:delegate',
      ],
    },
    description: 'Time-bounded delegated permissions and revocation controls',
  },
  {
    id: 'audit-log',
    route: 'audit-log',
    label: 'Audit Trail',
    group: 'insights',
    workspace: 'admin',
    sectionHeading: 'Compliance',
    built: true,
    icon: ScrollText,
    isImplemented: true,
    requiredPermissions: {
      any: ['audit_logs:read', 'audit_logs:read_confidential', 'audit_logs:verify'],
    },
    description: 'Tamper-evident hash-chained governance and security log',
  },
  {
    id: 'login-access',
    route: 'login-access',
    label: 'Login access',
    group: 'governance',
    workspace: 'admin',
    sectionHeading: 'Access Control',
    built: true,
    icon: ShieldCheck,
    isImplemented: true,
    requiredPermissions: {
      any: ['login_allowlist:manage', 'login_allowlist:read'],
    },
    description: 'CEO-only allowlist of verified emails permitted to sign in or be onboarded',
  },
  {
    id: 'access-history',
    route: 'access-history',
    label: 'Access History',
    group: 'governance',
    workspace: 'admin',
    sectionHeading: 'Access Control',
    built: true,
    icon: History,
    isImplemented: true,
    requiredPermissions: {
      any: ['access_history:read'],
    },
    description: 'Immutable ledger of permission grants, role adjustments, and delegations',
  },
  {
    id: 'project-requests',
    route: 'project-requests',
    label: 'Project Votes',
    group: 'governance',
    workspace: 'admin',
    sectionHeading: 'Projects & Governance',
    built: true,
    icon: Vote,
    isImplemented: true,
    requiredPermissions: {
      any: ['projects:request', 'projects:create', 'votes:cast'],
    },
    description: 'Project proposal stepper and executive voting console',
  },
  {
    id: 'my-requests',
    route: 'my-requests',
    label: 'My Requests',
    group: 'my_work',
    workspace: 'my_work',
    sectionHeading: 'Daily Work',
    built: true,
    icon: ListFilter,
    isImplemented: true,
    alwaysVisible: true,
    description: 'Live timeline tracking all your access, project, and budget requests',
  },
  {
    id: 'proposals',
    route: 'proposals',
    label: 'Proposals & Ideas',
    group: 'my_work',
    workspace: 'my_work',
    sectionHeading: 'Daily Work',
    built: true,
    icon: Lightbulb,
    isImplemented: true,
    alwaysVisible: true,
    description: 'Submit technical proposals or confidential workplace reports',
  },
  {
    id: 'security-overview',
    route: 'security-overview',
    label: 'Security',
    group: 'governance',
    workspace: 'admin',
    sectionHeading: 'Security',
    built: true,
    icon: ShieldCheck,
    isImplemented: true,
    requiredPermissions: {
      any: ['mfa:manage', 'governance:read', 'audit_logs:read'],
    },
    description: 'Organization MFA enrollment status, lockouts, and admin MFA/session resets',
  },
]

export function checkItemVisibility(
  item: NavRegistryItem,
  effectivePermissions: readonly string[],
  alreadyVisibleIds?: ReadonlySet<string>,
): boolean {
  if (!item.built) return false
  if (item.id === 'team' && alreadyVisibleIds?.has('team-management')) return false
  if (item.id === 'projects' && alreadyVisibleIds?.has('projects-repos')) return false
  if (item.alwaysVisible) return true

  const permSet = new Set(effectivePermissions)
  if (permSet.has('system:root')) return true

  const req = item.requiredPermissions
  if (!req) return true
  if (req.all && req.all.length > 0 && !req.all.every((c) => permSet.has(c))) {
    return false
  }
  if (req.any && req.any.length > 0 && !req.any.some((c) => permSet.has(c))) {
    return false
  }
  return true
}

export interface VisibleNavGroup {
  id: NavGroupId
  label: string
  items: NavRegistryItem[]
}

export interface WorkspaceSection {
  heading: string
  items: NavRegistryItem[]
}

export interface VisibleWorkspace {
  workspace: WorkspaceMeta
  items: NavRegistryItem[]
  /** At most 3 short section headings per workspace */
  sections: WorkspaceSection[]
}

export function resolveVisibleNavigation(effectivePermissions: readonly string[]): {
  groups: VisibleNavGroup[]
  visibleItems: NavRegistryItem[]
  mobileItems: NavRegistryItem[]
  settingsItem: NavRegistryItem | null
} {
  const visibleItems: NavRegistryItem[] = []
  const seenIds = new Set<string>()

  for (const item of NAV_REGISTRY) {
    if (checkItemVisibility(item, effectivePermissions, seenIds)) {
      visibleItems.push(item)
      seenIds.add(item.id)
    }
  }

  const nonEmptyGroups = NAV_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    items: visibleItems.filter((item) => item.group === g.id),
  })).filter((g) => g.items.length > 0)

  let settingsItem: NavRegistryItem | null = null
  let groups = nonEmptyGroups
  if (nonEmptyGroups.length > 8) {
    const settingsGroup = nonEmptyGroups.find((g) => g.id === 'settings')
    settingsItem = settingsGroup?.items[0] || null
    groups = nonEmptyGroups.filter((g) => g.id !== 'settings').slice(0, 8)
  }

  const mobileItems = visibleItems
    .filter((i) => typeof i.mobilePriority === 'number')
    .sort((a, b) => (a.mobilePriority ?? 99) - (b.mobilePriority ?? 99))
    .slice(0, 4)

  return { groups, visibleItems, mobileItems, settingsItem }
}

export function resolveVisibleWorkspaces(effectivePermissions: readonly string[]): VisibleWorkspace[] {
  const { visibleItems } = resolveVisibleNavigation(effectivePermissions)

  return WORKSPACES.map((ws) => {
    const items = visibleItems.filter((item) => item.workspace === ws.id)
    if (items.length === 0) return null

    const sectionMap = new Map<string, NavRegistryItem[]>()
    for (const item of items) {
      const heading = item.sectionHeading || 'Pages'
      const list = sectionMap.get(heading) || []
      list.push(item)
      sectionMap.set(heading, list)
    }

    const sections: WorkspaceSection[] = Array.from(sectionMap.entries())
      .slice(0, 3)
      .map(([heading, sectionItems]) => ({ heading, items: sectionItems }))

    return {
      workspace: ws,
      items,
      sections,
    }
  }).filter((w): w is VisibleWorkspace => w !== null)
}

export function findNavItemByRoute(routeId: string): NavRegistryItem | undefined {
  return NAV_REGISTRY.find((item) => item.route === routeId || item.id === routeId)
}

export function findWorkspaceByRoute(routeId: string): WorkspaceId {
  return findNavItemByRoute(routeId)?.workspace ?? 'home'
}

export function canAccessRoute(routeId: string, effectivePermissions: readonly string[]): boolean {
  const item = findNavItemByRoute(routeId)
  if (!item || !item.built) return false
  if (item.alwaysVisible) return true
  const permSet = new Set(effectivePermissions)
  if (permSet.has('system:root')) return true
  const req = item.requiredPermissions
  if (!req) return true
  if (req.all && !req.all.every((c) => permSet.has(c))) return false
  if (req.any && !req.any.some((c) => permSet.has(c))) return false
  return true
}
