#!/usr/bin/env node
/**
 * Safety guard preventing destructive or dev-only Prisma CLI commands
 * (`migrate reset`, `migrate dev`, `db push`) against non-localhost databases.
 * Never prints full connection strings or credentials.
 */
require('dotenv/config')

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres'])

function extractHost(rawUrl) {
  if (!rawUrl || !String(rawUrl).trim()) return null
  try {
    return new URL(String(rawUrl).trim()).hostname.toLowerCase()
  } catch {
    return '(invalid-url)'
  }
}

const cmdLabel = process.argv.slice(2).join(' ') || 'prisma command'
const targets = [
  ['DATABASE_URL', process.env.DATABASE_URL],
  ['DIRECT_URL', process.env.DIRECT_URL],
]

for (const [varName, raw] of targets) {
  const host = extractHost(raw)
  if (host && !LOCAL_HOSTS.has(host)) {
    console.error(
      `❌ Refusing to run "${cmdLabel}" because ${varName} targets non-localhost host "${host}". Use "npx prisma migrate deploy" for cloud/Neon databases.`,
    )
    process.exit(1)
  }
}

