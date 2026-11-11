import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { CommonModule } from './common/common.module'
import { envValidationSchema } from './common/config/env.validation'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { SanitizeResponseInterceptor } from './common/interceptors/sanitize-response.interceptor'
import { IpBlocklistGuard } from './common/ip-blocklist.guard'
import { ProxyThrottlerGuard } from './common/proxy-throttler.guard'
import { JwtAuthGuard } from './common/jwt-auth.guard'
import { RequestContextMiddleware } from './common/request-context.middleware'
import { AuthModule } from './auth/auth.module'
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
import { CommunicationsModule } from './communications/communications.module'
import { RbacModule } from './rbac/rbac.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CommonModule,
    AuthModule,
    RbacModule,
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
    CommunicationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: IpBlocklistGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ProxyThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*')
  }
}
