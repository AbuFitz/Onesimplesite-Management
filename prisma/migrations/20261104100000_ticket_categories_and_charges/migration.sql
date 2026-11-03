ALTER TABLE "Ticket" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'support', ADD COLUMN "priceMinor" INTEGER,
  ADD COLUMN "chargeStatus" TEXT NOT NULL DEFAULT 'none', ADD COLUMN "approvedAt" TIMESTAMP(3), ADD COLUMN "approvedByName" TEXT,
  ADD COLUMN "lastCustomerAt" TIMESTAMP(3), ADD COLUMN "lastStaffAt" TIMESTAMP(3), ADD COLUMN "remindedAt" TIMESTAMP(3), ADD COLUMN "teamRemindedAt" TIMESTAMP(3);
ALTER TABLE "BillingIntent" ALTER COLUMN "contractId" DROP NOT NULL, ADD COLUMN "ticketId" UUID;
CREATE UNIQUE INDEX "BillingIntent_ticketId_key" ON "BillingIntent"("ticketId");
ALTER TABLE "BillingIntent" ADD CONSTRAINT "BillingIntent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
