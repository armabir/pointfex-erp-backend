// Business-friendly dictionary translating technical ERP permission codes
// into plain-English capabilities grouped by Corporate Department.

export type CorporateDepartment =
  'Financial Operations' | 'Human Resources' | 'Engineering & Delivery' | 'Executive Governance'

export interface PermissionDisplayMeta {
  label: string
  description: string
  department: CorporateDepartment
}

export const CORPORATE_DEPARTMENTS: CorporateDepartment[] = [
  'Financial Operations',
  'Human Resources',
  'Engineering & Delivery',
  'Executive Governance',
]

export const DEPARTMENT_SUBTITLES: Record<CorporateDepartment, string> = {
  'Financial Operations':
    'Treasury reserves, project budgets, payroll wallets, and revenue sharing',
  'Human Resources':
    'Staff directory, performance reviews, confidential relations, and role access',
  'Engineering & Delivery': 'Projects, squads, deliverables, quality gates, security, and advisory',
  'Executive Governance': 'Corporate audit trail, executive directives, and leadership approvals',
}

export const PERMISSION_DICTIONARY: Record<string, PermissionDisplayMeta> = {
  // --- FINANCIAL OPERATIONS ---
  'treasury:read': {
    label: 'View Corporate Treasury & Revenue',
    description:
      'Access company capital reserves, total approved budgets, and client revenue figures',
    department: 'Financial Operations',
  },
  'wallets:read_own': {
    label: 'View Personal Earnings & Wallet',
    description: 'View own compensation balance, bonuses, deductions, and payout history',
    department: 'Financial Operations',
  },
  'wallets:read_all': {
    label: 'View All Employee Wallets',
    description: 'Review compensation balances and payouts across all staff members',
    department: 'Financial Operations',
  },
  'transactions:read_own': {
    label: 'View Personal Payment History',
    description: 'Review own disbursement, bonus, and deduction transaction statements',
    department: 'Financial Operations',
  },
  'transactions:read_all': {
    label: 'View Company Financial Ledger',
    description: 'Audit and export all corporate financial transactions across departments',
    department: 'Financial Operations',
  },
  'budgets:read_requests': {
    label: 'View Project Budget Requests',
    description: 'Review pending and historical project budget increase requests',
    department: 'Financial Operations',
  },
  'budgets:allocate_developer': {
    label: 'Disburse Project Funds to Staff',
    description: 'Allocate approved project funds into team members’ compensation wallets',
    department: 'Financial Operations',
  },
  'budgets:allocate_project': {
    label: 'Adjust Project Capital Budgets',
    description: 'Set or modify approved project budget pools from company reserves',
    department: 'Financial Operations',
  },
  'budgets:request_increase': {
    label: 'Request Project Budget Increase',
    description: 'Submit formal requests to Finance for additional project funding',
    department: 'Financial Operations',
  },
  'budgets:approve_request': {
    label: 'Approve Budget Increase Requests',
    description: 'Authorize pending budget requests and transfer funds from company reserves',
    department: 'Financial Operations',
  },
  'budgets:reject_request': {
    label: 'Decline Budget Increase Requests',
    description: 'Reject pending budget requests with written financial justification',
    department: 'Financial Operations',
  },
  'finance:issue_adjustment': {
    label: 'Issue Bonuses & Payroll Adjustments',
    description: 'Grant discretionary bonuses or apply SLA deductions to staff wallets',
    department: 'Financial Operations',
  },
  'revenue_share:process': {
    label: 'Process Client Revenue Sharing',
    description: 'Distribute commercial client revenue shares to deal acquirers and project squads',
    department: 'Financial Operations',
  },

  // --- HUMAN RESOURCES ---
  'employees:read_directory': {
    label: 'View Staff Directory',
    description: 'Browse employee profiles, titles, availability, skills, and squad assignments',
    department: 'Human Resources',
  },
  'employees:create': {
    label: 'Onboard & Provision Staff',
    description:
      'Create new employee accounts, assign initial roles, and issue temporary credentials',
    department: 'Human Resources',
  },
  'employees:update_own_profile': {
    label: 'Edit Personal Profile',
    description: 'Update own bio, skills, timezone, avatar, and availability status',
    department: 'Human Resources',
  },
  'employees:update_any': {
    label: 'Manage Any Employee Profile',
    description: 'Edit job titles, competencies, and profile records for any staff member',
    department: 'Human Resources',
  },
  'employees:suspend': {
    label: 'Suspend & Reactivate Accounts',
    description: 'Immediately suspend or restore employee access and reset privileges to baseline',
    department: 'Human Resources',
  },
  'positions:read': {
    label: 'View Organizational Chart & Seats',
    description: 'Inspect official company positions and historical seat assignments',
    department: 'Human Resources',
  },
  'positions:assign': {
    label: 'Assign Organizational Positions',
    description: 'Promote or transfer employees between official organizational seats',
    department: 'Human Resources',
  },
  'performance:read_own': {
    label: 'View Personal Performance Reviews',
    description: 'View own performance scorecards, recognition awards, and review feedback',
    department: 'Human Resources',
  },
  'performance:read_team': {
    label: 'View Team Performance Metrics',
    description: 'Monitor delivery speed and review scores for direct squad members',
    department: 'Human Resources',
  },
  'performance:read_all': {
    label: 'View Company-Wide Performance Roster',
    description: 'Access evaluations, attendance, morale scores, and HR notes for all personnel',
    department: 'Human Resources',
  },
  'performance:evaluate': {
    label: 'Conduct Staff Performance Evaluations',
    description: 'Record formal performance scores, tiers, strengths, and development areas',
    department: 'Human Resources',
  },
  'performance:recognize': {
    label: 'Award Employee Recognition',
    description: 'Issue formal performance commendations and optional recognition bonuses',
    department: 'Human Resources',
  },
  'performance:discipline': {
    label: 'Issue Formal Disciplinary Actions',
    description: 'Record compliance warnings and optional financial penalties',
    department: 'Human Resources',
  },
  'reports:create': {
    label: 'Submit Proposals & Operational Reports',
    description: 'File new project proposals, operational reports, or standard workplace feedback',
    department: 'Human Resources',
  },
  'reports:read_standard': {
    label: 'View Standard Proposals & Reports',
    description: 'Read non-confidential project proposals, status reports, and general complaints',
    department: 'Human Resources',
  },
  'reports:triage': {
    label: 'Review & Update Standard Reports',
    description: 'Respond to general staff complaints and update proposal review statuses',
    department: 'Human Resources',
  },
  'reports:forward': {
    label: 'Escalate Proposals to Senior Leadership',
    description: 'Endorse and forward team project proposals to executive leadership',
    department: 'Human Resources',
  },
  'grievances:submit_confidential': {
    label: 'File Confidential HR Grievance',
    description: 'Submit a private, protected workplace or ethics concern directly to HR/CEO',
    department: 'Human Resources',
  },
  'grievances:read_confidential': {
    label: 'View Confidential HR Grievances',
    description: 'Access restricted whistleblower and confidential employee relation filings',
    department: 'Human Resources',
  },
  'grievances:adjudicate_confidential': {
    label: 'Resolve Confidential HR Grievances',
    description: 'Record mediation notes and resolve confidential employee grievances',
    department: 'Human Resources',
  },
  'announcements:read': {
    label: 'Read Company Announcements',
    description: 'View company-wide leadership updates and sprint schedules',
    department: 'Human Resources',
  },
  'notifications:read_own': {
    label: 'View Personal Notifications',
    description: 'Read and clear personal alerts for tasks, reviews, and payouts',
    department: 'Human Resources',
  },
  'roles:read': {
    label: 'View Roles & Access Policies',
    description: 'Review configured organizational roles and their assigned capabilities',
    department: 'Human Resources',
  },
  'roles:create': {
    label: 'Create Custom Organizational Roles',
    description: 'Define new custom roles and bundle business capabilities together',
    department: 'Human Resources',
  },
  'roles:update': {
    label: 'Modify Role Capabilities',
    description: 'Update role descriptions or add and remove capabilities from roles',
    department: 'Human Resources',
  },
  'roles:delete': {
    label: 'Remove Custom Roles',
    description: 'Delete non-standard custom roles that are no longer needed',
    department: 'Human Resources',
  },
  'permissions:read': {
    label: 'Browse Full Capabilities Catalog',
    description: 'View the complete catalog of system capabilities available for role design',
    department: 'Human Resources',
  },
  'permissions:delegate': {
    label: 'Grant Temporary Access Exceptions',
    description: 'Temporarily grant capabilities you hold to direct reports or colleagues',
    department: 'Human Resources',
  },
  'users:assign_role': {
    label: 'Manage Employee System Access',
    description: 'Assign or revoke organizational roles for any employee in the company',
    department: 'Human Resources',
  },

  // --- ENGINEERING & DELIVERY ---
  'teams:read_own': {
    label: 'View Assigned Squad Details',
    description: 'View members, sprint week, and delivery health for your own team',
    department: 'Engineering & Delivery',
  },
  'teams:read_all': {
    label: 'View All Company Squads',
    description: 'Oversee rosters, velocity, and sprint health across all squads',
    department: 'Engineering & Delivery',
  },
  'teams:create': {
    label: 'Establish New Engineering Squads',
    description: 'Create a new delivery squad and assign its Project Manager seat',
    department: 'Engineering & Delivery',
  },
  'teams:update': {
    label: 'Update Squad Settings & Health',
    description: 'Modify squad focus, velocity targets, and delivery health status',
    department: 'Engineering & Delivery',
  },
  'teams:manage_members': {
    label: 'Manage Squad Membership',
    description: 'Add, transfer, remove, or designate lead engineers across squads',
    department: 'Engineering & Delivery',
  },
  'projects:read_own': {
    label: 'View Assigned Squad Projects',
    description: 'Access specifications, timelines, and links for your squad’s projects',
    department: 'Engineering & Delivery',
  },
  'projects:read_all': {
    label: 'View All Company Projects',
    description: 'Oversee every active project, specification document, and repository',
    department: 'Engineering & Delivery',
  },
  'projects:create': {
    label: 'Launch New Projects',
    description: 'Create new software initiatives and assign them to delivery squads',
    department: 'Engineering & Delivery',
  },
  'projects:update': {
    label: 'Update Project Details & Specs',
    description: 'Edit project progress, deadlines, health indicators, and specification links',
    department: 'Engineering & Delivery',
  },
  'projects:assign_team': {
    label: 'Reassign Project Teams',
    description: 'Transfer ownership of a project from one delivery squad to another',
    department: 'Engineering & Delivery',
  },
  'milestones:create': {
    label: 'Create Project Milestones',
    description: 'Define new deliverable milestones and payout checkpoints on projects',
    department: 'Engineering & Delivery',
  },
  'milestones:update': {
    label: 'Update Milestone Progress',
    description: 'Mark project milestones as pending, active, or completed',
    department: 'Engineering & Delivery',
  },
  'tasks:read_own': {
    label: 'View Personal Assigned Tasks',
    description: 'View deliverables assigned directly to you or created by you',
    department: 'Engineering & Delivery',
  },
  'tasks:read_team': {
    label: 'View Squad Task Board',
    description: 'Monitor all sprint tasks and workloads across your assigned squad',
    department: 'Engineering & Delivery',
  },
  'tasks:read_all': {
    label: 'View All Company Tasks',
    description: 'View task boards and delivery progress across every squad',
    department: 'Engineering & Delivery',
  },
  'tasks:create_personal': {
    label: 'Create Personal Tasks',
    description: 'Add self-assigned work items to your own task queue',
    department: 'Engineering & Delivery',
  },
  'tasks:create_assign': {
    label: 'Create & Assign Team Tasks',
    description: 'Create work items and assign deliverables to team members',
    department: 'Engineering & Delivery',
  },
  'tasks:update_status': {
    label: 'Update Task Progress Status',
    description: 'Move tasks across To Do, In Progress, In Review, and Blocked stages',
    department: 'Engineering & Delivery',
  },
  'tasks:approve': {
    label: 'Approve Deliverables & Release Payouts',
    description: 'Sign off on completed work items and trigger milestone payouts',
    department: 'Engineering & Delivery',
  },
  'tasks:reject': {
    label: 'Request Deliverable Revisions',
    description: 'Return submitted work to In Progress with mandatory review feedback',
    department: 'Engineering & Delivery',
  },
  'tasks:reassign': {
    label: 'Reassign Tasks Between Staff',
    description: 'Rebalance workloads by shifting tasks from one engineer to another',
    department: 'Engineering & Delivery',
  },
  'tasks:toggle_checklist': {
    label: 'Update Task Checklists',
    description: 'Check off subtask acceptance criteria on active deliverables',
    department: 'Engineering & Delivery',
  },
  'tasks:submit_work': {
    label: 'Submit Deliverable Links & Notes',
    description: 'Attach code review links, live previews, and release notes for review',
    department: 'Engineering & Delivery',
  },
  'tasks:comment': {
    label: 'Comment on Deliverables',
    description: 'Collaborate with team members and reviewers inside task threads',
    department: 'Engineering & Delivery',
  },
  'quality_gates:read': {
    label: 'View Code Quality & Compliance',
    description: 'Inspect automated code quality gates, test coverage, and technical debt',
    department: 'Engineering & Delivery',
  },
  'security_alerts:read': {
    label: 'View Security Vulnerability Alerts',
    description: 'Monitor open security advisories and vulnerability backlogs across projects',
    department: 'Engineering & Delivery',
  },
  'security_alerts:create': {
    label: 'Log Security Vulnerability Alerts',
    description: 'Flag new security findings or compliance risks against active projects',
    department: 'Engineering & Delivery',
  },
  'security_alerts:update_status': {
    label: 'Manage Security Remediation Status',
    description: 'Update investigation and patch resolution status on security alerts',
    department: 'Engineering & Delivery',
  },
  'test_runs:read': {
    label: 'View Automated Test Results',
    description: 'Review pass/fail rates, duration, and coverage from automated test suites',
    department: 'Engineering & Delivery',
  },
  'consultancy:read': {
    label: 'View Technical Advisory Requests',
    description: 'Browse internal and client technical consultancy requests',
    department: 'Engineering & Delivery',
  },
  'consultancy:create': {
    label: 'Request Technical Advisory',
    description: 'Submit requests for specialist architecture or security guidance',
    department: 'Engineering & Delivery',
  },
  'consultancy:manage': {
    label: 'Manage Advisory Engagements',
    description: 'Assign technical advisors, set schedules, and approve consultancy fees',
    department: 'Engineering & Delivery',
  },

  // --- EXECUTIVE GOVERNANCE ---
  'directives:read': {
    label: 'View Executive Directives',
    description: 'Read strategic top-down mandates issued by senior leadership',
    department: 'Executive Governance',
  },
  'directives:dispatch': {
    label: 'Issue Executive Directives',
    description: 'Dispatch company-wide strategic mandates to department heads and PMs',
    department: 'Executive Governance',
  },
  'decisions:read': {
    label: 'View Ratified Leadership Decisions',
    description: 'Review formal authorizations and strategic decisions logged by the CEO',
    department: 'Executive Governance',
  },
  'decisions:ratify': {
    label: 'Ratify Executive Decisions',
    description: 'Formally authorize high-impact corporate and capital decisions',
    department: 'Executive Governance',
  },
  'audit_logs:read': {
    label: 'View Corporate Audit Trail',
    description: 'Inspect and export system-wide activity logs for compliance oversight',
    department: 'Executive Governance',
  },
  'audit_logs:read_confidential': {
    label: 'View Confidential HR Audit Trail',
    description: 'Access sensitive audit entries related to confidential grievance handling',
    department: 'Executive Governance',
  },
}

export function getPermissionDisplay(
  code: string,
  fallbackDescription?: string,
): PermissionDisplayMeta {
  const mapped = PERMISSION_DICTIONARY[code]
  if (mapped) return mapped

  // Graceful fallback if a new backend permission is added before updating the UI dictionary
  const [resource = '', action = ''] = code.split(':')
  const toTitle = (s: string) =>
    s
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  let department: CorporateDepartment = 'Engineering & Delivery'
  if (
    ['treasury', 'wallets', 'transactions', 'budgets', 'finance', 'revenue_share'].includes(
      resource,
    )
  ) {
    department = 'Financial Operations'
  } else if (
    [
      'employees',
      'positions',
      'performance',
      'reports',
      'grievances',
      'roles',
      'permissions',
      'users',
      'announcements',
      'notifications',
    ].includes(resource)
  ) {
    department = 'Human Resources'
  } else if (['directives', 'decisions', 'audit_logs'].includes(resource)) {
    department = 'Executive Governance'
  }

  return {
    label: `${toTitle(action)} ${toTitle(resource)}`.trim() || code,
    description: fallbackDescription || 'Manage this capability within the organization.',
    department,
  }
}
