import { formatBDT } from '../utils/money'
import type { Notification, Report, Task } from '../types'

export type UnifiedInboxItemType =
  | 'approval'
  | 'task_review'
  | 'leave_request'
  | 'access_request'
  | 'email_request'
  | 'delegation'
  | 'mention'
  | 'budget_request'

export interface UnifiedInboxItem {
  id: string
  sourceId: string
  type: UnifiedInboxItemType
  title: string
  subtitle: string
  requesterName?: string
  amountBDT?: number
  createdAt: string
  expiresAt?: string
  canApprove: boolean
  canReject: boolean
  isCritical?: boolean
  routeHint?: string
  raw?: any
}

export const INBOX_TYPE_LABELS: Record<UnifiedInboxItemType | 'all', string> = {
  all: 'All',
  approval: 'Approvals',
  task_review: 'Task Reviews',
  leave_request: 'Leave Requests',
  access_request: 'Access Requests',
  email_request: 'Email Requests',
  delegation: 'Delegations',
  budget_request: 'Budgets',
  mention: 'Mentions',
}

export function buildUnifiedInboxItems(params: {
  approvals?: any[]
  accessRequests?: any[]
  emailRequests?: any[]
  myReceivedDelegations?: any[]
  pendingDelegations?: any[]
  budgetRequests?: any[]
  tasks?: Task[]
  reports?: Report[]
  notifications?: Notification[]
  canApproveTasks?: boolean
  canApproveBudgets?: boolean
  canApproveAccess?: boolean
  canApproveEmailRequests?: boolean
  canApproveDelegations?: boolean
  canTriageReports?: boolean
  nowMs?: number
}): UnifiedInboxItem[] {
  const now = params.nowMs ?? Date.now()
  const items: UnifiedInboxItem[] = []

  // 1. Workflow Approvals
  for (const req of params.approvals || []) {
    items.push({
      id: `approval:${req.id}`,
      sourceId: req.id,
      type: 'approval',
      title: req.actionCode || 'Approval Request',
      subtitle: `${req.entityType || 'item'}:${req.entityId || req.id}${req.amount ? ` • ${formatBDT(Number(req.amount))}` : ''}`,
      requesterName: req.requester?.name,
      amountBDT: req.amount ? Number(req.amount) : undefined,
      createdAt: req.createdAt || new Date(now).toISOString(),
      canApprove: true,
      canReject: true,
      isCritical: Boolean(req.requiresDualApproval),
      routeHint: 'approvals',
      raw: req,
    })
  }

  // 2. Task Reviews (tasks currently in_review)
  if (params.canApproveTasks) {
    for (const task of params.tasks || []) {
      if (task.status !== 'in_review') continue
      items.push({
        id: `task_review:${task.id}`,
        sourceId: task.id,
        type: 'task_review',
        title: `Review task: ${task.title}`,
        subtitle: `Priority: ${task.priority} • Due ${task.dueDate || 'unscheduled'}`,
        createdAt: task.createdAt || new Date(now).toISOString(),
        canApprove: true,
        canReject: true,
        routeHint: 'task-management',
        raw: task,
      })
    }
  }

  // 3. Access Requests
  if (params.canApproveAccess) {
    for (const req of params.accessRequests || []) {
      if (req.status && req.status !== 'PENDING') continue
      items.push({
        id: `access_request:${req.id}`,
        sourceId: req.id,
        type: 'access_request',
        title: `Role request: ${req.requestedRole?.name || req.requestedRoleId || 'Access'}`,
        subtitle: `For ${req.targetEmployee?.name || req.targetEmployeeId || 'Employee'}`,
        requesterName: req.requester?.name || req.targetEmployee?.name,
        createdAt: req.createdAt || new Date(now).toISOString(),
        canApprove: true,
        canReject: true,
        routeHint: 'access-control',
        raw: req,
      })
    }
  }

  // 3b. Allowlist Email Requests (CEO-only)
  if (params.canApproveEmailRequests) {
    for (const req of params.emailRequests || []) {
      if (req.status && req.status !== 'PENDING') continue
      items.push({
        id: `email_request:${req.id}`,
        sourceId: req.id,
        type: 'email_request',
        title: `Allowlist email: ${req.email}`,
        subtitle: `${req.fullName || 'Candidate'} • ${req.reason || 'Onboarding request'}`,
        requesterName: req.fullName,
        createdAt: req.createdAt || new Date(now).toISOString(),
        canApprove: true,
        canReject: true,
        isCritical: true,
        routeHint: 'login-access',
        raw: req,
      })
    }
  }

  // 4. Delegations: pending approval OR expiring within 24h
  if (params.canApproveDelegations) {
    for (const del of params.pendingDelegations || []) {
      if (del.status !== 'PENDING_APPROVAL') continue
      items.push({
        id: `delegation_approve:${del.id}`,
        sourceId: del.id,
        type: 'delegation',
        title: `Approve delegation to ${del.delegatee?.name || del.delegateeId}`,
        subtitle: del.reason || 'Temporary delegated permissions',
        requesterName: del.delegator?.name,
        createdAt: del.createdAt || new Date(now).toISOString(),
        expiresAt: del.expiresAt,
        canApprove: true,
        canReject: true,
        routeHint: 'delegations',
        raw: del,
      })
    }
  }

  for (const del of params.myReceivedDelegations || []) {
    if (del.status !== 'ACTIVE' || !del.expiresAt) continue
    const msLeft = new Date(del.expiresAt).getTime() - now
    if (msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000) {
      const hoursLeft = Math.max(1, Math.round(msLeft / 3_600_000))
      items.push({
        id: `delegation_expiring:${del.id}`,
        sourceId: del.id,
        type: 'delegation',
        title: `Delegation expiring in ~${hoursLeft}h`,
        subtitle: `From ${del.delegator?.name || del.delegatorId}: ${del.reason || 'Temporary access'}`,
        createdAt: del.startsAt || del.createdAt || new Date(now).toISOString(),
        expiresAt: del.expiresAt,
        canApprove: false,
        canReject: false,
        routeHint: 'delegations',
        raw: del,
      })
    }
  }

  // 5. Budget Requests
  if (params.canApproveBudgets) {
    for (const b of params.budgetRequests || []) {
      if (b.status && !['pending', 'submitted', 'PENDING'].includes(String(b.status))) continue
      const amt = Number(b.requestedAmount ?? b.amount ?? 0)
      items.push({
        id: `budget_request:${b.id}`,
        sourceId: b.id,
        type: 'budget_request',
        title: b.title || `Budget request (${b.projectName || b.projectId || b.id})`,
        subtitle: amt > 0 ? `Requested ${formatBDT(amt)}` : b.description || 'Pending finance review',
        amountBDT: amt > 0 ? amt : undefined,
        createdAt: b.createdAt || new Date(now).toISOString(),
        canApprove: true,
        canReject: true,
        isCritical: amt >= 50_000,
        routeHint: 'budget',
        raw: b,
      })
    }
  }

  // 6. Leave Requests & Submissions
  if (params.canTriageReports) {
    for (const r of params.reports || []) {
      if (!['submitted', 'pending', 'under_review'].includes(String(r.status))) continue
      const isLeave =
        String(r.type).toLowerCase().includes('leave') ||
        String(r.title).toLowerCase().includes('leave')
      if (!isLeave) continue
      items.push({
        id: `leave_request:${r.id}`,
        sourceId: r.id,
        type: 'leave_request',
        title: r.title,
        subtitle: r.description || 'Leave request awaiting review',
        createdAt: r.submittedAt || r.createdAt || new Date(now).toISOString(),
        canApprove: false,
        canReject: false,
        routeHint: 'reports',
        raw: r,
      })
    }
  }

  // 7. Unread Mentions & Notifications
  for (const n of params.notifications || []) {
    if (n.read) continue
    items.push({
      id: `mention:${n.id}`,
      sourceId: n.id,
      type: 'mention',
      title: n.title,
      subtitle: n.message,
      createdAt: n.timestamp || new Date(now).toISOString(),
      canApprove: false,
      canReject: false,
      raw: n,
    })
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function filterUnifiedInboxItems(
  items: UnifiedInboxItem[],
  typeFilter: UnifiedInboxItemType | 'all',
  searchQuery: string,
): UnifiedInboxItem[] {
  const q = searchQuery.trim().toLowerCase()
  return items.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false
    if (!q) return true
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      (item.requesterName || '').toLowerCase().includes(q)
    )
  })
}

export function getInboxReadStorageKey(userId: string): string {
  return `pointfex_inbox_read_${userId}`
}

export function loadReadInboxIds(userId?: string): Set<string> {
  if (!userId || typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(getInboxReadStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function saveReadInboxIds(userId: string | undefined, ids: Set<string>): void {
  if (!userId || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(getInboxReadStorageKey(userId), JSON.stringify(Array.from(ids)))
  } catch {
    // ignore storage quota errors
  }
}
