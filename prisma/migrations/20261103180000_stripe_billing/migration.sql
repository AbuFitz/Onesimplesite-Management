ALTER TABLE "Customer" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "BillingIntent" ADD COLUMN "description" TEXT, ADD COLUMN "paidAt" TIMESTAMP(3), ADD COLUMN "paidVia" TEXT,
  ADD COLUMN "stripeSessionId" TEXT, ADD COLUMN "stripePaymentIntent" TEXT, ADD COLUMN "stripeSubscriptionId" TEXT;
CREATE INDEX "BillingIntent_stripeSubscriptionId_idx" ON "BillingIntent"("stripeSubscriptionId");
