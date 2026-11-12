import { INestApplication, Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser = require('cookie-parser')
import helmet from 'helmet'
import { AppModule } from './app.module'

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  configureApp(app)
  await app.init()
  return app
}

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService)

  // Vercel and the local reverse proxies both provide one trusted proxy hop.
  app.getHttpAdapter().getInstance().set('trust proxy', 1)
  app.use(cookieParser())
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  )

  const allowedOrigins = configService
    .getOrThrow<string>('CORS_ORIGIN')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*')

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error(`Origin "${origin}" is not allowed by CORS policy`), false)
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  })

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
}

export async function listen(): Promise<void> {
  const logger = new Logger('PointfexERP')
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  configureApp(app)
  const configService = app.get(ConfigService)
  const portValue = Number(configService.getOrThrow<string>('PORT'))

  if (!Number.isInteger(portValue) || portValue <= 0) {
    throw new Error('PORT environment variable must be a valid positive integer.')
  }

  await app.listen(portValue)
  logger.log(`Pointfex ERP Backend is running on port ${portValue} (/api)`)
}
