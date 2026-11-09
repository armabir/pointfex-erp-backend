import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'Pointfex ERP API',
      status: 'online',
      message: 'Pointfex ERP API service is running successfully.',
      healthCheck: '/api/health',
      documentation: 'All application endpoints are served under the /api prefix.',
      endpoints: [
        '/api/health',
        '/api/employees',
        '/api/positions',
        '/api/teams',
        '/api/projects',
        '/api/tasks',
        '/api/finance',
        '/api/performance',
        '/api/reports',
        '/api/audit-logs',
        '/api/engineering',
        '/api/consultancy',
        '/api/governance',
      ],
      timestamp: new Date().toISOString(),
    }
  }
}
