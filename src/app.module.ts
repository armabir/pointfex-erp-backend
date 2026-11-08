import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CommonModule } from './common/common.module'
import { EmployeesModule } from './employees/employees.module'
import { PositionsModule } from './positions/positions.module'
import { TeamsModule } from './teams/teams.module'
import { ProjectsModule } from './projects/projects.module'
import { TasksModule } from './tasks/tasks.module'
import { FinanceModule } from './finance/finance.module'
import { PerformanceModule } from './performance/performance.module'
import { ReportsModule } from './reports/reports.module'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { EngineeringModule } from './engineering/engineering.module'
import { ConsultancyModule } from './consultancy/consultancy.module'
import { GovernanceModule } from './governance/governance.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    EmployeesModule,
    PositionsModule,
    TeamsModule,
    ProjectsModule,
    TasksModule,
    FinanceModule,
    PerformanceModule,
    ReportsModule,
    AuditLogsModule,
    EngineeringModule,
    ConsultancyModule,
    GovernanceModule,
  ],
})
export class AppModule {}

