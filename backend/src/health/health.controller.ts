import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { Public } from '../common/public.decorator'
import { PrismaService } from '../common/prisma.service'

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'pointfex-erp-backend' }
  }

  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { status: 'ready', database: 'connected' }
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready', database: 'disconnected' })
    }
  }
}

