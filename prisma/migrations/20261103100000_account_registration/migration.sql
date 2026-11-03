-- Account registration: what kind of business, and where. Customer type is now company, sole trader or individual.
ALTER TABLE "Customer" ADD COLUMN "businessType" TEXT;
ALTER TABLE "Customer" ADD COLUMN "town" TEXT;

-- A support ticket can be about one of the customer's projects.
ALTER TABLE "Ticket" ADD COLUMN "projectId" UUID;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
