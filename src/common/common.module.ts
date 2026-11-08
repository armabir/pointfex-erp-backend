import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { DemoIdentityGuard } from './demo-identity.guard'
import { RolesGuard } from './roles.guard'

@Global()
@Module({
  providers: [PrismaService, DemoIdentityGuard, RolesGuard],
  exports: [PrismaService, DemoIdentityGuard, RolesGuard],
})
export class CommonModule {}

