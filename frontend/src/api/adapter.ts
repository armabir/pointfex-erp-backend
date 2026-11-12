import type {
  SeedData,
  User,
  Team,
  Project,
  Milestone,
  Repository,
  Task,
  TaskComment,
  Wallet,
  Transaction,
  PerformanceRecord,
  Report,
  Announcement,
  Notification,
  ActivityLog,
  CodeQualityGate,
  SecurityAlert,
  TestingSuite,
  ConsultancyRequest,
  CompanyTreasury,
} from '../types'
import { ROLE_LIST } from '../data/roles'
import { formatBDT } from '../utils/money'

export interface BackendBundle {
  employees: any[]
  positions: any[]
  teams: any[]
  projects: any[]
  tasks: any[]
  treasury: any
  wallets: any[]
  transactions: any[]
  budgetRequests: any[]
  performance: any[]
  reports: any[]
  auditLogs: any[]
  qualityGates: any[]
  securityAlerts: any[]
  testRuns: any[]
  consultancy: any[]
  announcements: any[]
  notifications: any[]
}

const num = (val: unknown, fallback = 0): number => {
  if (val === null || val === undefined || val === '') return fallback
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

const isoDate = (val: unknown, fallback = ''): string => {
  if (!val) return fallback
  const d = new Date(String(val))
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toISOString().split('T')[0]
}

export function mapBackendBundleToSeedData(
  bundle: BackendBundle,
  fallbackPrev?: SeedData,
): SeedData {
  // 1. Employees -> Users
  const users: User[] = (bundle.employees || []).map((emp) => {
    const posRole = emp.positionAssignments?.[0]?.position?.roleCategory || 'developer'
    const normalizedRole = posRole === 'chro' ? 'cpo' : posRole
    const teamId = emp.teamMemberships?.[0]?.teamId
    const activeRoles = (emp.employeeRoles || []).filter((er: any) => er.isActive && er.role)
    const pendingReq = emp.targetedAccessChanges?.[0]
    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: normalizedRole,
      title: emp.title,
      teamId,
      avatar: emp.avatarUrl || undefined,
      avatarUrl: emp.avatarUrl || undefined,
      initials: emp.initials,
      status: emp.status || 'online',
      isSuspended: Boolean(emp.isSuspended),
      mfaEnabled: Boolean(emp.mfaEnabled),
      inviteDeliveryStatus: emp.inviteDeliveryStatus || 'sent',
      inviteTokenExpiresAt: emp.inviteTokenExpiresAt || null,
      inviteTokenUsedAt: emp.inviteTokenUsedAt || null,
      activeRoleSlugs: activeRoles.map((er: any) => er.role.slug),
      activeRoleNames: activeRoles.map((er: any) => er.role.name),
      pendingAccessRequest: pendingReq
        ? {
            id: pendingReq.id,
            requestedRoleId: pendingReq.requestedRoleId,
            requestedRoleSlug: pendingReq.requestedRole?.slug || '',
            requestedRoleName: pendingReq.requestedRole?.name || 'Updated Role',
            requesterId: pendingReq.requesterId,
            requesterName: pendingReq.requester?.name || 'C-Level Executive',
            reason: pendingReq.reason || null,
            createdAt: pendingReq.createdAt,
          }
        : null,
      skills: emp.skills || [],
      timezone: emp.timezone || 'UTC+6 (BST)',
      github: emp.github || undefined,
      joinedSprint: emp.joinedSprint || 'Sprint 1',
      bio: emp.bio || undefined,
      phone: emp.phone || undefined,
      location: emp.location || undefined,
    }
  })

  // Also ensure PMs have teamId resolved from managedTeam if not in teamMemberships
  const pmTeamByEmployeeId = new Map<string, string>()
  for (const t of bundle.teams || []) {
    if (t.pm?.id) pmTeamByEmployeeId.set(t.pm.id, t.id)
  }
  for (const u of users) {
    if (!u.teamId && pmTeamByEmployeeId.has(u.id)) {
      u.teamId = pmTeamByEmployeeId.get(u.id)
    }
  }

  // 2. Teams
  const teams: Team[] = (bundle.teams || []).map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    focus: t.focus,
    pmId: t.pm?.id || '',
    leadDevId: t.leadDev?.id || '',
    memberIds: (t.members || []).map((m: any) => m.id),
    projectIds: (t.projects || []).map((p: any) => p.id),
    color: t.color || '#38bdf8',
    currentSprintWeek: t.currentSprintWeek ?? 3,
    totalSprintWeeks: t.totalSprintWeeks ?? 5,
    health: t.health || 'on_track',
    weeklyVelocity: t.weeklyVelocity ?? 40,
  }))

  // 3. Projects, Milestones & Repositories
  const milestones: Milestone[] = []
  const repositories: Repository[] = []

  const projects: Project[] = (bundle.projects || []).map((p) => {
    const repoId = `repo_${p.id}`
    const projMilestones = (p.milestones || []).map((ms: any) => {
      milestones.push({
        id: ms.id,
        projectId: p.id,
        sprintWeek: ms.sprintWeek ?? undefined,
        title: ms.title,
        dueDate: isoDate(ms.dueDate),
        status: ms.status || 'pending',
        progress:
          ms.progress ?? (ms.status === 'completed' ? 100 : ms.status === 'in_progress' ? 50 : 0),
        deliverablesCount: ms.deliverablesCount ?? 0,
        payoutAmount:
          ms.payoutAmount !== null && ms.payoutAmount !== undefined
            ? num(ms.payoutAmount)
            : undefined,
      })
      return {
        id: ms.id,
        title: ms.title,
        dueDate: isoDate(ms.dueDate),
        status: ms.status || 'pending',
      }
    })

    const repoUrl =
      p.repositoryUrl || `https://github.com/pointfex/${String(p.code || p.id).toLowerCase()}`
    const repoName = repoUrl.replace(/^https?:\/\/github\.com\//, '')
    repositories.push({
      id: repoId,
      projectId: p.id,
      name: repoName,
      url: repoUrl,
      defaultBranch: 'main',
      activeBranch: 'main',
      openPRsCount: 0,
      lastCommit: {
        hash: 'main-head',
        message: `${p.name} sprint sync`,
        author: p.pm?.name || 'Pointfex Squad',
        timestamp: 'Up to date',
      },
      stars: 24,
      forks: 4,
      openIssues: 0,
    })

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      teamId: p.teamId || '',
      pmId: p.pm?.id || '',
      leadDevId: p.assignedDevs?.[0]?.id,
      repoId,
      description: p.description,
      status: p.status || 'in_progress',
      progress: p.progress ?? 0,
      health: p.health || 'on_track',
      startDate: isoDate(p.startDate),
      deadline: isoDate(p.deadline),
      totalWeeks: p.totalWeeks ?? 5,
      currentWeek: p.currentWeek ?? 3,
      budget: num(p.budget),
      allocatedBudget: num(p.allocatedBudget),
      clientRevenue: num(p.clientRevenue),
      client: p.client || undefined,
      priority: p.priority || 'Medium Priority',
      repositoryUrl: repoUrl,
      demoUrl: p.demoUrl || undefined,
      tags: p.tags || [],
      color: p.color || undefined,
      assignedDevIds: (p.assignedDevs || []).map((d: any) => d.id),
      milestones: projMilestones,
      srs: p.srsUrl
        ? {
            documentTitle: p.srsTitle || `${p.code}-SRS.pdf`,
            documentUrl: p.srsUrl,
            version: p.srsVersion || 'v1.0',
            lastUpdated: isoDate(p.srsLastUpdated, isoDate(p.updatedAt)),
            overview: p.srsOverview || p.description,
            requirementsCount: p.srsRequirementsCount ?? 0,
          }
        : undefined,
    }
  })

  // 4. Tasks & Comments
  const comments: TaskComment[] = []
  const tasks: Task[] = (bundle.tasks || []).map((t) => {
    for (const c of t.comments || []) {
      comments.push({
        id: c.id,
        taskId: t.id,
        authorId: c.authorId,
        content: c.content,
        createdAt: c.createdAt,
      })
    }
    return {
      id: t.id,
      title: t.title,
      description: t.description || '',
      projectId: t.projectId,
      assigneeId: t.assigneeId,
      assignedTo: t.assigneeId,
      creatorId: t.creatorId,
      status: t.status || 'todo',
      priority: t.priority || 'medium',
      dueDate: isoDate(t.dueDate),
      estimatedHours: num(t.estimatedHours, 8),
      loggedHours: num(t.loggedHours, 0),
      milestoneId: t.milestoneId || undefined,
      tags: t.tags || [],
      checklist: (t.checklist || []).map((item: any) => ({
        id: item.id,
        text: item.text,
        completed: Boolean(item.completed),
      })),
      createdAt: isoDate(t.createdAt),
    }
  })

  // 5. Wallets
  const wallets: Wallet[] = (bundle.wallets || []).map((w) => ({
    userId: w.employeeId,
    balance: num(w.balance),
    currency: w.currency || 'BDT',
    currencySymbol: w.currencySymbol || '৳',
    pendingEscrow: num(w.pendingEscrow),
    totalEarnedToDate: num(w.totalEarnedToDate),
    totalPenalties: num(w.totalPenalties),
    hourlyRateEquivalent: w.hourlyRateEquivalent ? num(w.hourlyRateEquivalent) : undefined,
    sprintBonusEarned: num(w.sprintBonusEarned),
    totalSpendings: num(w.totalSpendings),
    lastPayoutDate: isoDate(w.lastPayoutDate),
    nextScheduledPayout: isoDate(w.nextScheduledPayout),
  }))

  // 6. Transactions
  const transactions: Transaction[] = (bundle.transactions || []).map((tx) => ({
    id: tx.id,
    userId: tx.employeeId || tx.wallet?.employeeId || '',
    projectId: tx.projectId || undefined,
    milestoneId: tx.milestoneId || undefined,
    amount: num(tx.amount),
    type: tx.type,
    description: tx.description,
    date: isoDate(tx.createdAt),
    status: tx.status || 'completed',
    reason: tx.reason || undefined,
  }))

  // 7. Performance Records
  const performanceRecords: PerformanceRecord[] = (bundle.performance || []).map((p) => ({
    userId: p.employeeId,
    developerId: p.employeeId,
    overallScore: num(p.overallScore, 90),
    codeQuality: num(p.codeQuality ?? p.overallScore, 90),
    codeQualityScore: num(p.codeQuality ?? p.overallScore, 90),
    deliverySpeed: num(p.deliverySpeed, 90),
    reliability: num(p.reliability, 92),
    collaboration: num(p.collaboration, 94),
    attendanceRate: num(p.attendanceRate, 96),
    satisfactionIndex: num(p.satisfactionIndex, 4.7),
    performanceTier: p.performanceTier || 'strong_contributor',
    evaluationNotes: p.evaluationNotes || undefined,
    disciplinaryNotes: p.disciplinaryNotes || undefined,
    strengths: p.strengths || [],
    improvementAreas: p.improvements || [],
    improvements: p.improvements || [],
    weeklyHours: p.weeklyHours || [40, 40, 40, 40],
    lastEvaluationDate: isoDate(p.lastEvaluationDate),
  }))

  // 8. Reports + Budget Requests (merged into Report[] so CfoBudgetPage & PmReportsPage work identically)
  const standardReports: Report[] = (bundle.reports || []).map((r) => {
    const authorRole = r.author?.positionAssignments?.[0]?.position?.roleCategory || ''
    return {
      id: r.id,
      userId: r.authorId,
      teamId: r.teamId || undefined,
      projectId: r.projectId || undefined,
      type: r.type,
      category: r.category || undefined,
      title: r.title,
      description: r.description,
      date: isoDate(r.submittedAt),
      status: r.status || 'pending',
      submittedAt: r.submittedAt,
      createdAt: r.submittedAt,
      authorId: r.authorId,
      authorName: r.author?.name,
      authorRole: authorRole.toUpperCase(),
      targetUserId: r.targetUserId || undefined,
      targetUserName: r.targetUser?.name || undefined,
      docsUrl: r.docsUrl || undefined,
      feedback: r.feedback || undefined,
      complainTo: r.complainTo || undefined,
      recipient: r.recipient || undefined,
      forwardedTo: r.forwardedTo || undefined,
      forwardedBy: r.forwardedBy || undefined,
      forwardedAt: r.forwardedAt || undefined,
      pmEndorsement: r.pmEndorsement || undefined,
      isConfidential: Boolean(r.isConfidential || r.confidentialTo),
      confidentialTo: r.confidentialTo || undefined,
      mediationNotes: r.mediationNotes || undefined,
      resolvedAt: r.resolvedAt || undefined,
    }
  })

  const budgetReports: Report[] = (bundle.budgetRequests || []).map((br) => {
    const requester = users.find((u) => u.id === br.requesterId)
    const proj = projects.find((p) => p.id === br.projectId)
    const statusMap: Record<string, string> = {
      pending: 'under_review',
      approved: 'resolved',
      rejected: 'dismissed',
    }
    return {
      id: br.id,
      userId: br.requesterId,
      teamId: proj?.teamId,
      projectId: br.projectId,
      type: 'pm_report',
      category: 'Budget Request',
      recipient: 'Chief Financial Officer (CFO)',
      title: `Budget Increase Request: ${formatBDT(num(br.requestedAmount))} for ${br.project?.name || proj?.name || br.projectId}`,
      description: br.reason,
      date: isoDate(br.requestedAt),
      status: statusMap[br.status] || br.status,
      submittedAt: br.requestedAt,
      createdAt: br.requestedAt,
      authorId: br.requesterId,
      authorName: requester?.name || br.requesterId,
      authorRole: 'PM',
      feedback: br.feedback || undefined,
      resolvedAt: br.reviewedAt || undefined,
    }
  })

  const reports = [...budgetReports, ...standardReports]

  // 9. Audit Logs
  const activityLogs: ActivityLog[] = (bundle.auditLogs || []).map((a) => ({
    id: a.id,
    userId: a.actorId || 'system',
    action: a.action,
    actionCode: a.actionCode,
    severity: a.severity,
    actorName: a.actor?.name || a.actorName,
    actorEmail: a.actor?.email || a.actorEmail,
    actorRole: a.actorRole,
    entityType: a.entityType,
    entityId: a.entityId,
    entityTitle: a.entityTitle || undefined,
    description: a.description,
    timestamp: a.timestamp,
    category: a.category,
    badgeColor: a.badgeColor || undefined,
    payload: a.payload || undefined,
  }))

  // 10. Engineering
  const codeQualityGates: CodeQualityGate[] = (bundle.qualityGates || []).map((q) => ({
    projectId: q.projectId,
    complianceScore: q.complianceScore,
    testCoverage: q.testCoverage,
    techDebtHours: q.techDebtHours,
    codeSmellsCount: q.codeSmellsCount,
    bugsDetected: q.bugsDetected,
    vulnerabilitiesCount: q.vulnerabilitiesCount,
    lastAnalysis: isoDate(q.lastAnalysis),
    status: q.status,
  }))

  const securityAlerts: SecurityAlert[] = (bundle.securityAlerts || []).map((s) => ({
    id: s.id,
    projectId: s.projectId,
    title: s.title,
    severity: s.severity,
    category: s.category,
    status: s.status,
    detectedAt: s.detectedAt,
    resolvedAt: s.resolvedAt || undefined,
    assignedPmId: s.assignedPmId || undefined,
    cveOrPackage: s.cveOrPackage || undefined,
    description: s.description,
    recommendation: s.recommendation,
  }))

  const testingSuites: TestingSuite[] = (bundle.testRuns || []).map((t) => ({
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    totalTests: t.totalTests,
    passed: t.passed,
    failed: t.failed,
    skipped: t.skipped,
    duration: t.duration,
    coveragePercent: num(t.coveragePercent),
    lastRun: isoDate(t.lastRun),
    status: t.status,
  }))

  // 11. Consultancy
  const consultancyRequests: ConsultancyRequest[] = (bundle.consultancy || []).map((c) => ({
    id: c.id,
    title: c.title,
    requesterId: c.requesterId,
    teamId: c.teamId,
    projectId: c.projectId,
    category: c.category,
    description: c.description,
    urgency: c.urgency,
    status: c.status,
    assignedConsultantId: c.assignedConsultantId || undefined,
    assignedConsultantName: c.assignedConsultantName || undefined,
    estimatedHours: c.estimatedHours ? num(c.estimatedHours) : undefined,
    feeBDT: c.feeBDT ? num(c.feeBDT) : c.feeUSD ? num(c.feeUSD) : undefined,
    requestedAt: c.requestedAt,
    targetDate: c.targetDate ? isoDate(c.targetDate) : undefined,
    ctoNotes: c.ctoNotes || undefined,
    completedAt: c.completedAt || undefined,
  }))

  // 12. Announcements & Notifications
  const announcements: Announcement[] = (bundle.announcements || []).map((a) => {
    const author = users.find((u) => u.id === a.authorId)
    return {
      id: a.id,
      title: a.title,
      content: a.content,
      authorId: a.authorId,
      authorName: author?.name || a.authorId,
      category: a.category,
      priority: a.priority,
      date: isoDate(a.createdAt),
      read: false,
      pinned: Boolean(a.pinned),
    }
  })

  const notifications: Notification[] = (bundle.notifications || []).map((n) => ({
    id: n.id,
    userId: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    timestamp: isoDate(n.createdAt),
    createdAt: n.createdAt,
    read: Boolean(n.read),
    entityType: n.entityType || undefined,
    entityId: n.entityId || undefined,
  }))

  // 13. Treasury
  const treasury: CompanyTreasury = bundle.treasury
    ? {
        initialCapital: num(bundle.treasury.initialCapital),
        totalApprovedBudgets: num(bundle.treasury.totalApprovedBudgets),
        totalDistributedToDevs: num(bundle.treasury.totalDistributedToDevs),
        totalClientRevenue: num(bundle.treasury.totalClientRevenue),
        unallocatedReserves: num(bundle.treasury.unallocatedReserves),
      }
    : fallbackPrev?.treasury || {
        initialCapital: 0,
        totalApprovedBudgets: 0,
        totalDistributedToDevs: 0,
        totalClientRevenue: 0,
        unallocatedReserves: 0,
      }

  return {
    roles: JSON.parse(JSON.stringify(ROLE_LIST)),
    users,
    teams,
    projects,
    tasks,
    comments,
    attachments: fallbackPrev?.attachments || [],
    wallets,
    transactions,
    performanceRecords,
    reports,
    announcements,
    notifications,
    activityLogs,
    milestones,
    repositories,
    pullRequests: fallbackPrev?.pullRequests || [],
    codeQualityGates,
    securityAlerts,
    testingSuites,
    bugBounties: fallbackPrev?.bugBounties || [],
    consultancyRequests,
    treasury,
  }
}
