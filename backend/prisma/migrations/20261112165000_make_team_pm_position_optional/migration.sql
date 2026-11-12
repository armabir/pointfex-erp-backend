-- AlterTable: allow creating a team before assigning a Project Manager position
ALTER TABLE "teams" ALTER COLUMN "pmPositionId" DROP NOT NULL;

