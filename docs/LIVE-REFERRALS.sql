-- Referrals: everything the live database needs, in one go.
-- Safe to run more than once (every statement checks first). Only ADDS: four new tables and one index set; no existing table or row is changed.
-- Paste into the LIVE Supabase project: SQL editor > New query > Run.

CREATE TABLE IF NOT EXISTS "ReferralLink" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "rewardType" TEXT,
  "rewardValue" INTEGER,
  "welcomeMonths" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralLink_code_key" ON "ReferralLink"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralLink_workspaceId_customerId_key" ON "ReferralLink"("workspaceId", "customerId");

CREATE TABLE IF NOT EXISTS "Referral" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "referrerId" UUID,
  "partnerId" UUID,
  "refereeId" UUID NOT NULL,
  "freeMonths" INTEGER NOT NULL DEFAULT 0,
  "freeLabel" TEXT,
  "orderMinor" INTEGER,
  "via" TEXT NOT NULL DEFAULT 'team',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "flag" TEXT,
  "note" TEXT,
  "qualifiedAt" TIMESTAMP(3),
  "decidedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_workspaceId_refereeId_key" ON "Referral"("workspaceId", "refereeId");
CREATE INDEX IF NOT EXISTS "Referral_workspaceId_referrerId_idx" ON "Referral"("workspaceId", "referrerId");
CREATE INDEX IF NOT EXISTS "Referral_workspaceId_status_idx" ON "Referral"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "RewardEntry" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "payeeId" UUID NOT NULL,
  "payeeType" TEXT NOT NULL DEFAULT 'customer',
  "referralId" UUID,
  "kind" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "note" TEXT,
  "actorLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RewardEntry_referralId_payeeId_kind_key" ON "RewardEntry"("referralId", "payeeId", "kind");
CREATE INDEX IF NOT EXISTS "RewardEntry_workspaceId_payeeId_idx" ON "RewardEntry"("workspaceId", "payeeId");

CREATE TABLE IF NOT EXISTS "Partner" (
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
  "staffId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Partner_code_key" ON "Partner"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Partner_workspaceId_staffId_key" ON "Partner"("workspaceId", "staffId");
CREATE INDEX IF NOT EXISTS "Partner_workspaceId_active_idx" ON "Partner"("workspaceId", "active");
