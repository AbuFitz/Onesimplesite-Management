-- Ticket-style fields on a job (priority, due date). Assignee already exists as ownerId.
ALTER TABLE "Opportunity" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "Opportunity" ADD COLUMN "dueDate" TIMESTAMP(3);
