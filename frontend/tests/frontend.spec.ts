import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { formatBDT, formatBDTCompact, moneyToneClass } from '../src/utils/money'
import {
  resolveVisibleNavigation,
  resolveVisibleWorkspaces,
  canAccessRoute,
  NAV_GROUPS,
  NAV_REGISTRY,
} from '../src/config/nav-registry'
import {
  resolveVisibleDashboardWidgets,
  DASHBOARD_WIDGETS,
} from '../src/dashboard/widgets'
import {
  buildUnifiedInboxItems,
  filterUnifiedInboxItems,
} from '../src/services/unified-inbox'
import { filterPaletteByPermissions } from '../src/services/palette-items'
import { PERMISSION_PACKS, buildRolePlainSummary } from '../src/config/permission-packs'
import {
  getVisibleSensitiveProfileActions,
  isPermissionMfaRequiredEveryTime,
} from '../src/config/sensitive-actions'
import { AccessDeniedCard } from '../src/pages/security/AccessDeniedPage'
import { parseAllowlistInput } from '../src/utils/allowlist'
import {
  resolveMissingPermissionsForRoute,
  buildAccessRequestPayload,
} from '../src/pages/security/access-request-helpers'

export function runFrontendSuite(): Array<{ name: string; pass: boolean }> {
  const results: Array<{ name: string; pass: boolean }> = []
  const test = (name: string, fn: () => void) => {
    fn()
    results.push({ name, pass: true })
  }

  // 1. BDT money formatting & semantic tone tests
  test('formatBDT uses taka symbol and South Asian 3-2-2 lakh/crore grouping', () => {
    assert.equal(formatBDT(500000), '৳5,00,000')
    assert.equal(formatBDT(12345678), '৳1,23,45,678')
    assert.equal(formatBDT(-12500), '-৳12,500')
    assert.equal(formatBDT(null), '৳0')
    assert.equal(formatBDT(500000.5, true), '৳5,00,000.50')
  })

  test('formatBDTCompact formats thousands, lakhs, and crores cleanly', () => {
    assert.equal(formatBDTCompact(500000), '৳5 lakh')
    assert.equal(formatBDTCompact(12000000), '৳1.2 crore')
    assert.equal(formatBDTCompact(850), '৳850')
  })

  test('moneyToneClass assigns success, danger, and default text tokens semantically', () => {
    assert.match(moneyToneClass(1500), /success/)
    assert.match(moneyToneClass(-200), /danger/)
    assert.match(moneyToneClass(0), /--text/)
  })

  // 2. Navigation visibility & custom role dynamism
  test('minimal user sees Home, My Work & Settings only (empty org groups hidden) and max 8 sidebar groups', () => {
    const resolved = resolveVisibleNavigation([])
    const groupIds = resolved.groups.map((g: { id: string }) => g.id)
    assert.deepEqual(groupIds, ['home', 'my_work', 'settings'])
    assert.equal(canAccessRoute('dashboard', []), true)
    assert.equal(canAccessRoute('budget', []), false)
    assert.equal(canAccessRoute('role-matrix', []), false)
  })

  test('custom role "Chief AI Officer" dynamically unlocks permitted nav groups with no code change', () => {
    const chiefAiOfficerPerms = [
      'projects:read_all',
      'treasury:read',
      'audit_logs:read',
      'approvals:read',
      'approvals:approve',
    ]
    const resolved = resolveVisibleNavigation(chiefAiOfficerPerms)
    const groupIds = resolved.groups.map((g: { id: string }) => g.id)
    assert.ok(groupIds.includes('home'))
    assert.ok(groupIds.includes('my_work'))
    assert.ok(groupIds.includes('projects'))
    assert.ok(groupIds.includes('finance'))
    assert.ok(groupIds.includes('governance'))
    assert.ok(groupIds.includes('insights'))
    assert.equal(groupIds.includes('people'), false)
    assert.ok(resolved.groups.length <= 8)
    assert.equal(canAccessRoute('budget', chiefAiOfficerPerms), true)
    assert.equal(canAccessRoute('audit-log', chiefAiOfficerPerms), true)
    assert.equal(canAccessRoute('people', chiefAiOfficerPerms), false)
  })

  test('nav definitions cap sidebar groups to <= 8 even for system:root', () => {
    const rootResolved = resolveVisibleNavigation(['system:root'])
    assert.ok(NAV_GROUPS.length >= 8)
    assert.ok(NAV_REGISTRY.length >= 10)
    assert.ok(rootResolved.groups.length <= 8)
    assert.equal(rootResolved.settingsItem?.route, 'settings')
  })

  test('workspaces gate cleanly for minimal employee, manager, Chief AI Officer, and CEO (hiding unbuilt modules)', () => {
    // 1. Minimal employee
    const minimalWs = resolveVisibleWorkspaces([])
    assert.deepEqual(
      minimalWs.map((w) => w.workspace.id),
      ['home', 'my_work'],
    )

    // 2. Manager
    const managerPerms = [
      'teams:read_all',
      'projects:read_all',
      'tasks:create_assign',
      'budgets:read_requests',
      'approvals:read',
      'approvals:approve',
    ]
    const managerWs = resolveVisibleWorkspaces(managerPerms)
    assert.deepEqual(
      managerWs.map((w) => w.workspace.id),
      ['home', 'my_work', 'people', 'delivery', 'finance', 'admin'],
    )
    assert.ok(managerWs.every((w) => w.sections.length <= 3))

    // 3. Custom "Chief AI Officer" role
    const aiOfficerPerms = [
      'projects:read_all',
      'treasury:read',
      'audit_logs:read',
      'approvals:read',
      'approvals:approve',
    ]
    const aiWs = resolveVisibleWorkspaces(aiOfficerPerms)
    assert.deepEqual(
      aiWs.map((w) => w.workspace.id),
      ['home', 'my_work', 'delivery', 'finance', 'admin'],
    )

    // 4. CEO (system:root) — unbuilt operations workspace remains hidden
    const ceoWs = resolveVisibleWorkspaces(['system:root'])
    const ceoIds = ceoWs.map((w) => w.workspace.id)
    assert.equal(ceoIds.includes('operations'), false)
    assert.equal(ceoIds.length, 9)
    assert.equal(canAccessRoute('procurement-ops', ['system:root']), false)
  })

  // 3. Dashboard widget visibility tests
  test('dashboard hides org widgets for basic users and reveals permitted ones dynamically', () => {
    const basicWidgets = resolveVisibleDashboardWidgets([])
    const basicIds = basicWidgets.map((w) => w.id)
    assert.ok(basicIds.includes('my_tasks_due'))
    assert.ok(basicIds.includes('my_xp_wallet'))
    assert.equal(basicIds.includes('treasury_summary'), false)
    assert.equal(basicIds.includes('audit_highlights'), false)

    const aiOfficerWidgets = resolveVisibleDashboardWidgets([
      'treasury:read',
      'audit_logs:read',
      'approvals:read',
    ])
    const aiIds = aiOfficerWidgets.map((w) => w.id)
    assert.ok(aiIds.includes('treasury_summary'))
    assert.ok(aiIds.includes('audit_highlights'))
    assert.ok(aiIds.includes('my_pending_approvals'))
    assert.ok(DASHBOARD_WIDGETS.length >= 10)
  })

  // 4. AccessDeniedPage helper & SSR rendering tests
  test('AccessDeniedCard renders required capability badges, Request Access button, and builds approval payload', () => {
    const missing = resolveMissingPermissionsForRoute('budget')
    assert.ok(missing.length > 0)

    const payload = buildAccessRequestPayload({
      userId: 'emp_ai_01',
      routeId: 'budget',
      routeLabel: 'Treasury & Budgets',
      missingPermissions: missing,
      reason: 'Quarterly AI compute budget review',
    })
    assert.equal(payload.entityType, 'route_access')
    assert.equal(payload.entityId, 'emp_ai_01:budget')
    assert.match(payload.reason, /Quarterly AI compute budget review/)

    const html = renderToStaticMarkup(
      React.createElement(AccessDeniedCard, {
        routeId: 'budget',
        routeLabel: 'Treasury & Budgets',
        missingPermissions: missing,
        canSubmitRequest: true,
        isFormOpen: false,
        isSubmitting: false,
        submitted: false,
        reason: '',
        onChangeReason: () => {},
        onOpenForm: () => {},
        onCloseForm: () => {},
        onSubmitForm: () => {},
        onBackHome: () => {},
      }),
    )
    assert.match(html, /Access Restricted/)
    assert.match(html, /Treasury &amp; Budgets|Treasury & Budgets/)
    assert.match(html, /Request Access/)
    assert.match(html, /Back to Home/)
  })

  test('unified inbox aggregates approvals, task reviews, expiring delegations, and filters by type', () => {
    const now = Date.parse('2026-11-12T12:00:00Z')
    const built = buildUnifiedInboxItems({
      nowMs: now,
      canApproveTasks: true,
      canApproveBudgets: true,
      canApproveEmailRequests: true,
      emailRequests: [
        {
          id: 'er_1',
          email: 'hire@gmail.com',
          fullName: 'New Hire',
          reason: 'Q4 cohort',
          status: 'PENDING',
        },
      ],
      approvals: [
        {
          id: 'ap_1',
          actionCode: 'payroll:approve_batch',
          entityType: 'payroll_batch',
          entityId: 'nov_2026',
          amount: 250000,
          requiresDualApproval: true,
        },
      ],
      tasks: [
        {
          id: 't_1',
          title: 'Ship unified inbox',
          status: 'in_review',
          priority: 'high',
          dueDate: '2026-11-13',
        } as any,
      ],
      myReceivedDelegations: [
        {
          id: 'del_1',
          status: 'ACTIVE',
          expiresAt: '2026-11-12T18:00:00Z',
          delegator: { name: 'CTO' },
          reason: 'Release coverage',
        },
      ],
      notifications: [
        { id: 'n_1', title: 'Mentioned in Q4 review', message: 'Check budget', read: false, timestamp: '2026-11-12T11:00:00Z' } as any,
        { id: 'n_2', title: 'Already read', message: 'Ignore', read: true, timestamp: '2026-11-12T10:00:00Z' } as any,
      ],
    })
    assert.equal(built.length, 5)
    assert.equal(filterUnifiedInboxItems(built, 'approval', '').length, 1)
    assert.equal(filterUnifiedInboxItems(built, 'task_review', '').length, 1)
    assert.equal(filterUnifiedInboxItems(built, 'delegation', '').length, 1)
    assert.equal(filterUnifiedInboxItems(built, 'email_request', '').length, 1)
    assert.equal(filterUnifiedInboxItems(built, 'all', 'payroll').length, 1)
  })

  test('command palette filters pages, quick-create actions, shortcuts, and people strictly by effective permissions', () => {
    const basicPalette = filterPaletteByPermissions({ query: '', effectivePermissions: [] })
    assert.equal(basicPalette.allowPeople, false)
    assert.equal(
      basicPalette.actions.some((a) => a.id === 'new_role'),
      false,
    )
    assert.equal(
      basicPalette.shortcuts.some((s) => s.route === 'budget'),
      false,
    )
    assert.ok(basicPalette.actions.some((a) => a.id === 'submit_leave'))

    const financePalette = filterPaletteByPermissions({
      query: 'budget',
      effectivePermissions: ['treasury:read', 'budgets:request_increase', 'employees:read_directory'],
    })
    assert.equal(financePalette.allowPeople, true)
    assert.ok(financePalette.actions.some((a) => a.id === 'request_budget'))
    assert.ok(financePalette.shortcuts.some((s) => s.route === 'budget'))
  })

  test('every code in all 40 permission packs exists in docs/permissions_master.md and critical codes are explicitly marked', () => {
    const mdPath = path.resolve(process.cwd(), '../docs/permissions_master.md')
    const md = fs.readFileSync(mdPath, 'utf8')
    const catalog = new Map<string, boolean>()
    for (const line of md.split('\n')) {
      if (!line.startsWith('|')) continue
      const match =
        line.match(/\|\s*`([a-z0-9_]+:[a-z0-9_]+)`\s*\|/i) ||
        line.match(/\|\s*([a-z0-9_]+:[a-z0-9_]+)\s*\|/)
      if (match) {
        catalog.set(match[1], line.includes('⚠'))
      }
    }

    assert.ok(PERMISSION_PACKS.length >= 40, `Expected >=40 packs, got ${PERMISSION_PACKS.length}`)
    for (const pack of PERMISSION_PACKS) {
      for (const code of pack.codes) {
        assert.ok(catalog.has(code), `Pack "${pack.id}" contains unknown code "${code}"`)
        if (catalog.get(code)) {
          assert.equal(
            pack.riskLevel,
            'critical',
            `Pack "${pack.id}" includes critical code "${code}" without riskLevel="critical"`,
          )
          assert.ok(
            pack.criticalCodes.includes(code),
            `Pack "${pack.id}" includes critical code "${code}" without listing it in criticalCodes`,
          )
        }
      }
    }

    const summary = buildRolePlainSummary(new Set(['projects:read_all', 'sprints:create']))
    assert.match(summary.canSummary, /This role can/)
    assert.match(summary.cannotSummary, /but cannot/)
  })

  test('sensitive-action registry marks critical, governance:*, and executive permissions as requiring fresh MFA every time', () => {
    assert.equal(isPermissionMfaRequiredEveryTime('users:assign_role', false), true)
    assert.equal(isPermissionMfaRequiredEveryTime('employees:read_sensitive', false), true)
    assert.equal(isPermissionMfaRequiredEveryTime('governance:any_future_action', false), true)
    assert.equal(isPermissionMfaRequiredEveryTime('custom:critical_action', true), true)
    assert.equal(isPermissionMfaRequiredEveryTime('tasks:read_own', false), false)
  })

  test('employee profile sensitive action buttons are gated strictly by permission and require reason where configured', () => {
    assert.deepEqual(
      getVisibleSensitiveProfileActions(() => false).map((a) => a.key),
      [],
    )

    const onlyPromoteAndUnlock = getVisibleSensitiveProfileActions((perm) =>
      ['promotions:approve', 'employees:read_sensitive'].includes(perm),
    )
    assert.deepEqual(
      onlyPromoteAndUnlock.map((a) => a.key),
      ['unlock_sensitive', 'promote'],
    )
    assert.equal(onlyPromoteAndUnlock[0].requiresReason, false)
    assert.equal(onlyPromoteAndUnlock[1].requiresReason, true)

    const allFive = getVisibleSensitiveProfileActions(() => true)
    assert.deepEqual(
      allFive.map((a) => a.key),
      ['unlock_sensitive', 'promote', 'remove_position', 'reset_password', 'reset_mfa'],
    )
    assert.match(allFive[1].describe('Nusrat Jahan', 'Principal Engineer'), /Nusrat Jahan.*Principal Engineer/)
    assert.match(allFive[3].describe('Nusrat Jahan'), /email it directly to Nusrat Jahan/)
  })

  test('login page contains zero demo accounts, demo env flags, or hardcoded role credentials', () => {
    const loginSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/auth/LoginPage.tsx'),
      'utf8',
    )
    for (const forbidden of [
      'VITE_ENABLE_DEMO_LOGIN',
      'VITE_DEMO_PASSWORD',
      'DEMO_ENVIRONMENTS',
      'noor.ceo@',
      'abir.cto@',
      'rahid.cfo@',
      'naim.chro@',
      'jihad.pm@',
      'fahim.dev@',
    ]) {
      assert.equal(
        loginSource.includes(forbidden),
        false,
        `LoginPage.tsx must not contain demo artifact "${forbidden}"`,
      )
    }
  })

  test('LoginAccessPage parser trims, lowercases, dedupes, and counts invalid emails', () => {
    const existing = new Set(['already@company.com'])
    const res = parseAllowlistInput(
      'Alice@Gmail.com, already@company.com\nalice@gmail.com\nnot-an-email',
      existing,
    )
    assert.deepEqual(res.toAdd, ['alice@gmail.com'])
    assert.equal(res.duplicates, 2)
    assert.deepEqual(res.invalid, ['not-an-email'])
  })

  test('MyAccountPage exposes all required sections and login-access route gates on allowlist permissions', () => {
    const accountSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/account/MyAccountPage.tsx'),
      'utf8',
    )
    for (const section of [
      'Profile',
      'Change Password',
      'Linked Google Account',
      'MFA Status',
      'MfaRecoveryCodesCard',
      'Active Sessions',
      'Theme &amp; Density',
    ]) {
      assert.ok(accountSource.includes(section), `MyAccountPage missing "${section}"`)
    }

    assert.equal(canAccessRoute('login-access', ['tasks:read_own']), false)
    assert.equal(canAccessRoute('login-access', ['login_allowlist:read']), true)
    assert.equal(canAccessRoute('login-access', ['login_allowlist:manage']), true)
  })

  test('replaceRolePermissions forwards X-MFA-Code, X-MFA-Action, and X-MFA-Target (CEO role-save bug regression)', () => {
    const clientSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/api/client.ts'),
      'utf8',
    )
    assert.ok(
      clientSource.includes("'X-MFA-Action': 'roles:update'"),
      "client.ts replaceRolePermissions must send X-MFA-Action: roles:update",
    )
    assert.ok(
      clientSource.includes("'X-MFA-Action': 'users:assign_role'"),
      "client.ts assignRoleToEmployee must send X-MFA-Action: users:assign_role",
    )
    assert.ok(
      clientSource.includes("'X-MFA-Action': 'roles:create'"),
      "client.ts createRole must send X-MFA-Action: roles:create",
    )
    assert.ok(
      clientSource.includes("'X-MFA-Action': 'roles:delete'"),
      "client.ts deleteRole must send X-MFA-Action: roles:delete",
    )
  })

  test('auth preservation: AppContext and client protect reset-password tokens and routes', () => {
    const appContextSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/context/AppContext.tsx'),
      'utf8',
    )
    assert.ok(
      appContextSource.includes("!window.location.pathname.startsWith('/reset-password')"),
      'AppContext must not overwrite /reset-password on unauthenticated session bootstrap',
    )
    assert.ok(
      appContextSource.includes("'/login' + window.location.search"),
      'AppContext must preserve query parameters when redirecting to /login',
    )

    const clientSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/api/client.ts'),
      'utf8',
    )
    assert.ok(
      clientSource.includes("path.startsWith('/auth/reset-password')"),
      'client.ts must mark /auth/reset-password as an auth lifecycle route',
    )
    assert.ok(
      clientSource.includes("path.startsWith('/auth/google')"),
      'client.ts must mark /auth/google as an auth lifecycle route',
    )

    const vercelConfig = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8'),
    )
    const rootRedirect = vercelConfig.redirects?.find((r: any) => r.source === '/')
    assert.ok(rootRedirect, 'vercel.json must have a redirect for /')
    assert.equal(rootRedirect.destination, '/login')
  })

  return results
}
