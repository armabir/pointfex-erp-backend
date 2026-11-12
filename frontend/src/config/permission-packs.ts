import type { WorkspaceId } from './workspaces'

export type PackRiskLevel = 'standard' | 'elevated' | 'critical'

export interface PermissionPack {
  id: string
  name: string
  description: string
  workspace: WorkspaceId
  codes: readonly string[]
  riskLevel: PackRiskLevel
  /** Every critical (⚠) code in `codes` must be explicitly listed here */
  criticalCodes: readonly string[]
}

export const PERMISSION_PACKS: readonly PermissionPack[] = [
  // My Work
  {
    id: 'my_daily_work',
    name: 'Personal Tasks & Leave',
    description: 'View own tasks, create personal items, and submit or cancel leave requests.',
    workspace: 'my_work',
    codes: ['tasks:read_own', 'tasks:create_personal', 'tasks:update_status', 'leaves:request', 'leaves:cancel', 'leaves:read_own'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  {
    id: 'my_attendance_self',
    name: 'Self Attendance & Profile',
    description: 'Check in/out for daily attendance, view own logs, and update own profile.',
    workspace: 'my_work',
    codes: ['attendance:check_in', 'attendance:check_out', 'attendance:read_own', 'attendance:correct_own', 'employees:read_own', 'employees:update_own_profile'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  {
    id: 'my_wallet_expenses',
    name: 'Personal Wallet & Expenses',
    description: 'View own payroll slips, XP standing, and submit expense claims.',
    workspace: 'my_work',
    codes: ['compensation:read_own', 'payroll:read_own', 'xp:read_own', 'expenses:submit', 'expenses:read_own'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  // People & Culture
  {
    id: 'view_directory',
    name: 'View Employee Directory',
    description: 'Browse the company staff directory and department structure.',
    workspace: 'people',
    codes: ['employees:read_directory', 'departments:read', 'teams:read_own'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  {
    id: 'manage_recruiting',
    name: 'Manage Recruiting',
    description: 'Review candidates, score interviews, and issue hiring offers.',
    workspace: 'people',
    codes: ['candidates:read', 'candidates:manage', 'candidates:score_interview', 'candidates:offer', 'candidates:approve_hiring'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'manage_employee_records',
    name: 'Manage Employee Profiles',
    description: 'Create employee profiles, update assignments, and manage HR documents.',
    workspace: 'people',
    codes: ['employees:create', 'employees:update_any', 'employees:change_department', 'employees:change_supervisor', 'employees:manage_documents'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'view_sensitive_hr',
    name: 'View Sensitive HR & Contracts',
    description: 'Inspect confidential employee contracts and sensitive personal records.',
    workspace: 'people',
    codes: ['employees:read_sensitive', 'employees:read_contract'],
    riskLevel: 'critical',
    criticalCodes: ['employees:read_sensitive'],
  },
  {
    id: 'offboard_employees',
    name: 'Offboard & Archive Staff',
    description: 'Execute formal employee offboarding and archive departed accounts.',
    workspace: 'people',
    codes: ['employees:offboard', 'employees:archive'],
    riskLevel: 'critical',
    criticalCodes: ['employees:offboard'],
  },
  {
    id: 'approve_timesheets',
    name: 'Approve Timesheets & Attendance',
    description: 'Review team attendance logs, approve corrections, and assign shifts.',
    workspace: 'people',
    codes: ['attendance:read_team', 'attendance:correct_team', 'attendance:approve_correction', 'shifts:read', 'shifts:assign'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'manage_leave_approvals',
    name: 'Approve Team Leave',
    description: 'Approve or reject leave requests and adjust leave balances.',
    workspace: 'people',
    codes: ['leaves:read_team', 'leaves:read_all', 'leaves:approve', 'leaves:reject', 'leaves:manage_balance'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'manage_squads',
    name: 'Manage Squads & Teams',
    description: 'Create squads, manage team membership, and assign squad leads.',
    workspace: 'people',
    codes: ['teams:read_all', 'teams:create', 'teams:update', 'teams:manage_members', 'teams:assign_lead', 'teams:read_capacity'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'run_performance_reviews',
    name: 'Run KPI & Performance Reviews',
    description: 'Create KPIs, set targets, review evidence, and approve evaluation scores.',
    workspace: 'people',
    codes: ['kpis:read', 'kpis:create', 'kpis:update', 'kpis:assign', 'kpis:set_targets', 'kpis:review_evidence', 'kpis:approve_results'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'manage_xp_rewards',
    name: 'Award & Manage XP',
    description: 'View team XP ledgers and award recognition points.',
    workspace: 'people',
    codes: ['xp:read_team', 'xp:read_all', 'xp:read_ledger', 'xp:award', 'xp:manage_rules'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  // Delivery
  {
    id: 'view_company_projects',
    name: 'View Company Projects',
    description: 'View all projects, roadmaps, and delivery progress across squads.',
    workspace: 'delivery',
    codes: ['projects:read_all', 'projects:read_own', 'epics:read', 'sprints:read', 'backlog:read'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  {
    id: 'manage_projects',
    name: 'Manage Projects & Settings',
    description: 'Create projects, assign teams and managers, and update milestones.',
    workspace: 'delivery',
    codes: ['projects:create', 'projects:update', 'projects:assign_team', 'projects:assign_manager', 'projects:manage_members'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'run_sprints',
    name: 'Run Sprints & Backlog',
    description: 'Create sprints, prioritize backlog items, and manage epics and subtasks.',
    workspace: 'delivery',
    codes: ['sprints:create', 'sprints:update', 'backlog:manage', 'backlog:prioritize', 'epics:create', 'epics:update', 'subtasks:create', 'subtasks:manage'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'assign_and_review_tasks',
    name: 'Assign & Review Tasks',
    description: 'Assign tasks across squad members, reassign owners, and review completed work.',
    workspace: 'delivery',
    codes: ['tasks:read_team', 'tasks:read_all', 'tasks:create_assign', 'tasks:update', 'tasks:reassign'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  // Engineering Ops
  {
    id: 'code_repositories',
    name: 'Manage Repositories & PRs',
    description: 'Create branches, review and approve pull requests, and link repositories.',
    workspace: 'engineering',
    codes: ['repositories:read', 'repositories:create', 'repositories:link', 'branches:create', 'pull_requests:read', 'pull_requests:review', 'pull_requests:approve', 'pull_requests:merge'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'quality_and_testing',
    name: 'View Code Quality & Test Runs',
    description: 'Inspect automated test runs and quality gate compliance.',
    workspace: 'engineering',
    codes: ['quality_gates:read', 'quality_gates:manage', 'test_runs:read'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  {
    id: 'security_triage',
    name: 'Triage Security Alerts',
    description: 'View vulnerabilities, run security scans, and update alert statuses.',
    workspace: 'engineering',
    codes: ['security_alerts:read', 'security_alerts:create', 'security_alerts:update_status', 'vulnerabilities:read', 'security_scans:read', 'security_scans:execute'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'incident_response',
    name: 'Handle Production Incidents',
    description: 'Declare incidents, assign responders, resolve issues, and publish postmortems.',
    workspace: 'engineering',
    codes: ['incidents:read', 'incidents:create', 'incidents:declare', 'incidents:assign', 'incidents:resolve', 'incidents:close', 'incidents:postmortem'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  // Finance
  {
    id: 'view_treasury_and_ledger',
    name: 'View Treasury & Ledger',
    description: 'Read treasury balances, project budgets, and financial ledger entries.',
    workspace: 'finance',
    codes: ['treasury:read', 'budgets:read', 'budgets:read_dept', 'ledger:read'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  {
    id: 'request_and_allocate_budgets',
    name: 'Request & Allocate Squad Budgets',
    description: 'Submit budget increase requests and allocate funds to developers.',
    workspace: 'finance',
    codes: ['budgets:read_requests', 'budgets:request_increase', 'budgets:allocate_developer'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'approve_project_budgets',
    name: 'Approve Project Budgets',
    description: 'Approve or reject budget requests and allocate project pools.',
    workspace: 'finance',
    codes: ['budgets:create', 'budgets:approve_request', 'budgets:reject_request', 'budgets:allocate_project', 'budgets:reallocate'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'issue_invoices',
    name: 'Issue & Manage Invoices',
    description: 'Create, send, update, and mark client invoices as paid.',
    workspace: 'finance',
    codes: ['invoices:read', 'invoices:create', 'invoices:update', 'invoices:send', 'invoices:mark_paid'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'approve_expenses',
    name: 'Approve & Reimburse Expenses',
    description: 'Review company expenses, approve claims, and process reimbursements.',
    workspace: 'finance',
    codes: ['expenses:read_all', 'expenses:approve', 'expenses:reject', 'expenses:reimburse'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'run_payroll_prep',
    name: 'Prepare Payroll Runs',
    description: 'View payroll profiles, compensation bands, and calculate monthly payroll.',
    workspace: 'finance',
    codes: ['payroll_profiles:read', 'payroll_profiles:update', 'compensation:read_all', 'compensation:read_bands', 'payroll:read_all', 'payroll:calculate'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'approve_payroll_batch',
    name: 'Approve Payroll Batch',
    description: 'Authorize final payroll batch disbursement and salary compensation changes.',
    workspace: 'finance',
    codes: ['payroll:approve_batch', 'compensation:set', 'compensation:approve_changes'],
    riskLevel: 'critical',
    criticalCodes: ['payroll:approve_batch', 'compensation:set', 'compensation:approve_changes'],
  },
  {
    id: 'treasury_transfers',
    name: 'Execute Treasury Transfers',
    description: 'Initiate treasury transfers, withdrawals, and close accounting periods.',
    workspace: 'finance',
    codes: ['treasury:manage', 'treasury:reconcile', 'treasury:transfer', 'treasury:withdraw', 'ledger:close_period'],
    riskLevel: 'critical',
    criticalCodes: ['treasury:transfer', 'treasury:withdraw', 'ledger:close_period'],
  },
  // Operations
  {
    id: 'manage_vendors_and_po',
    name: 'Manage Vendors & Purchase Orders',
    description: 'Create vendors, submit purchase requests, and approve purchase orders.',
    workspace: 'operations',
    codes: ['vendors:read', 'vendors:create', 'vendors:update', 'purchase_requests:create', 'purchase_requests:approve', 'purchase_orders:create', 'purchase_orders:approve'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'manage_inventory',
    name: 'Manage Inventory & Stock',
    description: 'View, register, and update company inventory levels.',
    workspace: 'operations',
    codes: ['inventory:read', 'inventory:create', 'inventory:update'],
    riskLevel: 'standard',
    criticalCodes: [],
  },
  // Product & Clients
  {
    id: 'manage_product_roadmap',
    name: 'Manage Product Roadmaps',
    description: 'Create products, manage roadmaps, and prioritize feature proposals.',
    workspace: 'product_clients',
    codes: ['products:read', 'products:create', 'products:update', 'roadmaps:read', 'roadmaps:manage', 'features:prioritize', 'features:approve'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'manage_clients_and_leads',
    name: 'Manage Clients & Sales Leads',
    description: 'Create and update client accounts, leads, and consultancy engagements.',
    workspace: 'product_clients',
    codes: ['clients:read_all', 'clients:create', 'clients:update', 'leads:create', 'leads:manage', 'leads:convert', 'consultancy:read', 'consultancy:create', 'consultancy:manage'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  // Company Hub
  {
    id: 'company_announcements',
    name: 'Publish Company Announcements',
    description: 'Create and broadcast company-wide or squad announcements.',
    workspace: 'company_hub',
    codes: ['announcements:read', 'announcements:create', 'announcements:update', 'announcements:global', 'announcements:squad'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'triage_executive_reports',
    name: 'Triage & Export Reports',
    description: 'Read, triage, forward, and export executive operational reports.',
    workspace: 'company_hub',
    codes: ['reports:create', 'reports:read_standard', 'reports:triage', 'reports:forward', 'reports:export', 'analytics:read'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  // Admin & Governance
  {
    id: 'review_approvals_inbox',
    name: 'Review & Sign Approvals',
    description: 'View pending workflow approvals and sign or reject approval steps.',
    workspace: 'admin',
    codes: ['approvals:read', 'approvals:create', 'approvals:approve', 'approvals:reject', 'governance:read', 'governance:approve_request'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'delegate_authority',
    name: 'Delegate & Revoke Authority',
    description: 'Grant temporary scoped delegations and approve or revoke active delegations.',
    workspace: 'admin',
    codes: ['delegations:create', 'delegations:read_own', 'delegations:read_received', 'delegations:read_all', 'delegations:approve', 'delegations:revoke'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'manage_roles_and_assignments',
    name: 'Manage Roles & User Access',
    description: 'Create, update, clone, and assign organizational roles and review access.',
    workspace: 'admin',
    codes: ['roles:read', 'roles:create', 'roles:update', 'roles:clone', 'roles:activate', 'roles:read_assignments', 'roles:read_versions', 'users:read', 'users:assign_role', 'permissions:read'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
  {
    id: 'user_lifecycle_security',
    name: 'Account Lifecycle & MFA Controls',
    description: 'Reset user passwords, revoke sessions, enforce MFA, and offboard accounts.',
    workspace: 'admin',
    codes: ['sessions:read', 'sessions:revoke', 'mfa:manage', 'mfa:enforce', 'users:reset_password', 'users:suspend', 'users:reactivate', 'users:offboard'],
    riskLevel: 'critical',
    criticalCodes: ['users:offboard'],
  },
  {
    id: 'audit_and_compliance',
    name: 'Inspect Audit Trail',
    description: 'Read tamper-evident hash-chained audit logs across system activity.',
    workspace: 'admin',
    codes: ['audit_logs:read', 'reports:read_confidential'],
    riskLevel: 'elevated',
    criticalCodes: [],
  },
]

export function buildRolePlainSummary(selectedCodes: ReadonlySet<string>): {
  canSummary: string
  cannotSummary: string
  matchedPacks: PermissionPack[]
  unmatchedPacks: PermissionPack[]
} {
  const matchedPacks = PERMISSION_PACKS.filter((pack) =>
    pack.codes.some((c) => selectedCodes.has(c)),
  )
  const unmatchedPacks = PERMISSION_PACKS.filter(
    (pack) => !pack.codes.some((c) => selectedCodes.has(c)),
  )

  const canLabels = matchedPacks.slice(0, 4).map((p) => p.name.toLowerCase())
  const cannotLabels = unmatchedPacks
    .filter((p) => p.riskLevel !== 'standard')
    .slice(0, 3)
    .map((p) => p.name.toLowerCase())

  const canSummary =
    canLabels.length > 0
      ? `This role can ${canLabels.join(', ')}${matchedPacks.length > 4 ? ` (+${matchedPacks.length - 4} more areas)` : ''}`
      : 'This role currently has no permissions assigned'

  const cannotSummary =
    cannotLabels.length > 0
      ? `but cannot ${cannotLabels.join(', ')}.`
      : 'and has broad operational coverage across packs.'

  return { canSummary, cannotSummary, matchedPacks, unmatchedPacks }
}

