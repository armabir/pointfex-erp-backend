-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('SEQUENTIAL', 'PARALLEL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'ESCALATED', 'TIMED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "sod_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "actionCodes" TEXT[],
    "entityScope" TEXT NOT NULL DEFAULT 'SAME_RESOURCE',
    "isStrict" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sod_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "mode" "ApprovalMode" NOT NULL DEFAULT 'SEQUENTIAL',
    "minApprovals" INTEGER NOT NULL DEFAULT 1,
    "requiresDualApproval" BOOLEAN NOT NULL DEFAULT false,
    "amountThreshold" DECIMAL(14,2),
    "stepDefinitions" JSONB NOT NULL,
    "escalationAfterHours" INTEGER,
    "timeoutHours" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "policyId" TEXT,
    "actionCode" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "ApprovalMode" NOT NULL DEFAULT 'SEQUENTIAL',
    "requiresDualApproval" BOOLEAN NOT NULL DEFAULT false,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "reason" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "requiredPermission" TEXT NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decisionNotes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "escalatedToPermission" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sod_rules_code_key" ON "sod_rules"("code");

-- CreateIndex
CREATE INDEX "sod_rules_isActive_idx" ON "sod_rules"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "approval_policies_code_key" ON "approval_policies"("code");

-- CreateIndex
CREATE INDEX "approval_policies_actionCode_isActive_idx" ON "approval_policies"("actionCode", "isActive");

-- CreateIndex
CREATE INDEX "approval_requests_entityType_entityId_idx" ON "approval_requests"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "approval_requests_requesterId_status_idx" ON "approval_requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "approval_requests_status_expiresAt_idx" ON "approval_requests"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "approval_requests_actionCode_status_idx" ON "approval_requests"("actionCode", "status");

-- CreateIndex
CREATE INDEX "approval_steps_requestId_stepOrder_idx" ON "approval_steps"("requestId", "stepOrder");

-- CreateIndex
CREATE INDEX "approval_steps_status_dueAt_idx" ON "approval_steps"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
