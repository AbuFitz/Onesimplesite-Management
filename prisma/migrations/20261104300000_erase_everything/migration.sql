-- Deleting a company now leaves nothing of it behind: its queued and sent emails and its activity history go too.
-- The audit log stays append-only for the app role; only this erasure function (running as the owner) may delete a company's rows.

DROP TRIGGER IF EXISTS audit_append_only ON "AuditEvent";
CREATE TRIGGER audit_append_only BEFORE DELETE OR UPDATE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION oss_append_only_erasable();

CREATE OR REPLACE FUNCTION oss_erase_company(p_workspace uuid, p_customer uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_projects uuid[]; v_contracts uuid[]; v_proposals uuid[]; v_signing uuid[]; v_versions uuid[];
  v_name text; v_emails text[]; v_refs text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Customer" WHERE "id" = p_customer AND "workspaceId" = p_workspace) THEN RAISE EXCEPTION 'company not found'; END IF;
  SELECT "displayName" INTO v_name FROM "Customer" WHERE "id" = p_customer;
  SELECT COALESCE(array_agg(DISTINCT lower(e)), '{}') INTO v_emails FROM (
    SELECT "email" AS e FROM "Contact" WHERE "customerId" = p_customer AND "email" IS NOT NULL
    UNION SELECT "email" FROM "Invitation" WHERE "customerId" = p_customer
    UNION SELECT u."email" FROM "ClientMembership" m JOIN "user" u ON u."id" = m."userId" WHERE m."customerId" = p_customer) x;
  SELECT COALESCE(array_agg(r), '{}') INTO v_refs FROM (
    SELECT "reference" AS r FROM "Customer" WHERE "id" = p_customer
    UNION SELECT "reference" FROM "Ticket" WHERE "customerId" = p_customer
    UNION SELECT "reference" FROM "Contract" WHERE "customerId" = p_customer
    UNION SELECT "reference" FROM "Proposal" WHERE "customerId" = p_customer
    UNION SELECT "reference" FROM "Project" WHERE "customerId" = p_customer) y;
  SELECT COALESCE(array_agg("id"), '{}') INTO v_projects FROM "Project" WHERE "customerId" = p_customer AND "workspaceId" = p_workspace;
  SELECT COALESCE(array_agg("id"), '{}') INTO v_contracts FROM "Contract" WHERE "customerId" = p_customer AND "workspaceId" = p_workspace;
  SELECT COALESCE(array_agg("id"), '{}') INTO v_proposals FROM "Proposal" WHERE "customerId" = p_customer AND "workspaceId" = p_workspace;
  SELECT COALESCE(array_agg("id"), '{}') INTO v_signing FROM "SigningRequest" WHERE "contractId" = ANY (v_contracts);
  SELECT COALESCE(array_agg("id"), '{}') INTO v_versions FROM "ProposalVersion" WHERE "proposalId" = ANY (v_proposals);

  DELETE FROM "Receipt" WHERE "customerId" = p_customer;
  DELETE FROM "BillingIntent" WHERE "customerId" = p_customer;
  DELETE FROM "Attachment" WHERE "customerId" = p_customer;
  DELETE FROM "CompanyLogo" WHERE "customerId" = p_customer;
  DELETE FROM "Ticket" WHERE "customerId" = p_customer AND "workspaceId" = p_workspace;
  DELETE FROM "AccessRequest" WHERE "customerId" = p_customer;
  DELETE FROM "Note" WHERE ("customerId" = p_customer OR "projectId" = ANY (v_projects)) AND "workspaceId" = p_workspace;
  DELETE FROM "CalendarEvent" WHERE ("customerId" = p_customer OR "projectId" = ANY (v_projects)) AND "workspaceId" = p_workspace;
  DELETE FROM "Task" WHERE ("customerId" = p_customer OR "projectId" = ANY (v_projects)) AND "workspaceId" = p_workspace;
  DELETE FROM "ProjectUpdate" WHERE "projectId" = ANY (v_projects);
  DELETE FROM "AssetRequest" WHERE "projectId" = ANY (v_projects);
  DELETE FROM "Project" WHERE "id" = ANY (v_projects);
  DELETE FROM "BillingIntent" WHERE "contractId" = ANY (v_contracts);
  DELETE FROM "ContractDocument" WHERE "contractId" = ANY (v_contracts);
  DELETE FROM "SignatureRecord" WHERE "signingRequestId" = ANY (v_signing);
  DELETE FROM "ScopedLinkToken" WHERE "entityId" = ANY (v_signing || v_proposals || v_versions);
  DELETE FROM "SigningRequest" WHERE "id" = ANY (v_signing);
  DELETE FROM "Contract" WHERE "id" = ANY (v_contracts);
  DELETE FROM "ProposalAcceptance" WHERE "versionId" = ANY (v_versions);
  DELETE FROM "ProposalLine" WHERE "versionId" = ANY (v_versions);
  DELETE FROM "ProposalVersion" WHERE "id" = ANY (v_versions);
  DELETE FROM "Proposal" WHERE "id" = ANY (v_proposals);
  DELETE FROM "Opportunity" WHERE "customerId" = p_customer AND "workspaceId" = p_workspace;
  DELETE FROM "Invitation" WHERE "customerId" = p_customer;
  DELETE FROM "ClientMembership" WHERE "customerId" = p_customer;
  DELETE FROM "Contact" WHERE "customerId" = p_customer AND "workspaceId" = p_workspace;
  DELETE FROM "Customer" WHERE "id" = p_customer;
  -- Emails still waiting or already sent to or about this company, so nothing goes out after the deletion and no copy of their details is left in the queue.
  DELETE FROM "Outbox" WHERE "workspaceId" = p_workspace AND (
    lower(payload->>'to') = ANY (v_emails) OR lower(payload->>'replyTo') = ANY (v_emails)
    OR (v_name IS NOT NULL AND v_name <> '' AND payload::text LIKE '%"' || replace(replace(v_name, '\\', '\\\\'), '"', '\\"') || '"%')
    OR EXISTS (SELECT 1 FROM unnest(v_refs) r WHERE payload::text LIKE '%"' || r || '"%'));
  -- The company's own activity history goes too. (Records of what the team did elsewhere, and Stripe events, stay.)
  DELETE FROM "AuditEvent" WHERE "customerId" = p_customer;
END $$;


REVOKE ALL ON FUNCTION oss_erase_company(uuid, uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN GRANT EXECUTE ON FUNCTION oss_erase_company(uuid, uuid) TO oss_app; END IF;
END $$;
