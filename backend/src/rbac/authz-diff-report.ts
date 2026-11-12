import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const mode = process.env.AUTHZ_MODE || 'shadow'
    const logs = await prisma.authzShadowLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    console.log(`=== Pointfex Authorization Shadow Diff Report (AUTHZ_MODE=${mode}) ===`)
    console.log(`Total logged disagreements: ${logs.length}`)

    if (logs.length === 0) {
      console.log('Zero shadow-mode disagreements recorded.')
      return
    }

    const summary = new Map<
      string,
      {
        employeeId: string
        actingRole: string
        permissionCode: string
        routePath: string
        oldAllowed: boolean
        newAllowed: boolean
        count: number
        lastSeen: string
        reason: string
      }
    >()

    for (const row of logs) {
      const key = `${row.employeeId}|${row.permissionCode}|${row.routePath ?? ''}|${row.oldAllowed}->${row.newAllowed}`
      const existing = summary.get(key)
      if (existing) {
        existing.count++
      } else {
        summary.set(key, {
          employeeId: row.employeeId,
          actingRole: row.actingRole ?? '-',
          permissionCode: row.permissionCode,
          routePath: row.routePath ?? '-',
          oldAllowed: row.oldAllowed,
          newAllowed: row.newAllowed,
          count: 1,
          lastSeen: row.createdAt.toISOString(),
          reason: row.reason ?? '-',
        })
      }
    }

    console.table(Array.from(summary.values()))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Failed generating authz diff report:', err)
  process.exitCode = 1
})

