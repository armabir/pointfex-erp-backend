import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

const APPEND_ONLY_SQL_RE =
  /\b(TRUNCATE|DROP\s+(TABLE|TRIGGER|FUNCTION)|ALTER\s+TABLE|DELETE\s+FROM|UPDATE)\b[\s\S]*\b(audit_logs|financial_transactions|xp_ledger_entries)\b/i
const BLOCKED_MUTATION_OPS = new Set(['update', 'updateMany', 'upsert', 'delete', 'deleteMany'])

function assertSafeRawSql(sqlText: string): void {
  if (APPEND_ONLY_SQL_RE.test(sqlText)) {
    throw new Error(
      'Security policy: Destructive or mutating SQL against append-only audit/ledger tables is prohibited.',
    )
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super()

    const wrapDelegate = (modelKey: 'auditLog' | 'financialTransaction' | 'xpLedgerEntry') => {
      const delegate = (this as any)[modelKey]
      if (!delegate) return
      ;(this as any)[modelKey] = new Proxy(delegate, {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && BLOCKED_MUTATION_OPS.has(prop)) {
            return () => {
              throw new Error(
                `Security policy: "${modelKey}.${prop}()" is blocked because "${modelKey}" is strictly append-only.`,
              )
            }
          }
          return Reflect.get(target, prop, receiver)
        },
      })
    }

    wrapDelegate('auditLog')
    wrapDelegate('financialTransaction')
    wrapDelegate('xpLedgerEntry')

    const origExecuteRaw = this.$executeRaw.bind(this)
    ;(this as any).$executeRaw = (query: any, ...values: any[]) => {
      const sqlText = Array.isArray(query?.strings) ? query.strings.join(' ') : String(query)
      assertSafeRawSql(sqlText)
      return origExecuteRaw(query, ...values)
    }

    const origExecuteRawUnsafe = this.$executeRawUnsafe.bind(this)
    ;(this as any).$executeRawUnsafe = (query: string, ...values: any[]) => {
      assertSafeRawSql(String(query))
      return origExecuteRawUnsafe(query, ...values)
    }
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
