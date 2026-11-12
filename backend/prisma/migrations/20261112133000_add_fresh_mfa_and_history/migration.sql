-- Phase 4B: Additive Fresh-MFA & Immutable History Schema

ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "mfaLastUsedStep" INTEGER,
ADD COLUMN IF NOT EXISTS "mfaFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "mfaFailureWindowStart" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "mfaLockedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "mfaRecoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "actionKey" TEXT,
ADD COLUMN IF NOT EXISTS "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "device" TEXT;

CREATE TABLE IF NOT EXISTS "employee_change_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "reason" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_change_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employee_change_history_employeeId_createdAt_idx" ON "employee_change_history"("employeeId", "createdAt");
CREATE INDEX IF NOT EXISTS "employee_change_history_actorId_idx" ON "employee_change_history"("actorId");

ALTER TABLE "employee_change_history"
ADD CONSTRAINT "employee_change_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_change_history"
ADD CONSTRAINT "employee_change_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sensitive_profile_view_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_profile_view_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sensitive_profile_view_tokens_tokenHash_key" ON "sensitive_profile_view_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "sensitive_profile_view_tokens_actorId_targetEmployeeId_idx" ON "sensitive_profile_view_tokens"("actorId", "targetEmployeeId");
CREATE INDEX IF NOT EXISTS "sensitive_profile_view_tokens_expiresAt_idx" ON "sensitive_profile_view_tokens"("expiresAt");

CREATE TABLE IF NOT EXISTS "mfa_action_bindings" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "timeStep" INTEGER NOT NULL,
    "actionKey" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_action_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mfa_action_bindings_actorId_timeStep_key" ON "mfa_action_bindings"("actorId", "timeStep");
CREATE INDEX IF NOT EXISTS "mfa_action_bindings_actorId_createdAt_idx" ON "mfa_action_bindings"("actorId", "createdAt");
