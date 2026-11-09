import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import express from 'express'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from '../src/app.module'

const server = express()
let isInitialized = false

async function bootstrap() {
  if (!isInitialized) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server))

    const configuredOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'https://pointfex-erp.armabir1.workers.dev',
        ]

    const vercelOriginRegex = /^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/
    const workersDevRegex = /^https:\/\/[a-zA-Z0-9_.-]+\.(workers\.dev|pages\.dev)$/
    const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
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

    app.setGlobalPrefix('api')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    )

    await app.init()
    isInitialized = true
  }
  return server
}

export default async function handler(req: any, res: any) {
  const expressInstance = await bootstrap()
  return expressInstance(req, res)
}
