// Formatting helpers for the ERP system
import type { RelativeDeadline } from '../types'
import { formatBDT } from './money'

export function formatCurrency(amount: number, _currency: string = 'BDT'): string {
  return formatBDT(amount)
}

export function formatDate(
  dateString?: string | null,
  format: 'short' | 'full' | 'medium' = 'medium',
): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString

  if (format === 'short') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Dhaka',
    })
  }
  if (format === 'full') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Dhaka',
    })
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  })
}

export function getRelativeDeadline(dueDateString?: string | null): RelativeDeadline {
  if (!dueDateString) return { label: 'No date', isOverdue: false, isUrgent: false, days: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateString)
  due.setHours(0, 0, 0, 0)

  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    return {
      label: `${overdueDays}d overdue`,
      isOverdue: true,
      isUrgent: true,
      days: diffDays,
      badgeColor: 'rose',
    }
  }
  if (diffDays === 0) {
    return {
      label: 'Due today',
      isOverdue: false,
      isUrgent: true,
      days: 0,
      badgeColor: 'amber',
    }
  }
  if (diffDays === 1) {
    return {
      label: 'Due tomorrow',
      isOverdue: false,
      isUrgent: true,
      days: 1,
      badgeColor: 'amber',
    }
  }
  if (diffDays <= 3) {
    return {
      label: `In ${diffDays} days`,
      isOverdue: false,
      isUrgent: true,
      days: diffDays,
      badgeColor: 'sky',
    }
  }
  return {
    label: `In ${diffDays} days`,
    isOverdue: false,
    isUrgent: false,
    days: diffDays,
    badgeColor: 'slate',
  }
}

export interface StatusBadgeConfig {
  label: string
  bg: string
  text: string
  border: string
  dot?: string
}

// Softer, relaxing status pill configurations with dark mode support
export const STATUS_CONFIG: Record<string, StatusBadgeConfig> = {
  // Task statuses
  todo: {
    label: 'To Do',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200/80 dark:border-sky-800/60',
    dot: 'bg-sky-500',
  },
  in_review: {
    label: 'In Review',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200/80 dark:border-purple-800/60',
    dot: 'bg-purple-500',
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200/80 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },

  // Project statuses
  active: {
    label: 'Active',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  planning: {
    label: 'Planning',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },

  // Grievance / report statuses
  pending: {
    label: 'Pending',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },
  under_investigation: {
    label: 'Under Review',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200/80 dark:border-purple-800/60',
    dot: 'bg-purple-500',
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200/80 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },

  // Priority
  urgent: {
    label: 'Urgent',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200/80 dark:border-rose-800/60',
  },
  high: {
    label: 'High',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200/80 dark:border-amber-800/60',
  },
  medium: {
    label: 'Medium',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200/80 dark:border-sky-800/60',
  },
  low: {
    label: 'Low',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
  },
}

export function getStatusBadge(statusKey: string): StatusBadgeConfig {
  return (
    STATUS_CONFIG[statusKey] || {
      label: statusKey,
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      dot: 'bg-slate-400',
    }
  )
}
