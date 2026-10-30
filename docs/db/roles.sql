-- Least-privilege runtime role. Run once as the migration owner after `prisma migrate deploy`.
-- The app never connects as owner/superuser; migrations use MIGRATE_DATABASE_URL.
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN CREATE ROLE oss_app LOGIN PASSWORD 'CHANGE_ME'; END IF; END $$;
GRANT CONNECT ON DATABASE oss_manage TO oss_app;
GRANT USAGE ON SCHEMA public TO oss_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO oss_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO oss_app;
-- Append-only evidence: no UPDATE/DELETE even before the triggers fire.
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditEvent", "ProposalAcceptance" FROM oss_app;
-- Financial/signing history must not be hard-deleted by the app.
-- ProposalLine DELETE stays granted: drafts replace lines; a trigger blocks it once the version is sent.
REVOKE DELETE ON "Contract", "Customer", "BillingIntent", "ProposalVersion" FROM oss_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oss_app;
