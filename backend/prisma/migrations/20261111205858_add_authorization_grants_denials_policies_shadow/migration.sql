-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "user_permission_grants" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scope" "AuthorizationScope" NOT NULL DEFAULT 'ORG',
    "scopeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantedById" TEXT,
    "reason" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_denials" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scope" "AuthorizationScope" NOT NULL DEFAULT 'ORG',
    "scopeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deniedById" TEXT,
    "reason" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permission_denials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_policies" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorization_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authz_shadow_logs" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeEmail" TEXT,
    "actingRole" TEXT,
    "permissionCode" TEXT NOT NULL,
    "routePath" TEXT,
    "httpMethod" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "oldAllowed" BOOLEAN NOT NULL,
    "newAllowed" BOOLEAN NOT NULL,
    "reason" TEXT,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authz_shadow_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permission_grants_employeeId_isActive_idx" ON "user_permission_grants"("employeeId", "isActive");

-- CreateIndex
CREATE INDEX "user_permission_grants_permissionId_isActive_idx" ON "user_permission_grants"("permissionId", "isActive");

-- CreateIndex
CREATE INDEX "user_permission_grants_expiresAt_idx" ON "user_permission_grants"("expiresAt");

-- CreateIndex
CREATE INDEX "user_permission_denials_employeeId_isActive_idx" ON "user_permission_denials"("employeeId", "isActive");

-- CreateIndex
CREATE INDEX "user_permission_denials_permissionId_isActive_idx" ON "user_permission_denials"("permissionId", "isActive");

-- CreateIndex
CREATE INDEX "user_permission_denials_expiresAt_idx" ON "user_permission_denials"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "authorization_policies_key_key" ON "authorization_policies"("key");

-- CreateIndex
CREATE INDEX "authz_shadow_logs_employeeId_idx" ON "authz_shadow_logs"("employeeId");

-- CreateIndex
CREATE INDEX "authz_shadow_logs_permissionCode_idx" ON "authz_shadow_logs"("permissionCode");

-- CreateIndex
CREATE INDEX "authz_shadow_logs_createdAt_idx" ON "authz_shadow_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_denials" ADD CONSTRAINT "user_permission_denials_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_denials" ADD CONSTRAINT "user_permission_denials_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
