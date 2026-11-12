import type { ComponentType } from 'react'

// --- ROLES ---
export type RoleId = 'developer' | 'pm' | 'cto' | 'cpo' | 'cfo' | 'ceo' | string
export type UserRole = RoleId

export interface Role {
  id: RoleId
  name: string
  badge: string
  description: string
  isImplemented: boolean
}

// --- USERS ---
export type UserStatus = 'online' | 'offline' | 'away'

export interface User {
  id: string
  name: string
  email: string
  role: RoleId
  title: string
  teamId?: string
  avatar?: string
  avatarUrl?: string
  initials: string
  status: UserStatus
  isSuspended?: boolean
  mfaEnabled?: boolean
  inviteDeliveryStatus?: string
  inviteTokenExpiresAt?: string | null
  inviteTokenUsedAt?: string | null
  activeRoleSlugs?: string[]
  activeRoleNames?: string[]
  pendingAccessRequest?: {
    id: string
    requestedRoleId: string
    requestedRoleSlug: string
    requestedRoleName: string
    requesterId: string
    requesterName: string
    reason?: string | null
    createdAt: string
  } | null
  skills?: string[]
  timezone?: string
  github?: string
  joinedSprint?: string
  bio?: string
  phone?: string
  location?: string
}

// --- TEAMS ---
export interface Team {
  id: string
  name: string
  code: string
  focus?: string
  pmId: string
  leadDevId?: string
  memberIds: string[]
  projectIds?: string[]
  color?: string
  currentSprintWeek?: number
  totalSprintWeeks?: number
  health?: 'on_track' | 'needs_attention' | 'delayed' | string
  weeklyVelocity?: number
}

// --- PROJECTS ---
export interface ProjectMilestone {
  id: string
  title: string
  dueDate: string
  status: 'completed' | 'in_progress' | 'pending' | string
}

export interface ProjectSRS {
  documentTitle: string
  documentUrl: string
  version: string
  lastUpdated: string
  overview: string
  requirementsCount: number
  approvedBy?: string
}

export interface Project {
  id: string
  name: string
  code: string
  teamId: string
  pmId: string
  leadDevId?: string
  repoId?: string
  description: string
  status: 'in_progress' | 'planning' | 'completed' | 'on_hold' | string
  progress: number
  health: 'on_track' | 'needs_attention' | 'at_risk' | 'delayed' | string
  startDate: string
  deadline: string
  totalWeeks: number
  currentWeek: number
  budget: number
  allocatedBudget?: number
  clientRevenue?: number
  client?: string
  priority?: string
  repositoryUrl?: string
  demoUrl?: string
  tags: string[]
  color?: string
  assignedDevIds: string[]
  milestones?: ProjectMilestone[]
  srs?: ProjectSRS
}

// --- TASKS ---
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'blocked'
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

export interface TaskChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  projectId: string
  assigneeId: string
  assignedTo?: string
  creatorId: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string
  estimatedHours: number
  loggedHours: number
  milestoneId?: string
  tags: string[]
  checklist?: TaskChecklistItem[]
  createdAt: string
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  content: string
  createdAt: string
}

export interface TaskAttachment {
  id: string
  taskId: string
  name: string
  size: string
  type: string
  uploadedById: string
  uploadedAt: string
}

// --- WALLETS & TRANSACTIONS ---
export interface Wallet {
  userId: string
  balance: number
  currency: string
  currencySymbol?: string
  pendingEscrow: number
  totalEarnedToDate: number
  totalPenalties?: number
  hourlyRateEquivalent?: number
  sprintBonusEarned?: number
  lastPayoutDate?: string
  nextScheduledPayout?: string
  totalSpendings?: number
}

export type TransactionType =
  | 'milestone_payout'
  | 'penalty'
  | 'bonus'
  | 'advance_disbursement'
  | 'budget_allocation'
  | 'escrow_hold'
  | 'payout'
  | string

export interface Transaction {
  id: string
  userId: string
  projectId?: string
  milestoneId?: string
  amount: number
  type: TransactionType
  description: string
  date: string
  status: 'completed' | 'deducted' | 'pending' | 'allocated' | string
  reason?: string
}

// --- PERFORMANCE ---
export interface PerformanceReward {
  id: string
  title: string
  description: string
  date: string
  icon: string
  bonusValue?: string
  points?: number | string
}

export interface PerformanceRecord {
  userId: string
  developerId?: string
  overallScore: number
  completionRate?: number
  onTimeDeliveryRate?: number
  codeQualityScore?: number
  codeQuality?: number
  deliverySpeed?: number
  reliability?: number
  collaboration?: number
  peerReviewScore?: number
  velocityPointsSprint3?: number
  targetVelocityPoints?: number
  sprintWeek?: number
  recentRewards?: PerformanceReward[]
  strengths?: string[]
  improvementAreas?: string[]
  improvements?: string[]
  weeklyHours?: number[]
  attendanceRate?: number
  satisfactionIndex?: number
  performanceTier?: 'top_performer' | 'strong_contributor' | 'needs_support' | string
  evaluationNotes?: string
  disciplinaryNotes?: string
  lastEvaluationDate?: string
}

// --- REPORTS & SUBMISSIONS ---
export type ReportType = 'project_submission' | 'complaint' | 'pm_report' | string
export type ReportStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'under_investigation'
  | 'resolved'
  | 'forwarded_to_c_level'
  | string

export interface Report {
  id: string
  userId: string
  teamId?: string
  type: ReportType
  title: string
  description: string
  date: string
  status: ReportStatus
  submittedAt: string
  createdAt?: string
  authorId?: string
  authorName?: string
  authorRole?: string
  targetUserId?: string
  targetUserName?: string
  docsUrl?: string
  feedback?: string
  complainTo?: string
  category?: string
  recipient?: string
  projectId?: string
  forwardedTo?: string
  forwardedBy?: string
  forwardedAt?: string
  pmEndorsement?: string
  isConfidential?: boolean
  confidentialTo?: string
  mediationNotes?: string
  author?: User
  resolvedAt?: string
}

// --- ANNOUNCEMENTS & NOTIFICATIONS ---
export interface Announcement {
  id: string
  title: string
  content: string
  authorId: string
  authorName?: string
  category: 'pm' | 'company' | 'critical' | string
  priority: 'urgent' | 'normal' | 'low' | string
  date: string
  read: boolean
  pinned?: boolean
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: 'comment' | 'pr' | 'financial' | 'deadline' | 'milestone' | string
  timestamp: string
  createdAt: string
  read: boolean
  entityType?: 'task' | 'wallet' | 'milestone' | 'project' | string
  entityId?: string
}

// --- ACTIVITY LOGS ---
export interface ActivityLog {
  id: string
  userId: string
  action: string
  entityType: string
  entityId: string
  entityTitle?: string
  description: string
  timestamp: string
  category:
    | 'task'
    | 'comment'
    | 'git'
    | 'financial'
    | 'milestone'
    | 'security'
    | 'user'
    | 'project'
    | string
  badgeColor?: string
  actorName?: string
  actorEmail?: string
  actorRole?: string
  actionCode?: string
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS' | string
  payload?: Record<string, any>
}

// --- MILESTONES & REPOSITORIES ---
export interface Milestone {
  id: string
  projectId: string
  sprintWeek?: number
  title: string
  dueDate: string
  status: 'completed' | 'active' | 'pending' | string
  progress: number
  deliverablesCount?: number
  payoutAmount?: number
}

export interface CommitInfo {
  hash: string
  message: string
  author: string
  timestamp: string
  date?: string
}

export interface Repository {
  id: string
  projectId: string
  name: string
  url: string
  defaultBranch: string
  activeBranch?: string
  openPRsCount: number
  lastCommit: CommitInfo
  stars: number
  forks: number
  openIssues: number
}

// --- CTO SPECIFIC TYPES: PULL REQUESTS, SECURITY, TESTING, CONSULTANCY ---
export interface PullRequest {
  id: string
  projectId: string
  repoId: string
  title: string
  authorId: string
  reviewerId?: string
  branch: string
  baseBranch: string
  status: 'open' | 'in_review' | 'approved' | 'merged' | 'changes_requested'
  additions: number
  deletions: number
  changedFiles: number
  createdAt: string
  reviewCommentsCount: number
  qualityScore?: number
  description: string
}

export interface CodeQualityGate {
  projectId: string
  complianceScore: number
  testCoverage: number
  techDebtHours: number
  codeSmellsCount: number
  bugsDetected: number
  vulnerabilitiesCount: number
  lastAnalysis: string
  status: 'passed' | 'warning' | 'failed'
}

export interface SecurityAlert {
  id: string
  projectId: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'dependency' | 'auth' | 'injection' | 'encryption' | 'infrastructure'
  status: 'open' | 'investigating' | 'patch_in_progress' | 'resolved'
  detectedAt: string
  resolvedAt?: string
  assignedPmId?: string
  cveOrPackage?: string
  description: string
  recommendation: string
}

export interface TestingSuite {
  id: string
  projectId: string
  name: string
  totalTests: number
  passed: number
  failed: number
  skipped: number
  duration: string
  coveragePercent: number
  lastRun: string
  status: 'passed' | 'failed' | 'warning'
}

export interface BugBountyItem {
  id: string
  title: string
  projectId: string
  reporterName: string
  reporterType: 'internal_qa' | 'external_researcher' | 'developer'
  severity: 'critical' | 'high' | 'medium' | 'low'
  bountyAmount: number
  status: 'reported' | 'triaged' | 'rewarded' | 'rejected'
  submittedAt: string
  description: string
}

export interface ConsultancyRequest {
  id: string
  title: string
  requesterId: string
  teamId: string
  projectId: string
  category: string
  description: string
  urgency: 'critical' | 'high' | 'medium' | 'low'
  status:
    | 'submitted'
    | 'under_review'
    | 'accepted'
    | 'assigned'
    | 'in_progress'
    | 'completed'
    | 'rejected'
  assignedConsultantId?: string
  assignedConsultantName?: string
  estimatedHours?: number
  feeBDT?: number
  requestedAt: string
  targetDate?: string
  ctoNotes?: string
  completedAt?: string
}

// --- FINANCIAL TREASURY ---
export interface CompanyTreasury {
  initialCapital: number
  totalApprovedBudgets: number
  totalDistributedToDevs: number
  totalClientRevenue: number
  unallocatedReserves: number
}

// --- SEED DATA & RESOLVERS ---
export interface SeedData {
  roles: Role[]
  users: User[]
  teams: Team[]
  projects: Project[]
  tasks: Task[]
  comments: TaskComment[]
  attachments: TaskAttachment[]
  wallets: Wallet[]
  transactions: Transaction[]
  performanceRecords: PerformanceRecord[]
  reports: Report[]
  announcements: Announcement[]
  notifications: Notification[]
  activityLogs: ActivityLog[]
  milestones: Milestone[]
  repositories: Repository[]
  pullRequests: PullRequest[]
  codeQualityGates: CodeQualityGate[]
  securityAlerts: SecurityAlert[]
  testingSuites: TestingSuite[]
  bugBounties: BugBountyItem[]
  consultancyRequests: ConsultancyRequest[]
  treasury: CompanyTreasury
}

export interface DataResolvers {
  getUser: (id: string) => User | null
  getProject: (id: string) => Project | null
  getTeam: (id: string) => Team | null
  getMilestone: (id: string) => Milestone | null
  getRepo: (id: string) => Repository | null
  getDeveloperTasks: (devId?: string) => Task[]
  getDeveloperProjects: (devId?: string) => Project[]
  getDeveloperWallet: (devId?: string) => Wallet | null
  getDeveloperPerformance: (devId?: string) => PerformanceRecord | null
  getDeveloperTransactions: (devId?: string) => Transaction[]
}

// --- NAVIGATION CONFIG ---
export interface NavItem {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  isImplemented: boolean
}

export interface RoleNavigation {
  roleId: string
  roleLabel: string
  items: NavItem[]
}

// --- TOAST ---
export interface ToastMessage {
  msg: string
  type: 'info' | 'success' | 'error' | 'warning'
  id: number
}

// --- RELATIVE DEADLINE INFO ---
export interface RelativeDeadline {
  label: string
  isOverdue: boolean
  isUrgent: boolean
  days: number
  badgeColor?: string
}

// --- ENRICHED TASK ---
export interface EnrichedTask extends Task {
  deadlineInfo: RelativeDeadline
  projectName?: string
  projectCode?: string
  project?: Project | null
  assignee?: User | null
  creator?: User | null
}

// --- ENRICHED PROJECT ---
export interface EnrichedProject extends Project {
  repo?: Repository | null
  pm?: User | null
  tasksCount?: number
  totalTasksCount?: number
  completedTasksCount?: number
  inReviewTasksCount?: number
  assignedDevs?: User[]
}

// --- DEVELOPER WORKLOAD ---
export interface DeveloperWorkload extends User {
  totalTasks: number
  activeTasks: number
  completedTasks: number
  todoTasks: number
  blockedTasks: number
  inReviewTasks?: number
  tasks: EnrichedTask[]
  performance: PerformanceRecord
  isOverloaded: boolean
}

// --- APP CONTEXT TYPE ---
export type AuthorizationScope =
  | 'SELF'
  | 'ASSIGNED'
  | 'SQUAD'
  | 'DEPARTMENT'
  | 'PROJECT'
  | 'ORG'
  | 'GLOBAL'

export interface EffectiveAuthzGrant {
  code: string
  scope: AuthorizationScope
  scopeIds: string[]
  sourceType: 'role' | 'wildcard' | 'direct' | 'delegation'
  sourceId: string
  roleSlug?: string
  expiresAt: string | null
}

export interface EffectiveAuthzDenial {
  code: string
  scope: AuthorizationScope
  scopeIds: string[]
  reason?: string | null
  expiresAt: string | null
}

export interface EffectiveAuthzSnapshot {
  employeeId: string
  authVersion: number
  isSuspended: boolean
  isRoot: boolean
  roleSlugs: string[]
  grants: EffectiveAuthzGrant[]
  denials: EffectiveAuthzDenial[]
  aliasForward: Record<string, string[]>
  aliasReverse: Record<string, string[]>
  effectiveCodes: string[]
  computedAt: string
  authzMode?: string
}

export interface DirectPermissionDelegation {
  id: string
  permissionId: string
  code: string
  module: string
  description?: string | null
  isSensitive?: boolean
  isCritical?: boolean
  grantedById?: string | null
  grantedAt: string
  expiresAt?: string | null
  reason?: string | null
}

export interface AppContextType {
  data: SeedData
  currentRole: RoleId
  currentDevId: string
  currentPmId: string
  currentRoute: string
  theme: string
  isSidebarCollapsed: boolean
  isMobileSidebarOpen: boolean
  isAuthenticated: boolean
  mustChangePassword: boolean
  mustEnrollMfa: boolean
  completeFirstLoginSetup: () => Promise<void>
  isAuthChecking: boolean
  isDataLoading: boolean
  searchQuery: string
  isSearchOpen: boolean
  selectedTaskModal: Task | EnrichedTask | null
  selectedProjectModal: Project | EnrichedProject | null
  toastMessage: ToastMessage | null
  currentUser: User | null
  currentTeam: Team | null
  rolePermissions: string[]
  myPermissions: string[]
  directPermissions: DirectPermissionDelegation[]
  authzSnapshot: EffectiveAuthzSnapshot | null
  pendingApprovalsCount: number
  activeDelegationsCount: number
  recentRoutes: string[]
  resolvers: DataResolvers

  setRole: (roleId: string) => void
  setPmId: (pmId: string) => void
  setRoute: (routeId: string) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  setMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  loginWithCredentials: (
    email: string,
    password: string,
    options?: { mfaCode?: string; recoveryCode?: string },
  ) => Promise<{ mfaRequired?: boolean }>
  completeGoogleLogin: (body: {
    code?: string
    pendingToken?: string
    mfaCode?: string
    recoveryCode?: string
  }) => Promise<{ mfaRequired?: boolean; pendingToken?: string }>
  logout: () => void
  hasPermission: (code: string) => boolean
  hasAnyPermission: (...codes: string[]) => boolean
  can: (code: string, scope?: AuthorizationScope, targetScopeId?: string) => boolean
  canAny: (codes: string[], scope?: AuthorizationScope, targetScopeId?: string) => boolean
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedTaskModal: React.Dispatch<React.SetStateAction<Task | EnrichedTask | null>>
  setSelectedProjectModal: React.Dispatch<React.SetStateAction<Project | EnrichedProject | null>>
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => boolean
  addTaskComment: (taskId: string, content: string) => void
  updateUserProfile: (updatedFields: Partial<User>) => void
  addSubmission: (submission: Report) => void
  addComplaint: (complaint: Report) => void
  markNotificationRead: (notificationId: string) => void
  markAllNotificationsRead: () => void
  refreshData: () => Promise<void>
  refreshPermissions: () => Promise<void>
  showToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void

  createTask: (taskData: {
    title: string
    description?: string
    projectId: string
    assigneeId: string
    priority?: TaskPriority
    dueDate?: string
    estimatedHours?: number | string
    tags?: string[]
    checklist?: TaskChecklistItem[]
  }) => Task
  approveTask: (taskId: string, feedback?: string) => void
  rejectTask: (taskId: string, feedback: string) => void
  reassignTask: (taskId: string, newAssigneeId: string) => void
  allocateBudget: (allocation: {
    developerId: string
    projectId: string
    amount: number | string
    description?: string
    week?: number | string
  }) => void
  requestBudgetIncrease: (req: {
    projectId: string
    amount: number | string
    reason: string
  }) => void
  submitPmReport: (report: {
    category: string
    recipient: string
    title: string
    description: string
    projectId?: string
    docsUrl?: string
  }) => void
  updatePmTaskStatus: (taskId: string, newStatus: TaskStatus) => void
  forwardSubmissionToCLevel: (submissionId: string, recipient: string, endorsement: string) => void
  addProjectMilestone: (
    projectId: string,
    milestoneData: {
      title: string
      dueDate?: string
      status?: string
    },
  ) => void
  updateMilestoneStatus: (projectId: string, milestoneId: string, newStatus: string) => void
  updatePmProfile: (updatedFields: Partial<User>) => void
  updateComplaintStatus: (complaintId: string, newStatus: string, pmComment?: string) => void

  // CTO State Handlers
  createCtoPersonalTask: (taskData: {
    title: string
    description?: string
    priority?: TaskPriority
    dueDate?: string
    tags?: string[]
    projectId?: string
  }) => Task
  createCtoEngineeringTask: (taskData: {
    title: string
    description?: string
    projectId: string
    pmId: string
    priority?: TaskPriority
    dueDate?: string
    estimatedHours?: number | string
    tags?: string[]
  }) => Task
  reviewCtoTaskSubmission: (taskId: string, approved: boolean, feedback?: string) => void
  updateCtoPersonalTaskStatus: (taskId: string, newStatus: TaskStatus) => void
  createProject: (projectData: {
    name: string
    code: string
    teamId?: string
    budget?: number
    deadline?: string
    description?: string
    repositoryUrl?: string
    srsUrl?: string
    status?: string
    progress?: number
    tags?: string[]
  }) => Project
  updateProject: (
    projectId: string,
    updates: Partial<Project> & { repositoryUrl?: string; srsUrl?: string },
  ) => void
  updateUser: (userId: string, updates: Partial<User>) => void
  createTeam: (teamData: {
    name: string
    code: string
    focus: string
    pmId?: string
    leadDevId?: string
    memberIds?: string[]
    projectIds?: string[]
    weeklyVelocity?: number
  }) => Team
  updateTeam: (teamId: string, updates: Partial<Team>) => void
  reviewProjectIdea: (ideaId: string, status: string, feedback?: string) => void
  updateComplaintStatusGeneral: (complaintId: string, status: string, feedback?: string) => void
  updateRepoConfig: (
    projectId: string,
    updates: {
      repositoryUrl?: string
      defaultBranch?: string
      tags?: string[]
      srsUrl?: string
    },
  ) => void
  reviewPullRequest: (prId: string, newStatus: 'approved' | 'merged' | 'changes_requested') => void
  createSecurityIssue: (issue: {
    title: string
    projectId: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    category: 'dependency' | 'auth' | 'injection' | 'encryption' | 'infrastructure'
    assignedPmId?: string
    description: string
    recommendation: string
    cveOrPackage?: string
  }) => void
  updateSecurityIssueStatus: (
    issueId: string,
    newStatus: 'open' | 'investigating' | 'patch_in_progress' | 'resolved',
  ) => void
  updateConsultancyStatus: (
    requestId: string,
    updates: {
      status:
        | 'submitted'
        | 'under_review'
        | 'accepted'
        | 'assigned'
        | 'in_progress'
        | 'completed'
        | 'rejected'
      assignedConsultantName?: string
      feeBDT?: number
      targetDate?: string
      ctoNotes?: string
    },
  ) => void
  submitCtoReport: (report: {
    category: string
    recipient: string
    title: string
    description: string
    projectId?: string
    docsUrl?: string
  }) => void
  updateIncomingReportStatus: (
    reportId: string,
    newStatus: string,
    feedback?: string,
    forwardTo?: string,
  ) => void
  updateCtoProfile: (updatedFields: Partial<User>) => void

  // CFO Financial State Handlers
  allocateProjectBudget: (projectId: string, newBudget: number, reason?: string) => void
  approveBudgetRequest: (reportId: string, approvedAmount: number, feedback?: string) => void
  rejectBudgetRequest: (reportId: string, feedback: string) => void
  issueFinancialAdjustment: (
    userId: string,
    amount: number,
    type: 'bonus' | 'penalty',
    reason: string,
  ) => void

  // CHRO State Handlers
  recordPerformanceEvaluation: (
    userId: string,
    evaluation: {
      score: number
      tier: 'top_performer' | 'strong_contributor' | 'needs_support' | string
      notes: string
      strengths?: string[]
      improvementAreas?: string[]
    },
  ) => void
  issueEmployeeRecognition: (
    userId: string,
    title: string,
    description: string,
    bonusAmount?: number,
  ) => void
  issueDisciplinaryAction: (
    userId: string,
    title: string,
    description: string,
    penaltyAmount?: number,
  ) => void
  updateConfidentialComplaintStatus: (
    complaintId: string,
    status: string,
    mediationNotes?: string,
  ) => void

  // Executive Management Handlers
  updateExecutiveProfile: (roleId: string, updatedFields: Partial<User>) => void
  createExecutiveDirective: (directive: {
    title: string
    description?: string
    assigneeRole: string
    assigneeId?: string
    priority?: TaskPriority
    dueDate?: string
    tags?: string[]
    projectId?: string
  }) => Task
  authorizeCeoAction: (actionType: string, entityId: string, notes?: string) => void
}
