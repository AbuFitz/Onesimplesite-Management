-- Referrals: additive only (three new tables, no existing table is changed).
CREATE TABLE "ReferralLink" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReferralLink_code_key" ON "ReferralLink"("code");
CREATE UNIQUE INDEX "ReferralLink_workspaceId_customerId_key" ON "ReferralLink"("workspaceId", "customerId");

CREATE TABLE "Referral" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "referrerId" UUID NOT NULL,
  "refereeId" UUID NOT NULL,
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
CREATE UNIQUE INDEX "Referral_workspaceId_refereeId_key" ON "Referral"("workspaceId", "refereeId");
CREATE INDEX "Referral_workspaceId_referrerId_idx" ON "Referral"("workspaceId", "referrerId");
CREATE INDEX "Referral_workspaceId_status_idx" ON "Referral"("workspaceId", "status");

CREATE TABLE "RewardEntry" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "referralId" UUID,
  "kind" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "note" TEXT,
  "actorLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RewardEntry_referralId_customerId_kind_key" ON "RewardEntry"("referralId", "customerId", "kind");
CREATE INDEX "RewardEntry_workspaceId_customerId_idx" ON "RewardEntry"("workspaceId", "customerId");
