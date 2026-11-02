-- Values the legal documents quote (support hours, notice period, emails...) live in settings, not in the wording.
ALTER TABLE "Workspace" ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}';

-- Care plans the team sells. Prices and allowances are edited here and filled into the documents when an order is sent.
CREATE TABLE "ServicePlan" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "monthlyMinor" INTEGER NOT NULL DEFAULT 0,
    "revisionsPerMonth" INTEGER NOT NULL DEFAULT 3,
    "backupFrequency" TEXT,
    "backupRetention" TEXT,
    "summary" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServicePlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServicePlan_workspaceId_key_key" ON "ServicePlan"("workspaceId", "key");
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServicePlan" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "ServicePlan" TO oss_app;
    CREATE POLICY oss_app_all ON "ServicePlan" FOR ALL TO oss_app USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "ServicePlan" FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "ServicePlan" FROM authenticated; END IF;
END $$;
