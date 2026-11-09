import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../common/prisma.service'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = 'healthy'
    let dbLatencyMs = 0

    try {
      const start = Date.now()
      await this.prisma.$queryRaw`SELECT 1`
      dbLatencyMs = Date.now() - start
    } catch (e: any) {
      dbStatus = `unhealthy: ${e.message}`
    }

    return {
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      service: 'pointfex-erp-backend',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      corsAllowedOrigins: process.env.CORS_ORIGIN || 'default (localhost, vercel.app)',
      version: '1.0.0',
    }
  }
}
