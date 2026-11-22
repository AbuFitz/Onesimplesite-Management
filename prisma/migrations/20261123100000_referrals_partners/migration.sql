-- Referrals v2: partners, cash payouts, the new company's free-months incentive. Additive (new table; the referral tables are not live yet).
CREATE TABLE "Partner" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'agency',
  "email" TEXT,
  "code" TEXT NOT NULL,
  "commissionType" TEXT NOT NULL DEFAULT 'fixed',
  "commissionValue" INTEGER NOT NULL DEFAULT 5000,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Partner_code_key" ON "Partner"("code");
CREATE INDEX "Partner_workspaceId_active_idx" ON "Partner"("workspaceId", "active");

ALTER TABLE "Referral" ALTER COLUMN "referrerId" DROP NOT NULL;
ALTER TABLE "Referral" ADD COLUMN "partnerId" UUID, ADD COLUMN "freeMonths" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "freeLabel" TEXT, ADD COLUMN "orderMinor" INTEGER;

DROP INDEX "RewardEntry_referralId_customerId_kind_key";
DROP INDEX "RewardEntry_workspaceId_customerId_idx";
ALTER TABLE "RewardEntry" RENAME COLUMN "customerId" TO "payeeId";
ALTER TABLE "RewardEntry" ADD COLUMN "payeeType" TEXT NOT NULL DEFAULT 'customer';
CREATE UNIQUE INDEX "RewardEntry_referralId_payeeId_kind_key" ON "RewardEntry"("referralId", "payeeId", "kind");
CREATE INDEX "RewardEntry_workspaceId_payeeId_idx" ON "RewardEntry"("workspaceId", "payeeId");
