import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { AuditLoggerService } from './audit-logger.service'
import { IpBlocklistGuard } from './ip-blocklist.guard'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'
import { PermissionsGuard } from './permissions.guard'

@Global()
@Module({
  providers: [
    PrismaService,
    AuditLoggerService,
    IpBlocklistGuard,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    PrismaService,
    AuditLoggerService,
    IpBlocklistGuard,
    JwtAuthGuard,
    RolesGuard,
    PermissionsGuard,
  ],
})
export class CommonModule {}
