-- People: where someone sits in the customer's business.
ALTER TABLE "Contact" ADD COLUMN "position" TEXT;

-- Support tickets: raised by the team or by the client in their portal, always linked to the person who reached out.
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "contactId" UUID,
    "reference" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'issue',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "source" TEXT NOT NULL DEFAULT 'staff',
    "assigneeId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ticket_workspaceId_reference_key" ON "Ticket"("workspaceId", "reference");
CREATE INDEX "Ticket_workspaceId_status_idx" ON "Ticket"("workspaceId", "status");
CREATE INDEX "Ticket_workspaceId_customerId_idx" ON "Ticket"("workspaceId", "customerId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_customerId_workspaceId_fkey" FOREIGN KEY ("customerId", "workspaceId") REFERENCES "Customer"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TicketComment" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorKind" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorStaffId" UUID,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ticket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TicketComment" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "Ticket", "TicketComment" TO oss_app;
    CREATE POLICY oss_app_all ON "Ticket" FOR ALL TO oss_app USING (true) WITH CHECK (true);
    CREATE POLICY oss_app_all ON "TicketComment" FOR ALL TO oss_app USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "Ticket", "TicketComment" FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "Ticket", "TicketComment" FROM authenticated; END IF;
END $$;
