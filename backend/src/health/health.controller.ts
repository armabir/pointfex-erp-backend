import {
  Controller,
  Get,
  Post,
  Headers,
  Optional,
  Inject,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { Public } from '../common/public.decorator'
import { PrismaService } from '../common/prisma.service'
import { DelegationService } from '../rbac/delegation.service'
import { ApprovalEngineService } from '../rbac/approval-engine.service'
import { ProjectRequestsService } from '../projects/project-requests.service'

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly delegationService?: DelegationService,
    @Optional() private readonly approvalEngineService?: ApprovalEngineService,
    @Optional() private readonly projectRequestsService?: ProjectRequestsService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'pointfex-erp-backend' }
  }

  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ready', database: 'connected' }
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'disconnected' })
    }
  }

  @Public()
  @Get('cron/sweep')
  async cronSweepGet(@Headers('x-cron-secret') cronSecret?: string) {
    return this.runSweep(cronSecret)
  }

  @Public()
  @Post('cron/sweep')
  async cronSweepPost(@Headers('x-cron-secret') cronSecret?: string) {
    return this.runSweep(cronSecret)
  }

  private async runSweep(providedSecret?: string) {
    const expected = process.env.CRON_SECRET?.trim()
    if (expected && providedSecret !== expected) {
      throw new UnauthorizedException('Invalid or missing CRON_SECRET')
    }

    const [delRes, appRes, projRes] = await Promise.all([
      this.delegationService?.expireStaleDelegations().catch(() => ({ expiredCount: 0 })),
      this.approvalEngineService
        ?.processEscalationsAndTimeouts()
        .catch(() => ({ timedOut: 0, escalated: 0 })),
      this.projectRequestsService?.sweepExpiredVotes().catch(() => ({ expiredCount: 0 })),
    ])

    return {
      success: true,
      timestamp: new Date().toISOString(),
      delegations: delRes,
      approvals: appRes,
      projects: projRes,
    }
  }
}

