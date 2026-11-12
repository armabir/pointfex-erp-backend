-- CreateEnum
CREATE TYPE "DelegationStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "delegations" (
    "id" TEXT NOT NULL,
    "delegatorId" TEXT NOT NULL,
    "delegateeId" TEXT NOT NULL,
    "status" "DelegationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 1,
    "parentDelegationId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "revocationTrigger" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_permissions" (
    "id" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_scopes" (
    "id" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "scope" "AuthorizationScope" NOT NULL DEFAULT 'PROJECT',
    "scopeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resourceType" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delegations_delegatorId_status_idx" ON "delegations"("delegatorId", "status");

-- CreateIndex
CREATE INDEX "delegations_delegateeId_status_idx" ON "delegations"("delegateeId", "status");

-- CreateIndex
CREATE INDEX "delegations_status_expiresAt_idx" ON "delegations"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "delegations_startsAt_expiresAt_idx" ON "delegations"("startsAt", "expiresAt");

-- CreateIndex
CREATE INDEX "delegation_permissions_permissionId_idx" ON "delegation_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "delegation_permissions_delegationId_permissionId_key" ON "delegation_permissions"("delegationId", "permissionId");

-- CreateIndex
CREATE INDEX "delegation_scopes_delegationId_idx" ON "delegation_scopes"("delegationId");

-- CreateIndex
CREATE INDEX "delegation_scopes_scope_idx" ON "delegation_scopes"("scope");

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegateeId_fkey" FOREIGN KEY ("delegateeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_permissions" ADD CONSTRAINT "delegation_permissions_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_permissions" ADD CONSTRAINT "delegation_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_scopes" ADD CONSTRAINT "delegation_scopes_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "delegations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
