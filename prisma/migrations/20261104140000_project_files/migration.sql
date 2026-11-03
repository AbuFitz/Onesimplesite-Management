ALTER TABLE "Attachment" ALTER COLUMN "ticketId" DROP NOT NULL, ADD COLUMN "projectId" UUID, ADD COLUMN "folder" TEXT;
CREATE INDEX "Attachment_projectId_createdAt_idx" ON "Attachment"("projectId", "createdAt");
