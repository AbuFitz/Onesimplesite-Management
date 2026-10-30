-- Least-privilege runtime role. Run ONCE as the migration owner (Supabase: the `postgres` user in the SQL editor)
-- AFTER `prisma migrate deploy`. Replace the password first. Works on any Postgres 14+.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN CREATE ROLE oss_app LOGIN PASSWORD 'CHANGE_ME'; END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO oss_app', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO oss_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oss_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oss_app;
-- Append-only evidence: no UPDATE/DELETE even before the triggers fire.
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent", "ProposalAcceptance", "SignatureRecord", "ContractDocument" FROM oss_app;
-- ProposalLine DELETE stays granted: drafts replace lines; a trigger blocks it once the version is sent.
REVOKE DELETE ON "Contract", "Customer", "BillingIntent", "ProposalVersion" FROM oss_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oss_app;
