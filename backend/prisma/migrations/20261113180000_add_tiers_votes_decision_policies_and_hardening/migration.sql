-- CreateEnum idempotently
DO $$ BEGIN
  CREATE TYPE "RoleTier" AS ENUM ('CEO', 'EXECUTIVE', 'MANAGER', 'STAFF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DecisionMode" AS ENUM ('CEO_ONLY', 'EXECUTIVE_VOTE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VoteChoice" AS ENUM ('APPROVE', 'REJECT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_VOTE', 'APPROVED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_pmPositionId_fkey";

-- AlterTable
ALTER TABLE "budget_requests" ADD COLUMN IF NOT EXISTS "decisionMode" "DecisionMode" NOT NULL DEFAULT 'EXECUTIVE_VOTE',
ADD COLUMN IF NOT EXISTS "urgency" TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS "voteDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "whatItCovers" TEXT;

-- AlterTable
ALTER TABLE "role_templates" ADD COLUMN IF NOT EXISTS "tier" "RoleTier" NOT NULL DEFAULT 'STAFF';

-- AlterTable
ALTER TABLE "role_versions" ADD COLUMN IF NOT EXISTS "tier" "RoleTier" NOT NULL DEFAULT 'STAFF';

-- AlterTable
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "tier" "RoleTier" NOT NULL DEFAULT 'STAFF';

-- CreateTable
CREATE TABLE IF NOT EXISTS "decision_policies" (
    "id" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "mode" "DecisionMode" NOT NULL DEFAULT 'CEO_ONLY',
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "executive_votes" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "reason" TEXT,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executive_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_creation_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "requesterId" TEXT NOT NULL,
    "proposedPmId" TEXT,
    "scopeDeliverables" TEXT NOT NULL,
    "timeline" TEXT NOT NULL,
    "teamDetails" JSONB,
    "initialBudgetBDT" DECIMAL(14,2) NOT NULL,
    "risks" TEXT NOT NULL,
    "successCriteria" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "creditedDeveloperId" TEXT,
    "proposalId" TEXT,
    "status" "ProjectRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decisionMode" "DecisionMode" NOT NULL DEFAULT 'EXECUTIVE_VOTE',
    "voteDeadline" TIMESTAMP(3),
    "approvedProjectId" TEXT,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_creation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_proposals" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedPmId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "forwardedRequestId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PROPOSAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "password_histories" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "decision_policies_requestType_key" ON "decision_policies"("requestType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "executive_votes_requestId_idx" ON "executive_votes"("requestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "executive_votes_voterId_idx" ON "executive_votes"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "executive_votes_requestId_voterId_key" ON "executive_votes"("requestId", "voterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_creation_requests_requesterId_idx" ON "project_creation_requests"("requesterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_creation_requests_status_idx" ON "project_creation_requests"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_proposals_requesterId_idx" ON "project_proposals"("requesterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_proposals_status_idx" ON "project_proposals"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_histories_employeeId_idx" ON "password_histories"("employeeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_histories_createdAt_idx" ON "password_histories"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "roles_tier_idx" ON "roles"("tier");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "teams" ADD CONSTRAINT "teams_pmPositionId_fkey" FOREIGN KEY ("pmPositionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "executive_votes" ADD CONSTRAINT "executive_votes_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "project_creation_requests" ADD CONSTRAINT "project_creation_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "project_proposals" ADD CONSTRAINT "project_proposals_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "password_histories" ADD CONSTRAINT "password_histories_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
