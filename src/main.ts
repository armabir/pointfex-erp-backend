import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config'
import { ValidationPipe, Logger } from '@nestjs/common'
import * as cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('PointfexERP')
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const configService = app.get(ConfigService)

  // Honor X-Forwarded-For from first reverse proxy (Nginx / Vite / Load Balancer)
  app.set('trust proxy', 1)

  // Parse HttpOnly authentication cookies
  app.use(cookieParser())

  // Security headers and strict Content Security Policy via Helmet
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

  // Strictly enforce whitelisted CORS origins configured via environment
  const corsRaw = configService.getOrThrow<string>('CORS_ORIGIN')
  const allowedOrigins = corsRaw
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

  // Global API Prefix
  app.setGlobalPrefix('api')

  // Strict Global DTO Validation, Whitelisting & Transformation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  const portValue = Number(configService.getOrThrow<string>('PORT'))
  if (!Number.isInteger(portValue) || portValue <= 0) {
    throw new Error('PORT environment variable must be a valid positive integer.')
  }

  await app.listen(portValue)
  logger.log(`🚀 Pointfex ERP Backend is running on port ${portValue} (/api)`)
}

bootstrap()
