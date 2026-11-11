import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

export interface SeedPermissionDef {
  code: string
  resource: string
  action: string
  module: string
  description: string
  isSensitive?: boolean
}

export const ERP_PERMISSIONS: SeedPermissionDef[] = [
  // Module 1: Employees & Directory (5)
  {
    code: 'employees:read_directory',
    resource: 'employees',
    action: 'read_directory',
    module: 'employees',
    description: 'View basic staff roster (name, title, status, skills, team)',
  },
  {
    code: 'employees:create',
    resource: 'employees',
    action: 'create',
    module: 'employees',
    description: 'Onboard and provision new employee accounts with initial role and squad',
    isSensitive: true,
  },
  {
    code: 'employees:update_own_profile',
    resource: 'employees',
    action: 'update_own_profile',
    module: 'employees',
    description: 'Edit own employee profile, skills, bio, avatar, and status',
  },
  {
    code: 'employees:update_any',
    resource: 'employees',
    action: 'update_any',
    module: 'employees',
    description: 'Edit any employee profile, title, or status',
    isSensitive: true,
  },
  {
    code: 'employees:suspend',
    resource: 'employees',
    action: 'suspend',
    module: 'employees',
    description: 'Suspend, reactivate, and reset access levels for employee accounts',
    isSensitive: true,
  },

  // Module 2: Organizational Positions (2)
  {
    code: 'positions:read',
    resource: 'positions',
    action: 'read',
    module: 'positions',
    description: 'View organizational seats and assignment history',
  },
  {
    code: 'positions:assign',
    resource: 'positions',
    action: 'assign',
    module: 'positions',
    description: 'Assign an employee to an organizational position seat',
    isSensitive: true,
  },

  // Module 3: Teams & Squads (5)
  {
    code: 'teams:read_own',
    resource: 'teams',
    action: 'read_own',
    module: 'teams',
    description: 'View own squad roster, sprint velocity, and health',
  },
  {
    code: 'teams:read_all',
    resource: 'teams',
    action: 'read_all',
    module: 'teams',
    description: 'View all engineering squads across the company',
  },
  {
    code: 'teams:create',
    resource: 'teams',
    action: 'create',
    module: 'teams',
    description: 'Create a new squad bound to a PM position',
  },
  {
    code: 'teams:update',
    resource: 'teams',
    action: 'update',
    module: 'teams',
    description: 'Update squad metadata, health, velocity, or PM position',
  },
  {
    code: 'teams:manage_members',
    resource: 'teams',
    action: 'manage_members',
    module: 'teams',
    description: 'Add, reassign, promote lead developer, or remove squad members',
  },

  // Module 4: Projects & Milestones (7)
  {
    code: 'projects:read_own',
    resource: 'projects',
    action: 'read_own',
    module: 'projects',
    description: 'View projects assigned to own squad',
  },
  {
    code: 'projects:read_all',
    resource: 'projects',
    action: 'read_all',
    module: 'projects',
    description: 'View all company projects, SRS documents, and repo links',
  },
  {
    code: 'projects:create',
    resource: 'projects',
    action: 'create',
    module: 'projects',
    description: 'Create a new project and bind an initial squad',
  },
  {
    code: 'projects:update',
    resource: 'projects',
    action: 'update',
    module: 'projects',
    description: 'Update project metadata, status, health, progress, and URLs',
  },
  {
    code: 'projects:assign_team',
    resource: 'projects',
    action: 'assign_team',
    module: 'projects',
    description: 'Reassign a project to a different engineering squad',
  },
  {
    code: 'milestones:create',
    resource: 'milestones',
    action: 'create',
    module: 'projects',
    description: 'Create a deliverable milestone on a project',
  },
  {
    code: 'milestones:update',
    resource: 'milestones',
    action: 'update',
    module: 'projects',
    description: 'Update project milestone status',
  },

  // Module 5: Tasks, Checklists & Submissions (12)
  {
    code: 'tasks:read_own',
    resource: 'tasks',
    action: 'read_own',
    module: 'tasks',
    description: 'View tasks assigned to or created by self',
  },
  {
    code: 'tasks:read_team',
    resource: 'tasks',
    action: 'read_team',
    module: 'tasks',
    description: 'View all tasks belonging to own squad/projects',
  },
  {
    code: 'tasks:read_all',
    resource: 'tasks',
    action: 'read_all',
    module: 'tasks',
    description: 'View all tasks across all squads company-wide',
  },
  {
    code: 'tasks:create_personal',
    resource: 'tasks',
    action: 'create_personal',
    module: 'tasks',
    description: 'Create a self-assigned task',
  },
  {
    code: 'tasks:create_assign',
    resource: 'tasks',
    action: 'create_assign',
    module: 'tasks',
    description: 'Create and assign tasks to other employees',
  },
  {
    code: 'tasks:update_status',
    resource: 'tasks',
    action: 'update_status',
    module: 'tasks',
    description: 'Move tasks between todo, in_progress, in_review, and blocked',
  },
  {
    code: 'tasks:approve',
    resource: 'tasks',
    action: 'approve',
    module: 'tasks',
    description: 'Approve deliverable, mark completed, and trigger milestone payout',
    isSensitive: true,
  },
  {
    code: 'tasks:reject',
    resource: 'tasks',
    action: 'reject',
    module: 'tasks',
    description: 'Reject task deliverable back to in_progress with feedback',
  },
  {
    code: 'tasks:reassign',
    resource: 'tasks',
    action: 'reassign',
    module: 'tasks',
    description: 'Reassign an existing task to another developer',
  },
  {
    code: 'tasks:toggle_checklist',
    resource: 'tasks',
    action: 'toggle_checklist',
    module: 'tasks',
    description: 'Toggle checklist items on accessible tasks',
  },
  {
    code: 'tasks:submit_work',
    resource: 'tasks',
    action: 'submit_work',
    module: 'tasks',
    description: 'Submit PR link, demo URL, and deliverable notes',
  },
  {
    code: 'tasks:comment',
    resource: 'tasks',
    action: 'comment',
    module: 'tasks',
    description: 'Post comments on accessible tasks',
  },

  // Module 6: Finance, Treasury, Budgets & Wallets (13)
  {
    code: 'treasury:read',
    resource: 'treasury',
    action: 'read',
    module: 'finance',
    description: 'View corporate treasury capital, reserves, and revenue',
    isSensitive: true,
  },
  {
    code: 'wallets:read_own',
    resource: 'wallets',
    action: 'read_own',
    module: 'finance',
    description: 'View own wallet balance, escrow, bonuses, and penalties',
  },
  {
    code: 'wallets:read_all',
    resource: 'wallets',
    action: 'read_all',
    module: 'finance',
    description: 'View employee wallets across the company',
    isSensitive: true,
  },
  {
    code: 'transactions:read_own',
    resource: 'transactions',
    action: 'read_own',
    module: 'finance',
    description: 'View own financial transaction history',
  },
  {
    code: 'transactions:read_all',
    resource: 'transactions',
    action: 'read_all',
    module: 'finance',
    description: 'View and export company-wide financial transaction ledger',
    isSensitive: true,
  },
  {
    code: 'budgets:read_requests',
    resource: 'budgets',
    action: 'read_requests',
    module: 'finance',
    description: 'View PM project budget increase requests',
  },
  {
    code: 'budgets:allocate_developer',
    resource: 'budgets',
    action: 'allocate_developer',
    module: 'finance',
    description: 'Disburse project budget funds into a developer wallet',
    isSensitive: true,
  },
  {
    code: 'budgets:allocate_project',
    resource: 'budgets',
    action: 'allocate_project',
    module: 'finance',
    description: 'Adjust approved project budget pool from treasury reserves',
    isSensitive: true,
  },
  {
    code: 'budgets:request_increase',
    resource: 'budgets',
    action: 'request_increase',
    module: 'finance',
    description: 'Request a project budget increase from CFO',
  },
  {
    code: 'budgets:approve_request',
    resource: 'budgets',
    action: 'approve_request',
    module: 'finance',
    description: 'Approve pending budget increase request from reserves',
    isSensitive: true,
  },
  {
    code: 'budgets:reject_request',
    resource: 'budgets',
    action: 'reject_request',
    module: 'finance',
    description: 'Reject pending budget increase request with feedback',
  },
  {
    code: 'finance:issue_adjustment',
    resource: 'finance',
    action: 'issue_adjustment',
    module: 'finance',
    description: 'Issue discretionary bonus or penalty deduction to an employee wallet',
    isSensitive: true,
  },
  {
    code: 'revenue_share:process',
    resource: 'revenue_share',
    action: 'process',
    module: 'finance',
    description: 'Process commercial client revenue sharing payouts',
    isSensitive: true,
  },

  // Module 7: HR & Performance Management (6)
  {
    code: 'performance:read_own',
    resource: 'performance',
    action: 'read_own',
    module: 'performance',
    description: 'View own performance metrics, rewards, and evaluation notes',
  },
  {
    code: 'performance:read_team',
    resource: 'performance',
    action: 'read_team',
    module: 'performance',
    description: 'View performance metrics of squad developers',
  },
  {
    code: 'performance:read_all',
    resource: 'performance',
    action: 'read_all',
    module: 'performance',
    description: 'View company-wide staff performance roster and notes',
    isSensitive: true,
  },
  {
    code: 'performance:evaluate',
    resource: 'performance',
    action: 'evaluate',
    module: 'performance',
    description: 'Record or update formal employee performance evaluations',
    isSensitive: true,
  },
  {
    code: 'performance:recognize',
    resource: 'performance',
    action: 'recognize',
    module: 'performance',
    description: 'Issue formal recognition citations and optional bonus',
    isSensitive: true,
  },
  {
    code: 'performance:discipline',
    resource: 'performance',
    action: 'discipline',
    module: 'performance',
    description: 'Issue formal disciplinary actions and optional penalty',
    isSensitive: true,
  },

  // Module 8: Reports, Proposals & Confidential Grievances (7)
  {
    code: 'reports:create',
    resource: 'reports',
    action: 'create',
    module: 'reports',
    description: 'Submit project ideas, general complaints, or management reports',
  },
  {
    code: 'reports:read_standard',
    resource: 'reports',
    action: 'read_standard',
    module: 'reports',
    description: 'View non-confidential reports, proposals, and complaints',
  },
  {
    code: 'reports:triage',
    resource: 'reports',
    action: 'triage',
    module: 'reports',
    description: 'Update standard report status and record review feedback',
  },
  {
    code: 'reports:forward',
    resource: 'reports',
    action: 'forward',
    module: 'reports',
    description: 'Endorse and forward developer proposals to C-Level',
  },
  {
    code: 'grievances:submit_confidential',
    resource: 'grievances',
    action: 'submit_confidential',
    module: 'reports',
    description: 'Submit a privileged confidential whistleblower grievance',
  },
  {
    code: 'grievances:read_confidential',
    resource: 'grievances',
    action: 'read_confidential',
    module: 'reports',
    description: 'Read privileged confidential grievances',
    isSensitive: true,
  },
  {
    code: 'grievances:adjudicate_confidential',
    resource: 'grievances',
    action: 'adjudicate_confidential',
    module: 'reports',
    description: 'Adjudicate confidential grievances with mediation notes',
    isSensitive: true,
  },

  // Module 9: Engineering Quality, Security & Testing (5)
  {
    code: 'quality_gates:read',
    resource: 'quality_gates',
    action: 'read',
    module: 'engineering',
    description: 'View code quality gates, coverage, and technical debt metrics',
  },
  {
    code: 'security_alerts:read',
    resource: 'security_alerts',
    action: 'read',
    module: 'engineering',
    description: 'View active security vulnerabilities and CVE alerts',
  },
  {
    code: 'security_alerts:create',
    resource: 'security_alerts',
    action: 'create',
    module: 'engineering',
    description: 'Log a new security vulnerability alert for a project',
  },
  {
    code: 'security_alerts:update_status',
    resource: 'security_alerts',
    action: 'update_status',
    module: 'engineering',
    description: 'Update security alert triage and remediation status',
  },
  {
    code: 'test_runs:read',
    resource: 'test_runs',
    action: 'read',
    module: 'engineering',
    description: 'View automated test suite execution results',
  },

  // Module 10: Technical Consultancy (3)
  {
    code: 'consultancy:read',
    resource: 'consultancy',
    action: 'read',
    module: 'consultancy',
    description: 'View technical advisory and consultancy requests',
  },
  {
    code: 'consultancy:create',
    resource: 'consultancy',
    action: 'create',
    module: 'consultancy',
    description: 'Submit an architectural or technical consultancy request',
  },
  {
    code: 'consultancy:manage',
    resource: 'consultancy',
    action: 'manage',
    module: 'consultancy',
    description: 'Assign consultant, set fee/target date, and update consultancy status',
  },

  // Module 11: Executive Governance (4)
  {
    code: 'directives:read',
    resource: 'directives',
    action: 'read',
    module: 'governance',
    description: 'View strategic executive directives',
  },
  {
    code: 'directives:dispatch',
    resource: 'directives',
    action: 'dispatch',
    module: 'governance',
    description: 'Dispatch top-down strategic executive directives',
    isSensitive: true,
  },
  {
    code: 'decisions:read',
    resource: 'decisions',
    action: 'read',
    module: 'governance',
    description: 'View ratified executive decisions',
  },
  {
    code: 'decisions:ratify',
    resource: 'decisions',
    action: 'ratify',
    module: 'governance',
    description: 'Formally ratify actions in the CEO decision queue',
    isSensitive: true,
  },

  // Module 12: Corporate Audit Stream (2)
  {
    code: 'audit_logs:read',
    resource: 'audit_logs',
    action: 'read',
    module: 'audit_logs',
    description: 'View and export standard corporate audit logs',
    isSensitive: true,
  },
  {
    code: 'audit_logs:read_confidential',
    resource: 'audit_logs',
    action: 'read_confidential',
    module: 'audit_logs',
    description: 'View audit entries related to confidential HR grievances',
    isSensitive: true,
  },

  // Module 13: Communications (2)
  {
    code: 'announcements:read',
    resource: 'announcements',
    action: 'read',
    module: 'communications',
    description: 'View company and squad announcements',
  },
  {
    code: 'notifications:read_own',
    resource: 'notifications',
    action: 'read_own',
    module: 'communications',
    description: 'View and mark own notifications as read',
  },

  // Module 14: Dynamic RBAC Administration (7)
  {
    code: 'roles:read',
    resource: 'roles',
    action: 'read',
    module: 'rbac_admin',
    description: 'View dynamic roles and attached permissions',
  },
  {
    code: 'roles:create',
    resource: 'roles',
    action: 'create',
    module: 'rbac_admin',
    description: 'Create new dynamic roles without code deployment',
    isSensitive: true,
  },
  {
    code: 'roles:update',
    resource: 'roles',
    action: 'update',
    module: 'rbac_admin',
    description: 'Edit role metadata and attach/detach permissions',
    isSensitive: true,
  },
  {
    code: 'roles:delete',
    resource: 'roles',
    action: 'delete',
    module: 'rbac_admin',
    description: 'Delete non-system custom roles',
    isSensitive: true,
  },
  {
    code: 'permissions:read',
    resource: 'permissions',
    action: 'read',
    module: 'rbac_admin',
    description: 'Fetch full catalog of registered ERP permissions',
  },
  {
    code: 'permissions:delegate',
    resource: 'permissions',
    action: 'delegate',
    module: 'rbac_admin',
    description: 'Delegate permissions held by self directly to another employee',
    isSensitive: true,
  },
  {
    code: 'users:assign_role',
    resource: 'users',
    action: 'assign_role',
    module: 'rbac_admin',
    description: 'Assign or revoke dynamic roles for any employee',
    isSensitive: true,
  },
]

const ALL_PERMISSION_CODES = ERP_PERMISSIONS.map((p) => p.code)

const ROLE_DEFINITIONS: Array<{
  slug: string
  name: string
  description: string
  isSystemDefault: boolean
  permissions: string[]
}> = [
  {
    slug: 'developer',
    name: 'Developer',
    description:
      'Full-Stack Software Engineer — executes sprint tasks, submits PRs/demos, tracks personal wallet & reports.',
    isSystemDefault: true,
    permissions: [
      'employees:read_directory',
      'employees:update_own_profile',
      'teams:read_own',
      'projects:read_own',
      'tasks:read_own',
      'tasks:create_personal',
      'tasks:update_status',
      'tasks:toggle_checklist',
      'tasks:submit_work',
      'tasks:comment',
      'wallets:read_own',
      'transactions:read_own',
      'performance:read_own',
      'reports:create',
      'reports:read_standard',
      'grievances:submit_confidential',
      'consultancy:read',
      'consultancy:create',
      'announcements:read',
      'notifications:read_own',
    ],
  },
  {
    slug: 'pm',
    name: 'Project Manager',
    description:
      'Agile Squad Delivery Lead — manages squad backlog, approves/rejects deliverables, allocates project dev budgets.',
    isSystemDefault: true,
    permissions: [
      'employees:read_directory',
      'employees:update_own_profile',
      'teams:read_own',
      'projects:read_own',
      'projects:update',
      'milestones:create',
      'milestones:update',
      'tasks:read_own',
      'tasks:read_team',
      'tasks:create_personal',
      'tasks:create_assign',
      'tasks:update_status',
      'tasks:approve',
      'tasks:reject',
      'tasks:reassign',
      'tasks:toggle_checklist',
      'tasks:submit_work',
      'tasks:comment',
      'wallets:read_own',
      'transactions:read_own',
      'budgets:read_requests',
      'budgets:allocate_developer',
      'budgets:request_increase',
      'performance:read_own',
      'performance:read_team',
      'reports:create',
      'reports:read_standard',
      'reports:triage',
      'reports:forward',
      'grievances:submit_confidential',
      'security_alerts:read',
      'security_alerts:create',
      'security_alerts:update_status',
      'test_runs:read',
      'consultancy:read',
      'consultancy:create',
      'announcements:read',
      'notifications:read_own',
      'permissions:delegate',
    ],
  },
  {
    slug: 'cto',
    name: 'Chief Technology Officer',
    description:
      'Engineering Command — oversees squads, projects, quality gates, security alerts, consultancy, and engineering audit logs.',
    isSystemDefault: true,
    permissions: [
      'employees:read_directory',
      'employees:update_own_profile',
      'employees:update_any',
      'positions:read',
      'positions:assign',
      'teams:read_own',
      'teams:read_all',
      'teams:create',
      'teams:update',
      'teams:manage_members',
      'projects:read_own',
      'projects:read_all',
      'projects:create',
      'projects:update',
      'projects:assign_team',
      'milestones:create',
      'milestones:update',
      'tasks:read_own',
      'tasks:read_all',
      'tasks:create_personal',
      'tasks:create_assign',
      'tasks:update_status',
      'tasks:approve',
      'tasks:reject',
      'tasks:reassign',
      'tasks:toggle_checklist',
      'tasks:submit_work',
      'tasks:comment',
      'wallets:read_own',
      'transactions:read_own',
      'budgets:allocate_developer',
      'budgets:request_increase',
      'performance:read_own',
      'reports:create',
      'reports:read_standard',
      'reports:triage',
      'reports:forward',
      'grievances:submit_confidential',
      'quality_gates:read',
      'security_alerts:read',
      'security_alerts:create',
      'security_alerts:update_status',
      'test_runs:read',
      'consultancy:read',
      'consultancy:create',
      'consultancy:manage',
      'directives:read',
      'directives:dispatch',
      'decisions:read',
      'audit_logs:read',
      'announcements:read',
      'notifications:read_own',
      'permissions:delegate',
    ],
  },
  {
    slug: 'cfo',
    name: 'Chief Financial Officer',
    description:
      'Financial Desk — governs treasury reserves, project budgets, budget requests, financial adjustments, and ledger audits.',
    isSystemDefault: true,
    permissions: [
      'employees:read_directory',
      'employees:update_own_profile',
      'positions:read',
      'teams:read_all',
      'projects:read_all',
      'tasks:read_own',
      'tasks:read_all',
      'tasks:create_personal',
      'tasks:update_status',
      'tasks:comment',
      'treasury:read',
      'wallets:read_own',
      'wallets:read_all',
      'transactions:read_own',
      'transactions:read_all',
      'budgets:read_requests',
      'budgets:allocate_project',
      'budgets:approve_request',
      'budgets:reject_request',
      'finance:issue_adjustment',
      'revenue_share:process',
      'performance:read_own',
      'reports:create',
      'reports:read_standard',
      'reports:triage',
      'grievances:submit_confidential',
      'directives:read',
      'decisions:read',
      'audit_logs:read',
      'announcements:read',
      'notifications:read_own',
      'permissions:delegate',
    ],
  },
  {
    slug: 'chro',
    name: 'Chief Human Resources Officer',
    description:
      'People & Culture Hub — directs performance evaluations, recognition, disciplinary actions, and confidential grievances.',
    isSystemDefault: true,
    permissions: [
      'employees:read_directory',
      'employees:create',
      'employees:update_own_profile',
      'employees:update_any',
      'employees:suspend',
      'positions:read',
      'positions:assign',
      'teams:read_all',
      'projects:read_all',
      'tasks:read_own',
      'tasks:read_all',
      'tasks:create_personal',
      'tasks:update_status',
      'tasks:comment',
      'wallets:read_own',
      'transactions:read_own',
      'finance:issue_adjustment',
      'performance:read_own',
      'performance:read_all',
      'performance:evaluate',
      'performance:recognize',
      'performance:discipline',
      'reports:create',
      'reports:read_standard',
      'reports:triage',
      'grievances:submit_confidential',
      'grievances:read_confidential',
      'grievances:adjudicate_confidential',
      'directives:read',
      'decisions:read',
      'audit_logs:read',
      'audit_logs:read_confidential',
      'announcements:read',
      'notifications:read_own',
      'permissions:delegate',
    ],
  },
  {
    slug: 'ceo',
    name: 'Chief Executive Officer',
    description:
      'Executive Suite — full strategic, operational, financial, HR, and dynamic RBAC administration privileges.',
    isSystemDefault: true,
    permissions: ALL_PERMISSION_CODES,
  },
]

export async function seedRbac(prisma: PrismaClient) {
  console.log(`  -> Seeding PBAC Permissions (${ERP_PERMISSIONS.length} granular permissions)...`)
  const permissionIdByCode = new Map<string, string>()

  for (const perm of ERP_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        resource: perm.resource,
        action: perm.action,
        module: perm.module,
        description: perm.description,
        isSensitive: Boolean(perm.isSensitive),
      },
      create: {
        code: perm.code,
        resource: perm.resource,
        action: perm.action,
        module: perm.module,
        description: perm.description,
        isSensitive: Boolean(perm.isSensitive),
      },
    })
    permissionIdByCode.set(record.code, record.id)
  }

  console.log('  -> Seeding Default System Roles & Role-Permission Mappings...')
  const roleIdBySlug = new Map<string, string>()

  for (const roleDef of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { slug: roleDef.slug },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isSystemDefault: roleDef.isSystemDefault,
        isActive: true,
      },
      create: {
        slug: roleDef.slug,
        name: roleDef.name,
        description: roleDef.description,
        isSystemDefault: roleDef.isSystemDefault,
        isActive: true,
      },
    })
    roleIdBySlug.set(role.slug, role.id)

    const rows = roleDef.permissions
      .map((code) => permissionIdByCode.get(code))
      .filter((permId): permId is string => Boolean(permId))
      .map((permissionId) => ({
        roleId: role.id,
        permissionId,
        grantedById: 'emp_ceo_01',
      }))

    await prisma.rolePermission.createMany({
      data: rows,
      skipDuplicates: true,
    })
  }

  console.log('  -> Backfilling EmployeeRole Assignments from Active PositionAssignments...')
  const employees = await prisma.employee.findMany({
    include: {
      positionAssignments: {
        where: { isActive: true },
        include: { position: true },
      },
    },
  })

  const backfillRows: Array<{
    employeeId: string
    roleId: string
    assignedById: string
    isActive: boolean
  }> = []

  for (const emp of employees) {
    const categories = emp.positionAssignments.map((pa) => pa.position.roleCategory.toLowerCase())
    const targetSlugs = categories.length > 0 ? Array.from(new Set(categories)) : ['developer']

    for (const slug of targetSlugs) {
      const roleId = roleIdBySlug.get(slug) || roleIdBySlug.get('developer')
      if (roleId) {
        backfillRows.push({
          employeeId: emp.id,
          roleId,
          assignedById: 'emp_ceo_01',
          isActive: true,
        })
      }
    }
  }

  if (backfillRows.length > 0) {
    await prisma.employeeRole.createMany({
      data: backfillRows,
      skipDuplicates: true,
    })
  }

  console.log('  -> Seeding default bcrypt password hashes for uninitialized accounts...')
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD
  if (!defaultPassword || defaultPassword.trim().length < 8) {
    throw new Error(
      'SEED_DEFAULT_PASSWORD must be configured in environment variables (min 8 chars) before running seed.',
    )
  }
  const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10)
  const passwordResult = await prisma.employee.updateMany({
    where: { passwordHash: '' },
    data: { passwordHash: defaultPasswordHash },
  })

  console.log(
    `  ✅ PBAC seed complete: ${permissionIdByCode.size} permissions, ${roleIdBySlug.size} roles, ${backfillRows.length} employee-role links verified, ${passwordResult.count} accounts initialized with password hash.`,
  )
}
