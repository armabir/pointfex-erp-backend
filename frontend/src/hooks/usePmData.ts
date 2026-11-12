import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { getRelativeDeadline } from '../utils/formatters'
import type { createDataResolvers } from '../data'
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
  DeveloperWorkload,
} from '../types'

export interface PmData {
  pm: User
  team: Team
  teamMembers: User[]
  teamProjects: EnrichedProject[]
  teamTasks: EnrichedTask[]
  pmPersonalTasks: EnrichedTask[]
  pendingReviewTasks: EnrichedTask[]
  developerWorkloads: DeveloperWorkload[]
  resolvers: ReturnType<typeof createDataResolvers>
  financials: {
    totalApprovedBudget: number
    totalAllocated: number
    totalReleased: number
    remainingBudget: number
    pendingEscrow: number
    teamTransactions: Transaction[]
  }
  stats: {
    totalTasks: number
    todoTasks: number
    inProgressTasks: number
    inReviewTasks: number
    completedTasks: number
    blockedTasks: number
    memberCount: number
    projectCount: number
    completionRate: number
  }
  teamPerformance: {
    overallScore: number
    completionRate: number
    onTimeDeliveryRate: number
    teamVelocity: number
    qualityScore: number
  }
  pmWallet: Wallet
  pmTransactions: Transaction[]
  pmReports: Report[]
  recentActivities: ActivityLog[]
  announcements: Announcement[]
}

export function usePmData(): PmData {
  const { data, currentPmId, resolvers } = useApp()

  return useMemo(() => {
    // 1. Current PM User
    const pm: User =
      resolvers.getUser(currentPmId) || data.users.find((u) => u.role === 'pm') || data.users[0]

    // 2. PM's Squad / Team
    const team: Team =
      data.teams.find((t) => t.pmId === pm.id || t.id === pm.teamId) || data.teams[0]

    // 3. Squad Developers (4 Members)
    const teamMembers: User[] = team
      ? (team.memberIds.map((devId) => resolvers.getUser(devId)).filter(Boolean) as User[])
      : []

    // 4. Team Projects (2 Projects per team)
    const teamProjects: EnrichedProject[] = data.projects
      .filter((proj) => proj.teamId === team?.id || proj.pmId === pm.id)
      .map((proj) => {
        const repo = proj.repoId ? resolvers.getRepo(proj.repoId) : null
        const projTasks = data.tasks.filter((t) => t.projectId === proj.id)
        const completedTasks = projTasks.filter((t) => t.status === 'completed')
        const inReviewTasks = projTasks.filter((t) => t.status === 'in_review')
        const assignedDevs = (proj.assignedDevIds || [])
          .map((id) => resolvers.getUser(id))
          .filter(Boolean) as User[]

        return {
          ...proj,
          repo,
          tasksCount: projTasks.length,
          completedTasksCount: completedTasks.length,
          inReviewTasksCount: inReviewTasks.length,
          assignedDevs,
        }
      })

    // 5. Team Tasks (all tasks assigned to team members or team projects)
    const teamProjectIds = teamProjects.map((p) => p.id)
    const teamMemberIds = teamMembers.map((m) => m.id)

    const teamTasks: EnrichedTask[] = data.tasks
      .filter((t) => teamProjectIds.includes(t.projectId) || teamMemberIds.includes(t.assigneeId))
      .map((task) => {
        const assignee = resolvers.getUser(task.assigneeId)
        const project = resolvers.getProject(task.projectId)
        const deadlineInfo = getRelativeDeadline(task.dueDate)
        return {
          ...task,
          assignee,
          project,
          deadlineInfo,
        }
      })

    // 6. PM Personal Tasks (Tasks assigned directly to PM by CTO/CFO/CPO/CEO)
    const pmPersonalTasks: EnrichedTask[] = data.tasks
      .filter((t) => t.assigneeId === pm.id)
      .map((task) => {
        const creator = resolvers.getUser(task.creatorId)
        const project = resolvers.getProject(task.projectId)
        const deadlineInfo = getRelativeDeadline(task.dueDate)
        return {
          ...task,
          creator,
          project,
          deadlineInfo,
        }
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    // 7. Tasks Pending PM Review & Approval
    const pendingReviewTasks = teamTasks.filter((t) => t.status === 'in_review')

    // 8. Task Distribution Stats
    const todoTasks = teamTasks.filter((t) => t.status === 'todo')
    const inProgressTasks = teamTasks.filter((t) => t.status === 'in_progress')
    const completedTasks = teamTasks.filter((t) => t.status === 'completed')
    const blockedTasks = teamTasks.filter((t) => t.status === 'blocked')

    // 9. Financial Summary for PM's Projects
    const totalApprovedBudget = teamProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0)

    // Developer allocations (from transactions with type 'budget_allocation' or estimated sprint share)
    const teamTransactions = data.transactions.filter(
      (tx) =>
        (tx.projectId && teamProjectIds.includes(tx.projectId)) ||
        teamMemberIds.includes(tx.userId),
    )

    const totalReleased = teamTransactions
      .filter((tx) => tx.amount > 0 && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0)

    const txAllocated = teamTransactions
      .filter((tx) => tx.type === 'budget_allocation')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    const projectAllocated = teamProjects.reduce((sum, p) => sum + (p.allocatedBudget || 0), 0)
    const totalAllocated = Math.max(txAllocated, projectAllocated)
    const remainingBudget = Math.max(0, totalApprovedBudget - totalAllocated)
    const pendingEscrow = teamTransactions
      .filter((tx) => tx.type === 'escrow_hold' || tx.status === 'pending')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

    // 10. PM Personal Wallet & Transactions
    const pmWallet: Wallet = resolvers.getDeveloperWallet(pm.id) || {
      userId: pm.id,
      balance: 0,
      currency: 'BDT',
      currencySymbol: '৳',
      pendingEscrow: 0,
      totalEarnedToDate: 0,
      totalPenalties: 0,
      totalSpendings: 0,
      sprintBonusEarned: 0,
    }

    const pmTransactions = data.transactions.filter((tx) => tx.userId === pm.id)

    // 11. Developer Workload & Individual Performance
    const developerWorkloads: DeveloperWorkload[] = teamMembers.map((member) => {
      const devTasks = teamTasks.filter((t) => t.assigneeId === member.id)
      const devCompleted = devTasks.filter((t) => t.status === 'completed').length
      const devActive = devTasks.filter(
        (t) => t.status === 'in_progress' || t.status === 'in_review',
      ).length
      const devTodo = devTasks.filter((t) => t.status === 'todo').length
      const devBlocked = devTasks.filter((t) => t.status === 'blocked').length
      const devPerf = resolvers.getDeveloperPerformance(member.id) || {
        userId: member.id,
        overallScore: 92,
        onTimeDeliveryRate: 94,
        completionRate: 88,
        recentRewards: [],
      }

      return {
        ...member,
        totalTasks: devTasks.length,
        activeTasks: devActive,
        completedTasks: devCompleted,
        todoTasks: devTodo,
        blockedTasks: devBlocked,
        tasks: devTasks,
        performance: devPerf,
        isOverloaded: devActive >= 3,
      }
    })

    // 12. Team Aggregate Performance
    const totalTeamTasks = teamTasks.length || 1
    const completionRate = Math.round((completedTasks.length / totalTeamTasks) * 100)
    const onTimeDeliveryRate = 96
    const teamVelocity = team?.weeklyVelocity || 42

    // 13. PM Reports (Submitted to C-Level)
    const pmReports = data.reports.filter(
      (r) => r.type === 'pm_report' && (r.userId === pm.id || r.teamId === team?.id),
    )

    // 14. Activity Logs (Team filtered)
    const recentActivities = data.activityLogs.slice(0, 8)

    return {
      pm,
      team,
      teamMembers,
      teamProjects,
      teamTasks,
      pmPersonalTasks,
      pendingReviewTasks,
      developerWorkloads,
      financials: {
        totalApprovedBudget,
        totalAllocated,
        totalReleased,
        remainingBudget,
        pendingEscrow,
        teamTransactions,
      },
      stats: {
        totalTasks: teamTasks.length,
        todoTasks: todoTasks.length,
        inProgressTasks: inProgressTasks.length,
        inReviewTasks: pendingReviewTasks.length,
        completedTasks: completedTasks.length,
        blockedTasks: blockedTasks.length,
        memberCount: teamMembers.length,
        projectCount: teamProjects.length,
        completionRate,
      },
      teamPerformance: {
        overallScore: 95,
        completionRate,
        onTimeDeliveryRate,
        teamVelocity,
        qualityScore: 94,
      },
      pmWallet,
      pmTransactions,
      pmReports,
      recentActivities,
      announcements: data.announcements,
      resolvers,
    }
  }, [data, currentPmId, resolvers])
}

export default usePmData
