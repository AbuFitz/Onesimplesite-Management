-- Deleting a company has to remove signed agreements, acceptances and signature records, which are protected from the app by
-- append-only triggers and by the app role having no DELETE right on them. Instead of loosening that for everyone, one function
-- (running as the table owner, callable by the app) does the whole erasure in one go. The app role still cannot delete these rows any other way.

CREATE OR REPLACE FUNCTION oss_append_only_erasable() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  -- Only code that is NOT running as the app role directly (that is, the erasure function below, which runs as the owner) may delete.
  IF TG_OP = 'DELETE' AND current_user <> 'oss_app' THEN RETURN OLD; END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '23000';
END $$;

DROP TRIGGER IF EXISTS contract_document_append_only ON "ContractDocument";
CREATE TRIGGER contract_document_append_only BEFORE DELETE OR UPDATE ON "ContractDocument" FOR EACH ROW EXECUTE FUNCTION oss_append_only_erasable();
DROP TRIGGER IF EXISTS acceptance_append_only ON "ProposalAcceptance";
CREATE TRIGGER acceptance_append_only BEFORE DELETE OR UPDATE ON "ProposalAcceptance" FOR EACH ROW EXECUTE FUNCTION oss_append_only_erasable();
DROP TRIGGER IF EXISTS signature_append_only ON "SignatureRecord";
CREATE TRIGGER signature_append_only BEFORE DELETE OR UPDATE ON "SignatureRecord" FOR EACH ROW EXECUTE FUNCTION oss_append_only_erasable();

CREATE OR REPLACE FUNCTION oss_proposal_line_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $$
DECLARE sent timestamptz;
BEGIN
  IF TG_OP = 'DELETE' AND current_user <> 'oss_app' THEN RETURN OLD; END IF;
  SELECT "sentAt" INTO sent FROM "ProposalVersion" WHERE "id" = COALESCE(OLD."versionId", NEW."versionId");
  IF sent IS NOT NULL THEN RAISE EXCEPTION 'lines of a sent proposal version are immutable' USING ERRCODE = '23000'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION oss_erase_company(p_workspace uuid, p_customer uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_projects uuid[]; v_contracts uuid[]; v_proposals uuid[]; v_signing uuid[]; v_versions uuid[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Customer" WHERE "id" = p_customer AND "workspaceId" = p_workspace) THEN RAISE EXCEPTION 'company not found'; END IF;
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
END $$;

REVOKE ALL ON FUNCTION oss_erase_company(uuid, uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'oss_app') THEN GRANT EXECUTE ON FUNCTION oss_erase_company(uuid, uuid) TO oss_app; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON FUNCTION oss_erase_company(uuid, uuid) FROM anon; END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON FUNCTION oss_erase_company(uuid, uuid) FROM authenticated; END IF;
END $$;
