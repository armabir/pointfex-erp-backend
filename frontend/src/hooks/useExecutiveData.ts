import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { getRelativeDeadline } from '../utils/formatters'
import type {
  User,
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
  CompanyTreasury,
  PerformanceRecord,
} from '../types'
import type { TeamWithDetails } from './useCtoData'

export interface ProjectBudgetOverview {
  project: EnrichedProject
  approvedBudget: number
  distributedToDevs: number
  remainingBudget: number
  utilizationRate: number
  health: 'healthy' | 'warning' | 'critical'
  clientRevenue: number
  revenueShareCompany: number
  revenueShareSquad: number
  revenueShareReserve: number
}

export interface ExecutiveData {
  role: string
  currentExecutive: User
  executiveWallet: Wallet
  executiveTransactions: Transaction[]
  executiveTasks: EnrichedTask[]
  assignedDirectives: EnrichedTask[]

  // Company Overview
  teams: TeamWithDetails[]
  projects: EnrichedProject[]
  tasks: EnrichedTask[]
  developers: User[]
  projectManagers: User[]
  allUsers: User[]

  // CFO & Financial Domain
  treasury: CompanyTreasury
  projectBudgets: ProjectBudgetOverview[]
  pendingBudgetRequests: Report[]
  financialTransactions: Transaction[]

  // CHRO & People Domain
  performanceRecords: PerformanceRecord[]
  confidentialComplaints: Report[]
  generalComplaints: Report[]
  projectIdeas: Report[]
  hrStats: {
    avgPerformanceScore: number
    avgAttendanceRate: number
    avgSatisfactionIndex: number
    onTimeDeliveryRate: number
    topPerformersCount: number
    needsSupportCount: number
    activeGrievancesCount: number
  }

  // CTO Engineering Domain
  repositories: Repository[]
  pullRequests: PullRequest[]
  codeQualityGates: CodeQualityGate[]
  securityAlerts: SecurityAlert[]
  testingSuites: TestingSuite[]
  bugBounties: BugBountyItem[]
  consultancyRequests: ConsultancyRequest[]

  // Governance & Logs
  auditLogs: ActivityLog[]
  allReports: Report[]
  announcements: Announcement[]

  // High-Level Executive Scorecard
  executiveStats: {
    treasuryBalance: number
    totalCapital: number
    totalApprovedBudgets: number
    totalDistributed: number
    clientRevenue: number
    headcount: number
    activeProjects: number
    avgQualityScore: number
    activeAlerts: number
    pendingDecisionsCount: number
  }
}

export function useExecutiveData(): ExecutiveData {
  const { data, currentRole, currentUser, resolvers } = useApp()

  return useMemo(() => {
    // 1. Current Executive User
    const execUser: User = currentUser || {
      id: 'user_ceo_01',
      name: 'Victoria Sterling-Fox',
      email: 'victoria.fox@pointfex.internal',
      role: currentRole || 'ceo',
      title: 'Chief Executive Officer',
      initials: 'VF',
      status: 'online',
    }

    // 2. Executive Wallet & Personal Transactions
    const executiveWallet: Wallet = resolvers.getDeveloperWallet(execUser.id) || {
      userId: execUser.id,
      balance: 15000,
      currency: 'BDT',
      currencySymbol: '৳',
      pendingEscrow: 2500,
      totalEarnedToDate: 45000,
    }
    const executiveTransactions = data.transactions.filter((tx) => tx.userId === execUser.id)

    // 3. User lists
    const developers = data.users.filter((u) => u.role === 'developer')
    const projectManagers = data.users.filter((u) => u.role === 'pm')
    const allUsers = data.users

    // 4. Projects with rich details
    const projects: EnrichedProject[] = data.projects.map((proj) => {
      const repo = proj.repoId ? resolvers.getRepo(proj.repoId) : null
      const pm = resolvers.getUser(proj.pmId)
      const projTasks = data.tasks.filter((t) => t.projectId === proj.id)
      const completedTasks = projTasks.filter((t) => t.status === 'completed')
      const inReviewTasks = projTasks.filter((t) => t.status === 'in_review')
      const assignedDevs = (proj.assignedDevIds || [])
        .map((id) => resolvers.getUser(id))
        .filter(Boolean) as User[]

      return {
        ...proj,
        repo,
        pm,
        tasksCount: projTasks.length,
        totalTasksCount: projTasks.length,
        completedTasksCount: completedTasks.length,
        inReviewTasksCount: inReviewTasks.length,
        assignedDevs,
      }
    })

    // 5. Teams with details
    const teams: TeamWithDetails[] = data.teams.map((team) => {
      const pm = resolvers.getUser(team.pmId)
      const leadDev = team.leadDevId ? resolvers.getUser(team.leadDevId) : null
      const members = team.memberIds.map((id) => resolvers.getUser(id)).filter(Boolean) as User[]
      const teamProjects = projects.filter(
        (p) => p.teamId === team.id || team.projectIds?.includes(p.id),
      )
      const teamTasks = data.tasks.filter((t) => team.memberIds.includes(t.assigneeId))
      const completedTasks = teamTasks.filter((t) => t.status === 'completed')
      const inProgressTasks = teamTasks.filter((t) => t.status === 'in_progress')

      return {
        ...team,
        pm,
        leadDev,
        members,
        projects: teamProjects,
        tasksCount: teamTasks.length,
        completedTasksCount: completedTasks.length,
        inProgressTasksCount: inProgressTasks.length,
      }
    })

    // 6. Enriched Tasks
    const tasks: EnrichedTask[] = data.tasks.map((task) => {
      const deadlineInfo = getRelativeDeadline(task.dueDate)
      const project = resolvers.getProject(task.projectId)
      const assignee = resolvers.getUser(task.assigneeId)
      const creator = resolvers.getUser(task.creatorId)

      return {
        ...task,
        deadlineInfo,
        project,
        projectName: project?.name,
        projectCode: project?.code,
        assignee,
        creator,
      }
    })

    // Tasks assigned to current executive
    const executiveTasks = tasks.filter(
      (t) =>
        t.assigneeId === execUser.id ||
        t.tags?.includes('Executive') ||
        t.tags?.includes('Strategy'),
    )

    // Technical / Strategic directives assigned to PMs
    const assignedDirectives = tasks.filter((t) =>
      projectManagers.some((pm) => pm.id === t.assigneeId),
    )

    // 7. CFO & Budget Calculations
    const treasury: CompanyTreasury = data.treasury || {
      initialCapital: 500000,
      totalApprovedBudgets: projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0),
      totalDistributedToDevs: data.transactions
        .filter((tx) => tx.type === 'budget_allocation')
        .reduce((sum, tx) => sum + tx.amount, 0),
      totalClientRevenue: 740000,
      unallocatedReserves: 120000,
    }

    const projectBudgets: ProjectBudgetOverview[] = projects.map((proj) => {
      const approvedBudget = Number(proj.budget) || 0
      // Sum actual distributed budget from transactions
      const distributed =
        data.transactions
          .filter((tx) => tx.projectId === proj.id && tx.type === 'budget_allocation')
          .reduce((sum, tx) => sum + tx.amount, 0) || Math.round(approvedBudget * 0.68)

      const remainingBudget = Math.max(0, approvedBudget - distributed)
      const utilizationRate =
        approvedBudget > 0 ? Math.round((distributed / approvedBudget) * 100) : 0
      const health: 'healthy' | 'warning' | 'critical' =
        utilizationRate >= 95 ? 'critical' : utilizationRate >= 80 ? 'warning' : 'healthy'

      const clientRevenue = proj.clientRevenue || approvedBudget * 1.6
      const revenueShareCompany = Math.round(clientRevenue * 0.3)
      const revenueShareSquad = Math.round(clientRevenue * 0.4)
      const revenueShareReserve = Math.round(clientRevenue * 0.3)

      return {
        project: proj,
        approvedBudget,
        distributedToDevs: distributed,
        remainingBudget,
        utilizationRate,
        health,
        clientRevenue,
        revenueShareCompany,
        revenueShareSquad,
        revenueShareReserve,
      }
    })

    const pendingBudgetRequests = data.reports.filter(
      (r) =>
        r.type === 'pm_report' &&
        r.category?.toLowerCase().includes('budget') &&
        r.status !== 'resolved' &&
        r.status !== 'dismissed',
    )

    const financialTransactions = data.transactions.filter(
      (t) =>
        t.type === 'budget_allocation' ||
        t.type === 'payout' ||
        t.type === 'milestone_payout' ||
        t.type === 'client_revenue_share' ||
        t.type === 'penalty' ||
        t.type === 'deduction' ||
        t.type === 'bonus',
    )

    // 8. CHRO & Performance Calculations
    const performanceRecords = data.performanceRecords
    const count = performanceRecords.length
    const avgPerformanceScore = count
      ? Math.round(
          performanceRecords.reduce((acc, p) => acc + (p.overallScore ?? 0), 0) / count,
        )
      : 0
    const avgAttendanceRate = count
      ? Math.round(
          performanceRecords.reduce((acc, p) => acc + (p.attendanceRate ?? 0), 0) / count,
        )
      : 0
    const avgSatisfactionIndex = count
      ? Number(
          (
            performanceRecords.reduce((acc, p) => acc + (p.satisfactionIndex ?? 0), 0) / count
          ).toFixed(1),
        )
      : 0
    const onTimeDeliveryRate = count
      ? Math.round(
          performanceRecords.reduce((acc, p) => acc + (p.onTimeDeliveryRate ?? 0), 0) / count,
        )
      : 0
    const topPerformersCount = performanceRecords.filter((p) => p.overallScore >= 93).length
    const needsSupportCount = performanceRecords.filter(
      (p) => (p.overallScore && p.overallScore < 88) || p.performanceTier === 'needs_support',
    ).length

    // Confidential Complaints: accessible only to CHRO (cpo/chro) and CEO
    const confidentialComplaints = data.reports.filter(
      (r) =>
        r.type === 'complaint' &&
        (r.isConfidential || r.complainTo?.includes('CHRO') || r.complainTo?.includes('CPO')),
    )

    const generalComplaints = data.reports.filter(
      (r) => r.type === 'complaint' && !r.isConfidential,
    )

    const projectIdeas = data.reports.filter((r) => r.type === 'project_submission')

    const activeGrievancesCount = data.reports.filter(
      (r) => r.type === 'complaint' && r.status !== 'resolved',
    ).length

    // 9. CTO Engineering Domain
    const repositories = data.repositories
    const pullRequests = data.pullRequests
    const codeQualityGates = data.codeQualityGates
    const securityAlerts = data.securityAlerts
    const testingSuites = data.testingSuites
    const bugBounties = data.bugBounties
    const consultancyRequests = data.consultancyRequests
    const avgQualityScore = Math.round(
      codeQualityGates.reduce((acc, g) => acc + g.complianceScore, 0) /
        (codeQualityGates.length || 1),
    )

    // 10. Executive High-Level Stats
    const pendingDecisionsCount =
      pendingBudgetRequests.filter((r) => r.status === 'under_review' || r.status === 'pending')
        .length +
      data.reports.filter((r) => r.status === 'pending' || r.status === 'forwarded_to_c_level')
        .length +
      pullRequests.filter((pr) => pr.status === 'in_review').length

    return {
      role: currentRole,
      currentExecutive: execUser,
      executiveWallet,
      executiveTransactions,
      executiveTasks,
      assignedDirectives,

      teams,
      projects,
      tasks,
      developers,
      projectManagers,
      allUsers,

      treasury,
      projectBudgets,
      pendingBudgetRequests,
      financialTransactions,

      performanceRecords,
      confidentialComplaints,
      generalComplaints,
      projectIdeas,
      hrStats: {
        avgPerformanceScore,
        avgAttendanceRate,
        avgSatisfactionIndex,
        onTimeDeliveryRate,
        topPerformersCount,
        needsSupportCount,
        activeGrievancesCount,
      },

      repositories,
      pullRequests,
      codeQualityGates,
      securityAlerts,
      testingSuites,
      bugBounties,
      consultancyRequests,

      auditLogs: data.activityLogs,
      allReports: data.reports,
      announcements: data.announcements,

      executiveStats: {
        treasuryBalance: treasury.unallocatedReserves,
        totalCapital: treasury.initialCapital,
        totalApprovedBudgets: treasury.totalApprovedBudgets,
        totalDistributed: treasury.totalDistributedToDevs,
        clientRevenue: treasury.totalClientRevenue,
        headcount: allUsers.length,
        activeProjects: projects.length,
        avgQualityScore,
        activeAlerts: securityAlerts.filter((a) => a.status !== 'resolved').length,
        pendingDecisionsCount,
      },
    }
  }, [data, currentRole, currentUser, resolvers])
}
