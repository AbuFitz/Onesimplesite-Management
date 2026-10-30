-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "contact_ws_fk";

-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "contract_ws_fk";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "opp_ws_fk";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "project_ws_fk";

-- DropForeignKey
ALTER TABLE "Proposal" DROP CONSTRAINT "proposal_ws_fk";

-- AlterTable
ALTER TABLE "two_factor" ADD COLUMN     "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;
