import { Module } from '@nestjs/common'
import { EngineeringService } from './engineering.service'
import { EngineeringController } from './engineering.controller'

@Module({
  controllers: [EngineeringController],
  providers: [EngineeringService],
  exports: [EngineeringService],
})
export class EngineeringModule {}
