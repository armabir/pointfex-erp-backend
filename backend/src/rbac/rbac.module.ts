import { Global, Module } from '@nestjs/common'
import { RbacController } from './rbac.controller'
import { UsersLifecycleController } from './users-lifecycle.controller'
import { DelegationsController } from './delegations.controller'
import { ApprovalsController } from './approvals.controller'
import { SecurityControlsController } from './security-controls.controller'
import { AccessHistoryController } from './access-history.controller'
import { RbacService } from './rbac.service'
import { EmployeeAccessService } from './employee-access.service'
import { EmployeeLifecycleService } from './employee-lifecycle.service'
import { PermissionCacheService } from './permission-cache.service'
import { CeoBootstrapService } from './ceo-bootstrap.service'
import { AuthorizationService } from './authorization.service'
import { DelegationService } from './delegation.service'
import { SodValidatorService } from './sod-validator.service'
import { ApprovalEngineService } from './approval-engine.service'
import { SecurityControlsService } from './security-controls.service'

@Global()
@Module({
  controllers: [
    RbacController,
    UsersLifecycleController,
    DelegationsController,
    ApprovalsController,
    SecurityControlsController,
    AccessHistoryController,
  ],
  providers: [
    RbacService,
    EmployeeAccessService,
    EmployeeLifecycleService,
    PermissionCacheService,
    CeoBootstrapService,
    AuthorizationService,
    DelegationService,
    SodValidatorService,
    ApprovalEngineService,
    SecurityControlsService,
  ],
  exports: [
    RbacService,
    EmployeeAccessService,
    EmployeeLifecycleService,
    PermissionCacheService,
    CeoBootstrapService,
    AuthorizationService,
    DelegationService,
    SodValidatorService,
    ApprovalEngineService,
    SecurityControlsService,
  ],
})
export class RbacModule {}
