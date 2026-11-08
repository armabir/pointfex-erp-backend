import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
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
import { DemoIdentityGuard, DemoUser } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('finance')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('treasury')
  getTreasury() {
    return this.financeService.getTreasury()
  }

  @Get('wallets')
  getAllWallets() {
    return this.financeService.getAllWallets()
  }

  @Get('wallets/:employeeId')
  getWallet(@Param('employeeId') employeeId: string) {
    return this.financeService.getWallet(employeeId)
  }

  @Get('transactions')
  getTransactions(
    @Query('employeeId') employeeId?: string,
    @Query('projectId') projectId?: string,
    @Query('type') type?: string,
  ) {
    return this.financeService.getTransactions({ employeeId, projectId, type })
  }

  @Get('budget-requests')
  getBudgetRequests(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.financeService.getBudgetRequests(projectId, status)
  }

  @Post('allocate-developer')
  @Roles('pm', 'cto', 'ceo')
  allocateDeveloperBudget(
    @Body() dto: AllocateDeveloperBudgetDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.financeService.allocateDeveloperBudget(dto, actor)
  }

  @Post('allocate-project')
  @Roles('cfo', 'ceo')
  allocateProjectBudget(
    @Body() dto: AllocateProjectBudgetDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.financeService.allocateProjectBudget(dto, actor)
  }

  @Post('request-budget')
  @Roles('pm', 'cto', 'ceo')
  requestBudgetIncrease(
    @Body() dto: RequestBudgetIncreaseDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.financeService.requestBudgetIncrease(dto, actor)
  }

  @Post('approve-budget/:requestId')
  @Roles('cfo', 'ceo')
  approveBudgetRequest(
    @Param('requestId') requestId: string,
    @Body() dto: AdjudicateBudgetRequestDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.financeService.approveBudgetRequest(requestId, dto, actor)
  }

  @Post('reject-budget/:requestId')
  @Roles('cfo', 'ceo')
  rejectBudgetRequest(
    @Param('requestId') requestId: string,
    @Body() dto: RejectBudgetRequestDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.financeService.rejectBudgetRequest(requestId, dto, actor)
  }

  @Post('adjustment')
  @Roles('cfo', 'chro', 'ceo')
  issueAdjustment(
    @Body() dto: IssueFinancialAdjustmentDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.financeService.issueAdjustment(dto, actor)
  }

  @Post('client-revenue-share')
  @Roles('cfo', 'ceo')
  processClientRevenueShare(
    @Body() dto: ClientRevenueShareDto,
    @CurrentUser() actor: DemoUser,
  ) {
    return this.financeService.processClientRevenueShare(dto, actor)
  }
}

