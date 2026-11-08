import { Module } from '@nestjs/common'
import { PerformanceService } from './performance.service'
import { PerformanceController } from './performance.controller'
import { FinanceModule } from '../finance/finance.module'

@Module({
  imports: [FinanceModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}

