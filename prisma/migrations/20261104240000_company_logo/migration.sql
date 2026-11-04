CREATE TABLE "CompanyLogo" (
    "customerId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "bytes" BYTEA NOT NULL,
    "type" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyLogo_pkey" PRIMARY KEY ("customerId")
);
ALTER TABLE "CompanyLogo" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "CompanyLogo" TO oss_app;
    CREATE POLICY oss_app_all ON "CompanyLogo" FOR ALL TO oss_app USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "CompanyLogo" FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "CompanyLogo" FROM authenticated; END IF;
END $$;
