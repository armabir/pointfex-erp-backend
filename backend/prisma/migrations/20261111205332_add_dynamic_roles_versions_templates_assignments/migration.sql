-- CreateEnum
CREATE TYPE "AuthorizationScope" AS ENUM ('SELF', 'ASSIGNED', 'SQUAD', 'DEPARTMENT', 'PROJECT', 'ORG', 'GLOBAL');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "includeCritical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRootRole" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateCode" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "wildcards" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "role_versions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "wildcards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permissionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeCritical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changeReason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultScope" "AuthorizationScope" NOT NULL DEFAULT 'ORG',
    "wildcards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "permissionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeCritical" BOOLEAN NOT NULL DEFAULT false,
    "restrictedNotes" TEXT,
    "isSystemManaged" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scope" "AuthorizationScope" NOT NULL DEFAULT 'ORG',
    "scopeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignedById" TEXT,
    "reason" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_versions_roleId_idx" ON "role_versions"("roleId");

-- CreateIndex
CREATE INDEX "role_versions_createdAt_idx" ON "role_versions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "role_versions_roleId_version_key" ON "role_versions"("roleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "role_templates_code_key" ON "role_templates"("code");

-- CreateIndex
CREATE INDEX "user_role_assignments_employeeId_isActive_idx" ON "user_role_assignments"("employeeId", "isActive");

-- CreateIndex
CREATE INDEX "user_role_assignments_roleId_isActive_idx" ON "user_role_assignments"("roleId", "isActive");

-- CreateIndex
CREATE INDEX "user_role_assignments_expiresAt_idx" ON "user_role_assignments"("expiresAt");

-- CreateIndex
CREATE INDEX "user_role_assignments_scope_idx" ON "user_role_assignments"("scope");

-- CreateIndex
CREATE INDEX "roles_isRootRole_idx" ON "roles"("isRootRole");

-- CreateIndex
CREATE INDEX "roles_templateCode_idx" ON "roles"("templateCode");

-- AddForeignKey
ALTER TABLE "role_versions" ADD CONSTRAINT "role_versions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
