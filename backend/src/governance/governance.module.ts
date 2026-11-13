import { Module } from '@nestjs/common'
import { GovernanceService } from './governance.service'
import { GovernanceController } from './governance.controller'
import { VoteEngineService } from './vote-engine.service'
import { CommonModule } from '../common/common.module'

@Module({
  imports: [CommonModule],
  controllers: [GovernanceController],
  providers: [GovernanceService, VoteEngineService],
  exports: [GovernanceService, VoteEngineService],
})
export class GovernanceModule {}
