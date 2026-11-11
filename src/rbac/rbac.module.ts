import { Global, Module } from '@nestjs/common'
import { RbacController } from './rbac.controller'
import { UsersLifecycleController } from './users-lifecycle.controller'
import { RbacService } from './rbac.service'
import { EmployeeAccessService } from './employee-access.service'
import { EmployeeLifecycleService } from './employee-lifecycle.service'
import { PermissionCacheService } from './permission-cache.service'

@Global()
@Module({
  controllers: [RbacController, UsersLifecycleController],
  providers: [RbacService, EmployeeAccessService, EmployeeLifecycleService, PermissionCacheService],
  exports: [RbacService, EmployeeAccessService, EmployeeLifecycleService, PermissionCacheService],
})
export class RbacModule {}
