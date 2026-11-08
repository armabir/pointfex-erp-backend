import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from './common/prisma.service'
import { TasksService } from './tasks/tasks.service'
import { FinanceService } from './finance/finance.service'
import { ReportsService } from './reports/reports.service'
import { TeamsService } from './teams/teams.service'
import { ProjectsService } from './projects/projects.service'
import { PerformanceService } from './performance/performance.service'
import { GovernanceService } from './governance/governance.service'
import { EngineeringService } from './engineering/engineering.service'
import { PositionsService } from './positions/positions.service'
import { Prisma } from '@prisma/client'
import { ForbiddenException, BadRequestException } from '@nestjs/common'

describe('Comprehensive Cross-Role Workflow Verification (22 Workflows)', () => {
  let prisma: any
  let tasksService: TasksService
  let financeService: FinanceService
  let reportsService: ReportsService
  let teamsService: TeamsService
  let projectsService: ProjectsService
  let performanceService: PerformanceService
  let governanceService: GovernanceService
  let engineeringService: EngineeringService
  let positionsService: PositionsService

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      taskComment: { create: jest.fn() },
      taskChecklistItem: { findFirst: jest.fn(), update: jest.fn() },
      taskSubmission: { create: jest.fn() },
      companyTreasury: { findUnique: jest.fn(), update: jest.fn() },
      project: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      projectMilestone: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      teamProject: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
      employee: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      employeeWallet: { findUnique: jest.fn(), upsert: jest.fn() },
      financialTransaction: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      budgetRequest: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      performanceRecord: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      report: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn(), findMany: jest.fn() },
      position: { findUnique: jest.fn(), findMany: jest.fn() },
      positionAssignment: { create: jest.fn(), updateMany: jest.fn() },
      team: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      teamMembership: { updateMany: jest.fn(), create: jest.fn() },
      securityAlert: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      executiveDirective: { create: jest.fn() },
      executiveDecision: { create: jest.fn() },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        FinanceService,
        ReportsService,
        TeamsService,
        ProjectsService,
        PerformanceService,
        GovernanceService,
        EngineeringService,
        PositionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    tasksService = module.get<TasksService>(TasksService)
    financeService = module.get<FinanceService>(FinanceService)
    reportsService = module.get<ReportsService>(ReportsService)
    teamsService = module.get<TeamsService>(TeamsService)
    projectsService = module.get<ProjectsService>(ProjectsService)
    performanceService = module.get<PerformanceService>(PerformanceService)
    governanceService = module.get<GovernanceService>(GovernanceService)
    engineeringService = module.get<EngineeringService>(EngineeringService)
    positionsService = module.get<PositionsService>(PositionsService)
  })

  // Workflow 1: CTO assigns task to PM
  it('Workflow 1: CTO assigns task to PM -> PM sees it and updates it', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_01' })
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_pm_01', name: 'Tanvir Ahmed' })
    prisma.task.create.mockResolvedValue({
      id: 'task_cto_01',
      title: 'Architectural Review',
      assigneeId: 'emp_pm_01',
      creatorId: 'emp_cto_01',
      status: 'todo',
    })
    prisma.task.findUnique.mockResolvedValue({ id: 'task_cto_01', title: 'Architectural Review', status: 'todo' })
    prisma.task.update.mockResolvedValue({ id: 'task_cto_01', status: 'in_progress' })

    const task = await tasksService.create(
      { title: 'Architectural Review', projectId: 'proj_01', assigneeId: 'emp_pm_01' },
      { id: 'emp_cto_01', role: 'cto' },
    )
    expect(task.assigneeId).toBe('emp_pm_01')

    const updated = await tasksService.updateStatus(
      'task_cto_01',
      { status: 'in_progress' },
      { id: 'emp_pm_01', role: 'pm' },
    )
    expect(updated.status).toBe('in_progress')
  })

  // Workflow 2: PM assigns task to Developer
  it('Workflow 2: PM assigns task to Developer -> Dev sees it', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_01' })
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_dev_01', name: 'Arifur Rahman' })
    prisma.task.create.mockResolvedValue({
      id: 'task_pm_01',
      title: 'Build UI Component',
      assigneeId: 'emp_dev_01',
      creatorId: 'emp_pm_01',
    })

    const task = await tasksService.create(
      { title: 'Build UI Component', projectId: 'proj_01', assigneeId: 'emp_dev_01' },
      { id: 'emp_pm_01', role: 'pm' },
    )
    expect(task.assigneeId).toBe('emp_dev_01')
  })

  // Workflow 3: Developer moves task to In Review
  it('Workflow 3: Developer moves task to In Review', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task_01', title: 'GIS Map', status: 'in_progress' })
    prisma.task.update.mockResolvedValue({ id: 'task_01', status: 'in_review' })

    const updated = await tasksService.updateStatus('task_01', { status: 'in_review' }, { id: 'emp_dev_01', role: 'developer' })
    expect(updated.status).toBe('in_review')
  })

  // Workflow 4: PM approves task -> Completed + developer payment
  it('Workflow 4: PM approves task -> Task becomes Completed and developer receives payment', async () => {
    prisma.task.findUnique.mockResolvedValue({
      id: 'task_01',
      title: 'GIS Map',
      projectId: 'proj_01',
      assigneeId: 'emp_dev_01',
      milestone: { payoutAmount: new Prisma.Decimal(6400) },
    })
    prisma.task.update.mockResolvedValue({ id: 'task_01', status: 'completed' })
    prisma.financialTransaction.findFirst.mockResolvedValue(null)

    const res = await tasksService.approve('task_01', { feedback: 'Approved' }, { id: 'emp_pm_01', role: 'pm' })
    expect(res.status).toBe('completed')
    expect(prisma.employeeWallet.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          balance: { increment: new Prisma.Decimal(6400) },
        }),
      }),
    )
  })

  // Workflow 5: PM rejects task -> returns to In Progress with feedback
  it('Workflow 5: PM rejects task -> Task returns to In Progress with feedback', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task_01', title: 'GIS Map', status: 'in_review' })
    prisma.task.update.mockResolvedValue({ id: 'task_01', status: 'in_progress' })

    const res = await tasksService.reject('task_01', { feedback: 'Fix test suite' }, { id: 'emp_pm_01', role: 'pm' })
    expect(res.status).toBe('in_progress')
    expect(prisma.taskComment.create).toHaveBeenCalled()
  })

  // Workflow 6: PM reassigns task to another developer
  it('Workflow 6: PM reassigns task to another developer', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task_01', title: 'GIS Map', assigneeId: 'emp_dev_01' })
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_dev_02', name: 'Mehedi Hasan' })
    prisma.task.update.mockResolvedValue({ id: 'task_01', assigneeId: 'emp_dev_02' })

    const res = await tasksService.reassign('task_01', { newAssigneeId: 'emp_dev_02' }, { id: 'emp_pm_01', role: 'pm' })
    expect(res.assigneeId).toBe('emp_dev_02')
  })

  // Workflow 7: Developer updates checklist items -> progress updates
  it('Workflow 7: Developer updates checklist items -> progress updates', async () => {
    prisma.taskChecklistItem.findFirst.mockResolvedValue({ id: 'chk_01', completed: false })
    prisma.taskChecklistItem.update.mockResolvedValue({ id: 'chk_01', completed: true })

    const res = await tasksService.toggleChecklistItem('task_01', 'chk_01', true)
    expect(res.completed).toBe(true)
  })

  // Workflow 8: Users create personal tasks
  it('Workflow 8: Users create personal tasks', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_01' })
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_dev_01', name: 'Arifur Rahman' })
    prisma.task.create.mockResolvedValue({ id: 'task_pers', creatorId: 'emp_dev_01', assigneeId: 'emp_dev_01' })

    const task = await tasksService.create(
      { title: 'Personal Refactor', projectId: 'proj_01', assigneeId: 'emp_dev_01' },
      { id: 'emp_dev_01', role: 'developer' },
    )
    expect(task.assigneeId).toBe('emp_dev_01')
  })

  // Workflow 9: Developer submits work with PR links, demo URLs, and notes
  it('Workflow 9: Developer submits work with PR link and demo URL', async () => {
    prisma.task.findUnique.mockResolvedValue({ id: 'task_01' })
    prisma.taskSubmission.create.mockResolvedValue({
      id: 'sub_01',
      prUrl: 'https://github.com/pointfex/unseen-bangladesh/pull/42',
      demoUrl: 'https://preview-42.unseenbd.pointfex.internal',
    })

    const sub = await tasksService.submitWork(
      'task_01',
      {
        prUrl: 'https://github.com/pointfex/unseen-bangladesh/pull/42',
        demoUrl: 'https://preview-42.unseenbd.pointfex.internal',
      },
      { id: 'emp_dev_01', role: 'developer' },
    )
    expect(sub.prUrl).toContain('pull/42')
  })

  // Workflow 10: PM forwards submission to C-Level
  it('Workflow 10: PM forwards submission to C-level with endorsement', async () => {
    prisma.report.findUnique.mockResolvedValue({ id: 'rep_01', title: 'Tile Sync Engine', isConfidential: false })
    prisma.report.update.mockResolvedValue({ id: 'rep_01', status: 'forwarded_to_c_level' })

    const res = await reportsService.forwardToCLevel(
      'rep_01',
      { recipient: 'CTO', endorsement: 'Recommended for R&D' },
      { id: 'emp_pm_01', role: 'pm' },
    )
    expect(res.status).toBe('forwarded_to_c_level')
  })

  // Workflow 11: CFO allocates budget to project
  it('Workflow 11: CFO allocates budget to project', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_01', name: 'Unseen BD', budget: new Prisma.Decimal(30000) })
    prisma.companyTreasury.findUnique.mockResolvedValue({ id: 'singleton', unallocatedReserves: new Prisma.Decimal(50000) })
    prisma.project.update.mockResolvedValue({ id: 'proj_01', budget: new Prisma.Decimal(45000) })

    const res = await financeService.allocateProjectBudget(
      { projectId: 'proj_01', newBudget: 45000 },
      { id: 'emp_cfo_01', role: 'cfo' },
    )
    expect(res.budget).toEqual(new Prisma.Decimal(45000))
  })

  // Workflow 12 & 13: PM distributes funds & cannot over-allocate
  it('Workflow 12 & 13: PM distributes funds and cannot allocate more than remaining budget', async () => {
    prisma.project.findUnique.mockResolvedValue({
      id: 'proj_01',
      budget: new Prisma.Decimal(40000),
      allocatedBudget: new Prisma.Decimal(38000), // Only 2000 remaining
    })
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_dev_01' })

    // Allocating 3000 must fail
    await expect(
      financeService.allocateDeveloperBudget(
        { developerId: 'emp_dev_01', projectId: 'proj_01', amount: 3000 },
        { id: 'emp_pm_01', role: 'pm' },
      ),
    ).rejects.toThrow(BadRequestException)
  })

  // Workflow 14: PM requests budget increase -> CFO approves or rejects
  it('Workflow 14: PM requests budget increase -> CFO approves it', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_01', name: 'Unseen BD' })
    prisma.budgetRequest.create.mockResolvedValue({ id: 'br_01', status: 'pending' })
    prisma.budgetRequest.findUnique.mockResolvedValue({
      id: 'br_01',
      projectId: 'proj_01',
      project: { name: 'Unseen BD' },
    })
    prisma.companyTreasury.findUnique.mockResolvedValue({ id: 'singleton', unallocatedReserves: new Prisma.Decimal(50000) })
    prisma.budgetRequest.update.mockResolvedValue({ id: 'br_01', status: 'approved' })

    const req = await financeService.requestBudgetIncrease(
      { projectId: 'proj_01', amount: 10000, reason: 'Satellite Imagery' },
      { id: 'emp_pm_01', role: 'pm' },
    )
    expect(req.status).toBe('pending')

    const approved = await financeService.approveBudgetRequest(
      'br_01',
      { approvedAmount: 10000 },
      { id: 'emp_cfo_01', role: 'cfo' },
    )
    expect(approved.status).toBe('approved')
  })

  // Workflow 15: CTO creates project and assigns team
  it('Workflow 15: CTO creates project and assigns team', async () => {
    prisma.project.create.mockResolvedValue({ id: 'proj_new', name: 'Digital Identity BD', code: 'DIB-13' })
    prisma.team.findUnique.mockResolvedValue({ id: 'team_01' })
    prisma.teamProject.create.mockResolvedValue({ id: 'tp_new' })

    const proj = await projectsService.create({
      name: 'Digital Identity BD',
      code: 'DIB-13',
      description: 'National digital ID verification protocol',
      teamId: 'team_01',
    })
    expect(proj.name).toBe('Digital Identity BD')
  })

  // Workflow 16: PM/CTO creates and updates project milestone
  it('Workflow 16: PM/CTO creates and updates project milestone', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_01', teamProjects: [], milestones: [], tasks: [] })
    prisma.projectMilestone.create.mockResolvedValue({ id: 'ms_01', title: 'Beta Release', status: 'pending' })
    prisma.projectMilestone.findFirst.mockResolvedValue({ id: 'ms_01', projectId: 'proj_01', status: 'pending' })
    prisma.projectMilestone.update.mockResolvedValue({ id: 'ms_01', status: 'completed', progress: 100 })

    const ms = await projectsService.addMilestone('proj_01', { title: 'Beta Release' })
    expect(ms.title).toBe('Beta Release')

    const updated = await projectsService.updateMilestoneStatus('proj_01', 'ms_01', { status: 'completed' })
    expect(updated.status).toBe('completed')
  })

  // Workflow 17: CTO reassigns employees to teams
  it('Workflow 17: CTO reassigns employees to teams', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team_02', memberships: [], teamProjects: [] })
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_dev_01' })
    prisma.teamMembership.create.mockResolvedValue({ id: 'tm_new', teamId: 'team_02', employeeId: 'emp_dev_01' })

    const res = await teamsService.addMember('team_02', { employeeId: 'emp_dev_01' })
    expect(res.teamId).toBe('team_02')
  })

  // Workflow 18: CHRO records performance evaluations
  it('Workflow 18: CHRO records performance evaluations', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_dev_01', name: 'Arifur Rahman' })
    prisma.performanceRecord.findFirst.mockResolvedValue(null)
    prisma.performanceRecord.create.mockResolvedValue({ id: 'perf_01', overallScore: new Prisma.Decimal(95) })

    const record = await performanceService.recordEvaluation(
      { userId: 'emp_dev_01', score: 95, tier: 'top_performer', notes: 'Excellent' },
      { id: 'emp_chro_01', role: 'chro' },
    )
    expect(record.overallScore).toEqual(new Prisma.Decimal(95))
  })

  // Workflow 19: CFO/CHRO issues bonuses and penalties
  it('Workflow 19: CFO/CHRO issues bonus and penalty adjustments', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp_dev_01', name: 'Arifur Rahman' })
    prisma.employeeWallet.findUnique.mockResolvedValue({ employeeId: 'emp_dev_01', balance: new Prisma.Decimal(5000) })
    prisma.companyTreasury.findUnique.mockResolvedValue({ id: 'singleton', unallocatedReserves: new Prisma.Decimal(30000) })
    prisma.financialTransaction.create.mockResolvedValue({ id: 'tx_adj' })

    const res = await financeService.issueAdjustment(
      { userId: 'emp_dev_01', amount: 2000, type: 'bonus', reason: 'High velocity' },
      { id: 'emp_cfo_01', role: 'cfo' },
    )
    expect(res.message).toContain('bonus')
  })

  // Workflow 20: Employees submit complaints & confidential grievances
  it('Workflow 20: Employees submit complaints & confidential grievances', async () => {
    prisma.report.create.mockResolvedValue({ id: 'rep_01', isConfidential: true, title: 'Whistleblower Report' })

    const rep = await reportsService.create(
      { title: 'Whistleblower Report', description: 'Ethics issue', type: 'complaint', isConfidential: true },
      { id: 'emp_dev_04', role: 'developer' },
    )
    expect(rep.isConfidential).toBe(true)
  })

  // Workflow 21: Confidential grievances are accessible only to CHRO and CEO
  it('Workflow 21: Confidential grievances are accessible only to CHRO and CEO', async () => {
    prisma.report.findUnique.mockResolvedValue({ id: 'rep_conf', isConfidential: true, authorId: 'emp_dev_04' })

    // CTO cannot access
    await expect(reportsService.findOne('rep_conf', { id: 'emp_cto_01', role: 'cto' })).rejects.toThrow(ForbiddenException)
    // PM cannot access
    await expect(reportsService.findOne('rep_conf', { id: 'emp_pm_01', role: 'pm' })).rejects.toThrow(ForbiddenException)
    // CHRO CAN access
    const chroAccess = await reportsService.findOne('rep_conf', { id: 'emp_chro_01', role: 'chro' })
    expect(chroAccess.id).toBe('rep_conf')
    // CEO CAN access
    const ceoAccess = await reportsService.findOne('rep_conf', { id: 'emp_ceo_01', role: 'ceo' })
    expect(ceoAccess.id).toBe('rep_conf')
  })

  // Workflow 22: Important actions create audit log entries
  it('Workflow 22: Important actions create audit log entries', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_01' })
    prisma.securityAlert.create.mockResolvedValue({ id: 'sec_01', title: 'Open Port' })

    await engineeringService.createSecurityAlert(
      {
        projectId: 'proj_01',
        title: 'Open Port',
        severity: 'high',
        category: 'infrastructure',
        description: 'Unprotected port 8080',
        recommendation: 'Close port',
      },
      { id: 'emp_cto_01', role: 'cto' },
    )

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SECURITY_ALERT_LOGGED',
          severity: 'WARNING',
        }),
      }),
    )
  })
})

