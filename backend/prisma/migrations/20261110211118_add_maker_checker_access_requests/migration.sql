-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "access_change_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "requestedRoleId" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approvedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_change_requests_targetEmployeeId_status_idx" ON "access_change_requests"("targetEmployeeId", "status");

-- CreateIndex
CREATE INDEX "access_change_requests_status_idx" ON "access_change_requests"("status");

-- AddForeignKey
ALTER TABLE "access_change_requests" ADD CONSTRAINT "access_change_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_change_requests" ADD CONSTRAINT "access_change_requests_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_change_requests" ADD CONSTRAINT "access_change_requests_requestedRoleId_fkey" FOREIGN KEY ("requestedRoleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_change_requests" ADD CONSTRAINT "access_change_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
