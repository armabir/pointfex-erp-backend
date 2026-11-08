import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { GovernanceService } from './governance.service'
import { CreateDirectiveDto, RatifyDecisionDto } from './dto/governance.dto'
import { DemoIdentityGuard, DemoUser } from '../common/demo-identity.guard'
import { RolesGuard } from '../common/roles.guard'
import { Roles } from '../common/roles.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('governance')
@UseGuards(DemoIdentityGuard, RolesGuard)
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('directives')
  getDirectives() {
    return this.governanceService.getDirectives()
  }

  @Get('decisions')
  getDecisions() {
    return this.governanceService.getDecisions()
  }

  @Post('directives')
  @Roles('ceo', 'cto')
  dispatchDirective(@Body() dto: CreateDirectiveDto, @CurrentUser() actor: DemoUser) {
    return this.governanceService.dispatchDirective(dto, actor)
  }

  @Post('ratify')
  @Roles('ceo')
  ratifyDecision(@Body() dto: RatifyDecisionDto, @CurrentUser() actor: DemoUser) {
    return this.governanceService.ratifyDecision(dto, actor)
  }
}

