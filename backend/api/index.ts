import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { createApp } from '../src/bootstrap'

let appPromise: Promise<NestExpressApplication> | undefined

export default async function handler(req: VercelRequest, res: VercelResponse) {
  appPromise ??= createApp()
  const app = await appPromise
  return app.getHttpAdapter().getInstance()(req, res)
}
