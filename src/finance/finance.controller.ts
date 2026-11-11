import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common'
import { FinanceService } from './finance.service'
import {
  AllocateDeveloperBudgetDto,
  AllocateProjectBudgetDto,
  RequestBudgetIncreaseDto,
  AdjudicateBudgetRequestDto,
  RejectBudgetRequestDto,
  IssueFinancialAdjustmentDto,
  ClientRevenueShareDto,
} from './dto/finance.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('finance')
@UseGuards(PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('treasury')
  @RequirePermissions('treasury:read')
  getTreasury() {
    return this.financeService.getTreasury()
  }

  @Get('wallets')
  @RequirePermissions('wallets:read_all')
  getAllWallets() {
    return this.financeService.getAllWallets()
  }

  @Get('wallets/:employeeId')
  getWallet(@Param('employeeId') employeeId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.financeService.getWallet(employeeId, actor)
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('projectId') projectId?: string,
    @Query('type') type?: string,
  ) {
    return this.financeService.getTransactions({ employeeId, projectId, type }, actor)
  }

  @Get('budget-requests')
  @RequirePermissions('budgets:read_requests')
  getBudgetRequests(@Query('projectId') projectId?: string, @Query('status') status?: string) {
    return this.financeService.getBudgetRequests(projectId, status)
  }

  @Post('allocate-developer')
  @RequirePermissions('budgets:allocate_developer')
  allocateDeveloperBudget(
    @Body() dto: AllocateDeveloperBudgetDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.financeService.allocateDeveloperBudget(dto, actor)
  }

  @Post('allocate-project')
  @RequirePermissions('budgets:allocate_project')
  allocateProjectBudget(
    @Body() dto: AllocateProjectBudgetDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.financeService.allocateProjectBudget(dto, actor)
  }

  @Post('request-budget')
  @RequirePermissions('budgets:request_increase')
  requestBudgetIncrease(
    @Body() dto: RequestBudgetIncreaseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.financeService.requestBudgetIncrease(dto, actor)
  }

  @Post('approve-budget/:requestId')
  @RequirePermissions('budgets:approve_request')
  approveBudgetRequest(
    @Param('requestId') requestId: string,
    @Body() dto: AdjudicateBudgetRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.financeService.approveBudgetRequest(requestId, dto, actor)
  }

  @Post('reject-budget/:requestId')
  @RequirePermissions('budgets:reject_request')
  rejectBudgetRequest(
    @Param('requestId') requestId: string,
    @Body() dto: RejectBudgetRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.financeService.rejectBudgetRequest(requestId, dto, actor)
  }

  @Post('adjustment')
  @RequirePermissions('finance:issue_adjustment')
  issueAdjustment(
    @Body() dto: IssueFinancialAdjustmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.financeService.issueAdjustment(dto, actor)
  }

  @Post('client-revenue-share')
  @RequirePermissions('revenue_share:process')
  processClientRevenueShare(
    @Body() dto: ClientRevenueShareDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.financeService.processClientRevenueShare(dto, actor)
  }
}
