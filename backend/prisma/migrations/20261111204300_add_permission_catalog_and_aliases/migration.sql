-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "deprecatedAt" TIMESTAMP(3),
ADD COLUMN     "isCritical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDelegable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSystemRoot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;

-- CreateTable
CREATE TABLE "permission_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domains" TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_aliases" (
    "id" TEXT NOT NULL,
    "legacyCode" TEXT NOT NULL,
    "targetCode" TEXT NOT NULL,
    "legacyPermissionId" TEXT,
    "targetPermissionId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_categories_code_key" ON "permission_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permission_categories_slug_key" ON "permission_categories"("slug");

-- CreateIndex
CREATE INDEX "permission_categories_displayOrder_idx" ON "permission_categories"("displayOrder");

-- CreateIndex
CREATE INDEX "permission_aliases_legacyCode_idx" ON "permission_aliases"("legacyCode");

-- CreateIndex
CREATE INDEX "permission_aliases_targetCode_idx" ON "permission_aliases"("targetCode");

-- CreateIndex
CREATE INDEX "permission_aliases_legacyPermissionId_idx" ON "permission_aliases"("legacyPermissionId");

-- CreateIndex
CREATE INDEX "permission_aliases_targetPermissionId_idx" ON "permission_aliases"("targetPermissionId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_aliases_legacyCode_targetCode_key" ON "permission_aliases"("legacyCode", "targetCode");

-- CreateIndex
CREATE INDEX "permissions_categoryId_idx" ON "permissions"("categoryId");

-- CreateIndex
CREATE INDEX "permissions_isSensitive_idx" ON "permissions"("isSensitive");

-- CreateIndex
CREATE INDEX "permissions_isCritical_idx" ON "permissions"("isCritical");

-- CreateIndex
CREATE INDEX "permissions_isDelegable_idx" ON "permissions"("isDelegable");

-- CreateIndex
CREATE INDEX "permissions_isDeprecated_idx" ON "permissions"("isDeprecated");

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "permission_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_aliases" ADD CONSTRAINT "permission_aliases_legacyPermissionId_fkey" FOREIGN KEY ("legacyPermissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_aliases" ADD CONSTRAINT "permission_aliases_targetPermissionId_fkey" FOREIGN KEY ("targetPermissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
