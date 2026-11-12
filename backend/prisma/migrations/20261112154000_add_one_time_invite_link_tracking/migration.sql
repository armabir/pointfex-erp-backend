-- AlterTable
ALTER TABLE "employees"
ADD COLUMN "inviteTokenHash" TEXT,
ADD COLUMN "inviteTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "inviteTokenUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "employees_inviteTokenHash_key" ON "employees"("inviteTokenHash");

