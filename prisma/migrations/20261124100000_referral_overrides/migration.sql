-- Referrals: a company's own deal, and team members' own links. Additive (new nullable columns on the referral tables only).
ALTER TABLE "ReferralLink" ADD COLUMN "rewardType" TEXT, ADD COLUMN "rewardValue" INTEGER, ADD COLUMN "welcomeMonths" INTEGER;
ALTER TABLE "Partner" ADD COLUMN "staffId" UUID;
CREATE UNIQUE INDEX "Partner_workspaceId_staffId_key" ON "Partner"("workspaceId", "staffId");
