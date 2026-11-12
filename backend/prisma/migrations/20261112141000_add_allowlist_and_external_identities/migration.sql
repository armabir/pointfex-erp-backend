-- AlterTable
ALTER TABLE "employees" ADD COLUMN "tempPasswordExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "login_allowlist" (
    "id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "isDomain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_allowlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identities" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_allowlist_pattern_key" ON "login_allowlist"("pattern");

-- CreateIndex
CREATE INDEX "login_allowlist_isActive_pattern_idx" ON "login_allowlist"("isActive", "pattern");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_provider_providerUserId_key" ON "external_identities"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "external_identities_employeeId_provider_idx" ON "external_identities"("employeeId", "provider");

-- CreateIndex
CREATE INDEX "external_identities_email_idx" ON "external_identities"("email");

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

