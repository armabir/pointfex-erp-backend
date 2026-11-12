-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "afterState" JSONB,
ADD COLUMN     "approvalChain" JSONB,
ADD COLUMN     "beforeState" JSONB,
ADD COLUMN     "delegationId" TEXT,
ADD COLUMN     "entryHash" TEXT,
ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN     "permissionSource" TEXT,
ADD COLUMN     "prevHash" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaSecret" TEXT;

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN     "reversalOfId" TEXT;

-- CreateTable
CREATE TABLE "xp_ledger_entries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'AWARD',
    "reversalOfId" TEXT,
    "awardedById" TEXT,
    "approvalRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_sessions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenFamilyId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "mfaMethod" TEXT DEFAULT 'NONE',
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_reviews" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "findings" JSONB,
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_ledger_entries_employeeId_createdAt_idx" ON "xp_ledger_entries"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "xp_ledger_entries_reversalOfId_idx" ON "xp_ledger_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "security_sessions_employeeId_isRevoked_idx" ON "security_sessions"("employeeId", "isRevoked");

-- CreateIndex
CREATE INDEX "security_sessions_expiresAt_idx" ON "security_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "access_reviews_targetEmployeeId_status_idx" ON "access_reviews"("targetEmployeeId", "status");

-- CreateIndex
CREATE INDEX "access_reviews_reviewerId_status_idx" ON "access_reviews"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_entryHash_idx" ON "audit_logs"("entryHash");

-- CreateIndex
CREATE INDEX "audit_logs_actionCode_idx" ON "audit_logs"("actionCode");

-- CreateIndex
CREATE INDEX "financial_transactions_reversalOfId_idx" ON "financial_transactions"("reversalOfId");

-- AddForeignKey
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_sessions" ADD CONSTRAINT "security_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DB-Level Append-Only Immutability Triggers (Audit Log, Financial Ledger, XP Ledger)
CREATE OR REPLACE FUNCTION prevent_append_only_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table "%" is strictly append-only and tamper-evident; UPDATE and DELETE operations are prohibited.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON "audit_logs";
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_financial_transactions_immutable ON "financial_transactions";
CREATE TRIGGER trg_financial_transactions_immutable
BEFORE UPDATE OR DELETE ON "financial_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_xp_ledger_entries_immutable ON "xp_ledger_entries";
CREATE TRIGGER trg_xp_ledger_entries_immutable
BEFORE UPDATE OR DELETE ON "xp_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
