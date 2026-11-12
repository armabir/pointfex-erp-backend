import {
  LayoutDashboard,
  Briefcase,
  Users,
  FolderGit2,
  Cpu,
  Coins,
  Package,
  Handshake,
  Building2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export type WorkspaceId =
  | 'home'
  | 'my_work'
  | 'people'
  | 'delivery'
  | 'engineering'
  | 'finance'
  | 'operations'
  | 'product_clients'
  | 'company_hub'
  | 'admin'

export interface WorkspaceMeta {
  id: WorkspaceId
  label: string
  shortLabel: string
  description: string
  icon: LucideIcon
  /** Permission catalog module codes (00-20) owned by this workspace */
  modules: readonly string[]
  alwaysVisible?: boolean
}

export const WORKSPACES: readonly WorkspaceMeta[] = [
  {
    id: 'home',
    label: 'Home',
    shortLabel: 'Home',
    description: 'My Day overview, priorities, and role-aware widgets',
    icon: LayoutDashboard,
    modules: ['00'],
    alwaysVisible: true,
  },
  {
    id: 'my_work',
    label: 'My Work',
    shortLabel: 'Work',
    description: 'Tasks, wallet & XP, leave submissions, and profile settings',
    icon: Briefcase,
    modules: ['00'],
    alwaysVisible: true,
  },
  {
    id: 'people',
    label: 'People & Culture',
    shortLabel: 'People',
    description: 'Employee directory, squads, attendance, and performance reviews',
    icon: Users,
    modules: ['04', '05', '16', '17'],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    shortLabel: 'Delivery',
    description: 'Projects, repositories, sprints, and task operations',
    icon: FolderGit2,
    modules: ['10', '11'],
  },
  {
    id: 'engineering',
    label: 'Engineering Ops',
    shortLabel: 'Eng Ops',
    description: 'Code quality gates, security alerts, and automated test runs',
    icon: Cpu,
    modules: ['12', '13', '14', '15'],
  },
  {
    id: 'finance',
    label: 'Finance',
    shortLabel: 'Finance',
    description: 'Treasury reserves, project budgets, payroll, and budget requests',
    icon: Coins,
    modules: ['06', '07'],
  },
  {
    id: 'operations',
    label: 'Operations',
    shortLabel: 'Ops',
    description: 'Procurement, vendors, inventory, and company assets',
    icon: Package,
    modules: ['08'],
  },
  {
    id: 'product_clients',
    label: 'Product & Clients',
    shortLabel: 'Clients',
    description: 'Consultancy pipeline, client accounts, and advisory delivery',
    icon: Handshake,
    modules: ['09', '18'],
  },
  {
    id: 'company_hub',
    label: 'Company Hub',
    shortLabel: 'Hub',
    description: 'Announcements, policies, and cross-squad executive reports',
    icon: Building2,
    modules: ['19'],
  },
  {
    id: 'admin',
    label: 'Admin & Governance',
    shortLabel: 'Admin',
    description: 'Roles, permissions, delegations, approval inbox, and audit trail',
    icon: ShieldCheck,
    modules: ['01', '02', '03', '20'],
  },
]

export function getWorkspaceMeta(id: WorkspaceId): WorkspaceMeta {
  return WORKSPACES.find((w) => w.id === id) || WORKSPACES[0]
}

