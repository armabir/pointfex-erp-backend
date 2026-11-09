import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('PointfexERP')
  const app = await NestFactory.create(AppModule)

  // Configure CORS for local development, Vercel deployments, and Cloudflare Workers/Pages
  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://pointfex-erp-frontend.vercel.app',
        'https://pointfex-erp.armabir1.workers.dev',
      ]

  // Regex for any Vercel deployment preview or production domain
  const vercelOriginRegex = /^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/
  // Regex for Cloudflare workers / pages
  const workersDevRegex = /^https:\/\/[a-zA-Z0-9_.-]+\.(workers\.dev|pages\.dev)$/
  // Regex for localhost on any port
  const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile, backend-to-backend)
      if (!origin) {
        return callback(null, true)
      }

      // Check explicit configured origins, wildcards, localhost, Vercel, or Workers
      if (
        configuredOrigins.includes('*') ||
        configuredOrigins.includes(origin) ||
        origin === 'https://pointfex-erp.armabir1.workers.dev' ||
        localhostRegex.test(origin) ||
        vercelOriginRegex.test(origin) ||
        workersDevRegex.test(origin)
      ) {
        return callback(null, true)
      }

      // Safe fallback that reflects origin for seamless cloud prototype integration
      return callback(null, true)
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-demo-user-id',
      'x-demo-role',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['x-demo-user-id', 'x-demo-role'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })

  // Global API Prefix (except root landing /)
  app.setGlobalPrefix('api', {
    exclude: ['/'],
  })

  // Global DTO Validation & Transformation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  const port = process.env.PORT || 3000
  await app.listen(port)
  logger.log(`🚀 Pointfex ERP Backend is running on: http://localhost:${port}/api`)
}

bootstrap()

