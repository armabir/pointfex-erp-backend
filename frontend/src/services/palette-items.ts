import { canAccessRoute, resolveVisibleNavigation } from '../config/nav-registry'

export interface PaletteQuickAction {
  id: string
  label: string
  description: string
  route: string
  requiredAny?: string[]
  alwaysVisible?: boolean
}

export interface PaletteShortcut {
  keys: string
  sequence: [string, string]
  label: string
  route: string
}

export const PALETTE_QUICK_ACTIONS: readonly PaletteQuickAction[] = [
  {
    id: 'create_task',
    label: 'Create New Task',
    description: 'Open Task Operations to assign work',
    route: 'task-management',
    requiredAny: ['tasks:create_assign', 'tasks:create_own', 'tasks:reassign'],
  },
  {
    id: 'submit_leave',
    label: 'Submit Leave or Proposal',
    description: 'File a leave notice, idea, or report',
    route: 'report',
    alwaysVisible: true,
  },
  {
    id: 'request_budget',
    label: 'Request Budget / Expense (BDT)',
    description: 'Submit a new BDT budget request',
    route: 'budget-finance',
    requiredAny: ['budgets:request_increase', 'budgets:allocate_project', 'expenses:create'],
  },
  {
    id: 'new_delegation',
    label: 'Grant Temporary Delegation',
    description: 'Delegate scoped authority to a teammate',
    route: 'delegations',
    requiredAny: ['delegations:create', 'permissions:delegate'],
  },
  {
    id: 'new_role',
    label: 'Create Custom Role',
    description: 'Build a role from plain-English packs',
    route: 'access-control',
    requiredAny: ['roles:create'],
  },
]

export const GOTO_SHORTCUTS: readonly PaletteShortcut[] = [
  { keys: 'g h', sequence: ['g', 'h'], label: 'Go to Home (My Day)', route: 'dashboard' },
  { keys: 'g i', sequence: ['g', 'i'], label: 'Go to Needs My Action (Inbox)', route: 'inbox' },
  { keys: 'g t', sequence: ['g', 't'], label: 'Go to My Tasks', route: 'tasks' },
  { keys: 'g e', sequence: ['g', 'e'], label: 'Go to My Wallet & XP', route: 'earnings' },
  { keys: 'g d', sequence: ['g', 'd'], label: 'Go to Delegations', route: 'delegations' },
  { keys: 'g b', sequence: ['g', 'b'], label: 'Go to Treasury & Budgets', route: 'budget' },
  { keys: 'g r', sequence: ['g', 'r'], label: 'Go to Roles & Permissions', route: 'access-control' },
  { keys: 'g l', sequence: ['g', 'l'], label: 'Go to Audit Trail', route: 'audit-log' },
]

export function getPermittedQuickActions(
  effectivePermissions: readonly string[],
): PaletteQuickAction[] {
  const permSet = new Set(effectivePermissions)
  const isRoot = permSet.has('system:root')
  return PALETTE_QUICK_ACTIONS.filter((a) => {
    if (a.alwaysVisible || isRoot) return true
    if (!a.requiredAny || a.requiredAny.length === 0) return true
    return a.requiredAny.some((code) => permSet.has(code))
  })
}

export function getPermittedShortcuts(effectivePermissions: readonly string[]): PaletteShortcut[] {
  return GOTO_SHORTCUTS.filter((s) => canAccessRoute(s.route, effectivePermissions))
}

export function canSearchPeople(effectivePermissions: readonly string[]): boolean {
  const permSet = new Set(effectivePermissions)
  if (permSet.has('system:root')) return true
  return [
    'employees:read_directory',
    'employees:create',
    'employees:update_any',
    'teams:read_all',
    'teams:read_own',
  ].some((code) => permSet.has(code))
}

export function filterPaletteByPermissions(params: {
  query: string
  effectivePermissions: readonly string[]
}) {
  const q = params.query.trim().toLowerCase()
  const { visibleItems } = resolveVisibleNavigation(params.effectivePermissions)
  const actions = getPermittedQuickActions(params.effectivePermissions)
  const shortcuts = getPermittedShortcuts(params.effectivePermissions)
  const allowPeople = canSearchPeople(params.effectivePermissions)

  return {
    pages: !q
      ? visibleItems.slice(0, 6)
      : visibleItems.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q)),
        ),
    actions: !q
      ? actions
      : actions.filter(
          (a) =>
            a.label.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q),
        ),
    shortcuts: !q
      ? shortcuts
      : shortcuts.filter(
          (s) => s.label.toLowerCase().includes(q) || s.keys.toLowerCase().includes(q),
        ),
    allowPeople,
  }
}

