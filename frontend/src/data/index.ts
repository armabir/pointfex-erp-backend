import { ROLES, ROLE_LIST } from './roles'
import type {
  SeedData,
  DataResolvers,
  User,
  Project,
  Team,
  Milestone,
  Repository,
  Task,
  Wallet,
  PerformanceRecord,
  Transaction,
} from '../types'

export { ROLES, ROLE_LIST }

export function getInitialSeedData(): SeedData {
  return {
    roles: JSON.parse(JSON.stringify(ROLE_LIST)),
    users: [],
    teams: [],
    projects: [],
    tasks: [],
    comments: [],
    attachments: [],
    wallets: [],
    transactions: [],
    performanceRecords: [],
    reports: [],
    announcements: [],
    notifications: [],
    activityLogs: [],
    milestones: [],
    repositories: [],
    pullRequests: [],
    codeQualityGates: [],
    securityAlerts: [],
    testingSuites: [],
    bugBounties: [],
    consultancyRequests: [],
    treasury: {
      initialCapital: 0,
      totalApprovedBudgets: 0,
      totalDistributedToDevs: 0,
      totalClientRevenue: 0,
      unallocatedReserves: 0,
    },
  }
}

export const createDataResolvers = (data: SeedData): DataResolvers => {
  const getUser = (id: string): User | null => data.users.find((u) => u.id === id) || null
  const getProject = (id: string): Project | null => data.projects.find((p) => p.id === id) || null
  const getTeam = (id: string): Team | null => data.teams.find((t) => t.id === id) || null
  const getMilestone = (id: string): Milestone | null =>
    data.milestones.find((m) => m.id === id) || null
  const getRepo = (id: string): Repository | null =>
    data.repositories.find((r) => r.id === id) || null

  const getDeveloperTasks = (devId = ''): Task[] =>
    devId ? data.tasks.filter((task) => task.assigneeId === devId) : []

  const getDeveloperProjects = (devId = ''): Project[] => {
    const dev = devId ? getUser(devId) : null
    if (!dev) return []
    return data.projects.filter(
      (proj) => proj.teamId === dev.teamId || proj.assignedDevIds?.includes(devId),
    )
  }

  const getDeveloperWallet = (devId = ''): Wallet | null =>
    devId ? data.wallets.find((w) => w.userId === devId) || null : null

  const getDeveloperPerformance = (devId = ''): PerformanceRecord | null =>
    devId ? data.performanceRecords.find((p) => p.userId === devId) || null : null

  const getDeveloperTransactions = (devId = ''): Transaction[] =>
    devId ? data.transactions.filter((tx) => tx.userId === devId) : []

  return {
    getUser,
    getProject,
    getTeam,
    getMilestone,
    getRepo,
    getDeveloperTasks,
    getDeveloperProjects,
    getDeveloperWallet,
    getDeveloperPerformance,
    getDeveloperTransactions,
  }
}
