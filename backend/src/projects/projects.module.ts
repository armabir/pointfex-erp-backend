import { Module } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { ProjectsController } from './projects.controller'
import { ProjectRequestsService } from './project-requests.service'
import { ProposalsService } from './proposals.service'

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectRequestsService, ProposalsService],
  exports: [ProjectsService, ProjectRequestsService, ProposalsService],
})
export class ProjectsModule {}
