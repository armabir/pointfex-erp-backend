import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { getRelativeDeadline } from '../utils/formatters'
import type {
  User,
  Team,
  Wallet,
  Transaction,
  ActivityLog,
  Announcement,
  Report,
  EnrichedProject,
  EnrichedTask,
  PullRequest,
  CodeQualityGate,
  SecurityAlert,
  TestingSuite,
  BugBountyItem,
  ConsultancyRequest,
  Repository,
} from '../types'

export interface TeamWithDetails extends Team {
  pm?: User | null
  leadDev?: User | null
  members: User[]
  projects: EnrichedProject[]
  tasksCount: number
  completedTasksCount: number
  inProgressTasksCount: number
}

export interface CtoData {
  cto: User
  teams: TeamWithDetails[]
  projects: EnrichedProject[]
  tasks: EnrichedTask[]
  ctoPersonalTasks: EnrichedTask[]
  ctoEngineeringTasks: EnrichedTask[]
  repositories: Repository[]
  pullRequests: PullRequest[]
  codeQualityGates: CodeQualityGate[]
  securityAlerts: SecurityAlert[]
  testingSuites: TestingSuite[]
  bugBounties: BugBountyItem[]
  consultancyRequests: ConsultancyRequest[]
  incomingReports: Report[]
  ctoReports: Report[]
  allReports: Report[]
  auditLogs: ActivityLog[]
  ctoWallet: Wallet
  ctoTransactions: Transaction[]
  announcements: Announcement[]
  developers: User[]
  projectManagers: User[]
  companyStats: {
    totalTeams: number
    totalDevelopers: number
    totalPms: number
    totalProjects: number
    totalTasks: number
    activeTasks: number
    inReviewTasks: number
    completedTasks: number
    blockedTasks: number
    openPullRequests: number
    securityAlertsCount: number
    criticalSecurityAlertsCount: number
    pendingConsultancies: number
    averageQualityScore: number
    averageTestCoverage: number
    totalVelocity: number
  }
}

export function useCtoData(): CtoData {
  const { data, resolvers, currentUser } = useApp()

  // 1. CTO User
  const cto = useMemo<User>(() => {
    return (
      data.users.find((u) => u.role === 'cto') ||
      resolvers.getUser('user_cto_01') || {
        id: 'user_cto_01',
        name: 'Dr. Arthur Sterling',
        email: 'arthur.sterling@pointfex.internal',
        role: 'cto',
        title: 'Chief Technology Officer',
        initials: 'AS',
        status: 'online',
      }
    )
  }, [data.users, resolvers])

  // 2. All 24 Developers and 6 PMs
  const developers = useMemo(() => {
    return data.users.filter((u) => u.role === 'developer')
  }, [data.users])

  const projectManagers = useMemo(() => {
    return data.users.filter((u) => u.role === 'pm')
  }, [data.users])

  // 3. Enriched Projects (all 12 company projects)
  const projects = useMemo<EnrichedProject[]>(() => {
    return data.projects.map((proj) => {
      const repo = data.repositories.find((r) => r.projectId === proj.id) || null
      const pm = data.users.find((u) => u.id === proj.pmId) || null
      const projTasks = data.tasks.filter((t) => t.projectId === proj.id)
      const assignedDevs = (proj.assignedDevIds || [])
        .map((id) => resolvers.getUser(id))
        .filter((u): u is User => Boolean(u))

      return {
        ...proj,
        repo,
        pm,
        totalTasksCount: projTasks.length,
        tasksCount: projTasks.length,
        completedTasksCount: projTasks.filter((t) => t.status === 'completed').length,
        inReviewTasksCount: projTasks.filter((t) => t.status === 'in_review').length,
        assignedDevs,
      }
    })
  }, [data.projects, data.repositories, data.tasks, data.users, resolvers])

  // 4. Enriched Tasks across entire company
  const tasks = useMemo<EnrichedTask[]>(() => {
    return data.tasks.map((task) => {
      const project = data.projects.find((p) => p.id === task.projectId) || null
      const assignee = data.users.find((u) => u.id === task.assigneeId) || null
      const creator = data.users.find((u) => u.id === task.creatorId) || null
      const deadlineInfo = getRelativeDeadline(task.dueDate)

      return {
        ...task,
        projectName: project?.name,
        projectCode: project?.code,
        project,
        assignee,
        creator,
        deadlineInfo,
      }
    })
  }, [data.tasks, data.projects, data.users])

  // 5. Executive / CTO Personal Tasks (assigned by CEO or with assigneeId matching current user)
  const ctoPersonalTasks = useMemo(() => {
    const targetId = currentUser?.id || cto.id
    const ceoId = data.users.find((u) => u.role === 'ceo')?.id || 'emp_ceo_01'
    return tasks.filter(
      (t) =>
        t.assigneeId === targetId ||
        t.assignedTo === targetId ||
        (t.creatorId === ceoId && (t.assigneeId === targetId || t.assignedTo === targetId)),
    )
  }, [tasks, currentUser?.id, cto.id, data.users])

  // 6. CTO Engineering Tasks (created by CTO and assigned to PMs)
  const ctoEngineeringTasks = useMemo(() => {
    return tasks.filter((t) => t.creatorId === cto.id && t.assigneeId !== cto.id)
  }, [tasks, cto.id])

  // 7. Enriched Teams (all 6 squads)
  const teams = useMemo<TeamWithDetails[]>(() => {
    return data.teams.map((t) => {
      const pm = data.users.find((u) => u.id === t.pmId) || null
      const leadDev = t.leadDevId ? data.users.find((u) => u.id === t.leadDevId) || null : null
      const members = (t.memberIds || [])
        .map((id) => data.users.find((u) => u.id === id))
        .filter((u): u is User => Boolean(u))
      const teamProjects = projects.filter((p) => p.teamId === t.id)
      const teamTasks = tasks.filter((task) => members.some((m) => m.id === task.assigneeId))

      return {
        ...t,
        pm,
        leadDev,
        members,
        projects: teamProjects,
        tasksCount: teamTasks.length,
        completedTasksCount: teamTasks.filter((tk) => tk.status === 'completed').length,
        inProgressTasksCount: teamTasks.filter((tk) => tk.status === 'in_progress').length,
      }
    })
  }, [data.teams, data.users, projects, tasks])

  // 8. CTO Wallet & Financials
  const ctoWallet = useMemo<Wallet>(() => {
    return (
      data.wallets.find((w) => w.userId === cto.id) || {
        userId: cto.id,
        balance: 0,
        currency: 'BDT',
        pendingEscrow: 0,
        totalEarnedToDate: 0,
        totalPenalties: 0,
        totalSpendings: 0,
      }
    )
  }, [data.wallets, cto.id])

  const ctoTransactions = useMemo<Transaction[]>(() => {
    return data.transactions.filter((tx) => tx.userId === cto.id)
  }, [data.transactions, cto.id])

  // 9. Reports: Incoming (sent to CTO or category engineering) and Outgoing (sent by CTO)
  const incomingReports = useMemo<Report[]>(() => {
    return data.reports.filter(
      (r) =>
        r.recipient?.toLowerCase().includes('cto') ||
        r.recipient?.toLowerCase().includes('technology') ||
        r.forwardedTo?.toLowerCase().includes('cto') ||
        r.type === 'project_submission',
    )
  }, [data.reports])

  const ctoReports = useMemo<Report[]>(() => {
    return data.reports.filter((r) => r.userId === cto.id || r.type === 'cto_report')
  }, [data.reports, cto.id])

  // 10. Audit Logs
  const auditLogs = useMemo<ActivityLog[]>(() => {
    return [...data.activityLogs].sort((a, b) => {
      const ta =
        a.timestamp === 'Just now' ? Number.MAX_SAFE_INTEGER : new Date(a.timestamp).getTime()
      const tb =
        b.timestamp === 'Just now' ? Number.MAX_SAFE_INTEGER : new Date(b.timestamp).getTime()
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
    })
  }, [data.activityLogs])

  // 11. Company-wide Engineering Statistics
  const companyStats = useMemo(() => {
    const totalTasks = tasks.length
    const activeTasks = tasks.filter(
      (t) => t.status === 'in_progress' || t.status === 'todo',
    ).length
    const inReviewTasks = tasks.filter((t) => t.status === 'in_review').length
    const completedTasks = tasks.filter((t) => t.status === 'completed').length
    const blockedTasks = tasks.filter((t) => t.status === 'blocked').length
    const openPRs = data.pullRequests.filter(
      (pr) => pr.status === 'open' || pr.status === 'in_review',
    ).length
    const securityAlerts = data.securityAlerts.filter((s) => s.status !== 'resolved')
    const criticalSecurity = securityAlerts.filter((s) => s.severity === 'critical')
    const pendingConsultancies = data.consultancyRequests.filter(
      (c) => c.status === 'submitted' || c.status === 'under_review' || c.status === 'assigned',
    ).length

    const avgQuality =
      data.codeQualityGates.length > 0
        ? Math.round(
            data.codeQualityGates.reduce((sum, g) => sum + g.complianceScore, 0) /
              data.codeQualityGates.length,
          )
        : 95

    const avgCoverage =
      data.codeQualityGates.length > 0
        ? Math.round(
            data.codeQualityGates.reduce((sum, g) => sum + g.testCoverage, 0) /
              data.codeQualityGates.length,
          )
        : 88

    const totalVelocity = teams.reduce((sum, t) => sum + (t.weeklyVelocity || 40), 0)

    return {
      totalTeams: teams.length,
      totalDevelopers: developers.length,
      totalPms: projectManagers.length,
      totalProjects: projects.length,
      totalTasks,
      activeTasks,
      inReviewTasks,
      completedTasks,
      blockedTasks,
      openPullRequests: openPRs,
      securityAlertsCount: securityAlerts.length,
      criticalSecurityAlertsCount: criticalSecurity.length,
      pendingConsultancies,
      averageQualityScore: avgQuality,
      averageTestCoverage: avgCoverage,
      totalVelocity,
    }
  }, [
    tasks,
    data.pullRequests,
    data.securityAlerts,
    data.consultancyRequests,
    data.codeQualityGates,
    teams,
    developers.length,
    projectManagers.length,
    projects.length,
  ])

  return {
    cto,
    teams,
    projects,
    tasks,
    ctoPersonalTasks,
    ctoEngineeringTasks,
    repositories: data.repositories,
    pullRequests: data.pullRequests,
    codeQualityGates: data.codeQualityGates,
    securityAlerts: data.securityAlerts,
    testingSuites: data.testingSuites,
    bugBounties: data.bugBounties,
    consultancyRequests: data.consultancyRequests,
    incomingReports,
    ctoReports,
    allReports: data.reports,
    auditLogs,
    ctoWallet,
    ctoTransactions,
    announcements: data.announcements,
    developers,
    projectManagers,
    companyStats,
  }
}
