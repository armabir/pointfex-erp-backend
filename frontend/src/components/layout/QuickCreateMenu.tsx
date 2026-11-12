import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  CheckSquare,
  Send,
  Coins,
  Briefcase,
  Megaphone,
  Share2,
  KeyRound,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { usePermissions } from '../../hooks/usePermissions'

interface QuickCreateAction {
  id: string
  label: string
  description: string
  route: string
  icon: typeof Plus
  requiredAny?: string[]
  alwaysVisible?: boolean
}

const QUICK_CREATE_ACTIONS: QuickCreateAction[] = [
  {
    id: 'new_task',
    label: 'New Task',
    description: 'Create and assign a deliverable',
    route: 'task-management',
    icon: CheckSquare,
    requiredAny: ['tasks:create_assign', 'tasks:create_own', 'tasks:reassign'],
  },
  {
    id: 'leave_request',
    label: 'Leave / Submission',
    description: 'Submit leave notice or proposal',
    route: 'report',
    icon: Send,
    alwaysVisible: true,
  },
  {
    id: 'budget_request',
    label: 'Expense / Budget Request',
    description: 'Request squad or project funds in BDT',
    route: 'budget-finance',
    icon: Coins,
    requiredAny: ['budgets:request_increase', 'budgets:allocate_project', 'expenses:create'],
  },
  {
    id: 'client_advisory',
    label: 'Client Advisory',
    description: 'Log a new client consulting request',
    route: 'consultancy',
    icon: Briefcase,
    requiredAny: ['consultancy:create', 'consultancy:manage'],
  },
  {
    id: 'announcement',
    label: 'Announcement / Directive',
    description: 'Publish an executive update',
    route: 'reports',
    icon: Megaphone,
    requiredAny: ['announcements:create', 'directives:dispatch', 'reports:triage'],
  },
  {
    id: 'delegation',
    label: 'Temporary Delegation',
    description: 'Delegate scoped authority to a teammate',
    route: 'delegations',
    icon: Share2,
    requiredAny: ['delegations:create', 'permissions:delegate'],
  },
  {
    id: 'custom_role',
    label: 'Custom Role',
    description: 'Build a permission-backed role',
    route: 'access-control',
    icon: KeyRound,
    requiredAny: ['roles:create'],
  },
]

export function QuickCreateMenu() {
  const { setRoute } = useApp()
  const { permissions, authzSnapshot } = usePermissions()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const effectiveSet = useMemo(
    () => new Set(authzSnapshot?.effectiveCodes ?? permissions),
    [authzSnapshot?.effectiveCodes, permissions],
  )

  const allowedActions = useMemo(() => {
    const isRoot = effectiveSet.has('system:root')
    return QUICK_CREATE_ACTIONS.filter((a) => {
      if (a.alwaysVisible || isRoot) return true
      if (!a.requiredAny || a.requiredAny.length === 0) return true
      return a.requiredAny.some((code) => effectiveSet.has(code))
    })
  }, [effectiveSet])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  if (allowedActions.length === 0) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="min-h-[38px] min-w-[38px] sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--primary)] text-white text-[13px] font-medium hover:opacity-95 cursor-pointer transition-opacity"
        title="Quick Create"
        aria-label="Quick Create"
        aria-expanded={isOpen}
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">Create</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] shadow-xl z-50 p-2">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Quick Create
          </div>
          <div className="space-y-0.5 mt-1">
            {allowedActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    setRoute(action.route)
                    setIsOpen(false)
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-[var(--radius-control)] hover:bg-[var(--surface-muted)] flex items-start gap-2.5 cursor-pointer"
                >
                  <Icon className="w-4 h-4 text-[var(--primary)] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text)]">
                      {action.label}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate">
                      {action.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

