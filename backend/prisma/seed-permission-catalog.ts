import { PrismaClient } from '@prisma/client'
import { seedPermissionCatalog } from '../src/rbac/permission-catalog.seeder'

export {
  seedPermissionCatalog,
  type SeedPermissionCatalogOptions,
  type SeedPermissionCatalogResult,
} from '../src/rbac/permission-catalog.seeder'

if (require.main === module) {
  const prisma = new PrismaClient()
  seedPermissionCatalog(prisma)
    .then((result) => {
      console.log(
        `✅ Permission catalog seeded: ${result.categoryCount} categories, ${result.masterPermissionCount} master codes (${result.criticalCount} ⚠ critical, ${result.delegableCount} delegable), ${result.deprecatedCount} deprecated, ${result.sensitiveCount} sensitive (${result.sensitiveNonCriticalActiveCount} non-critical preserved), ${result.aliasCount} aliases.`,
      )
    })
    .catch((err) => {
      console.error('❌ Permission catalog seed failed:', err)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
