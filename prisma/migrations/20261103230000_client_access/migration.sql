ALTER TYPE "ClientRole" ADD VALUE IF NOT EXISTS 'viewer';
ALTER TABLE "Invitation" ADD COLUMN "clientBilling" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AccessRequest" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "requestedByEmail" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT,
    "role" TEXT NOT NULL,
    "billing" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccessRequest_workspaceId_status_idx" ON "AccessRequest"("workspaceId", "status");
CREATE INDEX "AccessRequest_customerId_status_idx" ON "AccessRequest"("customerId", "status");

ALTER TABLE "AccessRequest" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "AccessRequest" TO oss_app;
    CREATE POLICY oss_app_all ON "AccessRequest" FOR ALL TO oss_app USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "AccessRequest" FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "AccessRequest" FROM authenticated; END IF;
END $$;
