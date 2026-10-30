CREATE TABLE "VaultEntry" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "username" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "secret" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VaultEntry_workspaceId_title_idx" ON "VaultEntry"("workspaceId", "title");
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Access: only the app role; never the public Data API roles.
ALTER TABLE "VaultEntry" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "VaultEntry" TO oss_app;
    CREATE POLICY oss_app_all ON "VaultEntry" FOR ALL TO oss_app USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "VaultEntry" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "VaultEntry" FROM authenticated;
  END IF;
END $$;
