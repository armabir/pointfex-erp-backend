import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApprovalMode } from '@prisma/client'
import { CurrentUser } from '../common/current-user.decorator'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequireAnyPermission } from '../common/require-permissions.decorator'
import { RequiresFreshMfa } from '../common/requires-fresh-mfa.decorator'
import { ApprovalEngineService, StepDefinitionInput } from './approval-engine.service'
import { SodValidatorService } from './sod-validator.service'

@Controller('rbac')
@UseGuards(PermissionsGuard)
export class ApprovalsController {
  constructor(
    private readonly approvalEngine: ApprovalEngineService,
    private readonly sodValidator: SodValidatorService,
  ) {}

  @Get('sod-rules')
  @RequireAnyPermission('governance:read', 'audit_logs:read', 'roles:read')
  listSodRules() {
    return this.sodValidator.listRules()
  }

  @Get('approvals/inbox')
  @RequireAnyPermission(
    'approvals:read',
    'approvals:approve',
    'approvals:reject',
    'governance:approve_request',
    'payroll:approve_batch',
    'budgets:approve_request',
    'tasks:approve',
  )
  getInbox(@CurrentUser() actor: AuthenticatedUser) {
    return this.approvalEngine.listInboxForUser(actor.id)
  }

  @Get('approvals/mine')
  @RequireAnyPermission('approvals:read', 'approvals:create')
  getMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.approvalEngine.listForRequester(actor.id)
  }

  @Post('approvals')
  @RequireAnyPermission(
    'approvals:create',
    'payroll:approve_batch',
    'budgets:approve_request',
    'governance:approve_request',
  )
  @RequiresFreshMfa('approvals:decide')
  initiate(
    @CurrentUser() actor: AuthenticatedUser,
    @Body()
    body: {
      actionCode: string
      entityType: string
      entityId: string
      amount?: number
      reason?: string
      mode?: ApprovalMode
      payload?: Record<string, unknown>
      priorActorsByAction?: Record<string, string>
      steps?: StepDefinitionInput[]
    },
  ) {
    return this.approvalEngine.initiateWorkflow(actor, body)
  }

  @Post('approvals/:id/approve')
  @RequireAnyPermission(
    'approvals:approve',
    'payroll:approve_batch',
    'budgets:approve_request',
    'governance:approve_request',
    'tasks:approve',
    'deployments:approve',
  )
  @RequiresFreshMfa('approvals:decide')
  approve(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body?: { notes?: string },
  ) {
    return this.approvalEngine.actOnStep(id, actor, 'APPROVED', body?.notes)
  }

  @Post('approvals/:id/reject')
  @RequireAnyPermission(
    'approvals:reject',
    'payroll:approve_batch',
    'budgets:reject_request',
    'governance:approve_request',
    'tasks:reject',
    'deployments:approve',
  )
  @RequiresFreshMfa('approvals:decide')
  reject(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body?: { notes?: string },
  ) {
    return this.approvalEngine.actOnStep(id, actor, 'REJECTED', body?.notes)
  }

  @Post('approvals/escalate-sweep')
  @RequireAnyPermission('governance:approve_request', 'audit_logs:read')
  @RequiresFreshMfa('approvals:decide')
  sweep() {
    return this.approvalEngine.processEscalationsAndTimeouts()
  }
}

