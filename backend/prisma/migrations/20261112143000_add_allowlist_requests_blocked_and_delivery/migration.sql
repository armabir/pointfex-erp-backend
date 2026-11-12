-- AlterTable
ALTER TABLE "employees"
ADD COLUMN "inviteDeliveryStatus" TEXT NOT NULL DEFAULT 'sent',
ADD COLUMN "inviteLastSentAt" TIMESTAMP(3),
ADD COLUMN "inviteLastError" TEXT,
ADD COLUMN "inviteResendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "inviteResendWindowStart" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "lastLoginMethod" TEXT;

-- CreateTable
CREATE TABLE "login_blocked_attempts" (
    "id" TEXT NOT NULL,
    "maskedEmail" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_blocked_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowlist_email_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowlist_email_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_blocked_attempts_createdAt_idx" ON "login_blocked_attempts"("createdAt");

-- CreateIndex
CREATE INDEX "login_blocked_attempts_emailHash_idx" ON "login_blocked_attempts"("emailHash");

-- CreateIndex
CREATE INDEX "allowlist_email_requests_status_createdAt_idx" ON "allowlist_email_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "allowlist_email_requests_email_idx" ON "allowlist_email_requests"("email");

