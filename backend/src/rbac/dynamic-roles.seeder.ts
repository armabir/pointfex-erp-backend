import { AuthorizationScope, PrismaClient } from '@prisma/client'

export interface SeedRoleTemplateDef {
  code: string
  name: string
  description: string
  defaultScope: AuthorizationScope
  wildcards: string[]
  permissionCodes: string[]
  includeCritical: boolean
  restrictedNotes: string
}

/**
 * Section C ("Default authority map") seed templates from docs/permissions_master.md.
 * These are runtime editable templates, never hardcoded role checks in the engine.
 */
export const DEFAULT_ROLE_TEMPLATES: SeedRoleTemplateDef[] = [
  {
    code: 'CEO',
    name: 'Chief Executive Officer',
    description: 'Supreme authority across all modules via system:root.',
    defaultScope: 'GLOBAL',
    wildcards: [],
    permissionCodes: ['system:root'],
    includeCritical: true,
    restrictedNotes: 'Cannot be removed or edited; changes only via governance:transfer_ceo',
  },
  {
    code: 'COO',
    name: 'Chief Operating Officer',
    description: 'Operations & organizational leadership across ops domain, portfolio read, and ops approvals.',
    defaultScope: 'ORG',
    wildcards: ['ops:*'],
    permissionCodes: ['portfolio:read', 'purchase_orders:approve', 'vendors:approve', 'budgets:approve_request'],
    includeCritical: false,
    restrictedNotes: 'Finance execution, HR confidential',
  },
  {
    code: 'CTO',
    name: 'Chief Technology Officer',
    description: 'Engineering command across engineering domain and infra cost visibility.',
    defaultScope: 'ORG',
    wildcards: ['engineering:*'],
    permissionCodes: ['infra_cost:read'],
    includeCritical: false,
    restrictedNotes: 'Payroll, treasury, grievances',
  },
  {
    code: 'CFO',
    name: 'Chief Financial Officer',
    description: 'Finance command across finance domain plus payroll calculate and batch approval.',
    defaultScope: 'ORG',
    wildcards: ['finance:*'],
    permissionCodes: ['payroll:calculate', 'payroll:approve_batch'],
    includeCritical: false,
    restrictedNotes: 'Deployments, grievances',
  },
  {
    code: 'CHRO',
    name: 'Chief Human Resources Officer',
    description: 'People & culture command across HR domain including discipline and grievances.',
    defaultScope: 'ORG',
    wildcards: ['hr:*'],
    permissionCodes: [
      'performance:discipline',
      'grievances:read_confidential',
      'grievances:adjudicate_confidential',
      'audit_logs:read_confidential',
    ],
    includeCritical: false,
    restrictedNotes: 'Treasury transfer, secrets',
  },
  {
    code: 'CPO',
    name: 'Chief Product Officer',
    description: 'Product strategy, roadmaps, feedback, and feature lifecycle.',
    defaultScope: 'ORG',
    wildcards: ['product:*'],
    permissionCodes: ['feedback:read', 'feedback:triage', 'roadmaps:manage', 'features:prioritize'],
    includeCritical: false,
    restrictedNotes: 'Finance, HR sensitive',
  },
  {
    code: 'CRO',
    name: 'Chief Revenue Officer',
    description: 'CRM, sales pipeline, invoicing, and pricing governance.',
    defaultScope: 'ORG',
    wildcards: ['sales:*'],
    permissionCodes: ['invoices:create', 'invoices:read', 'pricing:manage'],
    includeCritical: false,
    restrictedNotes: 'Payroll, deployments',
  },
  {
    code: 'PM',
    name: 'Project Manager',
    description: 'Project-scoped delivery lead for projects, sprint tasks, timesheets, and dept budgets.',
    defaultScope: 'PROJECT',
    wildcards: [],
    permissionCodes: [
      'projects:read_own',
      'projects:read_all',
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
      'timesheets:approve',
      'budgets:read_dept',
      'budgets:request_increase',
      'budgets:allocate_developer',
    ],
    includeCritical: false,
    restrictedNotes: 'Treasury, HR sensitive',
  },
  {
    code: 'SQUAD_LEAD',
    name: 'Squad Lead',
    description: 'Squad-scoped technical lead managing squad roster, PR review/merge, tasks, and capped XP awards.',
    defaultScope: 'SQUAD',
    wildcards: [],
    permissionCodes: [
      'teams:read_own',
      'teams:manage_members',
      'tasks:read_own',
      'tasks:read_team',
      'tasks:create_assign',
      'tasks:update_status',
      'tasks:approve',
      'tasks:reject',
      'pull_requests:read',
      'pull_requests:review',
      'pull_requests:approve',
      'xp:award',
    ],
    includeCritical: false,
    restrictedNotes: 'Budget allocation',
  },
  {
    code: 'SENIOR_DEVELOPER',
    name: 'Senior Developer',
    description: 'Senior engineer with PR review, team task collaboration, and deployment visibility.',
    defaultScope: 'SQUAD',
    wildcards: [],
    permissionCodes: [
      'pull_requests:read',
      'pull_requests:create',
      'pull_requests:review',
      'tasks:read_own',
      'tasks:read_team',
      'tasks:create_personal',
      'tasks:update_status',
      'tasks:submit_work',
      'tasks:comment',
      'deployments:read',
    ],
    includeCritical: false,
    restrictedNotes: 'Production secrets',
  },
  {
    code: 'DEVELOPER',
    name: 'Developer',
    description: 'Individual contributor working on assigned tasks, personal wallet, XP, and KPIs.',
    defaultScope: 'SELF',
    wildcards: [],
    permissionCodes: [
      'tasks:read_own',
      'tasks:submit_work',
      'tasks:update_status',
      'tasks:comment',
      'timesheets:create',
      'wallets:read_own',
      'xp:read_own',
      'kpis:read_own',
    ],
    includeCritical: false,
    restrictedNotes: 'Anything outside SELF / ASSIGNED',
  },
  {
    code: 'QA_OFFICER',
    name: 'QA Officer',
    description: 'Narrow slice of module 14 (QA & Security) with zero critical permissions.',
    defaultScope: 'PROJECT',
    wildcards: [],
    permissionCodes: [
      'qa:test_plans:read',
      'qa:test_plans:create',
      'qa:test_cases:create',
      'qa:test_cases:execute',
      'qa:bugs:create',
      'qa:bugs:manage',
      'test_runs:read',
      'test_runs:trigger',
    ],
    includeCritical: false,
    restrictedNotes: 'All ⚠',
  },
  {
    code: 'DEVOPS_OFFICER',
    name: 'DevOps Officer',
    description: 'Narrow slice of module 13 (DevOps & CI/CD) without critical production secret mutations.',
    defaultScope: 'ORG',
    wildcards: [],
    permissionCodes: [
      'ci_cd:read',
      'ci_cd:trigger',
      'deployments:read',
      'environments:read',
      'monitoring:read',
      'alerts:read',
    ],
    includeCritical: false,
    restrictedNotes: 'All ⚠',
  },
  {
    code: 'FINANCE_OFFICER',
    name: 'Finance Officer',
    description: 'Operational accounting tasks from module 07 without critical bank transfers.',
    defaultScope: 'ORG',
    wildcards: [],
    permissionCodes: [
      'invoices:create',
      'invoices:read',
      'bills:create',
      'bills:read',
      'expenses:read_all',
      'transactions:read_all',
      'budgets:read_requests',
    ],
    includeCritical: false,
    restrictedNotes: 'All ⚠',
  },
  {
    code: 'HR_OFFICER',
    name: 'HR Officer',
    description: 'Operational HR onboarding and leave coordination from modules 04 & 05 without confidential grievances.',
    defaultScope: 'ORG',
    wildcards: [],
    permissionCodes: [
      'employees:read_directory',
      'employees:create',
      'onboarding:manage',
      'attendance:read_all',
      'leaves:read_all',
      'leaves:approve',
    ],
    includeCritical: false,
    restrictedNotes: 'All ⚠',
  },
  {
    code: 'SALES_OFFICER',
    name: 'Sales Officer',
    description: 'Operational CRM pipeline management from module 18 without critical discount/refund overrides.',
    defaultScope: 'ASSIGNED',
    wildcards: [],
    permissionCodes: [
      'leads:create',
      'leads:read',
      'leads:update',
      'deals:create',
      'deals:read',
      'deals:update',
      'clients:read',
      'proposals:create',
    ],
    includeCritical: false,
    restrictedNotes: 'All ⚠',
  },
  {
    code: 'EMPLOYEE_BASELINE',
    name: 'Employee (Baseline)',
    description: 'Baseline self-service permissions granted to every employee across Pointfex.',
    defaultScope: 'SELF',
    wildcards: [],
    permissionCodes: [
      'employees:read_directory',
      'employees:update_own_profile',
      'attendance:check_in',
      'attendance:check_out',
      'leaves:request',
      'expenses:submit',
      'grievances:submit_confidential',
      'notifications:read_own',
      'wiki:read',
      'search:global',
    ],
    includeCritical: false,
    restrictedNotes: 'None',
  },
]

const EXISTING_ROLE_WILDCARD_UPGRADES: Record<
  string,
  { wildcards: string[]; includeCritical: boolean; isRootRole: boolean; templateCode: string }
> = {
  ceo: { wildcards: [], includeCritical: true, isRootRole: true, templateCode: 'CEO' },
  cto: {
    wildcards: ['engineering:*'],
    includeCritical: false,
    isRootRole: false,
    templateCode: 'CTO',
  },
  cfo: {
    wildcards: ['finance:*'],
    includeCritical: false,
    isRootRole: false,
    templateCode: 'CFO',
  },
  chro: { wildcards: ['hr:*'], includeCritical: false, isRootRole: false, templateCode: 'CHRO' },
  pm: { wildcards: [], includeCritical: false, isRootRole: false, templateCode: 'PM' },
  developer: {
    wildcards: [],
    includeCritical: false,
    isRootRole: false,
    templateCode: 'DEVELOPER',
  },
}

function resolveDefaultScopeForRoleSlug(slug: string): AuthorizationScope {
  switch (slug.toLowerCase()) {
    case 'ceo':
      return 'GLOBAL'
    case 'cto':
    case 'cfo':
    case 'chro':
    case 'cpo':
    case 'coo':
    case 'cro':
      return 'ORG'
    case 'pm':
      return 'PROJECT'
    case 'squad_lead':
    case 'senior_developer':
      return 'SQUAD'
    case 'developer':
    default:
      return 'SELF'
  }
}

export async function seedDynamicRolesAndMigration(
  prisma: PrismaClient,
  ceoEmployeeId = 'emp_ceo_01',
) {
  // 1. Seed Section C RoleTemplates idempotently
  for (const tpl of DEFAULT_ROLE_TEMPLATES) {
    await prisma.roleTemplate.upsert({
      where: { code: tpl.code },
      update: {
        name: tpl.name,
        description: tpl.description,
        defaultScope: tpl.defaultScope,
        wildcards: tpl.wildcards,
        permissionCodes: tpl.permissionCodes,
        includeCritical: tpl.includeCritical,
        restrictedNotes: tpl.restrictedNotes,
        isSystemManaged: true,
      },
      create: {
        code: tpl.code,
        name: tpl.name,
        description: tpl.description,
        defaultScope: tpl.defaultScope,
        wildcards: tpl.wildcards,
        permissionCodes: tpl.permissionCodes,
        includeCritical: tpl.includeCritical,
        restrictedNotes: tpl.restrictedNotes,
        isSystemManaged: true,
      },
    })
  }

  // 2. Ensure CEO holds system:root and existing roles get domain wildcard + template metadata without losing RolePermissions
  const rootPerm = await prisma.permission.findUnique({ where: { code: 'system:root' } })
  const allRoles = await prisma.role.findMany({
    include: {
      rolePermissions: { include: { permission: { select: { code: true } } } },
      versions: { select: { version: true } },
    },
  })

  for (const role of allRoles) {
    const upgrade = EXISTING_ROLE_WILDCARD_UPGRADES[role.slug]
    if (upgrade) {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          wildcards: upgrade.wildcards,
          includeCritical: upgrade.includeCritical,
          isRootRole: upgrade.isRootRole,
          templateCode: upgrade.templateCode,
        },
      })
    }

    if (role.slug === 'ceo' && rootPerm) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: rootPerm.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: rootPerm.id,
          grantedById: ceoEmployeeId,
        },
      })
    }

    // Backfill v1 RoleVersion snapshot if role has no versions yet
    if (role.versions.length === 0) {
      const codes = role.rolePermissions.map((rp) => rp.permission.code)
      if (role.slug === 'ceo' && rootPerm && !codes.includes('system:root')) {
        codes.push('system:root')
      }
      await prisma.roleVersion.create({
        data: {
          roleId: role.id,
          version: role.version,
          name: role.name,
          description: role.description,
          wildcards: upgrade?.wildcards ?? role.wildcards ?? [],
          permissionCodes: Array.from(new Set(codes)).sort(),
          includeCritical: upgrade?.includeCritical ?? role.includeCritical,
          isActive: role.isActive,
          changeReason: 'Initial Phase 2 baseline snapshot',
          changedById: ceoEmployeeId,
        },
      })
    }
  }

  // 3. Migrate existing EmployeeRole rows into scoped UserRoleAssignment idempotently (no access lost)
  const existingAssignments = await prisma.userRoleAssignment.findMany({
    select: { employeeId: true, roleId: true, isActive: true },
  })
  const activeKeySet = new Set(
    existingAssignments
      .filter((a) => a.isActive)
      .map((a) => `${a.employeeId}::${a.roleId}`),
  )

  const legacyEmployeeRoles = await prisma.employeeRole.findMany({
    where: { isActive: true },
    include: {
      role: { select: { id: true, slug: true } },
      employee: {
        select: {
          id: true,
          positionAssignments: {
            where: { isActive: true },
            include: {
              position: {
                include: {
                  managedTeam: {
                    include: { teamProjects: { select: { projectId: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  for (const er of legacyEmployeeRoles) {
    const key = `${er.employeeId}::${er.roleId}`
    if (activeKeySet.has(key)) continue

    const scope = resolveDefaultScopeForRoleSlug(er.role.slug)
    let scopeIds: string[] = []
    if (scope === 'PROJECT') {
      scopeIds = Array.from(
        new Set(
          er.employee.positionAssignments.flatMap((pa) =>
            pa.position.managedTeam
              ? pa.position.managedTeam.teamProjects.map((tp) => tp.projectId)
              : [],
          ),
        ),
      )
    }

    await prisma.userRoleAssignment.create({
      data: {
        employeeId: er.employeeId,
        roleId: er.roleId,
        scope,
        scopeIds,
        assignedById: er.assignedById ?? ceoEmployeeId,
        reason: 'Migrated from legacy EmployeeRole assignment',
        startsAt: er.assignedAt,
        expiresAt: er.expiresAt,
        isActive: true,
      },
    })
    activeKeySet.add(key)
  }

  return {
    templatesSeeded: DEFAULT_ROLE_TEMPLATES.length,
    rolesUpgraded: allRoles.length,
    scopedAssignmentsTotal: activeKeySet.size,
  }
}

export async function seedAuthorizationPoliciesAndGovernanceGrants(
  prisma: PrismaClient,
  ceoEmployeeId = 'emp_ceo_01',
) {
  const defaultPolicies: Array<{ key: string; value: unknown; description: string }> = [
    {
      key: 'default_fallback_role_slug',
      value: 'developer',
      description: 'Default role slug used when demoting employees or succession fallback is omitted',
    },
    {
      key: 'max_delegation_days',
      value: 30,
      description: 'Maximum duration in days allowed for temporary permission delegations',
    },
    {
      key: 'allow_redelegation_depth',
      value: 1,
      description: 'Maximum delegation chain depth (default 1 = no re-delegation)',
    },
    {
      key: 'critical_dual_approval_required',
      value: true,
      description: 'Require two distinct approvers for all ⚠ critical permission executions',
    },
    {
      key: 'critical_reauth_required',
      value: true,
      description: 'Require fresh password/step-up confirmation for ⚠ and isSensitive actions',
    },
    {
      key: 'executive_mfa_required',
      value: true,
      description: 'Require enrolled MFA/TOTP verification hook for executive high-risk sessions',
    },
  ]

  for (const pol of defaultPolicies) {
    await prisma.authorizationPolicy.upsert({
      where: { key: pol.key },
      update: { description: pol.description },
      create: {
        key: pol.key,
        value: pol.value as any,
        description: pol.description,
        updatedById: ceoEmployeeId,
      },
    })
  }

  // Ensure GovernanceController, ApprovalsController, DelegationsController, and SecurityControlsController
  // baseline permissions are seeded on core roles so zero existing users lose operational access in enforce mode.
  const baseSelfOperationalPerms = [
    'approvals:read',
    'approvals:create',
    'delegations:read_received',
    'sessions:read',
    'sessions:revoke',
    'mfa:manage',
    'xp:read_own',
  ]

  const roleGrants: Record<string, string[]> = {
    developer: [...baseSelfOperationalPerms],
    pm: [
      ...baseSelfOperationalPerms,
      'approvals:approve',
      'approvals:reject',
      'delegations:read_own',
      'delegations:revoke',
    ],
    cto: [
      ...baseSelfOperationalPerms,
      'approvals:approve',
      'approvals:reject',
      'delegations:read_own',
      'delegations:revoke',
      'governance:read',
      'access_requests:submit',
      'xp:read_all',
    ],
    cfo: [
      ...baseSelfOperationalPerms,
      'approvals:approve',
      'approvals:reject',
      'delegations:read_own',
      'delegations:revoke',
      'governance:read',
      'access_requests:submit',
    ],
    chro: [
      ...baseSelfOperationalPerms,
      'approvals:approve',
      'approvals:reject',
      'delegations:read_own',
      'delegations:revoke',
      'governance:read',
      'access_requests:submit',
      'governance:approve_request',
      'xp:read_all',
    ],
    ceo: [
      ...baseSelfOperationalPerms,
      'approvals:approve',
      'approvals:reject',
      'delegations:read_own',
      'delegations:revoke',
      'governance:read',
      'access_requests:submit',
      'governance:approve_request',
      'xp:read_all',
    ],
  }

  const allGrantedCodes = Array.from(new Set(Object.values(roleGrants).flat()))
  const permRows = await prisma.permission.findMany({
    where: { code: { in: allGrantedCodes } },
    select: { id: true, code: true },
  })
  const permByCode = new Map(permRows.map((p) => [p.code, p.id]))

  for (const [slug, codes] of Object.entries(roleGrants)) {
    const role = await prisma.role.findUnique({ where: { slug } })
    if (!role) continue
    for (const code of codes) {
      const permId = permByCode.get(code)
      if (!permId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId, grantedById: ceoEmployeeId },
      })
    }
  }
}
