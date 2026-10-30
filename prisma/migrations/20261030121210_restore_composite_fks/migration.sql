-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Proposal" DROP CONSTRAINT IF EXISTS "Proposal_customerId_fkey";

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_workspaceId_fkey" FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_workspaceId_fkey" FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_customerId_workspaceId_fkey" FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_workspaceId_fkey" FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_workspaceId_fkey" FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
